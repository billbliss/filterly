// worker/auditMisfiled.ts
import "dotenv/config";

import { appendFileSync, mkdirSync } from "fs";
import { join } from "path";

import { resolveMailboxContext } from "@/lib/mailbox";
import { auditMisfiledMessages } from "@/lib/misfiledAudit";
import { getAccessToken } from "@/lib/msal";

const LOG_DIR = process.env.LOG_DIR || "./logs";
const LOG_FILE = process.env.MISFILED_LOG_FILE || "misfiled.jsonl";
const LOG_PATH = join(LOG_DIR, LOG_FILE);

function logLine(entry: unknown) {
  try {
    mkdirSync(LOG_DIR, { recursive: true });
    const line = JSON.stringify({
      t: new Date().toISOString(),
      ...(typeof entry === "object" && entry
        ? (entry as object)
        : { msg: entry }),
    });
    appendFileSync(LOG_PATH, `${line}\n`);
  } catch (err) {
    console.error("[misfiled:log:error]", err);
  }
}

function parseMaxPerFolder(): number | undefined {
  const raw = process.env.MISFILED_MAX_PER_FOLDER;
  if (!raw) return undefined;
  const parsed = Number.parseInt(raw, 10);
  return Number.isNaN(parsed) || parsed <= 0 ? undefined : parsed;
}

async function main() {
  console.log("[misfiled] starting audit...");
  logLine({ event: "misfiled:start" });

  const accessToken = await getAccessToken();
  const { root, mailboxAddresses } = resolveMailboxContext(accessToken);

  const summaries = await auditMisfiledMessages({
    root,
    mailboxAddresses,
    maxMessagesPerFolder: parseMaxPerFolder(),
    includeClassification: process.env.MISFILED_INCLUDE_CLASSIFICATION !== "0",
    log: logLine,
  });

  const totalMisfiled = summaries.reduce(
    (acc, summary) => acc + summary.total,
    0,
  );
  summaries.forEach((summary) => {
    const expectedBreakdown = Object.entries(summary.expectedBuckets)
      .map(([name, count]) => `${name}=${count}`)
      .join(", ");
    console.log(
      `[misfiled] ${summary.folderPath}: total=${summary.total}${
        expectedBreakdown ? ` (${expectedBreakdown})` : ""
      }`,
    );
  });

  logLine({
    event: "misfiled:done",
    folders: summaries.length,
    total: totalMisfiled,
  });
  console.log(
    `[misfiled] finished. folders=${summaries.length} misfiled=${totalMisfiled}`,
  );
}

main().catch((err) => {
  logLine({
    event: "misfiled:fatal",
    error: err instanceof Error ? err.message : String(err),
  });
  console.error("[misfiled] audit failed:", err);
  process.exit(1);
});
