#!/bin/bash
# Fact-check a page against its source, run by fresh models. Two passes run in parallel and their items merge:
#   guard  the workflow's fact-check question, verbatim (the keep decision counts this one)
#   sweep  the truth judge's rubric, verbatim: title and headings, then every label, outcome and blank, then prose.
#          It also counts dropped scope ('normally' removed, a conditional step made unconditional, a stage moved),
#          a behavior put in the wrong component, and inferred points shown as settled. The guard pass missed
#          all of these on pages the truth judge then marked down.
# usage: factcheck.sh <page.html> <source>    writes <page>.facts.txt, one "[pass] item" per line (empty when clean).
# Exits 0 when the list is empty, 1 when it has items, 2 when a check itself failed (no answer).
# Do not reword either prompt; only PAGE and PACK are filled in.
set -u
PAGE=$(cd "$(dirname "$1")" && pwd)/$(basename "$1")
PACK=$(cd "$(dirname "$2")" && pwd)/$(basename "$2")
OUT="${PAGE%.html}.facts.txt"
GUARD="Fact-check $PAGE against its only source $PACK. List every claim on the page (including inside interactive states, simulation outputs, and expanders; read the HTML) that contradicts the source or is unsupported. Ignore simplifications that stay true. Empty list if none."
read -r -d '' TRUTH <<'P'
Compare every claim on the page against the provided facts file. Sweep in this order, because most errors found so far sit in the first two steps. (1) The <title>, the H1, any eyebrow or date line, and every section heading. (2) Every figure label, readout, live-caption clause, scenario or attack outcome, guess verdict, the answer behind each recall blank, and napkin label. (3) Prose, table cells, drawers and expanders (open them), and noscript fallbacks. For every figure whose output is computed from reader inputs, also set 3 input combinations that the page's own scenarios and check rows do not show, and check each output against the facts file. A claim is wrong if it contradicts the facts file, if it drops a scope the facts file attaches (a result true only in one stage or environment stated in general, 'nothing reliably' written as 'nothing', a conditional step written as unconditional, 'normally' or 'about' removed, a date or stage moved), or if it puts a behavior in the wrong component. A simplification that stays true is not wrong. Score 100, then subtract 20 for each wrong claim (a wrong answer behind a blank or guess counts, and so does an analogy, naive state or simulation that implies a behavior the real system has without saying it does not), and 10 for each inferred point or invented timing presented as settled fact without an 'inferred' or 'example' mark. Count a wrong claim repeated in several places once. Floor 0. Do not score bugs here. List each wrong claim with the page text or the inputs you set, the facts-file line, and which sweep step found it.
P
SWEEP="Page: $PAGE (read the HTML; every scenario state, readout and recall answer is in its markup or script). Facts file: $PACK.
$TRUTH
Put each wrong claim and each unmarked inferred point in errors as one item, starting with its sweep step. Leave out the score and anything that is true. Empty list if none."
SCHEMA='{"type":"object","required":["errors"],"properties":{"errors":{"type":"array","items":{"type":"string"}}}}'
TMP=$(mktemp -d); trap 'rm -rf "$TMP"' EXIT
ask() { ${CLAUDE:-claude} -p "$1" --output-format json --json-schema "$SCHEMA" --effort "${EFFORT:-medium}" \
  --allowedTools Read Grep Glob --add-dir "$(dirname "$PAGE")" "$(dirname "$PACK")" < /dev/null > "$2" 2>&1; }
ask "$GUARD" "$TMP/guard.json" & ask "$SWEEP" "$TMP/sweep.json" & wait
node -e '
const fs = require("fs"), [dir, out] = process.argv.slice(1);
let items = [], broken = 0;
for (const pass of ["guard", "sweep"]) {
  const raw = fs.readFileSync(dir + "/" + pass + ".json", "utf8");
  let r; try { r = JSON.parse(raw); } catch { console.error(`factcheck ${pass}: no JSON answer:\n` + raw.slice(0, 600)); broken = 1; continue; }
  let o = r.structured_output; if (!o && typeof r.result === "string") { try { o = JSON.parse(r.result.replace(/^```(json)?|```$/g, "")); } catch {} }
  if (!o || !Array.isArray(o.errors)) { console.error(`factcheck ${pass}: answer has no errors list:\n` + JSON.stringify(r).slice(0, 600)); broken = 1; continue; }
  items.push(...o.errors.map((e) => String(e).replace(/\s+/g, " ").trim()).filter(Boolean).map((e) => `[${pass}] ${e}`));
}
fs.writeFileSync(out, items.join("\n") + (items.length ? "\n" : ""));
console.log(`${items.length ? "FAIL" : broken ? "ERR " : "ok  "}  facts     ${items.length} item(s) in ${out}`);
items.forEach((e, i) => console.log(`  ${i + 1}. ${e}`));
process.exit(items.length ? 1 : broken ? 2 : 0);
' "$TMP" "$OUT"
