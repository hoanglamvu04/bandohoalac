#!/usr/bin/env bash
set -euo pipefail

# Enforced on PRs changing product code or release-related automation.
# No credentials, PR comments, checkout writes, or remote API calls.
: "${BASE_SHA:?BASE_SHA is required}"
: "${HEAD_SHA:?HEAD_SHA is required}"

git cat-file -e "${BASE_SHA}^{commit}"
git cat-file -e "${HEAD_SHA}^{commit}"
changed="$(git diff --name-only "${BASE_SHA}...${HEAD_SHA}")"

if ! grep -Eq '^(backend/|frontend/|scripts/|\.github/workflows/|package\.json$|package-lock\.json$)' <<< "${changed}"; then
  echo "No application/release code modified; LUU_Y_CODE gate not required for this PR."
  exit 0
fi

missing=0
for required in \
  LUU_Y_CODE/BAO_CAO_TIEN_DO.md \
  LUU_Y_CODE/KE_HOACH_TIEP_THEO.md \
  LUU_Y_CODE/NHAT_KY_CODE.md; do
  if ! grep -Fxq "${required}" <<< "${changed}"; then
    echo "::error::Code PR is missing update to ${required}. Read AGENTS.md and LUU_Y_CODE/README.md."
    missing=1
  else
    echo "Updated: ${required}"
  fi
done

if [[ "${missing}" -ne 0 ]]; then
  echo "All code PRs must update status, next plan and append-only journal in the same PR."
  exit 1
fi
echo "LUU_Y_CODE PR discipline: PASS."
