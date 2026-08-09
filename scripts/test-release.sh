#!/usr/bin/env bash
set -Eeuo pipefail

readonly PRODUCTION_PROJECT_REF="hmeybakjxtzmiebtxonc"
readonly REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
readonly SUPABASE_CMD="${REPO_ROOT}/node_modules/.bin/supabase"

for candidate in "${SUPABASE_PROJECT_REF:-}" "${SUPABASE_URL:-}" "${VITE_SUPABASE_URL:-}" "${DATABASE_URL:-}"; do
  if [[ "${candidate,,}" == *"${PRODUCTION_PROJECT_REF}"* ]]; then
    echo "release test: refusing production project ${PRODUCTION_PROJECT_REF}" >&2
    exit 2
  fi
done

[[ -x "${SUPABASE_CMD}" ]] || { echo "release test: run npm ci first so the repo-local Supabase CLI is available" >&2; exit 2; }

cd "${REPO_ROOT}"
npm run test:ci

stack_was_running=0
status_file=""
if "${SUPABASE_CMD}" status >/dev/null 2>&1; then
  stack_was_running=1
else
  "${SUPABASE_CMD}" start
fi

cleanup() {
  if [[ -n "${status_file}" ]]; then
    rm -f "${status_file}"
  fi
  if [[ "${stack_was_running}" == "0" ]]; then
    "${SUPABASE_CMD}" stop --no-backup >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

status_file="$(mktemp "${TMPDIR:-/tmp}/gurodesk-release-status.XXXXXX")"
"${SUPABASE_CMD}" status -o env > "${status_file}"

status_value() {
  local key="$1"
  local value
  value="$(sed -n "s/^${key}=//p" "${status_file}" | head -n 1)"
  value="${value#\"}"; value="${value%\"}"; value="${value#\'}"; value="${value%\'}"
  printf '%s' "${value}"
}

export VITE_SUPABASE_URL="$(status_value API_URL)"
export VITE_SUPABASE_PUBLISHABLE_KEY="$(status_value ANON_KEY)"
export SUPABASE_URL="${VITE_SUPABASE_URL}"
export SUPABASE_ANON_KEY="${VITE_SUPABASE_PUBLISHABLE_KEY}"
export SUPABASE_SERVICE_ROLE_KEY="$(status_value SERVICE_ROLE_KEY)"
export SUPABASE_DB_URL="$(status_value DB_URL)"
export E2E_SUPABASE_URL="${VITE_SUPABASE_URL}"
export E2E_SUPABASE_ANON_KEY="${VITE_SUPABASE_PUBLISHABLE_KEY}"
export E2E_EMAIL="${E2E_EMAIL:-phase55-e2e-teacher@example.test}"
export E2E_PASSWORD="${E2E_PASSWORD:-Phase55-local-e2e-password-9!}"

case "${VITE_SUPABASE_URL}" in
  http://127.0.0.1:*|http://localhost:*|http://\[::1\]:*) ;;
  *) echo "release test: Supabase API is not local" >&2; exit 2 ;;
esac
case "${SUPABASE_DB_URL}" in
  *@127.0.0.1:*|*@localhost:*|*@\[::1\]:*) ;;
  *) echo "release test: Supabase database is not local" >&2; exit 2 ;;
esac
[[ -n "${VITE_SUPABASE_PUBLISHABLE_KEY}" && -n "${SUPABASE_SERVICE_ROLE_KEY}" ]] || {
  echo "release test: local Supabase keys are missing" >&2
  exit 2
}

npm run test:db
"${SUPABASE_CMD}" db reset --local --yes
npm run test:integration
npm run test:e2e:prepare
npm run test:e2e

echo "release test: all Phase 5.5 release gates passed"
