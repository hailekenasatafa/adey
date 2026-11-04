#!/usr/bin/env bash
# Recreate the local validation DB, apply the platform shim, then every migration in order.
set -euo pipefail
PSQL="psql -h /tmp/pg -p 5433 -U postgres -v ON_ERROR_STOP=1 -q"
$PSQL -d postgres -c "drop database if exists adey_test with (force);" >/dev/null
$PSQL -d postgres -c "create database adey_test;" >/dev/null
$PSQL -d adey_test -f "$(dirname "$0")/local_shim.sql"
for f in "$(dirname "$0")/../migrations/"*.sql; do
  echo "applying $(basename "$f")"
  $PSQL -d adey_test -f "$f"
done
if [ -f "$(dirname "$0")/../seed.sql" ]; then echo "applying seed.sql"; $PSQL -d adey_test -f "$(dirname "$0")/../seed.sql"; fi
echo "ALL MIGRATIONS OK"
