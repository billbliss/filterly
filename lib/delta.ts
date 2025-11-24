import { appendFileSync, mkdirSync } from "fs";
import { join } from "path";

import { classify } from "@/classification/classify";
import { extractMessageFeatures } from "@/classification/fromGraph";
import { shouldMoveFromInbox } from "@/classification/movePolicy";

import { loadDeltaState, saveDeltaState } from "./devDeltaStore";
import { graphClient } from "./graph";
import { fetchMessageDetails } from "./graphMessages";
import { kvGet, kvSet } from "./kv";
import { resolveMailboxContext } from "./mailbox";
import { moveMessageToFolder } from "./mailFolders";
import { applyCategoriesToMessage } from "./messageCategories";
import { getAccessToken } from "./msal";

// --- simple JSONL logger for classification inspection ---
const LOG_DIR = process.env.LOG_DIR || "./logs";
const LOG_FILE = process.env.LOG_MESSAGES_FILE || "messages.jsonl";
const LOG_PATH = join(LOG_DIR, LOG_FILE);

function logLine(record: unknown) {
  try {
    mkdirSync(LOG_DIR, { recursive: true });
    const line = JSON.stringify({
      t: new Date().toISOString(),
      ...(typeof record === "object" && record
        ? (record as object)
        : { msg: String(record) }),
    });
    appendFileSync(LOG_PATH, `${line}\n`);
  } catch (e) {
    // fall back silently; still console.log below
  }
}

// Base key for delta state
const DELTA_KEY = "graph:inbox:deltaState";
type DeltaState = { nextLink?: string; deltaLink?: string };
export async function pollInboxDelta() {
  // Decide mailbox root based on token type
  const accessToken = await getAccessToken();
  const { appOnly, resolvedUpn, root, mailboxAddresses } =
    resolveMailboxContext(accessToken);

  const client = await graphClient();

  // Use different delta checkpoints for app-only vs delegated (and per UPN)
  const stateKey = appOnly
    ? `${DELTA_KEY}:users:${resolvedUpn ?? "unknown"}`
    : `${DELTA_KEY}:me`;
  let state: DeltaState = {};
  if (process.env.NODE_ENV === "production") {
    state = (await kvGet<DeltaState>(stateKey)) || {};
  } else {
    state = loadDeltaState(stateKey) || {};
  }

  console.log(
    "[delta:load]",
    stateKey,
    state?.deltaLink ? "delta=✔" : "delta=∅",
    state?.nextLink ? "next=✔" : "next=∅",
  );

  logLine({ event: "delta:start", appOnly, root, state });
  let processed = 0;

  const TIME_BUDGET_MS = process.env.FAST_BASELINE === "1" ? 60000 : 20000;
  const begin = Date.now();

  const PAGE_TOP = 500; // larger page size to accelerate baseline
  const startUrl = `${root}/mailFolders('Inbox')/messages/delta?$select=id,receivedDateTime,subject,from,internetMessageId,inferenceClassification,categories,conversationId,parentFolderId&$top=${PAGE_TOP}`;
  let url = state.nextLink || state.deltaLink || startUrl;
  console.log(
    "[delta:init]",
    url.startsWith("http") ? `${url.slice(0, 120)}…` : url,
  );

  let pageGuard = 0;
  while (url) {
    const res = await client.api(url).get();

    if (Array.isArray(res.value) && res.value.length) {
      for (const m of res.value) {
        if (m["@removed"]) {
          logLine({
            event: "message:removed",
            id: m.id,
            reason: m["@removed"]?.reason,
          });
        } else if (m.id) {
          const rec = {
            event: "message",
            id: m.id,
            receivedDateTime: m.receivedDateTime,
            subject: m.subject,
            from: m.from,
            internetMessageId: m.internetMessageId,
            inferenceClassification: m.inferenceClassification,
            categories: m.categories,
            conversationId: m.conversationId,
            parentFolderId: m.parentFolderId,
          };
          try {
            const full = await fetchMessageDetails(client, root, m.id);
            const features = extractMessageFeatures(full, {
              mailboxAddresses,
            });
            const classification = classify(features);
            const top = classification.results[0];
            const primaryResult = classification.results.find(
              (r) => r.label === classification.primaryLabel,
            );
            const primaryConfidence = primaryResult?.confidence ?? 0;
            const primaryMoveEnabled = primaryResult?.moveEnabled ?? false;
            const enriched = {
              ...rec,
              classification: {
                primaryLabel: classification.primaryLabel,
                primaryFolder: classification.primaryFolder,
                results: classification.results,
              },
            };
            console.log(JSON.stringify(enriched));
            logLine(enriched);
            console.log(
              "[classify]",
              JSON.stringify({
                id: m.id,
                subject: rec.subject,
                primary: classification.primaryLabel,
                confidence: primaryConfidence || top?.confidence || 0,
                folder: classification.primaryFolder,
              }),
            );
            try {
              const categoryResult = await applyCategoriesToMessage(
                client,
                root,
                m.id,
                Array.isArray(full.categories)
                  ? (full.categories as string[])
                  : (m.categories as string[] | undefined),
                classification,
              );
              if (
                categoryResult?.changed ||
                categoryResult?.applied === false
              ) {
                logLine({
                  event: "classify:categories",
                  id: m.id,
                  categories: categoryResult.categories,
                  previous: categoryResult.previous,
                  applied: categoryResult.applied,
                });
                console.log(
                  "[classify:categories]",
                  JSON.stringify({
                    id: m.id,
                    categories: categoryResult.categories,
                    previous: categoryResult.previous,
                    applied: categoryResult.applied,
                  }),
                );
              }
            } catch (catErr) {
              const categoryError =
                catErr instanceof Error ? catErr.message : String(catErr);
              logLine({
                event: "classify:categories:error",
                id: m.id,
                error: categoryError,
              });
              console.error("[classify:categories:error]", m.id, categoryError);
            }
            if (
              classification.primaryFolder &&
              shouldMoveFromInbox({
                primaryLabel: classification.primaryLabel,
                confidence: primaryConfidence,
                moveEnabled: primaryMoveEnabled,
              })
            ) {
              try {
                const moveResult = await moveMessageToFolder(
                  client,
                  root,
                  m.id,
                  full.parentFolderId,
                  classification.primaryFolder,
                );
                if (
                  moveResult.action !== "already" &&
                  moveResult.action !== "no-target"
                ) {
                  logLine({
                    event: "classify:move",
                    id: m.id,
                    subject: m.subject,
                    action: moveResult.action,
                    targetFolder: moveResult.targetFolderName,
                    targetFolderId: moveResult.targetFolderId,
                    policyMoveEnabled: primaryMoveEnabled,
                  });
                  console.log(
                    "[classify:move]",
                    JSON.stringify({
                      id: m.id,
                      action: moveResult.action,
                      targetFolder: moveResult.targetFolderName,
                      policyMoveEnabled: primaryMoveEnabled,
                    }),
                  );
                }
              } catch (moveErr) {
                const moveError =
                  moveErr instanceof Error ? moveErr.message : String(moveErr);
                logLine({
                  event: "classify:move:error",
                  id: m.id,
                  error: moveError,
                });
                console.error("[classify:move:error]", m.id, moveError);
              }
            } else {
              logLine({
                event: "classify:move:skipped",
                id: m.id,
                subject: m.subject,
                reason: "policy",
                primaryLabel: classification.primaryLabel,
                confidence: primaryConfidence,
                policyMoveEnabled: primaryMoveEnabled,
              });
            }
          } catch (err) {
            const errorMessage =
              err instanceof Error ? err.message : String(err);
            console.error("[classify:error]", m.id, errorMessage);
            logLine({
              event: "classify:error",
              id: m.id,
              subject: m.subject,
              error: errorMessage,
            });
          } finally {
            processed++;
          }
        }
      }
    }

    if (res["@odata.nextLink"]) {
      // Save nextLink for continuation
      url = res["@odata.nextLink"];
      state = { nextLink: url };
      if (process.env.NODE_ENV === "production") {
        await kvSet(stateKey, state);
      } else {
        saveDeltaState(stateKey, state);
      }
      console.log("[delta:save]", stateKey, `next=${url.slice(0, 100)}…`);

      // Optional time budget guard: yield and exit if over budget
      if (Date.now() - begin > TIME_BUDGET_MS) {
        console.log(
          "[delta:yield] time budget used; saved nextLink and exiting",
        );
        break;
      }

      // eslint-disable-next-line no-continue
      continue;
    } else if (res["@odata.deltaLink"]) {
      // Completed paging — save deltaLink
      state = { deltaLink: res["@odata.deltaLink"] };
      if (process.env.NODE_ENV === "production") {
        await kvSet(stateKey, state);
      } else {
        saveDeltaState(stateKey, state);
      }
      console.log("[delta:complete] saved deltaLink");
      break;
    } else {
      url = undefined as any;
    }

    if (++pageGuard > 10) break;
  }

  logLine({ event: "delta:done", appOnly, state });

  return {
    count: processed,
    since: state?.deltaLink || state?.nextLink || null,
    until: new Date().toISOString(),
    mailbox: appOnly ? (resolvedUpn ?? null) : resolvedUpn || "me",
  };
}
