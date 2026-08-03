#!/usr/bin/env bash
# Asserts every Docker Compose service is actually up.
#
# Written as the regression check for FIX-01 (redis could not bind its host
# port) and FIX-02 (temporal crash-looped on an invalid driver name). Both
# failures were invisible until someone noticed a container missing, because
# `docker compose up -d` reports success for services that then exit.
#
#   ./scripts/check-stack.sh
#
# Exit 0 = every service running. Exit 1 = at least one is not.

set -uo pipefail
cd "$(dirname "$0")/.."

fail=0

echo "service state check"
echo "-------------------"

while IFS=$'\t' read -r svc state; do
  [ -z "$svc" ] && continue
  if [ "$state" = "running" ]; then
    printf "  ok    %-14s %s\n" "$svc" "$state"
  else
    printf "  FAIL  %-14s %s\n" "$svc" "$state"
    fail=1
  fi
done < <(docker compose ps -a --format "{{.Service}}\t{{.State}}")

# A container can be "running" while crash-looping if it restarts fast enough,
# so the two known crash signatures are checked explicitly.
echo
echo "crash-loop signatures"
echo "---------------------"

if docker compose logs temporal --tail=40 2>/dev/null | grep -q "Unsupported driver specified"; then
  echo "  FAIL  temporal is rejecting its DB driver name"
  fail=1
else
  echo "  ok    temporal driver accepted"
fi

if docker compose logs redis --tail=20 2>/dev/null | grep -qi "Ready to accept connections"; then
  echo "  ok    redis accepting connections"
else
  echo "  WARN  redis has not logged 'Ready to accept connections'"
fi

echo
if [ "$fail" -eq 0 ]; then
  echo "PASS — every service is up"
else
  echo "FAIL — see above"
fi
exit "$fail"
