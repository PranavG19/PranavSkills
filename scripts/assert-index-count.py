#!/usr/bin/env python3
"""
Assert INDEX.md entry count matches actual files on disk.
Exits 0 on pass, 1 on fail. Prints discrepancies.

Usage: python3 assert-index-count.py [domain]
  domain defaults to 'agent-arch'. Must be a bare name (no flags).

Supports two section styles:
  1. Enumerated: per-file entries like - [name](path) -- desc
     (layered style) -- compared file-by-file
  2. Count-declared: header carries a count like ## components (921 ...)
     (flat style) -- compared by declared count vs disk count
"""
import re, os, sys

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))

# The vault does not live in this repo. See the same block in
# assert-wikilinks.py for why.
KB_BASE = os.environ.get("AGENT_KNOWLEDGE_DIR") or os.path.expanduser(
    "~/agents/knowledge"
)
if not os.path.isdir(KB_BASE):
    print(
        "vault not found at %s\n"
        "Set AGENT_KNOWLEDGE_DIR, or install it to ~/agents/knowledge." % KB_BASE,
        file=sys.stderr,
    )
    sys.exit(2)

def discover_domains():
    """Return sorted list of domains that have an INDEX.md."""
    domains = []
    if os.path.isdir(KB_BASE):
        for d in sorted(os.listdir(KB_BASE)):
            if os.path.isfile(os.path.join(KB_BASE, d, "INDEX.md")):
                domains.append(d)
    return domains

def usage_and_exit():
    available = discover_domains()
    print(f"Usage: {sys.argv[0]} [domain]", file=sys.stderr)
    print(f"  domain: bare name, no flags. Default: agent-arch", file=sys.stderr)
    print(f"  Available domains: {', '.join(available)}", file=sys.stderr)
    sys.exit(1)

# Parse argument
if len(sys.argv) > 2:
    usage_and_exit()
if len(sys.argv) == 2:
    arg = sys.argv[1]
    if arg.startswith('-'):
        print(f"Error: unrecognized flag '{arg}'", file=sys.stderr)
        usage_and_exit()
    domain = arg
else:
    domain = "agent-arch"

KB_ROOT = os.path.join(KB_BASE, domain)
INDEX_PATH = os.path.join(KB_ROOT, "INDEX.md")

if not os.path.isfile(INDEX_PATH):
    print(f"Error: no INDEX.md found for domain '{domain}' at {INDEX_PATH}", file=sys.stderr)
    available = discover_domains()
    print(f"  Available domains: {', '.join(available)}", file=sys.stderr)
    sys.exit(1)

def parse_index(path):
    """Parse INDEX.md. Return {section: [paths]} and {section: declared_count}."""
    sections = {}
    declared_counts = {}
    current_section = None
    with open(path) as f:
        for line in f:
            # Section headers like ## semantic (N ...) or ## components (921 ...)
            m = re.match(r'^## (\S+)', line)
            if m:
                current_section = m.group(1)
                sections[current_section] = []
                # Extract leading number from parenthetical if present
                cm = re.search(r'\((\d+)\s', line)
                if cm:
                    declared_counts[current_section] = int(cm.group(1))
                continue
            # Entry lines like - [name](path) -- desc
            m = re.match(r'^- \[.*?\]\((.+?)\)', line)
            if m and current_section:
                sections[current_section].append(m.group(1))
    return sections, declared_counts

def scan_disk(kb_root):
    """Scan disk for actual .md records, return {section: [relative_paths]}."""
    skip_files = {'INDEX.md', 'COVERAGE.md', 'DECISIONS.md', 'code-review.md', 'AGENTS.md'}
    sections = {}
    for root, dirs, files in os.walk(kb_root):
        # Skip hidden directories
        dirs[:] = [d for d in dirs if not d.startswith('.')]
        rel_root = os.path.relpath(root, kb_root)
        if rel_root == '.':
            continue
        # Top-level section is the first path component
        section = rel_root.split(os.sep)[0]
        for fn in files:
            if not fn.endswith('.md') or fn in skip_files:
                continue
            rel_path = os.path.relpath(os.path.join(root, fn), kb_root)
            sections.setdefault(section, []).append(rel_path)
    return sections

def main():
    sections, declared_counts = parse_index(INDEX_PATH)
    disk = scan_disk(KB_ROOT)

    # Get declared record-count from frontmatter
    with open(INDEX_PATH) as f:
        content = f.read()
    m = re.search(r'record-count:\s*(\d+)', content)
    declared_total = int(m.group(1)) if m else None

    errors = []
    total_index = 0
    total_disk = 0

    all_sections = sorted(set(list(sections.keys()) + list(disk.keys())))
    for section in all_sections:
        idx_files = sorted(sections.get(section, []))
        dsk_files = sorted(disk.get(section, []))
        disk_count = len(dsk_files)
        total_disk += disk_count

        if idx_files:
            # Enumerated section: compare file-by-file
            total_index += len(idx_files)
            if idx_files != dsk_files:
                in_index_only = set(idx_files) - set(dsk_files)
                on_disk_only = set(dsk_files) - set(idx_files)
                if in_index_only:
                    errors.append(f"  [{section}] in INDEX but not on disk: {in_index_only}")
                if on_disk_only:
                    errors.append(f"  [{section}] on disk but not in INDEX: {on_disk_only}")
            print(f"  {section}: index={len(idx_files)} disk={disk_count} {'OK' if idx_files == dsk_files else 'MISMATCH'}")
        elif section in declared_counts:
            # Count-declared section: compare declared count vs disk count
            dc = declared_counts[section]
            total_index += dc
            ok = dc == disk_count
            if not ok:
                errors.append(f"  [{section}] declared={dc} but disk={disk_count}")
            print(f"  {section}: declared={dc} disk={disk_count} {'OK' if ok else 'MISMATCH'}")
        else:
            # Section on disk but not in INDEX at all
            errors.append(f"  [{section}] on disk ({disk_count} files) but not in INDEX")
            print(f"  {section}: index=MISSING disk={disk_count} MISMATCH")

    print(f"\n  Total: index={total_index} disk={total_disk}", end="")
    if declared_total is not None:
        print(f" declared={declared_total}", end="")
        if declared_total != total_disk:
            errors.append(f"  Frontmatter record-count ({declared_total}) != disk total ({total_disk})")
    print()

    if errors:
        print("\nFAIL:")
        for e in errors:
            print(e)
        return 1
    else:
        print("\nPASS: all sections match, all counts agree.")
        return 0

if __name__ == "__main__":
    sys.exit(main())
