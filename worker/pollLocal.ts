// worker/pollLocal.ts
import "dotenv/config";
import { pollInboxDelta } from "@/lib/delta";
import { appendFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const LOG_DIR = process.env.LOG_DIR || './logs';
const LOG_FILE = process.env.LOG_FILE || 'poll.log';
const LOG_PATH = join(LOG_DIR, LOG_FILE);

function logLine(data: unknown) {
  try {
    mkdirSync(LOG_DIR, { recursive: true });
    const line = JSON.stringify({ t: new Date().toISOString(), ...((typeof data === 'object' && data) ? (data as object) : { msg: String(data) }) });
    appendFileSync(LOG_PATH, line + '\n');
  } catch (e) {
    console.error('[logger]', e);
  }
}

async function main() {
  console.log("[local poll] starting...");
  logLine({ event: 'poll:start' });
  await pollInboxDelta();
  logLine({ event: 'poll:done' });
  console.log("[local poll] finished at", new Date().toISOString());
}

main();

// Run repeatedly on an interval (e.g., every minute)
setInterval(async () => {
  try {
    console.log("[local poll] starting...");
    await pollInboxDelta();
    console.log("[local poll] finished at", new Date().toISOString());
  } catch (err) {
    logLine({ event: 'poll:error', error: (err as Error).message });
    console.error("[local poll] error:", err);
  }
}, 60_000);