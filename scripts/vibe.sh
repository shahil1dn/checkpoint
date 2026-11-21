#!/usr/bin/env bash
# Send one task to Mistral Vibe, headless, capped, with every run's record kept for the pitch.
set -euo pipefail
cd "$(dirname "$0")/.."
[ $# -ge 1 ] || { echo 'usage: scripts/vibe.sh "<one small, specific task>"'; exit 2; }

out="logs/vibe/$(date +%Y%m%d-%H%M%S)"
mkdir -p "$out"
printf '%s\n' "$1" > "$out/task.txt"

args=(-p "$1" --trust
      --agent "${VIBE_AGENT:-smart-approve}"  # accept-edits blocks every command when headless
      --max-price "${VIBE_MAX_PRICE:-1}"
      --max-turns "${VIBE_MAX_TURNS:-30}"
      --time-limit "${VIBE_TIME_LIMIT:-600}"
      --output-dir "$out")
[ -n "${VIBE_MODEL:-}" ] && args+=(--model "$VIBE_MODEL")

vibe "${args[@]}" | tee "$out/reply.txt"
echo "--- run saved to $out"
