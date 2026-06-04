# Backup / Restore Drill — 2026-06-05

Covers **REQ-OPS-002** (备份和恢复演练) plus the Claude×Codex cross-review reinforcement:
a backup must cover **DB + media + app_state consistency**. Because all `app_state`
(careLogs / albumItems / growthMeasurements / reminders / chat / expenses / agent runs /
pending effects / …) lives **inside SQLite** (not a separate file), DB + app_state
consistency is achieved by a single online, transaction-consistent SQLite snapshot
(`sqlite3 .backup`, WAL-safe — never a plain `cp` under WAL). Media / auth secrets /
OTA bundles are file-based and backed up as a separate restore unit.

## Scripts under test

| Script | Role |
| --- | --- |
| `scripts/backup-app-data.sh` | Online `.backup` of SQLite (WAL-safe) → `backups/<UTC-timestamp>/db/`, rsync of media/auth/mobile-updates → `media/`, then `PRAGMA integrity_check` + `foreign_key_check` on the snapshot; writes `MANIFEST.txt` with sizes/durations/results. |
| `scripts/restore-app-data.sh` | Restores a snapshot into a **new** directory (refuses non-empty target unless `FORCE=1`, mirroring deploy `SYNC_DATA=0`); verifies source snapshot first, then re-verifies the restored DB with `integrity_check` + `foreign_key_check`. Never touches the live data dir. |

## Environment

- Host: macOS (local dev workstation), `sqlite3` 3.45.3
- Source DB: `backend/data/baby-companion.sqlite` (WAL journal mode, per `SqliteDataSourceConfig`)
- Source data dir: `backend/data/` (`uploads/` local attachments, `auth/`, `mobile-updates/`)
- Backup root for drill: `/tmp/baby-backup-drill`
- Restore target for drill: `/tmp/baby-restore-drill`

## Result: PASS

End-to-end: local backup of the live DB → restore into a temporary directory →
`integrity_check` passed on both the snapshot and the restored DB.

### Backup measurements

| Metric | Value |
| --- | --- |
| Snapshot path | `backups/<UTC-timestamp>/db/baby-companion.sqlite` |
| DB size | 784K (802,816 bytes) |
| DB `.backup` duration | < 1 s (0 s rounded) |
| `integrity_check` (snapshot) | **ok** |
| `foreign_key_check` (snapshot) | ok (no violations) |
| Media dir size (`auth` + `mobile-updates` + `uploads`) | 94M (98,979,840 bytes) |
| `uploads/` size | 0B (no local attachments yet; OTA bundles dominate the 94M) |
| Media copy duration | ~1 s |
| Total duration | ~1 s |

### Restore measurements

| Metric | Value |
| --- | --- |
| Restore target | `/tmp/baby-restore-drill` (new dir) |
| Restored DB size | 784K |
| Restored table count | 25 |
| Restore duration | < 1 s |
| `integrity_check` (restored) | **ok** |
| `foreign_key_check` (restored) | ok (no violations) |

### app_state consistency proof

Row counts matched the live DB exactly for every app_state table, and the full logical
dump was byte-identical:

| Table | Original | Restored |
| --- | --- | --- |
| care_log | 76 | 76 |
| album_item | 32 | 32 |
| growth_measurement | 0 | 0 |
| reminder | 2 | 2 |
| baby_profile | 1 | 1 |
| chat_message | 14 | 14 |
| memory_item | 0 | 0 |
| expense_item | 98 | 98 |
| pending_effect | 0 | 0 |

`sqlite3 .dump | shasum` — original `10fe66f0…93bc1a` == restored `10fe66f0…93bc1a`
→ **logical content identical**.

### Safety / failure-path checks

- Restore into a **non-empty** target without `FORCE=1` → refused, exit 1 (safe default,
  like deploy `SYNC_DATA=0`).
- `FORCE=1` into a non-empty target → succeeded.
- Restore of a **corrupt** source snapshot (random bytes) → rejected at the source
  `integrity_check` step (`file is not a database`), exit 1 — never produced a bad restore.
- Backup script aborts with non-zero exit if the snapshot `integrity_check` is not `ok`.

## Reproduce

```bash
# Backup the local DB + media into a timestamped dir
BACKUP_ROOT=/tmp/baby-backup-drill scripts/backup-app-data.sh

# Restore the latest snapshot into a fresh temp dir and verify
BK=$(ls -d /tmp/baby-backup-drill/*/ | head -1)
scripts/restore-app-data.sh "$BK" /tmp/baby-restore-drill
```

## Production schedule & retention (REQ-OPS-002)

Wire these on the ECS host (scripts ship the cron/retention guidance in their headers):

- **Daily cron** (03:30 server time) running `backup-app-data.sh` against
  `DATA_DIR=/var/lib/ai-baby-growth-companion`, output to a dedicated backup volume / object store.
- **Retention**: 7 daily / 30 weekly / 90 monthly snapshots (GFS). For OSS-stored media,
  enable Bucket Versioning + lifecycle rules rather than relying on file copies.
- **Pre-deploy snapshot**: `scripts/deploy-aliyun-ecs.sh` should invoke `backup-app-data.sh`
  before each deploy so every release is preceded by a verified DB snapshot.
- **Drill cadence**: repeat this restore drill at least monthly and append a dated record here.

## Notes / follow-ups (out of scope for this drill)

- `deploy-aliyun-ecs.sh` does not yet auto-invoke `backup-app-data.sh` pre-deploy; recommend
  adding that call (separate task — touches the deploy script).
- Going live from a restore is intentionally manual: stop the service, rsync the restored
  dir into `APP_DATA_DIR`, restart. The script prints these steps and does not perform them,
  so a drill can never clobber production.
- OSS mode: when `APP_STORAGE_MODE=oss`, attachment bytes live in OSS; this backup still
  captures the DB (which holds the OSS object keys) and any residual local files. Media
  durability in that mode relies on OSS versioning/lifecycle.
