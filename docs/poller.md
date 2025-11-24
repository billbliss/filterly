# Filterly Poller (Pi → Vercel webhook)

## Overview

This Raspberry Pi script periodically triggers the `POST /api/poll` endpoint on the Filterly Vercel app to run `pollInboxDelta()`.
It uses a systemd timer (preferred over cron) to run every 10 minutes.

Need to reprocess existing Inbox mail? See [`retro.md`](./retro.md) for the CLI sweep.

---

## Components

| File                                          | Purpose                                                                     |
| --------------------------------------------- | --------------------------------------------------------------------------- |
| `/usr/local/bin/filterly-poll.sh`             | Shell script that reads the secret token and `curl`s the Vercel endpoint.   |
| `/etc/filterly/cron_token`                    | Root-only file containing the CRON_TOKEN from Vercel environment variables. |
| `/etc/systemd/system/filterly-poller.service` | systemd unit that runs the poll script once.                                |
| `/etc/systemd/system/filterly-poller.timer`   | systemd timer that schedules the service every 10 minutes.                  |

---

## Setup Steps

```bash
# 1. Create token file
sudo mkdir -p /etc/filterly
sudo tee /etc/filterly/cron_token >/dev/null <<'EOF'
YOUR_TOKEN_HERE
EOF
sudo chmod 600 /etc/filterly/cron_token
sudo chown root:root /etc/filterly/cron_token

# 2. Install poller script
sudo install -m 755 filterly-poll.sh /usr/local/bin/filterly-poll.sh

# 3. Create service + timer
sudo tee /etc/systemd/system/filterly-poller.service >/dev/null <<'EOF'
[Unit]
Description=Filterly poll trigger
[Service]
Type=oneshot
Environment=CRON_URL=https://filterly-one.vercel.app/api/poll
ExecStart=/usr/local/bin/filterly-poll.sh
EOF

sudo tee /etc/systemd/system/filterly-poller.timer >/dev/null <<'EOF'
[Unit]
Description=Run Filterly poll every 10 minutes
[Timer]
OnBootSec=1min
OnUnitActiveSec=10min
Unit=filterly-poller.service
[Install]
WantedBy=timers.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable --now filterly-poller.timer
```

---

## Verifying Operation

```bash
# Check next run time
systemctl list-timers | grep filterly

# Run manually
sudo systemctl start filterly-poller.service

# Check status
sudo systemctl status filterly-poller.service

# Follow logs
sudo journalctl -u filterly-poller.service -f
```

Successful run log:

```
filterly-poll.sh[…]: {"ok":true}
```

---

## Notes

- **Cadence:** change `OnUnitActiveSec` in the timer to `5min`, `15min`, etc.
- **Endpoint:** edit `Environment=CRON_URL=` in the service file if your Vercel domain changes.
- **Security:** `/etc/filterly/cron_token` should remain root-only (mode 600).
- **No overlap:** the script uses `flock` to prevent concurrent runs.
- **Failures:** check logs with `journalctl -u filterly-poller.service -n 50`.
- **Manual curl test:**
  ```bash
  curl -s -X POST \
    -H "x-cron-token: $(sudo cat /etc/filterly/cron_token)" \
    https://filterly-one.vercel.app/api/poll | jq
  ```
