"""Run the local API and Vite dashboard as one development session."""
from __future__ import annotations

import os
import subprocess
import sys
import threading
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def main() -> int:
    api = subprocess.Popen(
        [sys.executable, "-u", "-m", "iwa.cli", "serve"],
        cwd=ROOT,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
    )
    assert api.stdout is not None
    address = api.stdout.readline().strip().removeprefix("Informal Work Atlas: ")
    if not address.startswith("http://"):
        api.terminate()
        raise RuntimeError(f"Local API failed to start: {address or 'no startup message'}")
    print(f"API: {address}", flush=True)
    def relay_api_output() -> None:
        for line in api.stdout or ():
            print(line, end="", flush=True)

    threading.Thread(target=relay_api_output, daemon=True).start()
    environment = os.environ.copy()
    environment["VITE_API_TARGET"] = address
    frontend = subprocess.Popen(["pnpm", "dev"], cwd=ROOT, env=environment)
    try:
        return frontend.wait()
    except KeyboardInterrupt:
        return 130
    finally:
        if frontend.poll() is None:
            frontend.terminate()
            frontend.wait(timeout=5)
        api.terminate()
        try:
            api.wait(timeout=5)
        except subprocess.TimeoutExpired:
            api.kill()
            api.wait()


if __name__ == "__main__":
    raise SystemExit(main())
