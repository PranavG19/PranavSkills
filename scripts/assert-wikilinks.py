#!/usr/bin/env python3
"""
Assert every [[wikilink]] in a knowledge domain resolves to an actual .md file.
Exits 0 on pass, 1 on fail. Prints all broken and dangling-resolvable links.

Usage: python3 assert-wikilinks.py [domain]
  domain defaults to 'agent-arch'. Must be a bare name (no flags).

Uses Obsidian's "shortest path" resolution: a bare [[name]] matches any
file named name.md anywhere in the vault. A [[folder/name]] matches
relative to the vault root.

DANGLING-RESOLVABLE: a link whose target does not resolve by the standard
rules but where a file with a name-variant match exists (e.g. [[Iron Mountain]]
-> IronMountain.md). These are reported separately and counted as failures
so the count cannot drift silently.
"""
import re, os, sys

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))

# The vault does not live in this repo. This repo is the portable installer and
# it must contain no knowledge/ directory at all, because knowledge here is
# internal and this remote is public. Resolve the vault the same way
# `recall` does, so the validator and the reader can never disagree about
# which tree they are looking at.
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

# Skip non-record files (metadata/docs that may contain example wikilinks)
SKIP_FILES = {'INDEX.md', 'COVERAGE.md', 'DECISIONS.md', 'code-review.md', 'AGENTS.md'}

WIKILINK_RE = re.compile(r'\[\[([^\]|]+?)(?:\|[^\]]+?)?\]\]')
INLINE_CODE_RE = re.compile(r'`[^`]+`')

ALIAS_LINE_RE = re.compile(r'^\s*(?:aliases|alias)\s*:\s*(.*)$')
ALIAS_ITEM_RE = re.compile(r'^\s*-\s+(.*)$')


def read_aliases(filepath):
    """Return the frontmatter aliases of one file.

    Obsidian resolves a wikilink against a note's aliases as well as its
    filename, so a validator that ignores aliases disagrees with the tool the
    vault is actually read in. That disagreement is the whole bug this
    function exists to remove: 22 links in one flat domain resolve correctly in
    Obsidian and were reported here as failures.

    Handles both YAML forms in use, the inline ``aliases: [A, B]`` that
    a flat domain writes and the block list form.
    """
    aliases = []
    try:
        with open(filepath) as f:
            if f.readline().strip() != '---':
                return aliases
            collecting = False
            for line in f:
                stripped = line.strip()
                if stripped == '---':
                    break
                match = ALIAS_LINE_RE.match(line)
                if match:
                    rest = match.group(1).strip()
                    if rest.startswith('['):
                        inner = rest.strip('[]')
                        aliases.extend(
                            part.strip().strip('"\'')
                            for part in inner.split(',')
                        )
                        collecting = False
                    else:
                        # A block list follows on subsequent lines.
                        collecting = not rest
                        if rest:
                            aliases.append(rest.strip('"\''))
                    continue
                if collecting:
                    item = ALIAS_ITEM_RE.match(line)
                    if item:
                        aliases.append(item.group(1).strip().strip('"\''))
                    elif stripped and not line.startswith((' ', '\t')):
                        collecting = False
    except OSError:
        return aliases
    return [a for a in aliases if a]


def build_filename_index(kb_root):
    """Build a map of basename (no extension) -> relative path for all .md files.
    Keys are lowercased for case-insensitive matching (Obsidian behavior).
    Declared frontmatter aliases are indexed the same way, because Obsidian
    resolves them too. A filename always wins over an alias on collision."""
    index = {}
    alias_index = {}
    for root, dirs, files in os.walk(kb_root):
        dirs[:] = [d for d in dirs if not d.startswith('.')]
        for fn in files:
            if not fn.endswith('.md'):
                continue
            basename = fn[:-3]  # strip .md
            key = basename.lower()
            full_path = os.path.join(root, fn)
            rel_path = os.path.relpath(full_path, kb_root)
            if key in index:
                if isinstance(index[key], list):
                    index[key].append(rel_path)
                else:
                    index[key] = [index[key], rel_path]
            else:
                index[key] = rel_path
            for alias in read_aliases(full_path):
                alias_key = alias.lower()
                if alias_key in alias_index and alias_index[alias_key] != rel_path:
                    existing = alias_index[alias_key]
                    if isinstance(existing, list):
                        existing.append(rel_path)
                    else:
                        alias_index[alias_key] = [existing, rel_path]
                else:
                    alias_index[alias_key] = rel_path
    for alias_key, rel_path in alias_index.items():
        index.setdefault(alias_key, rel_path)
    return index

def extract_wikilinks(filepath):
    """Extract all wikilink targets from a markdown file, ignoring code."""
    links = []
    in_frontmatter = False
    in_fenced_block = False
    with open(filepath) as f:
        for lineno, line in enumerate(f, 1):
            stripped = line.strip()
            if lineno == 1 and stripped == '---':
                in_frontmatter = True
                continue
            if in_frontmatter:
                if stripped == '---':
                    in_frontmatter = False
                continue
            if stripped.startswith('```') or stripped.startswith('~~~'):
                in_fenced_block = not in_fenced_block
                continue
            if in_fenced_block:
                continue
            clean_line = INLINE_CODE_RE.sub('', line)
            for m in WIKILINK_RE.finditer(clean_line):
                target = m.group(1).strip()
                links.append((lineno, target))
    return links

def resolve_link(target, index, kb_root):
    """Try to resolve a wikilink. Returns (resolved: bool, variant_path: str|None).
    variant_path is set when the link doesn't resolve by standard rules but a
    name-variant file exists (DANGLING-RESOLVABLE)."""
    # Strip anchor fragments (e.g. [[Kestrel#Sources]] -> Kestrel)
    if '#' in target:
        target = target.split('#')[0]

    # If target contains a path separator, resolve relative to vault root
    if '/' in target:
        candidate = target + '.md'
        return (os.path.isfile(os.path.join(kb_root, candidate)), None)

    key = target.lower()

    # Exact match (case-insensitive)
    if key in index:
        return (True, None)

    # Space-to-hyphen (Obsidian resolves both)
    key_hyphen = key.replace(' ', '-')
    if key_hyphen in index:
        return (True, None)

    # --- Name-variant search for DANGLING-RESOLVABLE ---
    # Strip hyphens, spaces, parens to get a normalized form
    def normalize(s):
        return re.sub(r'[-\s()\.]', '', s).lower()

    norm_target = normalize(target)
    if norm_target:
        for idx_key, idx_path in index.items():
            if normalize(idx_key) == norm_target:
                path = idx_path if isinstance(idx_path, str) else idx_path[0]
                return (False, path)

    return (False, None)

def main():
    index = build_filename_index(KB_ROOT)
    broken = []
    dangling = []
    total_links = 0

    for root, dirs, files in os.walk(KB_ROOT):
        dirs[:] = [d for d in dirs if not d.startswith('.')]
        for fn in files:
            if not fn.endswith('.md'):
                continue
            if fn in SKIP_FILES:
                continue
            filepath = os.path.join(root, fn)
            rel_path = os.path.relpath(filepath, KB_ROOT)

            links = extract_wikilinks(filepath)
            for lineno, target in links:
                total_links += 1
                resolved, variant = resolve_link(target, index, KB_ROOT)
                if not resolved:
                    if variant:
                        dangling.append(f"  DANGLING-RESOLVABLE: {rel_path}:{lineno} -> [[{target}]] -> {variant}")
                    else:
                        broken.append(f"  BROKEN: {rel_path}:{lineno} -> [[{target}]]")

    print(f"Scanned {total_links} wikilink(s) across the vault.")

    if dangling:
        print(f"\n{len(dangling)} dangling-resolvable link(s) (name-variant target exists):")
        for d in dangling:
            print(d)

    if broken:
        print(f"\n{len(broken)} broken link(s) (no target found):")
        for b in broken:
            print(b)

    total_issues = len(broken) + len(dangling)
    if total_issues:
        print(f"\nFAIL: {total_issues} issue(s) ({len(broken)} broken, {len(dangling)} dangling-resolvable)")
        return 1
    else:
        print("\nPASS: all wikilinks resolve.")
        return 0

if __name__ == "__main__":
    sys.exit(main())
