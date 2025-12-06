# Filterly

Filterly is a personal email triage tool that classifies Outlook/Exchange messages using hand-tuned rules, applies category tags, and (optionally) moves mail into curated folders. The codebase combines a Next.js admin UI with worker scripts that call Microsoft Graph on a schedule or via delta notifications.

## Highlights

- **Rules-based classifier**: See `classification/` for rulesets covering finance, travel, marketing, political, phishing, etc. Each ruleset maps to a simplified folder taxonomy defined in `classification/folderMap.ts`.
- **Per-ruleset move policy**: Only rulesets that set `moveEnabled: true` (for example, PoliticalSolicitation) are eligible for automatic folder moves. The global safety switch `MOVE_ENABLED=true` must be present in the environment for moves to execute; otherwise the workers stay read-only.
- **Graph workers**:
  - `worker/pollLocal.ts` streams Inbox deltas and drives classification + auto-move for new mail.
  - `worker/retroClassify.ts` (invoked via `npm run retro`) sweeps historical Inbox messages with the latest logic.
  - `worker/auditMisfiled.ts` records misclassified mail for manual review (`logs/misfiled.jsonl`).
- **Category + folder utilities**: `lib/messageCategories.ts` manages Outlook categories, and `lib/mailFolders.ts` handles folder lookup/move operations.

## Getting Started

1. Install dependencies: `npm install`.
2. Set up environment variables (`.env.local`) for Microsoft Graph: client ID, tenant, secret, etc. See `lib/msal.ts`.
3. Run the Next.js app for UI/debugging: `npm run dev`.
4. Start the delta poller locally: `npm run dev:poll`.

## Useful Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Next.js dev server for UI endpoints. |
| `npm run dev:poll` | Watches `worker/pollLocal.ts` to process new mail via delta changes. |
| `npm run audit:misfiled` | Outputs misfiled message stats to JSONL for tuning rules. |
| `npm run retro -- --days 7 --dry-run` | Retroactively classify/move messages from last 7 days (see `docs/retro.md`). |
| `npm run lint` | ESLint across the repo. |

## Logs & Docs

- JSONL logs (classification, retro, misfiled) live in `./logs/`.
- `docs/poller.md` describes the Raspberry Pi systemd timer that calls the hosted poll endpoint.
- `docs/retro.md` covers the “run now” CLI for reprocessing existing mail.

## Folder Structure (abridged)

```
classification/        Rule engine, rulesets, folder map
lib/                   Graph helpers, classifiers, move logic
worker/                Poller, retro, audit scripts
app/                   Next.js API routes / UI
docs/                  Operational docs (poller, retro)
logs/                  JSONL logs from workers
```

## Contributing / Tuning

1. Update rulesets in `classification/rulesets/` or policy in `classification/movePolicy.ts`.
2. Use `npm run audit:misfiled` to gather real inbox samples.
3. Adjust thresholds/domains/phrases, rerun `npm run lint`, and optionally `npm run retro` to reapply changes.

Feel free to open issues or TODOs in docs to track future tweaks (e.g., new phishing heuristics or folder mappings).
