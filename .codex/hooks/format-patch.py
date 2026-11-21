"""Format regular files named by a Codex apply_patch call."""
import json
import re
import subprocess
import sys
from pathlib import Path

event = json.load(sys.stdin)
patch = event.get("tool_input", {}).get("command")
if not isinstance(patch, str) or not event.get("cwd"):
    sys.exit(0)

root = Path(__file__).resolve().parents[2]
cwd = Path(event["cwd"])
files = set()
lines = patch.splitlines()
for index, line in enumerate(lines):
    match = re.fullmatch(r"\*\*\* (Add File|Update File): (.+)", line)
    if not match:
        continue
    name = match[2]
    if match[1] == "Update File" and lines[index + 1:index + 2]:
        move = lines[index + 1].removeprefix("*** Move to: ")
        if move != lines[index + 1]:
            name = move
    path = cwd / name
    if path.is_file() and not path.is_symlink() and path.resolve().is_relative_to(root):
        files.add(str(path.resolve()))

if files:
    subprocess.run([root / "node_modules/.bin/prettier", "--write", "--ignore-unknown",
                    "--", *sorted(files)], cwd=root, stdout=subprocess.DEVNULL, check=True)
