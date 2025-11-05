import { appendFileSync, mkdirSync } from "fs";
import { join } from "path";

import { loadDeltaState, saveDeltaState } from "./devDeltaStore";
import { graphClient } from "./graph";
import { kvGet, kvSet } from "./kv";
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

function isAppOnlyToken(jwt: string): boolean {
  try {
    const payload = JSON.parse(
      Buffer.from(jwt.split(".")[1], "base64").toString("utf8"),
    );
    return !!payload.roles && !payload.scp;
  } catch {
    return false;
  }
}

function decodeUpnLike(jwt: string): string | null {
  try {
    const payload = JSON.parse(
      Buffer.from(jwt.split(".")[1], "base64").toString("utf8"),
    );
    return (
      payload.upn ||
      payload.preferred_username ||
      payload.unique_name ||
      payload.email ||
      null
    );
  } catch {
    return null;
  }
}

export async function pollInboxDelta() {
  // Decide mailbox root based on token type
  const accessToken = await getAccessToken();
  const appOnly = isAppOnlyToken(accessToken);
  const tokenUpn = decodeUpnLike(accessToken);
  // Allow MAILBOX_UPN to override in all cases; required for app-only
  const resolvedUpn =
    process.env.MAILBOX_UPN || (!appOnly ? tokenUpn || null : null);

  const root = appOnly
    ? (() => {
        const explicit = process.env.MAILBOX_UPN || resolvedUpn;
        if (!explicit)
          throw new Error(
            "MAILBOX_UPN is required for app-only tokens (no user in token); set MAILBOX_UPN to the target mailbox UPN",
          );
        return `/users('${explicit}')`;
      })()
    : `/me`;

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

  logLine({ event: "delta:start", appOnly, root, state });
  let processed = 0;

  let url =
    state.deltaLink ||
    state.nextLink ||
    `${root}/mailFolders('Inbox')/messages/delta?$select=id,receivedDateTime,subject,from,internetMessageId,inferenceClassification,categories,conversationId,parentFolderId`;

  let pageGuard = 0;
  while (url) {
    const res = await client.api(url).get();

    if (Array.isArray(res.value) && res.value.length) {
      for (const m of res.value) {
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
        console.log(JSON.stringify(rec));
        logLine(rec);
        processed++;
      }
    }

    if (res["@odata.nextLink"]) {
      url = res["@odata.nextLink"];
      state.nextLink = url;
      if (process.env.NODE_ENV === "production") {
        await kvSet(stateKey, state);
      } else {
        saveDeltaState(stateKey, state);
      }
    } else if (res["@odata.deltaLink"]) {
      url = undefined as any;
      state = { deltaLink: res["@odata.deltaLink"] };
      if (process.env.NODE_ENV === "production") {
        await kvSet(stateKey, state);
      } else {
        saveDeltaState(stateKey, state);
      }
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
