// lib/misfiledAudit.ts
import { classify } from "@/classification/classify";
import { extractMessageFeatures } from "@/classification/fromGraph";

import { graphClient } from "./graph";
import { fetchMessageDetails } from "./graphMessages";

interface MailFolder {
  id?: string;
  displayName?: string;
  childFolderCount?: number;
  totalItemCount?: number;
  unreadItemCount?: number;
  parentFolderId?: string;
}

const CATEGORY_PREFIX = process.env.CATEGORY_PREFIX || "Filterly";
const FOLDER_TAG_PREFIX = `${CATEGORY_PREFIX}:Folder:`;

type LogFn = (entry: unknown) => void;

function formatSender(raw: unknown): string | null {
  if (!raw || typeof raw !== "object") return null;
  const { emailAddress } = raw as {
    emailAddress?: { name?: string | null; address?: string | null };
  };
  if (!emailAddress || typeof emailAddress !== "object") return null;
  const { name, address } = emailAddress;
  if (name && address) return `${name} <${address}>`;
  if (address) return address;
  if (name) return name;
  return null;
}

function normalizeFolderName(input: string | undefined | null) {
  return input?.trim().toLowerCase() ?? "";
}

function ensureArray(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return input
    .filter((value): value is string => typeof value === "string" && !!value)
    .map((value) => value.trim())
    .filter(Boolean);
}

function extractExpectedFolder(categories: string[]): string | null {
  const match = categories.find((cat) =>
    cat.toLowerCase().startsWith(FOLDER_TAG_PREFIX.toLowerCase()),
  );
  if (!match) return null;
  return match.slice(FOLDER_TAG_PREFIX.length).trim() || null;
}

async function listInboxHierarchy(
  client: Awaited<ReturnType<typeof graphClient>>,
  root: string,
) {
  const inbox = (await client
    .api(`${root}/mailFolders('Inbox')`)
    .select("id,displayName,childFolderCount")
    .get()) as MailFolder;

  if (!inbox?.id) throw new Error("Failed to resolve Inbox folder id");

  type FolderInfo = {
    id: string;
    displayName: string;
    path: string[];
    parentId: string;
    totalItemCount?: number;
    unreadItemCount?: number;
  };

  const folders = new Map<string, FolderInfo>();
  const queue: Array<{ id: string; path: string[] }> = [
    { id: inbox.id, path: [] },
  ];

  while (queue.length) {
    const current = queue.shift()!;
    const encodedId = encodeURIComponent(current.id);
    let url = `${root}/mailFolders/${encodedId}/childFolders?$select=id,displayName,childFolderCount,totalItemCount,unreadItemCount`;
    do {
      const res = await client.api(url).get();
      const values = Array.isArray(res?.value)
        ? (res.value as MailFolder[])
        : [];
      values.forEach((child) => {
        if (!child?.id || !child?.displayName) return;
        const info: FolderInfo = {
          id: child.id,
          displayName: child.displayName,
          path: [...current.path, child.displayName],
          parentId: current.id,
          totalItemCount: child.totalItemCount,
          unreadItemCount: child.unreadItemCount,
        };
        folders.set(child.id, info);
        if ((child.childFolderCount ?? 0) > 0) {
          queue.push({ id: child.id, path: info.path });
        }
      });
      url =
        typeof res?.["@odata.nextLink"] === "string"
          ? res["@odata.nextLink"]
          : "";
    } while (url);
  }

  return { inboxId: inbox.id, folders };
}

async function collectMessagesForFolder(
  client: Awaited<ReturnType<typeof graphClient>>,
  root: string,
  folderId: string,
  topLimit: number | undefined,
) {
  const encodedId = encodeURIComponent(folderId);
  const messages: Array<Record<string, unknown>> = [];
  const remainingCap =
    typeof topLimit === "number" && topLimit > 0 ? topLimit : null;
  if (remainingCap !== null && remainingCap <= 0) return messages;
  let remaining = remainingCap;
  const pageSize =
    remainingCap !== null && remainingCap < 50 ? remainingCap : 50;
  let url = `${root}/mailFolders/${encodedId}/messages?$select=id,subject,from,receivedDateTime,categories,parentFolderId&$orderby=receivedDateTime desc&$top=${pageSize}`;

  while (url) {
    const res = await client.api(url).get();
    const batch = Array.isArray(res?.value)
      ? (res.value as Array<Record<string, unknown>>)
      : [];
    for (const item of batch) {
      if (remaining !== null && remaining <= 0) break;
      messages.push(item);
      if (remaining !== null) remaining -= 1;
    }

    if (remaining !== null && remaining <= 0) break;
    if (!res?.["@odata.nextLink"]) break;
    url = res["@odata.nextLink"] as string;
  }

  return messages;
}

export interface MisfiledMessageRecord {
  id: string;
  subject?: string;
  sender?: string;
  receivedDateTime?: string;
  expectedFolder: string;
  actualFolder: string;
  folderPath: string;
  categories: string[];
  classification?: ReturnType<typeof classify>;
}

export interface MisfiledFolderGroup {
  folderPath: string;
  folderName: string;
  total: number;
  expectedBuckets: Record<string, number>;
  messages: MisfiledMessageRecord[];
}

export interface AuditMisfiledOptions {
  root: string;
  mailboxAddresses?: string[];
  log?: LogFn;
  maxMessagesPerFolder?: number;
  includeClassification?: boolean;
}

export async function auditMisfiledMessages(options: AuditMisfiledOptions) {
  const {
    root,
    mailboxAddresses = [],
    log = () => {},
    maxMessagesPerFolder,
    includeClassification = true,
  } = options;

  const client = await graphClient();
  const { folders } = await listInboxHierarchy(client, root);

  const groups = new Map<string, MisfiledFolderGroup>();

  for (const folder of folders.values()) {
    const messages = await collectMessagesForFolder(
      client,
      root,
      folder.id,
      maxMessagesPerFolder,
    );

    const folderPath = ["Inbox", ...folder.path].join("/");
    const folderBucket = groups.get(folderPath) ?? {
      folderPath,
      folderName: folder.path[folder.path.length - 1] ?? folder.displayName,
      total: 0,
      expectedBuckets: {},
      messages: [],
    };

    const actualNormalized = normalizeFolderName(folder.displayName);

    for (const message of messages) {
      const id = typeof message.id === "string" ? message.id : null;
      const categories = ensureArray(message.categories);
      const expectedFolder = extractExpectedFolder(categories);
      const expectedNormalized = expectedFolder
        ? normalizeFolderName(expectedFolder)
        : "";
      const parentId =
        typeof message.parentFolderId === "string"
          ? message.parentFolderId
          : null;
      const shouldInclude =
        Boolean(id) &&
        Boolean(expectedFolder) &&
        Boolean(expectedNormalized) &&
        expectedNormalized !== actualNormalized &&
        (!parentId || parentId === folder.id);

      if (shouldInclude && id && expectedFolder && expectedNormalized) {
        let classification: MisfiledMessageRecord["classification"];
        if (includeClassification) {
          try {
            const full = await fetchMessageDetails(client, root, id);
            const features = extractMessageFeatures(full, {
              mailboxAddresses,
            });
            classification = classify(features);
          } catch (err) {
            log({
              event: "misfiled:error",
              id,
              error: err instanceof Error ? err.message : String(err),
            });
          }
        }

        const sender =
          formatSender(message.from) ??
          formatSender((message as Record<string, unknown>)?.sender) ??
          undefined;

        const record: MisfiledMessageRecord = {
          id,
          subject:
            typeof message.subject === "string" ? message.subject : undefined,
          sender,
          receivedDateTime:
            typeof message.receivedDateTime === "string"
              ? message.receivedDateTime
              : undefined,
          expectedFolder,
          actualFolder: folder.displayName,
          folderPath,
          categories,
          classification,
        };

        folderBucket.total += 1;
        folderBucket.expectedBuckets[expectedFolder] =
          (folderBucket.expectedBuckets[expectedFolder] ?? 0) + 1;
        folderBucket.messages.push(record);
        log({ event: "misfiled:message", ...record });
      }
    }

    if (folderBucket.messages.length) {
      groups.set(folderPath, folderBucket);
    }
  }

  const summaries = Array.from(groups.values());
  summaries.forEach((summary) => {
    log({
      event: "misfiled:folderSummary",
      folderPath: summary.folderPath,
      total: summary.total,
      expectedBuckets: summary.expectedBuckets,
    });
  });

  return summaries;
}
