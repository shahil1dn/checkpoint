"""Prove the Mistral API key works: list the usable models, then make one tiny chat call."""
import json
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path

API = "https://api.mistral.ai/v1"
MODEL = os.environ.get("MISTRAL_MODEL", "mistral-large-4")


def read_key() -> str:
    key = os.environ.get("MISTRAL_API_KEY", "")
    env_file = Path(__file__).resolve().parent.parent / ".env"
    if not key and env_file.exists():
        for line in env_file.read_text().splitlines():
            if line.startswith("MISTRAL_API_KEY="):
                key = line.split("=", 1)[1].strip().strip('"')
    if not key:
        sys.exit("No key: put MISTRAL_API_KEY=... in .env (copy .env.example).")
    return key


def call(path: str, key: str, body: dict | None = None) -> dict:
    request = urllib.request.Request(
        API + path,
        data=json.dumps(body).encode() if body else None,
        headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            return json.load(response)
    except urllib.error.HTTPError as error:
        sys.exit(f"Mistral said {error.code} on {path}: {error.read().decode()[:300]}")


def main() -> None:
    key = read_key()
    models = sorted(m["id"] for m in call("/models", key)["data"])
    large = [m for m in models if "large" in m]
    print(f"{len(models)} models available. Large ones: {', '.join(large) or 'none'}")

    reply = call("/chat/completions", key, {
        "model": MODEL,
        "messages": [{"role": "user", "content": "Reply with exactly: chonk ok"}],
        "max_tokens": 400,  # Large 4 thinks before answering; the budget covers both
    })
    content = reply["choices"][0]["message"]["content"]
    if isinstance(content, list):  # reasoning models send thinking and answer as separate parts
        content = "".join(part.get("text", "") for part in content if part["type"] == "text")
    print(f"{reply['model']} answered: {content!r}")


if __name__ == "__main__":
    main()
