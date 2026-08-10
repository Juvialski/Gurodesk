#!/usr/bin/env bash
set -Eeuo pipefail

# Real migration application and upgrade-path behavioral harness.
#
# The default adapter is a running local Supabase stack.  It copies the
# migration directory into a temporary project so the repository itself is
# never edited while the upgrade path is staged.  A disposable local
# PostgreSQL URL can be supplied with SUPABASE_DB_URL when the Supabase CLI is
# unavailable; that mode requires SUPABASE_TEST_RESET=1.

readonly PRODUCTION_PROJECT_REF="hmeybakjxtzmiebtxonc"
readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
readonly MIGRATIONS_DIR="${REPO_ROOT}/supabase/migrations"
readonly FIXTURE_SQL="${REPO_ROOT}/tests/db/fixture_upgrade.sql"
readonly FRESH_ASSERT_SQL="${REPO_ROOT}/tests/db/assert_fresh.sql"
readonly UPGRADE_ASSERT_SQL="${REPO_ROOT}/tests/db/assert_upgrade.sql"

MODE="all"
DB_URL="${SUPABASE_DB_URL:-${DATABASE_URL:-}}"
START_LOCAL="${SUPABASE_TEST_START_LOCAL:-0}"
KEEP_TEMP="${SUPABASE_TEST_KEEP_TEMP:-0}"
SUPABASE_CMD=""
TEMP_PROJECT=""

usage() {
  cat <<'EOF'
Usage: scripts/test-db-migrations.sh [options]

Runs real database migrations and behavioral assertions against local
Supabase/Postgres.  No package.json wiring is required to invoke this file.

Options:
  --fresh          Apply all migrations and run fresh-schema assertions.
  --upgrade        Apply 001-014, insert fixture data, apply 015-026, assert.
  --all            Run both paths (default).
  --db-url URL     Use a disposable local PostgreSQL URL instead of CLI status.
  --start-local    Start local Supabase when it is not already running.
  --keep-temp      Keep the temporary migration project and logs.
  -h, --help       Show this help.

Environment:
  SUPABASE_DB_URL / DATABASE_URL  PostgreSQL URL for a disposable local DB.
  SUPABASE_TEST_RESET=1           Required for direct-psql reset mode.
  SUPABASE_PROJECT_REF            Project ref checked by the production guard.
EOF
}

die() {
  echo "db migration harness: $*" >&2
  exit 2
}

skip() {
  echo "db migration harness: SKIP ($*)" >&2
  exit 77
}

while (( "$#" )); do
  case "$1" in
    --fresh)
      MODE="fresh"
      ;;
    --upgrade)
      MODE="upgrade"
      ;;
    --all)
      MODE="all"
      ;;
    --start-local)
      START_LOCAL=1
      ;;
    --keep-temp)
      KEEP_TEMP=1
      ;;
    --db-url=*)
      DB_URL="${1#*=}"
      ;;
    --db-url)
      shift
      [[ "$#" -gt 0 ]] || die "--db-url requires a PostgreSQL URL"
      DB_URL="$1"
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      die "unknown option: $1 (use --help)"
      ;;
  esac
  shift
done

# Refuse the known production project before any CLI, reset, connection, or
# migration command.  Check both refs and URLs so a caller cannot accidentally
# route a local-looking test command to the hosted project.
for candidate in \
  "${SUPABASE_PROJECT_REF:-}" \
  "${SUPABASE_PROJECT_ID:-}" \
  "${SUPABASE_URL:-}" \
  "${DB_URL}"; do
  if [[ "${candidate,,}" == *"${PRODUCTION_PROJECT_REF}"* ]]; then
    die "refusing to run against production Supabase project ${PRODUCTION_PROJECT_REF}"
  fi
done

if [[ ! -d "${MIGRATIONS_DIR}" || ! -f "${FIXTURE_SQL}" || ! -f "${FRESH_ASSERT_SQL}" || ! -f "${UPGRADE_ASSERT_SQL}" ]]; then
  die "repository migration/test files are incomplete"
fi

readonly EXPECTED_MIGRATION_COUNT=26
mapfile -t MIGRATIONS < <(find "${MIGRATIONS_DIR}" -maxdepth 1 -type f -name '*.sql' -print | sort)
readonly TOTAL_MIGRATIONS="${#MIGRATIONS[@]}"
if [[ "${TOTAL_MIGRATIONS}" -ne "${EXPECTED_MIGRATION_COUNT}" ]]; then
  die "expected exactly ${EXPECTED_MIGRATION_COUNT} migration files, found ${TOTAL_MIGRATIONS}"
fi

if command -v supabase >/dev/null 2>&1; then
  SUPABASE_CMD="$(command -v supabase)"
elif [[ -x "${REPO_ROOT}/node_modules/.bin/supabase" ]]; then
  SUPABASE_CMD="${REPO_ROOT}/node_modules/.bin/supabase"
fi

is_local_db_url() {
  local value="$1"
  [[ "${value}" =~ @localhost([:/]|$) || "${value}" =~ @127\.0\.0\.1([:/]|$) || "${value}" =~ @\[::1\]([:/]|$) ]]
}

ensure_safe_db_url() {
  if [[ -z "${DB_URL}" ]]; then
    return
  fi
  if ! is_local_db_url "${DB_URL}"; then
    die "refusing non-local DB URL; migration tests require an isolated local database"
  fi
}

# Validate an explicitly supplied target before starting, resetting, or
# inspecting any local service. The resolved CLI URL is checked again below.
ensure_safe_db_url

if ! command -v psql >/dev/null 2>&1; then
  skip "psql is not installed; install PostgreSQL client tools and rerun"
fi

run_psql() {
  psql "${DB_URL}" -X -v ON_ERROR_STOP=1 "$@"
}

resolve_local_db_url() {
  if [[ -n "${DB_URL}" ]]; then
    ensure_safe_db_url
    return
  fi

  if [[ -n "${SUPABASE_CMD}" ]]; then
    local status_env
    status_env="$(${SUPABASE_CMD} status -o env 2>/dev/null || true)"
    DB_URL="$(printf '%s\n' "${status_env}" | awk -F= '$1 == "DB_URL" { sub(/^DB_URL=/, ""); print; exit }' | tr -d '"' | tr -d "'")"
  fi
  DB_URL="${DB_URL:-postgresql://postgres:postgres@127.0.0.1:54322/postgres}"
  ensure_safe_db_url
}

make_temp_project() {
  TEMP_PROJECT="$(mktemp -d "${TMPDIR:-/tmp}/gurodesk-db-migrations.XXXXXX")"
  mkdir -p "${TEMP_PROJECT}/supabase/migrations"
  cp "${REPO_ROOT}/supabase/config.toml" "${TEMP_PROJECT}/supabase/config.toml"
}

copy_migrations() {
  local first_count="$1"
  local index=0
  for migration in "${MIGRATIONS[@]}"; do
    index=$((index + 1))
    if (( index <= first_count )); then
      cp "${migration}" "${TEMP_PROJECT}/supabase/migrations/"
    fi
  done
}

copy_migrations_after_fixture() {
  local index=0
  for migration in "${MIGRATIONS[@]}"; do
    index=$((index + 1))
    if (( index >= 15 )); then
      cp "${migration}" "${TEMP_PROJECT}/supabase/migrations/"
    fi
  done
}

run_local_reset() {
  if [[ -z "${SUPABASE_CMD}" ]]; then
    return 1
  fi
  if [[ "${START_LOCAL}" == "1" ]]; then
    local status_code=0
    "${SUPABASE_CMD}" status >/dev/null 2>&1 || status_code=$?
    if (( status_code != 0 )); then
      "${SUPABASE_CMD}" start
    fi
  fi
  (
    cd "${TEMP_PROJECT}"
    "${SUPABASE_CMD}" db reset --local --yes
  )
}

reset_direct_db() {
  if [[ "${SUPABASE_TEST_RESET:-0}" != "1" ]]; then
    die "direct-psql mode needs SUPABASE_TEST_RESET=1 because the disposable public schema is reset"
  fi
  if ! is_local_db_url "${DB_URL}"; then
    die "direct reset mode only permits a local DB URL"
  fi
  run_psql <<'SQL'
drop schema if exists public cascade;
create schema public;
grant usage on schema public to public;
SQL
}

run_direct_fresh() {
  reset_direct_db
  for migration in "${MIGRATIONS[@]}"; do
    run_psql -f "${migration}"
  done
}

run_direct_upgrade() {
  reset_direct_db
  local index=0
  for migration in "${MIGRATIONS[@]}"; do
    index=$((index + 1))
    if (( index <= 14 )); then
      run_psql -f "${migration}"
    fi
  done
  run_psql -f "${FIXTURE_SQL}"
  index=0
  for migration in "${MIGRATIONS[@]}"; do
    index=$((index + 1))
    if (( index >= 15 )); then
      run_psql -f "${migration}"
    fi
  done
  run_psql -f "${UPGRADE_ASSERT_SQL}"
}

run_fresh() {
  echo "db migration harness: fresh path (all ${TOTAL_MIGRATIONS} migrations)"
  make_temp_project
  copy_migrations "${TOTAL_MIGRATIONS}"
  if ! run_local_reset; then
    if [[ -z "${DB_URL}" ]]; then
      skip "Supabase CLI/local stack is unavailable and no SUPABASE_DB_URL was supplied"
    fi
    run_direct_fresh
  fi
  resolve_local_db_url
  run_psql -f "${FRESH_ASSERT_SQL}"
  echo "db migration harness: fresh path passed"
}

run_upgrade() {
  echo "db migration harness: upgrade path (001-014, fixture, 015-026)"
  make_temp_project
  copy_migrations 14
  if ! run_local_reset; then
    if [[ -z "${DB_URL}" ]]; then
      skip "Supabase CLI/local stack is unavailable and no SUPABASE_DB_URL was supplied"
    fi
    if [[ "${SUPABASE_TEST_RESET:-0}" != "1" ]]; then
      die "upgrade path needs Supabase CLI or SUPABASE_TEST_RESET=1 for disposable direct-psql mode"
    fi
    ensure_safe_db_url
    run_direct_upgrade
    echo "db migration harness: upgrade path passed"
    return
  fi
  resolve_local_db_url
  run_psql -f "${FIXTURE_SQL}"
  copy_migrations_after_fixture
  local index=0
  for migration in "${MIGRATIONS[@]}"; do
    index=$((index + 1))
    if (( index >= 15 )); then
      run_psql -f "${migration}"
    fi
  done
  run_psql -f "${UPGRADE_ASSERT_SQL}"
  echo "db migration harness: upgrade path passed"
}

cleanup() {
  if [[ "${KEEP_TEMP}" == "1" ]]; then
    if [[ -n "${TEMP_PROJECT}" ]]; then
      echo "db migration harness: kept temporary project at ${TEMP_PROJECT}" >&2
    fi
  elif [[ -n "${TEMP_PROJECT}" ]]; then
    rm -rf "${TEMP_PROJECT}"
  fi
}
trap cleanup EXIT

if [[ "${MODE}" == "fresh" || "${MODE}" == "all" ]]; then
  run_fresh
fi
if [[ "${MODE}" == "upgrade" || "${MODE}" == "all" ]]; then
  run_upgrade
fi

echo "db migration harness: all requested paths passed"
