#!/usr/bin/env python3
"""
Rebuild knowledge/_INDEX.md from the front-matter of every knowledge document.

The index is what eos-context reads. A document without front-matter does not
exist to the system, and this script reports those loudly.

Usage:  python3 .claude/tools/build_index.py [knowledge_dir]
"""
from __future__ import annotations

import re
import sys
from pathlib import Path
from datetime import date, datetime

LAYERS = ["business", "product", "technical", "design", "seo", "ai", "standards"]
STALE_AFTER_DAYS = 365


def parse_front_matter(path: Path) -> dict | None:
    text = path.read_text(encoding="utf-8")
    m = re.match(r"^---\n(.*?)\n---\n", text, re.S)
    if not m:
        return None
    meta: dict = {}
    for line in m.group(1).split("\n"):
        if ":" not in line or line.strip().startswith("#"):
            continue
        k, v = line.split(":", 1)
        v = v.strip()
        if v.startswith("[") and v.endswith("]"):
            meta[k.strip()] = [x.strip() for x in v[1:-1].split(",") if x.strip()]
        else:
            meta[k.strip()] = v
    return meta


def staleness(meta: dict) -> str:
    if meta.get("status") in ("stale", "superseded"):
        return meta["status"]
    reviewed = meta.get("reviewed", "")
    try:
        d = datetime.strptime(str(reviewed), "%Y-%m-%d").date()
    except (ValueError, TypeError):
        return "unknown"
    return "STALE" if (date.today() - d).days > STALE_AFTER_DAYS else "current"


def main(root: Path) -> int:
    docs, missing = [], []
    for p in sorted(root.rglob("*.md")):
        if p.name.startswith("_"):
            continue
        meta = parse_front_matter(p)
        if meta is None:
            missing.append(p.relative_to(root))
            continue
        meta["_path"] = p.relative_to(root).as_posix()
        meta["_status"] = staleness(meta)
        docs.append(meta)

    counts = {l: sum(1 for d in docs if d.get("layer") == l) for l in LAYERS}

    out = ["# Knowledge Index", "",
           "The catalogue `eos-context` reads. **Generated — do not hand-edit.**", "",
           "```bash", "python3 .claude/tools/build_index.py", "```", "",
           f"Documents: **{len(docs)}**  ·  Rebuilt: {date.today()}", "",
           "## Layers", "",
           "| Layer | Documents |", "|---|---|"]
    out += [f"| {l} | {counts[l]} |" for l in LAYERS]

    out += ["", "## Catalogue", "",
            "| Document | Layer | Description | Tags | Priority | Reviewed | Status |",
            "|---|---|---|---|---|---|---|"]
    for d in sorted(docs, key=lambda x: (x.get("layer", "zz"), x["_path"])):
        tags = ", ".join(d.get("tags", []))[:70]
        out.append(
            f"| `{d['_path']}` | {d.get('layer','?')} | {d.get('description','')[:80]} "
            f"| {tags} | {d.get('priority','normal')} | {d.get('reviewed','?')} "
            f"| {d['_status']} |")

    # capability -> documents, the reverse map the router uses
    caps: dict[str, list[str]] = {}
    for d in docs:
        for c in d.get("capabilities", []):
            caps.setdefault(c, []).append(d["_path"])
    if caps:
        out += ["", "## Capability map", "", "| Capability | Documents |", "|---|---|"]
        out += [f"| {c} | {', '.join(f'`{p}`' for p in sorted(v))} |"
                for c, v in sorted(caps.items())]

    # tag -> documents
    tags_map: dict[str, list[str]] = {}
    for d in docs:
        for t in d.get("tags", []):
            tags_map.setdefault(t, []).append(d["_path"])
    if tags_map:
        out += ["", "## Tag map", "", "| Tag | Documents |", "|---|---|"]
        out += [f"| {t} | {', '.join(f'`{p}`' for p in sorted(v))} |"
                for t, v in sorted(tags_map.items())]

    stale = [d for d in docs if d["_status"] in ("STALE", "stale", "unknown")]
    if stale:
        out += ["", "## Needs review", "",
                "| Document | Reviewed | Status |", "|---|---|---|"]
        out += [f"| `{d['_path']}` | {d.get('reviewed','?')} | {d['_status']} |"
                for d in stale]

    if missing:
        out += ["", "## INVISIBLE TO THE SYSTEM (no front-matter)", "",
                "These documents cannot be discovered. Add front-matter per "
                "`_SCHEMA.md`.", ""]
        out += [f"- `{p}`" for p in missing]

    (root / "_INDEX.md").write_text("\n".join(out) + "\n", encoding="utf-8")

    print(f"indexed {len(docs)} documents across {sum(1 for c in counts.values() if c)} layers")
    if stale:
        print(f"WARNING: {len(stale)} document(s) need review")
    if missing:
        print(f"WARNING: {len(missing)} document(s) have no front-matter and are invisible")
    return 1 if missing else 0


if __name__ == "__main__":
    base = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("knowledge")
    if not base.exists():
        print(f"no knowledge directory at {base} — run /onboard first")
        sys.exit(1)
    sys.exit(main(base))
