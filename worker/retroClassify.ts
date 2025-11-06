#!/usr/bin/env node
import "dotenv/config";

import { appendFileSync, mkdirSync } from "fs";
import { dirname } from "path";

import { resolveMailboxContext } from "@/lib/mailbox.js";
import { getAccessToken } from "@/lib/msal.js";
import { processMessagesInRange } from "@/lib/processMessages.js";

type CliOptions = {
  days?: number;
  since?: string;
  pageSize?: number;
  dryRun?: boolean;
  overwrite?: boolean;
  maxPages?: number;
  verbose?: boolean;
  logFile?: string;
};

function printHelp() {
  console.log(`Usage: tsx worker/retroClassify.ts [options]

Options:
  --days <n>         Reprocess messages from the last N days
  --since <iso>      Reprocess messages received on/after ISO timestamp
  --page-size <n>    Page size for Graph queries (default 50)
  --max-pages <n>    Safety limit for pagination
  --dry-run          Classify and log without updating categories
  --overwrite        Replace existing Filterly categories
  --verbose          Emit per-message logs to stdout
  --log-file <path>  Append JSONL output to a local file
  --help             Show this help
`);
}

function parseArgs(argv: string[]): CliOptions {
  const opts: CliOptions = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    switch (arg) {
      case "--days":
        opts.days = Number(argv[++i]);
        break;
      case "--since":
        opts.since = argv[++i];
        break;
      case "--page-size":
        opts.pageSize = Number(argv[++i]);
        break;
      case "--dry-run":
        opts.dryRun = true;
        break;
      case "--overwrite":
        opts.overwrite = true;
        break;
      case "--max-pages":
        opts.maxPages = Number(argv[++i]);
        break;
      case "--verbose":
        opts.verbose = true;
        break;
      case "--log-file":
        opts.logFile = argv[++i];
        break;
      case "--help":
      case "-h":
        printHelp();
        process.exit(0);
        break;
      default:
        if (arg.startsWith("-")) {
          throw new Error(`Unknown option: ${arg}`);
        }
    }
  }
  return opts;
}

type Logger = (entry: unknown) => void;

function createFileLogger(path?: string): Logger | null {
  if (!path) return null;
  try {
    mkdirSync(dirname(path), { recursive: true });
  } catch {
    // ignore mkdir errors (will surface during write)
  }
  return (entry: unknown) => {
    try {
      appendFileSync(path, `${JSON.stringify(entry)}\n`, "utf8");
    } catch (err) {
      console.error("[retro:log-file:error]", err);
    }
  };
}

function createCombinedLogger(
  verbose: boolean | undefined,
  fileLogger: Logger | null,
): Logger {
  if (verbose || fileLogger) {
    return (entry: unknown) => {
      const serialized = JSON.stringify(entry);
      if (verbose) console.log(serialized);
      if (fileLogger) fileLogger(entry);
    };
  }
  return () => {};
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (!opts.days && !opts.since) {
    console.warn(
      "[retro] No --days or --since provided; defaulting to --days 7",
    );
    opts.days = 7;
  }

  const accessToken = await getAccessToken();
  const { root, mailboxAddresses } = resolveMailboxContext(accessToken);

  const started = Date.now();
  const fileLogger = createFileLogger(opts.logFile);
  const combinedLogger = createCombinedLogger(opts.verbose, fileLogger);
  const summary = await processMessagesInRange({
    root,
    days: opts.days,
    sinceIso: opts.since,
    pageSize: opts.pageSize,
    dryRun: opts.dryRun,
    overwriteFilterly: opts.overwrite,
    mailboxAddresses,
    maxPages: opts.maxPages,
    log: combinedLogger,
  });

  const durationMs = Date.now() - started;
  const summaryEntry = {
    event: "retro:summary",
    ...summary,
    durationMs,
    overwriteFilterly: opts.overwrite ?? false,
  };
  if (opts.verbose) console.log(JSON.stringify(summaryEntry));
  if (fileLogger) fileLogger(summaryEntry);
}

main().catch((err) => {
  console.error("[retro:error]", err);
  process.exit(1);
});
