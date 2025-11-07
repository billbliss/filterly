// lib/processMessages.ts
import { classify } from "@/classification/classify";
import { extractMessageFeatures } from "@/classification/fromGraph";
import { shouldMoveFromInbox } from "@/classification/movePolicy";

import { graphClient } from "./graph";
import { fetchMessageDetails } from "./graphMessages";
import { isMoveEnabled, moveMessageToFolder } from "./mailFolders";
import { applyCategoriesToMessage } from "./messageCategories";

type RetroOptions = {
  root: string;
  sinceIso?: string;
  days?: number;
  pageSize?: number;
  dryRun?: boolean;
  overwriteFilterly?: boolean;
  mailboxAddresses?: string[];
  log?: (entry: unknown) => void;
  maxPages?: number;
};

function resolveSince({ sinceIso, days }: RetroOptions) {
  if (sinceIso) return sinceIso;
  if (typeof days === "number") {
    const ms = Date.now() - days * 24 * 60 * 60 * 1000;
    return new Date(ms).toISOString();
  }
  return undefined;
}

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

export async function processMessagesInRange(options: RetroOptions) {
  const {
    root,
    pageSize = 50,
    dryRun = false,
    overwriteFilterly = false,
    mailboxAddresses = [],
    log = () => {},
    maxPages = 500,
  } = options;

  const since = resolveSince(options);
  const client = await graphClient();

  let url = `${root}/mailFolders('Inbox')/messages?$select=id,receivedDateTime,subject,from,categories,parentFolderId&$orderby=receivedDateTime desc&$top=${pageSize}`;
  if (since) {
    url += `&$filter=receivedDateTime ge ${since}`;
  }

  let fetched = 0;
  let changed = 0;
  let unchanged = 0;
  let page = 0;

  while (url) {
    const res = await client.api(url).get();
    const messages = Array.isArray(res.value) ? res.value : [];

    for (const summary of messages) {
      fetched += 1;
      if (summary.id) {
        try {
          const full = await fetchMessageDetails(client, root, summary.id);
          const features = extractMessageFeatures(full, { mailboxAddresses });
          const result = classify(features);
          const subject =
            (typeof full.subject === "string" && full.subject) ||
            (typeof summary.subject === "string" ? summary.subject : undefined);
          const sender =
            formatSender(full.from) ?? formatSender(summary.from) ?? undefined;
          const safeSubject =
            subject && subject.trim().length ? subject : "(no subject)";
          const safeSender =
            sender && sender.trim().length ? sender : "(unknown sender)";

          log({
            event: "retro:classify",
            id: summary.id,
            subject: safeSubject,
            sender: safeSender,
            primaryLabel: result.primaryLabel,
            primaryFolder: result.primaryFolder,
            receivedDateTime: summary.receivedDateTime,
          });

          let existingCategories: string[] | undefined;
          if (Array.isArray(full.categories)) {
            existingCategories = full.categories as string[];
          } else if (Array.isArray(summary.categories)) {
            existingCategories = summary.categories as string[];
          }

          const categoryOutcome = await applyCategoriesToMessage(
            client,
            root,
            summary.id,
            existingCategories,
            result,
            { overwriteFilterly, dryRun },
          );

          if (categoryOutcome.changed) changed += 1;
          else unchanged += 1;

          if (categoryOutcome.changed) {
            log({
              event: "retro:categories",
              id: summary.id,
              subject: safeSubject,
              sender: safeSender,
              before: categoryOutcome.previous,
              after: categoryOutcome.categories,
              applied: categoryOutcome.applied,
            });
          }

          const primaryConfidence =
            result.results.find((r) => r.label === result.primaryLabel)
              ?.confidence ?? 0;

          if (
            result.primaryFolder &&
            shouldMoveFromInbox({
              primaryLabel: result.primaryLabel,
              confidence: primaryConfidence,
            })
          ) {
            try {
              const moveResult = await moveMessageToFolder(
                client,
                root,
                summary.id,
                (full.parentFolderId as string | undefined) ??
                  (summary.parentFolderId as string | undefined),
                result.primaryFolder,
                { dryRun },
              );
              if (
                moveResult.action !== "already" &&
                moveResult.action !== "no-target"
              ) {
                log({
                  event: "retro:move",
                  id: summary.id,
                  subject: safeSubject,
                  sender: safeSender,
                  action: moveResult.action,
                  targetFolder: moveResult.targetFolderName,
                  targetFolderId: moveResult.targetFolderId,
                  moveEnabled: isMoveEnabled(),
                });
              }
            } catch (moveErr) {
              log({
                event: "retro:move:error",
                id: summary.id,
                subject: safeSubject,
                sender: safeSender,
                error:
                  moveErr instanceof Error ? moveErr.message : String(moveErr),
              });
            }
          } else {
            log({
              event: "retro:move:skipped",
              id: summary.id,
              subject: safeSubject,
              sender: safeSender,
              reason: "policy",
              primaryLabel: result.primaryLabel,
              confidence: primaryConfidence,
            });
          }
        } catch (err) {
          log({
            event: "retro:error",
            id: summary.id,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }
    }

    if (res["@odata.nextLink"]) {
      url = res["@odata.nextLink"];
    } else {
      url = undefined as any;
    }

    page += 1;
    if (page >= maxPages) break;
  }

  return { fetched, changed, unchanged, since, dryRun };
}
