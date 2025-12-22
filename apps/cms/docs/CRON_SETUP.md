# RankSheet CMS Cron Job Setup

This document describes how to set up automated refresh jobs for RankSheet CMS in production.

---

## Overview

RankSheet CMS requires periodic execution of the `/api/admin/refresh-all` endpoint to update ranking data. This is typically done via cron jobs on the host machine.

---

## Prerequisites

- RankSheet CMS is deployed and running
- `JOB_TOKEN` environment variable is set
- CMS is accessible at `https://cms.ranksheet.com` (or your configured domain)
- `curl` is available on the host system

---

## Recommended Schedule

| Job | Schedule | Description |
|-----|----------|-------------|
| **Weekly Full Refresh** | Every Monday at 03:00 UTC | Refresh all active keywords |
| **Daily Health Check** | Every day at 06:00 UTC | Verify CMS is healthy |

---

## Cron Configuration

### Method 1: System Crontab (Recommended)

1. **Create cron configuration file**:

```bash
sudo nano /etc/cron.d/ranksheet
```

2. **Add the following content**:

```bash
# RankSheet CMS Automated Jobs
# File: /etc/cron.d/ranksheet

# Environment (optional, for log location)
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/sbin:/bin:/usr/sbin:/usr/bin

# Weekly full refresh (Every Monday at 03:00 UTC)
0 3 * * 1 root curl -s -X POST https://cms.ranksheet.com/api/admin/refresh-all \
  -H "Authorization: Bearer YOUR_JOB_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{"concurrency": 5}' \
  >> /var/log/ranksheet/refresh-all.log 2>&1

# Daily health check (Every day at 06:00 UTC)
0 6 * * * root curl -s https://cms.ranksheet.com/api/healthz \
  >> /var/log/ranksheet/health.log 2>&1
```

3. **Replace `YOUR_JOB_TOKEN_HERE` with your actual `JOB_TOKEN`**

4. **Create log directory**:

```bash
sudo mkdir -p /var/log/ranksheet
sudo chown root:root /var/log/ranksheet
sudo chmod 755 /var/log/ranksheet
```

5. **Set proper permissions**:

```bash
sudo chmod 644 /etc/cron.d/ranksheet
```

6. **Verify cron is loaded**:

```bash
# Check if cron job is registered
sudo crontab -l -u root
# Or check syslog
sudo grep CRON /var/log/syslog | tail -20
```

---

### Method 2: User Crontab

If you prefer to run cron as a specific user:

1. **Edit crontab**:

```bash
crontab -e
```

2. **Add the following lines**:

```bash
# RankSheet CMS Jobs
0 3 * * 1 curl -s -X POST https://cms.ranksheet.com/api/admin/refresh-all \
  -H "Authorization: Bearer YOUR_JOB_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{"concurrency": 5}' \
  >> ~/ranksheet-refresh.log 2>&1

0 6 * * * curl -s https://cms.ranksheet.com/api/healthz \
  >> ~/ranksheet-health.log 2>&1
```

---

## API Parameters

### `POST /api/admin/refresh-all`

**Headers**:
- `Authorization: Bearer {JOB_TOKEN}` — Required
- `Content-Type: application/json`

**Body** (JSON):
```json
{
  "concurrency": 5,    // Optional: 1-10 concurrent workers (default: 3)
  "limit": 100         // Optional: Only refresh first N keywords (for testing)
}
```

**Response**:
```json
{
  "jobId": "uuid",
  "status": "QUEUED",
  "keywordsCount": 150,
  "message": "Queued refresh job for 150 keywords"
}
```

---

## Monitoring

### Check Last Refresh Time

```bash
# Via health check
curl -s https://cms.ranksheet.com/api/healthz | jq

# Check logs
tail -f /var/log/ranksheet/refresh-all.log
```

### Check Job Status

```bash
# Get job ID from logs, then:
curl -s https://cms.ranksheet.com/api/admin/job/{JOB_ID} \
  -H "Authorization: Bearer YOUR_JOB_TOKEN"
```

### Useful Commands

```bash
# View recent cron executions
sudo grep CRON /var/log/syslog | grep ranksheet | tail -20

# View refresh logs
tail -100 /var/log/ranksheet/refresh-all.log

# View health logs
tail -100 /var/log/ranksheet/health.log

# Test manual refresh
curl -X POST https://cms.ranksheet.com/api/admin/refresh-all \
  -H "Authorization: Bearer YOUR_JOB_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"concurrency": 1, "limit": 5}'
```

---

## Log Rotation

To prevent log files from growing too large, set up log rotation:

1. **Create rotation config**:

```bash
sudo nano /etc/logrotate.d/ranksheet
```

2. **Add configuration**:

```
/var/log/ranksheet/*.log {
    daily
    rotate 30
    compress
    delaycompress
    missingok
    notifempty
    create 0644 root root
}
```

3. **Test rotation**:

```bash
sudo logrotate -f /etc/logrotate.d/ranksheet
```

---

## Troubleshooting

### Cron Job Not Running

1. **Check if cron service is running**:
```bash
sudo systemctl status cron
```

2. **Check cron logs**:
```bash
sudo grep CRON /var/log/syslog | tail -50
```

3. **Verify cron file syntax**:
```bash
cat /etc/cron.d/ranksheet
```

### Authentication Errors

If you see `401 Unauthorized`:
- Verify `JOB_TOKEN` matches the one in CMS `.env.production`
- Check if IP whitelist is blocking the request (if `ADMIN_IP_WHITELIST` is set)

### Job Takes Too Long

Default refresh can take 10-30 minutes for 150+ keywords. To reduce time:
- Increase `concurrency` (max 10): `{"concurrency": 8}`
- Reduce batch size temporarily: `{"limit": 50}`

### CMS Not Accessible

If curl fails:
- Check if Docker container is running: `docker ps | grep ranksheet`
- Check Nginx proxy: `sudo nginx -t && sudo systemctl status nginx`
- Check DNS: `nslookup cms.ranksheet.com`

---

## Security Notes

- **Never log `JOB_TOKEN` in plain text** - it's a secret
- **Restrict access to log files**: `chmod 640 /var/log/ranksheet/*.log`
- **Use HTTPS only** - never send `JOB_TOKEN` over HTTP
- **Consider IP whitelist** - set `ADMIN_IP_WHITELIST` in production

---

## Alternative: Using Systemd Timers

For more advanced scheduling, consider using systemd timers instead of cron:

1. **Create service file** (`/etc/systemd/system/ranksheet-refresh.service`):

```ini
[Unit]
Description=RankSheet Weekly Refresh
After=network.target

[Service]
Type=oneshot
ExecStart=/usr/bin/curl -s -X POST https://cms.ranksheet.com/api/admin/refresh-all \
  -H "Authorization: Bearer YOUR_JOB_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"concurrency": 5}'
StandardOutput=append:/var/log/ranksheet/refresh-all.log
StandardError=append:/var/log/ranksheet/refresh-all.log
```

2. **Create timer file** (`/etc/systemd/system/ranksheet-refresh.timer`):

```ini
[Unit]
Description=Run RankSheet Refresh Weekly
Requires=ranksheet-refresh.service

[Timer]
OnCalendar=Mon *-*-* 03:00:00
Persistent=true

[Install]
WantedBy=timers.target
```

3. **Enable and start**:

```bash
sudo systemctl daemon-reload
sudo systemctl enable ranksheet-refresh.timer
sudo systemctl start ranksheet-refresh.timer
sudo systemctl status ranksheet-refresh.timer
```

---

## Production Checklist

- [ ] Cron job file created at `/etc/cron.d/ranksheet`
- [ ] `JOB_TOKEN` replaced with actual production value
- [ ] Log directory `/var/log/ranksheet` created with proper permissions
- [ ] Log rotation configured
- [ ] Cron service is running
- [ ] Test manual execution works
- [ ] Monitor first automated execution
- [ ] Set up alerts for job failures (optional: email/Slack webhook)
