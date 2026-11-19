# managed-glitchtip

A small, opinionated kit for **self-hosting [GlitchTip](https://glitchtip.com)** (an open-source,
Sentry-compatible error tracker) as a managed service: deploy a tenant behind a reverse proxy,
provision isolated instances, seed production-like demo data, and — most importantly — run a
**backup/restore drill** so you know your Recovery Point Objective before you need it.

Extracted from a real build. Full write-up, including the single-node restore trap:
**[Self-hosting GlitchTip and the restore trap](https://balmacefa.com/blog/self-hosting-glitchtip-and-the-restore-trap)**.

> Sanitized for publishing: replace the placeholder keys, domains (`errors.example.com`),
> secrets (`change-me-*`) and the org slug (`myorg`) with your own.

## Why GlitchTip

- Drop-in Sentry replacement: your apps keep the official Sentry SDK, you just swap the DSN.
- Four light containers (Django web, worker, PostgreSQL, Redis/Valkey) — not the Kafka/ClickHouse
  stack that self-hosted Sentry needs. Runs comfortably on ~1 GB.
- Migrate in or out by changing one URL.

## Layout

```
docker-compose.yml        Single tenant, local (host port). Quick start.
provision.sh <t> <port>   Spin up an isolated tenant (own docker project + volume).
backup.sh <t>             Daily pg_dump (gzip) with retention. Cron-friendly.
landing/index.html        Example marketing landing ("managed error tracking, no DevOps").
ops/
  compose.traefik.yml     Tenant behind a Traefik reverse proxy (TLS via letsencrypt).
  backup.sh               Custom-format pg_dump (pg_restore-ready) + issue count.
  restore-drill.sh        Full DR drill: backup -> DROP DATABASE -> restore -> verify.
  restore-window-demo.sh  Demonstrates the RPO loss: an event after the backup is gone post-restore.
  recreate.sh             Clean recreate from scratch (down -v) when the stack gets wedged.
seed/seed.mjs             Seed realistic, grouped error data (stable fingerprints).
tools/
  glitch.mjs             CDP driver for the Angular UI (register, create org/project, read DSN).
  mkproject.mjs          Create a project and capture its DSN.
```

## Quick start (local)

```bash
# single tenant on http://localhost:8001
TENANT=demo PORT=8001 docker compose -p gt-demo up -d
# first login at the URL creates the admin user
./backup.sh demo            # dump to ./backups/
```

## Behind a reverse proxy (production)

Use `ops/compose.traefik.yml`: no host port, Traefik labels route `errors.example.com` with
automatic TLS. Join your proxy's external network. See the file for the exact label pattern
(entrypoints http/https, redirect-to-https, gzip, `loadbalancer.server.port=8000`).

## The one thing people skip: the restore drill

```bash
ops/restore-drill.sh         # backup -> simulate disaster (drop db) -> restore -> verify
ops/restore-window-demo.sh   # proves data written AFTER the backup is lost on restore
```

A snapshot restore rewinds the database to the backup moment. **Everything written after it is
lost** — your RPO equals your backup interval. For continuous-write workloads, shrink the interval,
pause writes before a planned restore, restore to a separate instance and cut over, or move to
WAL archiving / PITR. Decide the number, then test it.

## Gotchas learned the hard way (GlitchTip 7)

- The **web process ingests events** via an in-process worker. The standalone `run-worker.sh` is
  deprecated and crash-loops; a competing worker container drops tasks. Run `run-web.sh` only.
- Event tables are **partitioned by date**; a fresh install only has partitions for today onward.
  Back-dated seed events have no partition and are dropped. Keep seed timestamps recent.
- Don't over-iterate on a live stack. Repeated `TRUNCATE ... RESTART IDENTITY` on partitioned
  tables wedged the ingest pipeline; a clean `down -v` recreate fixed it.

## License

MIT — see [LICENSE](./LICENSE).
