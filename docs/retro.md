## Retro Classification Sweep

Use the retro worker when you want to re-run the latest classification/move logic over existing Inbox mail instead of waiting for new delta notifications.

### Command

```bash
npm run retro -- --days 7 --dry-run --log-file logs/retro-latest.jsonl
```

- `--days 7` reprocesses messages received in the last seven days. Swap for `--since 2025-11-01T00:00:00Z` if you prefer an absolute ISO timestamp.
- `--dry-run` keeps the run read-only (classifies and logs, but skips folder moves/category writes). Remove it when ready to apply changes.
- `--log-file` saves JSONL output; omit if you only want console logs.
- Additional flags (see `worker/retroClassify.ts`): `--page-size`, `--max-pages`, `--overwrite` (replace existing Filterly categories), `--verbose` for per-message stdout logging.

### Notes

- The script walks the Inbox hierarchy (Inbox + all child folders) just like the live poller.
- Graph access uses the same MSAL device-code flow; sign in when prompted.
- For production-style runs, drop `--dry-run` and optionally set `--log-file logs/retro-$(date +%Y-%m-%d).jsonl`.
