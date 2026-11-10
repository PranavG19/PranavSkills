#!/bin/bash
# Screenshot an explainer page as 1440x900 slices: first (as a reader lands, no guess made), then light, dark,
# and all-drawers-open with every in-figure guess answered right and the 5 fact blanks filled; then narrow, 390x844 slices of
# the first state (run in a 390px iframe, since headless Chrome will not open a window under 500). Then runs budget.sh.
# Then every hero story step: hero-N-1440.png and hero-N-390.png (the figure), and hero-N-blind.png (the board at 1440 with every
# word hidden, for the blind test). Shots run with normal motion, as readers see the page; transitions finish within the budget.
# usage: shoot.sh <page.html> <out-dir>
# A full-height render is cut into screen-height slices, so the sticky rail shows only in slice 0.
set -eu
SRC=$(cd "$(dirname "$1")" && pwd)/$(basename "$1")
mkdir -p "$2/tmp"; OUT=$(cd "$2" && pwd); TMP="$OUT/tmp"
CH=${CHROME:-"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"}
# Variants live in the out dir; a <base> tag keeps the source's relative links working.
DIR=$(dirname "$SRC"); BASE=shoot
sed "s#<head>#<head><base href=\"file://$DIR/\">#" "$SRC" > "$TMP/$BASE-first.html"
# Opens each guess (clicks the asked button), clicks every right answer (data-answer, set by the page script), then Check.
sed 's#</body>#<script>document.querySelectorAll("figure[data-ask]").forEach((f) => { const b = f.querySelector(".scen [data-s=\x27" + f.dataset.ask + "\x27]"); if (b) b.click(); }); document.querySelectorAll("[data-answer]").forEach((p) => p.dispatchEvent(new MouseEvent("click", { bubbles: true }))); document.querySelectorAll(".ask .check:not([hidden]), .guess .check").forEach((b) => b.click()); document.querySelectorAll(".napkin [data-act=all]").forEach((b) => b.click())</script></body>#' "$TMP/$BASE-first.html" > "$TMP/$BASE-light.html"
sed 's/data-theme="light"/data-theme="dark"/' "$TMP/$BASE-light.html" > "$TMP/$BASE-dark.html"
sed 's/<details>/<details open>/g' "$TMP/$BASE-light.html" > "$TMP/$BASE-open.html"
DIR=$TMP

for name in first light dark open; do
  f="$DIR/$BASE-$name.html"
  probe="$DIR/$BASE-$name-probe.html"
  sed 's#</body>#<script>addEventListener("load",()=>{document.body.dataset.h=document.documentElement.scrollHeight})</script></body>#' "$f" > "$probe"
  h=$("$CH" --headless=new --disable-gpu --window-size=1440,900 --virtual-time-budget=1500 --dump-dom "file://$probe" 2>/dev/null | grep -o 'data-h="[0-9]*"' | grep -o '[0-9]*')
  "$CH" --headless=new --disable-gpu --hide-scrollbars --virtual-time-budget=6000 \
    --window-size=1440,"$h" --screenshot="$OUT/$name-full.png" "file://$f" >/dev/null 2>&1
  i=0; y=0
  while [ "$y" -lt "$h" ]; do
    echo "<html><body style='margin:0;overflow:hidden'><img src='file://$OUT/$name-full.png' style='display:block;margin-top:-${y}px'></body></html>" > "$TMP/slice.html"
    "$CH" --headless=new --disable-gpu --hide-scrollbars --allow-file-access-from-files \
      --window-size=1440,900 --screenshot="$OUT/$name-$i.png" "file://$TMP/slice.html" >/dev/null 2>&1
    i=$((i + 1)); y=$((y + 900))
  done
  echo "$name: height ${h}px, $i slices"
done
# Narrow: the first state inside a 390px srcdoc iframe; measure its height, render it, crop to 390 wide, cut 844px slices.
node -e 'const fs = require("fs"), [src, out, h] = process.argv.slice(1);
const page = fs.readFileSync(src, "utf8").replace("</body>", () => `<script>addEventListener("load",()=>setTimeout(()=>{parent.document.body.dataset.h=document.documentElement.scrollHeight},800))</script></body>`);
const esc = page.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
fs.writeFileSync(out, `<!doctype html><html><body style="margin:0"><iframe style="border:0;display:block;margin-left:1px" width="390" height="${h}" scrolling="no" srcdoc="${esc}"></iframe></body></html>`);' "$TMP/$BASE-first.html" "$TMP/narrow-probe.html" 844
h=$("$CH" --headless=new --disable-gpu --window-size=500,844 --virtual-time-budget=3000 --dump-dom "file://$TMP/narrow-probe.html" 2>/dev/null | grep -o 'data-h="[0-9]*"' | grep -o '[0-9]*')
node -e 'const fs = require("fs"), [inp, out, h] = process.argv.slice(1); fs.writeFileSync(out, fs.readFileSync(inp, "utf8").replace(/height="844"/, `height="${h}"`));' "$TMP/narrow-probe.html" "$TMP/narrow.html" "$h"
"$CH" --headless=new --disable-gpu --hide-scrollbars --virtual-time-budget=6000 --window-size=500,"$h" --screenshot="$TMP/narrow-wide.png" "file://$TMP/narrow.html" >/dev/null 2>&1
# sips treats an offset of 0 0 as "center", so the iframe sits 1px in and the crop starts at x=1.
sips -c "$h" 390 --cropOffset 0 1 "$TMP/narrow-wide.png" --out "$OUT/narrow-full.png" >/dev/null
i=0; y=0
while [ "$y" -lt "$h" ]; do
  sips -c 844 390 --cropOffset "$y" 1 "$TMP/narrow-wide.png" --out "$OUT/narrow-$i.png" >/dev/null
  i=$((i + 1)); y=$((y + 844))
done
echo "narrow: height ${h}px, $i slices"
# Hero story steps. A probe reads the step count and the figure's and board's boxes at 1440 and at 390.
rect='addEventListener("load",()=>setTimeout(()=>{const t=(window.parent!==window?parent.document:document).body,f=document.querySelector(".herostory"),b=f&&f.querySelector(".hs-board svg");if(!f)return;const r=(e)=>{const x=e.getBoundingClientRect();return [Math.round(x.left),Math.round(x.top+scrollY),Math.round(x.width),Math.round(x.height)].join(" ")};t.dataset.hn=heroStory.N;t.dataset.fig=r(f);t.dataset.brd=r(b)},900))'
# inject <page> <out> <html>: put a snippet before </body> (node, not sed, since snippets hold & and #).
inject() { SNIP="$3" node -e 'const fs = require("fs"); fs.writeFileSync(process.argv[2], fs.readFileSync(process.argv[1], "utf8").replace("</body>", () => process.env.SNIP + "</body>"))' "$1" "$2"; }
inject "$TMP/$BASE-first.html" "$TMP/hero-probe.html" "<script>$rect</script>"
dom=$("$CH" --headless=new --disable-gpu --window-size=1440,900 --virtual-time-budget=3000 --dump-dom "file://$TMP/hero-probe.html" 2>/dev/null)
HN=$(echo "$dom" | grep -o 'data-hn="[0-9]*"' | grep -o '[0-9]*' || true)
if [ -n "$HN" ]; then
  read -r FX FY FW FH <<< "$(echo "$dom" | grep -o 'data-fig="[0-9 -]*"' | sed 's/.*="\(.*\)"/\1/')"
  read -r BX BY BW BH <<< "$(echo "$dom" | grep -o 'data-brd="[0-9 -]*"' | sed 's/.*="\(.*\)"/\1/')"
  RECT="$rect" node -e 'const fs = require("fs"), [src, out] = process.argv.slice(1), rect = process.env.RECT;
    const page = fs.readFileSync(src, "utf8").replace("</body>", () => `<script>${rect}</script></body>`).replace(/&/g, "&amp;").replace(/"/g, "&quot;");
    fs.writeFileSync(out, `<!doctype html><html><body style="margin:0"><iframe style="border:0;display:block;margin-left:1px" width="390" height="1400" scrolling="no" srcdoc="${page}"></iframe></body></html>`);' "$TMP/$BASE-first.html" "$TMP/hero-nprobe.html"
  ndom=$("$CH" --headless=new --disable-gpu --window-size=500,1400 --virtual-time-budget=3000 --dump-dom "file://$TMP/hero-nprobe.html" 2>/dev/null)
  read -r NX NY NW NH <<< "$(echo "$ndom" | grep -o 'data-fig="[0-9 -]*"' | sed 's/.*="\(.*\)"/\1/')"
  for n in $(seq 1 "$HN"); do
    go="<script>addEventListener('load',()=>heroStory.set($n,'force'))</script>"
    inject "$TMP/$BASE-first.html" "$TMP/hero-$n.html" "$go"
    inject "$TMP/$BASE-first.html" "$TMP/hero-$n-blind.html" "<style>.herostory .board text{visibility:hidden!important}</style>$go"
    H=$((FY + FH + 20))
    "$CH" --headless=new --disable-gpu --hide-scrollbars --virtual-time-budget=2500 --window-size=1440,"$H" --screenshot="$TMP/h.png" "file://$TMP/hero-$n.html" >/dev/null 2>&1
    sips -c "$FH" "$FW" --cropOffset "$FY" "$FX" "$TMP/h.png" --out "$OUT/hero-$n-1440.png" >/dev/null
    "$CH" --headless=new --disable-gpu --hide-scrollbars --virtual-time-budget=2500 --window-size=1440,"$H" --screenshot="$TMP/h.png" "file://$TMP/hero-$n-blind.html" >/dev/null 2>&1
    sips -c "$BH" "$BW" --cropOffset "$BY" "$BX" "$TMP/h.png" --out "$OUT/hero-$n-blind.png" >/dev/null
    node -e 'const fs = require("fs"), [src, out, n] = process.argv.slice(1);
      const page = fs.readFileSync(src, "utf8").replace("</body>", () => `<script>addEventListener("load",()=>heroStory.set(${n},"force"))</script></body>`).replace(/&/g, "&amp;").replace(/"/g, "&quot;");
      fs.writeFileSync(out, `<!doctype html><html><body style="margin:0"><iframe style="border:0;display:block;margin-left:1px" width="390" height="1400" scrolling="no" srcdoc="${page}"></iframe></body></html>`);' "$TMP/$BASE-first.html" "$TMP/hero-$n-narrow.html" "$n"
    "$CH" --headless=new --disable-gpu --hide-scrollbars --virtual-time-budget=2500 --window-size=500,1400 --screenshot="$TMP/hn.png" "file://$TMP/hero-$n-narrow.html" >/dev/null 2>&1
    sips -c "$NH" 390 --cropOffset "$NY" 1 "$TMP/hn.png" --out "$OUT/hero-$n-390.png" >/dev/null
  done
  echo "hero: $HN steps at 1440, 390 and blind"
fi
"$(dirname "$0")/budget.sh" "$SRC"
