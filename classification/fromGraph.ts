// classification/fromGraph.ts
import type {
  Attachment,
  FileAttachment,
  InternetMessageHeader,
  Message,
} from "@microsoft/microsoft-graph-types";

import type { MessageFeatures } from "./types";

type GraphMessageForFeatures = Message & {
  internetMessageHeaders?: InternetMessageHeader[] | undefined;
  attachments?: Attachment[] | undefined;
};

const htmlEntityMap: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

function decodeEntities(input: string): string {
  return input.replace(
    /&(#x?[0-9a-f]+|[a-z]+);/gi,
    (_match, entity: string): string => {
      const lower = entity.toLowerCase();
      if (lower[0] === "#") {
        const isHex = lower[1] === "x";
        const codePoint = parseInt(
          isHex ? lower.slice(2) : lower.slice(1),
          isHex ? 16 : 10,
        );
        if (!Number.isNaN(codePoint)) return String.fromCodePoint(codePoint);
        return "";
      }
      return htmlEntityMap[lower] ?? "";
    },
  );
}

function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function htmlToText(html: string): string {
  if (!html) return "";
  const withoutTags = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ");
  return normalizeWhitespace(decodeEntities(withoutTags));
}

function getAddress(
  input?: {
    emailAddress?: { address?: string | null } | null;
  } | null,
): string {
  const addr = input?.emailAddress?.address;
  return addr ? addr.trim() : "";
}

function extractDomain(address: string): string {
  const at = address.lastIndexOf("@");
  return at === -1 ? "" : address.slice(at + 1).toLowerCase();
}

function parseHeaders(
  headers: InternetMessageHeader[] | undefined,
): Record<string, string | undefined> {
  if (!headers?.length) return {};
  return headers.reduce<Record<string, string | undefined>>((acc, h) => {
    if (!h.name) return acc;
    const key = h.name.toLowerCase();
    if (!(key in acc)) acc[key] = h.value ?? "";
    return acc;
  }, {});
}

function parseAuthResults(header?: string) {
  if (!header) return undefined;
  const lower = header.toLowerCase();
  const auth: NonNullable<MessageFeatures["auth"]> = {};

  if (/\bspf=\s*pass\b/.test(lower)) auth.spfPass = true;
  else if (/\bspf=\s*(softfail|fail|neutral|none)\b/.test(lower))
    auth.spfPass = false;

  if (/\bdkim=\s*pass\b/.test(lower)) auth.dkimPass = true;
  else if (/\bdkim=\s*(fail|policy|none)\b/.test(lower)) auth.dkimPass = false;

  if (/\barc=\s*pass\b/.test(lower)) auth.arcPass = true;
  else if (/\barc=\s*(fail|none)\b/.test(lower)) auth.arcPass = false;

  return Object.keys(auth).length ? auth : undefined;
}

function collectAttachmentKinds(
  attachments: Attachment[] | undefined,
): string[] {
  if (!attachments?.length) return [];
  const kinds = attachments.reduce<Set<string>>((acc, att) => {
    const name =
      (att as FileAttachment).name ||
      (att as FileAttachment).contentLocation ||
      "";
    if (typeof name !== "string" || !name) return acc;
    const dot = name.lastIndexOf(".");
    if (dot === -1) return acc;
    const ext = name.slice(dot + 1).toLowerCase();
    if (ext) acc.add(ext);
    return acc;
  }, new Set<string>());
  return Array.from(kinds);
}

function extractLinks(html: string): { text?: string; href?: string }[] {
  if (!html) return [];

  const links: { text?: string; href?: string }[] = [];
  const seen = new Set<string>();

  const anchorRegex = /<a\b[^>]*href=["']([^"']+)["'][^>]*>(.*?)<\/a>/gi;
  let anchorMatch: RegExpExecArray | null = anchorRegex.exec(html);
  while (anchorMatch) {
    const href = anchorMatch[1]?.trim();
    const text = normalizeWhitespace(htmlToText(anchorMatch[2] ?? ""));
    if (href) {
      const key = `a:${href}:${text}`;
      if (!seen.has(key)) {
        seen.add(key);
        links.push({ href, text: text || undefined });
      }
    }
    anchorMatch = anchorRegex.exec(html);
  }

  const urlRegex = /\bhttps?:\/\/[^\s<>"')]+/gi;
  let urlMatch: RegExpExecArray | null = urlRegex.exec(html);
  while (urlMatch) {
    const href = urlMatch[0];
    const key = `u:${href}`;
    if (!seen.has(key)) {
      seen.add(key);
      links.push({ href });
    }
    urlMatch = urlRegex.exec(html);
  }

  return links.slice(0, 100);
}

type ExtractOptions = {
  mailboxAddresses?: string[];
};

export function extractMessageFeatures(
  message: GraphMessageForFeatures,
  options: ExtractOptions = {},
): MessageFeatures {
  const headers = parseHeaders(message.internetMessageHeaders);
  const bodyHtml = message.body?.content ?? "";
  const bodyText = htmlToText(bodyHtml);
  const bodyCombined = bodyText || message.bodyPreview || "";
  const lowerBody = bodyCombined.toLowerCase();

  const authHeader =
    headers["authentication-results"] || headers["arc-authentication-results"];

  const selfAddresses = (options.mailboxAddresses || [])
    .map((addr) => addr?.toLowerCase().trim())
    .filter((addr): addr is string => Boolean(addr));
  const mentionsMailbox = selfAddresses.some((addr) =>
    lowerBody.includes(addr),
  );
  const isReplyChain =
    /\bfrom:\s.+@/i.test(bodyCombined) &&
    (/\bsent:\s/i.test(bodyCombined) || /\bwrote:/i.test(bodyCombined));

  return {
    id: message.id ?? "",
    subject: message.subject ?? "",
    bodySample: bodyCombined.slice(0, 4000),
    from: getAddress(message.from),
    fromDomain: extractDomain(getAddress(message.from)),
    replyTo: getAddress(message.replyTo?.[0]),
    hasListId: Boolean(headers["list-id"]),
    hasUnsubscribe: Boolean(
      headers["list-unsubscribe"] || headers["list-unsubscribe-post"],
    ),
    mentionsMailbox,
    isReplyChain,
    attachmentKinds: collectAttachmentKinds(message.attachments),
    links: extractLinks(bodyHtml),
    headers,
    auth: parseAuthResults(authHeader),
  };
}
