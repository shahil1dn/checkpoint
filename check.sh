#!/usr/bin/env bash
# The one command everyone runs before asking for a merge.
set -u
cd "$(dirname "$0")"
failed=0
# Windows (Git Bash) usually has "python", not "python3".
PY="$(command -v python3 || command -v python || true)"

echo "1. No API keys in tracked files"
if git grep -nE '(sk-[A-Za-z0-9]{20,}|MISTRAL_API_KEY *= *["'\'']?[A-Za-z0-9]{20,})' -- . ':!.env.example' >/dev/null 2>&1; then
  git grep -nE '(sk-[A-Za-z0-9]{20,}|MISTRAL_API_KEY *= *["'\'']?[A-Za-z0-9]{20,})' -- . ':!.env.example'
  echo "   FAIL: a key is in the code. Move it to .env."; failed=1
else echo "   ok"; fi

echo "2. .env is not tracked"
if git ls-files --error-unmatch .env >/dev/null 2>&1; then echo "   FAIL: run git rm --cached .env"; failed=1; else echo "   ok"; fi

echo "3. Project tests"
if [ -f package.json ] && grep -q '"test"' package.json; then npm test --silent || failed=1
elif [ -f app/package.json ] && grep -q '"test"' app/package.json; then (cd app && npm test --silent) || failed=1
elif compgen -G "tests/test_*.py" >/dev/null || compgen -G "app/test_*.py" >/dev/null; then
  if [ -n "$PY" ] && "$PY" -c "import pytest" 2>/dev/null; then "$PY" -m pytest -q || failed=1; elif command -v uvx >/dev/null; then uvx pytest -q || failed=1
  else echo "   FAIL: pytest is missing. Install it with: python -m pip install pytest"; failed=1; fi
else echo "   no tests yet"; fi

if [ "$failed" -eq 0 ]; then echo "ALL CHECKS PASSED"; else echo "CHECKS FAILED"; exit 1; fi
