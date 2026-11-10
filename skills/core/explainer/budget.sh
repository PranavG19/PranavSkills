#!/bin/bash
# Count an explainer page's words the way the reader meets them, at 1440x900 with every drawer closed.
# usage: budget.sh <page.html>    exits 1 when a hard budget fails.
# visible  = every word on screen without a click (prose, figure labels, table cells), minus nav and buttons
# prose    = visible words outside figures and tables (sentences the reader has to read)
# first    = prose words on the first 900px
# drawers  = words inside <details>; must stay under half of the rendered words (economy.js "visible"), so leftovers get cut, not hidden
# effective= economy.js: rendered words + 0.3 x everything hidden; the economy measure
# facts    = economy.js: each of the 5 facts in .keep is on screen, in its figure, with drawers closed and no click
# core     = bottom edge of the first-screen figure (the .herostory, else the first .core); it and its load state's stop mark,
#            if any, must sit on the first 900px
# checks   = red template-check bars (a broken guess, napkin, or predict wiring)
# desync   = figures whose GUESS row is visible while another scenario is selected, checked on load and after
#            asked-button, Show me, other-button clicks; also a visible GUESS row with no question and no result
# deep     = deep items (.deep li) whose answer words are not printed in their figure after at most 1 click (data-via)
# small    = SVG text rendered under 12px, at 1440 and at 390 (the 390 pass runs the page in a 390px iframe,
#            since headless Chrome will not open a window narrower than 500)
# overflow = document scrollWidth minus 390, at 390
# The economy judge's own counters, run verbatim on the fresh page before any click:
# effective= judge visible (body innerText) + 0.3 x the rest of the markup's words; cap 1000
# band     = judge visible words per 900px band of the page; cap 180 in every band
# recall   = items in the closing recall (unique blanks, a napkin part tied by data-n counts once, plus guesses); cap 12
# repeat   = 6-word runs printed twice in visible text outside the recall (one block or SVG <text> is one run of words); 0
# cite-leak= visible text matching [a-z]+.md:N or 'derived from'; sources live in data-src attributes; 0
# multiples= each figure.multiples: 2 to 4 panels, one shared viewBox, an .out line in every panel, a data-diff accent in every
#            panel, at most 4 labels a panel and 12 a figure (SVG text with a letter, plus .mkey entries), no guess, no
#            overflow inside the figure or a panel at 390, and no SVG text cut off at its viewBox edge at 1440 or 390. A section .core or .trace with 2 to 4 scenario buttons warns: turn it
#            into multiples unless the order of its states matters.
# codes    = acronyms (CHG, COD), step codes (E1-3, P4, PAY4), ALL_CAPS_IDS, and bare commit hashes printed in the main flow
#            (every scenario state included, drawers and the recall excluded) that are not inside a data-gloss element holding
#            a .gl gloss, not in their figure's .legend (inside it, or the element right after it), and not glossed earlier; 0
# herostory= the hero story (.herostory): 3 to 5 steps, each caption with data-src and 20 words or fewer; a fresh load paints
#            exactly step 1's marks; #hero-2 loads step 2; the figure and the board keep one height on every step at 1440 and at
#            390 (no layout shift); nothing inside it scrolls at 390; with reduced motion it shows one stacked frame per step;
#            an optional guess (data-ask) asks on the step before it, and any step change clears its feedback.
#            Writes <page>.states.txt: per step, its source, caption, the board's visible words and the data-say of every mark it
#            shows, so factcheck.sh can read the drawing.
# The main pass runs with normal motion, as readers and judges see the page; a third pass forces reduced motion.
set -eu
SRC=$(cd "$(dirname "$1")" && pwd)/$(basename "$1")
CH=${CHROME:-"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"}
STATES="${SRC%.html}.states.txt"; PAGEKEY=$(basename "$SRC" .html)
TMP=$(mktemp -d); trap 'rm -rf "$TMP" "$(dirname "$SRC")/.__budget_${PAGEKEY}_probe.html" "$(dirname "$SRC")/.__budget_${PAGEKEY}_narrow.html" "$(dirname "$SRC")/.__budget_${PAGEKEY}_reduce.html"' EXIT
# The probe runs after load, so figures drawn by JS are counted as drawn.
cat > "$TMP/probe.js" <<'JS'
addEventListener("load", () => setTimeout(async () => {
  // The economy judge's two counters, verbatim, before economy.js or any click changes the page.
  const judge = (()=>{const w=s=>(s.match(/[A-Za-z0-9][^\s]*/g)||[]).length;document.querySelectorAll('details').forEach(d=>d.open=false);const v=w(document.body.innerText);const c=document.body.cloneNode(true);c.querySelectorAll('script,style,noscript,template').forEach(e=>e.remove());const a=w(c.innerHTML.replace(/<[^>]+>/g,' ').replace(/&[a-z#0-9]+;/g,' '));return {visible:v,all:a,effective:Math.round(v+0.3*Math.max(0,a-v))}})();
  const bands = (()=>{document.querySelectorAll('details').forEach(d=>d.open=false);const b={};const t=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);let n;while(n=t.nextNode()){const e=n.parentElement;if(!e||e.closest('script,style,template'))continue;const r=e.getBoundingClientRect();if(!r.width||!r.height||getComputedStyle(e).visibility=='hidden')continue;const k=Math.floor((r.top+scrollY)/900);b[k]=(b[k]||0)+(n.textContent.match(/[A-Za-z0-9][^\s]*/g)||[]).length}return b})();
  // Recall items: every blank the reader fills, a napkin part tied by data-n counted once with its blank, plus any guess in the recall.
  const recallSec = (document.querySelector(".recall, .napkin") || { closest: () => null }).closest("section") || document.querySelector(".recall, .napkin");
  const recall = (() => { if (!recallSec) return { items: 0, counter: 0 };
    const keys = new Set(); [...recallSec.querySelectorAll(".blank")].forEach((b, i) => keys.add(b.dataset.n ? "n" + b.dataset.n : "b" + i));
    recallSec.querySelectorAll(".part").forEach((p) => { if (p.closest(".recall.js") ? !p.classList.contains("fixed") : true) keys.add("n" + p.dataset.n); });
    const guesses = recallSec.querySelectorAll("[data-ask], .guess, [data-turn]").length;
    const m = (recallSec.querySelector(".count") || { textContent: "" }).textContent.match(/of (\d+)/);
    return { items: keys.size + guesses, counter: m ? +m[1] : 0 }; })();
  // Repeats and cite leaks read visible text only, drawers closed. A unit is one SVG <text> or the nearest non-inline HTML box.
  const vis = (el) => { for (let e = el; e && e.nodeType === 1; e = e.parentElement) { const cs = getComputedStyle(e); if (cs.display === "none" || cs.visibility === "hidden") return false; } return !el.closest("details") || !!el.closest("summary"); };
  const unitOf = (el) => { const t = el.closest("svg text"); if (t) return t; let e = el; while (e.parentElement && getComputedStyle(e).display.startsWith("inline")) e = e.parentElement; return e; };
  const units = new Map(), leakText = [];
  { const tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n; (n = tw.nextNode()); ) { const el = n.parentElement; if (!el || el.closest("script,style,noscript,template,.authorwarn,#__budget") || !vis(el) || !n.textContent.trim()) continue;
      leakText.push(n.textContent);
      if (recallSec && recallSec.contains(el)) continue;
      const u = unitOf(el); units.set(u, (units.get(u) || "") + " " + n.textContent); } }
  const grams = new Map(); let ui = 0;
  for (const txt of units.values()) { ui++; const tk = (txt.match(/[A-Za-z0-9][^\s]*/g) || []).map((x) => x.toLowerCase().replace(/[.,:;!?)"'\u2019]+$/, ""));
    for (let i = 0; i + 6 <= tk.length; i++) { const g = tk.slice(i, i + 6).join(" "); const was = grams.get(g); if (!was) grams.set(g, [ui]); else was.push(ui); } }
  const repeats = [...grams.entries()].filter(([, at]) => at.length > 1).map(([g]) => g);
  const leakAll = leakText.join(" ");
  const leaks = [...(leakAll.match(/[a-z]+\.md:[0-9]+/gi) || []), ...(leakAll.match(/derived from/gi) || [])];
  // Codes: walk the main flow in DOM order. A data-gloss element or a .legend glosses the codes it holds for the rest of the page.
  const KNOWN = new Set("CI UI UX PR PRs API APIs HTTP HTTPS SQL HTML CSS JS TS AI ID IDs URL URLs OK CPU GPU OS JSON YAML CLI SDK UTC PST PDT AM PM DB RPC RPCs TCP UDP DNS IP AWS NA EU JP US UK TODO TODOs IO README MIT BSD GPL".split(" "));
  const codeRe = /\b(?=[0-9a-f]*\d)(?=[0-9a-f]*[a-f])[0-9a-f]{7,40}\b|\b[A-Z][A-Z0-9]*_[A-Z0-9_]+\b|\b[A-Z][A-Z0-9]*\d[A-Z0-9]*(?:-\d+)?\b|\b[A-Z]{2,6}s?\b(?!\.[a-z])/g;
  const FIGC = "figure, .tl, .stepper, .diff, .tbl, .multi, .tabs, .trace, .guess";
  const legendOf = (el) => { const c = el.closest(FIGC); if (!c) return null; const own = c.querySelector(".legend"); if (own) return own; const n = c.nextElementSibling; return n && n.matches(".legend") ? n : null; };
  const glossed = new Set(), codeMiss = new Map();
  { const tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n; (n = tw.nextNode()); ) { const el = n.parentElement, txt = n.textContent;
      if (!el || el.closest("script,style,noscript,template,.authorwarn,#__budget,nav,.num,svg .lane,.tag,.eyebrow,.verb") || !txt.trim()) continue;
      if (el.closest("details") && !el.closest("summary")) continue;
      if (recallSec && recallSec.contains(el)) continue;
      if (/[A-Z]/.test(txt) && !/[a-z]/.test(txt) && /[A-Z]+\s+[A-Z]+/.test(txt)) continue; // an all-caps lane label
      const toks = (txt.match(codeRe) || []).filter((t) => !KNOWN.has(t));
      if (!toks.length) continue;
      const g = el.closest("[data-gloss]"), lg = el.closest(".legend");
      if (lg || (g && g.querySelector(".gl"))) { toks.forEach((t) => glossed.add(t)); continue; }
      const leg = legendOf(el), legText = leg ? [...leg.querySelectorAll("*")].map((x) => [...x.childNodes].filter((c) => c.nodeType === 3).map((c) => c.textContent).join(" ")).join(" ") : "";
      for (const t of toks) { if (glossed.has(t) || new RegExp("(^|[^A-Za-z0-9])" + t.replace(/[-]/g, "\\-") + "($|[^A-Za-z0-9])").test(legText)) continue;
        if (!codeMiss.has(t)) codeMiss.set(t, ((el.closest("[id]") || {}).id || "?") + ": " + txt.trim().slice(0, 50)); } } }
  const codes = [...codeMiss.entries()].map(([t, at]) => ({ t, at }));
  const economy = ECONOMY;
  const FIG = "figure,svg,table,.trace,.stepper,.tabs,.multi,.diff,.tl,.core,.napkin,.guess,dl.facts,pre,.legend";
  const SKIP = "script,style,nav,button,.rail,.scen,.controls,.copy,.more,noscript";
  const words = (s) => (s.match(/[\p{L}\p{N}][\p{L}\p{N}'._\/-]*/gu) || []).length;
  const out = { visible: 0, prose: 0, first: 0, drawers: 0, hover: 0, sections: [] };
  const shown = (el) => { for (let e = el; e && e.nodeType === 1; e = e.parentElement) { const cs = getComputedStyle(e); if (cs.display === "none" || cs.visibility === "hidden") return false; } return true; };
  const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const per = new Map();
  for (let n; (n = walk.nextNode()); ) {
    const el = n.parentElement, w = words(n.textContent);
    if (!w || el.closest(SKIP)) continue;
    if (el.closest("details")) { if (!el.closest("summary")) { out.drawers += w; continue; } }
    if (!shown(el)) continue;
    out.visible += w;
    if (el.closest(FIG)) continue;
    out.prose += w;
    if (el.getBoundingClientRect().top + scrollY < innerHeight) out.first += w;
    const s = el.closest("section[id]"); if (s) per.set(s.id, (per.get(s.id) || 0) + w);
  }
  out.hover = document.querySelectorAll("[data-def], svg title, [title]").length;
  const core = document.querySelector(".herostory") || document.querySelector(".core"), stop = core && core.querySelector(".is-stop");
  out.core = core ? Math.round(core.getBoundingClientRect().bottom + scrollY) : -1;
  out.stop = stop ? Math.round(stop.getBoundingClientRect().bottom + scrollY) : -1;
  out.checks = document.querySelectorAll(".authorwarn").length;
  document.querySelectorAll("section[id]").forEach((s) => {
    const own = [...s.querySelectorAll(FIG)].filter((f) => !f.closest("details") && !f.matches("dl.facts,pre"));
    out.sections.push({ id: s.id, prose: per.get(s.id) || 0, figures: own.length });
  });
  const letters = (r) => [...r.querySelectorAll("text")].filter((t) => /\p{L}/u.test(t.textContent) && t.getClientRects().length).length;
  out.multiples = [...document.querySelectorAll("figure.multiples")].map((f) => {
    const panels = [...f.querySelectorAll(".mgrid > .panel")], per = panels.map(letters);
    return { id: f.id || "?", panels: panels.length, vbs: new Set(panels.map((p) => (p.querySelector("svg") || { getAttribute: () => "none" }).getAttribute("viewBox"))).size,
      outs: panels.filter((p) => ((p.querySelector(".out") || {}).textContent || "").trim()).length, diff: panels.filter((p) => p.querySelector(".is-diff")).length,
      per, labels: f.querySelectorAll(".mkey > li").length + per.reduce((a, b) => a + b, 0), ask: f.hasAttribute("data-ask"),
      clip: [...f.querySelectorAll(".panel svg")].reduce((a, g) => { const v = g.getBoundingClientRect(); return a + [...g.querySelectorAll("text")].filter((t) => { const b = t.getBoundingClientRect(); return b.width && (b.left < v.left - 1 || b.right > v.right + 1 || b.top < v.top - 1 || b.bottom > v.bottom + 1); }).length; }, 0) };
  });
  const firstCore = document.querySelector(".core");
  out.toggles = [...document.querySelectorAll("figure.core, figure.trace")].filter((f) => f !== firstCore && !f.closest("details"))
    .map((f) => ({ id: f.id || "?", n: f.querySelectorAll(".scen [data-s]").length })).filter((x) => x.n >= 2 && x.n <= 4);
  out.econ = economy; out.judge = judge; out.bands = bands; out.recall = recall; out.repeats = repeats; out.leaks = leaks; out.codes = codes;
  out.small = SMALL();
  // Hero story: steps, load state, hash, one height per step, the guess lifecycle, and the states export.
  const hs = document.querySelector(".herostory"), HS = window.heroStory;
  if (hs) {
    const caps = [...hs.querySelectorAll(".hs-caps > li")], wc = (t) => (t.match(/[A-Za-z0-9][^\s]*/g) || []).length, wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const H = { n: caps.length, nosrc: caps.map((c, i) => (c.dataset.src ? 0 : i + 1)).filter(Boolean), long: caps.map((c, i) => [i + 1, wc(c.textContent)]).filter(([, w]) => w > 20), engine: !!HS };
    if (HS) {
      const board = HS.board, marks = () => [...board.querySelectorAll("[data-on]")];
      const shownOn = () => JSON.stringify(marks().filter((el) => !el.classList.contains("off") && getComputedStyle(el).visibility !== "hidden").map((el) => el.dataset.on));
      H.first = HS.current() === 1 && shownOn() === JSON.stringify(marks().filter((el) => el.dataset.on.split(/\s+/).includes("1")).map((el) => el.dataset.on));
      H.firstCaption = !!caps[0] && caps[0].classList.contains("now") && getComputedStyle(caps[0]).visibility !== "hidden";
      location.hash = "#hero-2"; await wait(200); H.hash = HS.current() === 2;
      const box = (el) => el.getBoundingClientRect(), next = hs.nextElementSibling;
      H.sizes = [];
      for (let n = 1; n <= H.n; n++) { HS.set(n, "user"); await wait(450);
        H.sizes.push({ n, fig: Math.round(box(hs).height * 10) / 10, board: Math.round(box(board).height * 10) / 10, below: next ? Math.round(box(next).top + scrollY) : 0 }); }
      const spread = (k) => Math.max(...H.sizes.map((x) => x[k])) - Math.min(...H.sizes.map((x) => x[k]));
      H.shift = Math.max(spread("fig"), spread("board"), spread("below"));
      // The guess: asked on the step before data-ask; a wrong pick moves to the asked step with a verdict; a step change clears it.
      const askN = +hs.dataset.ask || 0; H.guess = [];
      if (askN) {
        const q = hs.querySelector(".hs-q"), res = hs.querySelector(".ask .res"), h0 = box(hs).height;
        HS.set(askN - 1, "user"); await wait(100);
        if (!q || q.classList.contains("off")) H.guess.push(`no question on step ${askN - 1}`);
        const wrong = [...board.querySelectorAll("[data-pick]:not([data-answer])")].find((p) => !p.closest(".off"));
        if (wrong) { wrong.dispatchEvent(new MouseEvent("click", { bubbles: true })); await wait(100);
          if (HS.current() !== askN) H.guess.push(`a pick did not move to step ${askN}`);
          if (!res || !res.textContent.trim()) H.guess.push("a pick printed no verdict");
          if (Math.abs(box(hs).height - h0) > 1) H.guess.push(`the verdict changed the figure's height by ${Math.round(box(hs).height - h0)}px`);
          HS.set(askN === 1 ? 2 : 1, "user"); await wait(100);
          if (res && res.textContent.trim()) H.guess.push("a step change left the verdict on screen");
          if (hs.querySelector(".g-pick")) H.guess.push("a step change left the pick marked"); }
        else H.guess.push(`no wrong pick is shown on step ${askN - 1}`);
      }
      // States export: what the board draws on each step and what its caption says.
      const visible = (el) => { for (let e = el; e && e !== board.parentElement; e = e.parentElement) if (e.classList && e.classList.contains("off")) return false; return true; };
      H.states = [];
      for (let n = 1; n <= H.n; n++) { HS.set(n, "user"); await wait(20);
        const words = [...board.querySelectorAll("text")].filter(visible).map((t) => t.textContent.trim()).filter(Boolean);
        const stops = [...board.querySelectorAll(".is-stop")].filter(visible).map((el) => el.dataset.pick || (el.querySelector("text") || el).textContent.trim()).filter(Boolean);
        H.states.push({ n, src: caps[n - 1].dataset.src || "", caption: caps[n - 1].textContent.replace(/\s+/g, " ").trim(), words, stops, marks: HS.said(board, n) }); }
      HS.set(1, "force"); try { history.replaceState(null, "", location.pathname); } catch (e) {} await wait(450);
    }
    out.hero = H;
  }
  const pressed = (f) => (f.querySelector(".scen [aria-pressed=true], [role=tab][aria-selected=true]") || { dataset: {} }).dataset.s;
  const rowOn = (f) => { const a = f.querySelector(".ask"); return !!a && a.getClientRects().length > 0; };
  const bad = (f) => rowOn(f) && (pressed(f) !== f.dataset.ask || !f.querySelector(".ask").innerText.replace(/guess/i, "").trim());
  const asked = [...document.querySelectorAll("figure[data-ask]:not(.herostory)")];
  out.desync = asked.filter(bad).map((f) => (f.id || "?") + " on load");
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  // Deep items: click data-via once (or nothing), then read the figure's rendered text, buttons and the GUESS row excluded.
  const seenText = (fig) => { const t = []; const w = document.createTreeWalker(fig, NodeFilter.SHOW_TEXT);
    for (let n; (n = w.nextNode()); ) { const el = n.parentElement;
      if (el.closest("details, .scen, [role=tablist], .ask, button, script, style, .authorwarn")) continue;
      if (!el.getClientRects().length || getComputedStyle(el).visibility === "hidden") continue; t.push(n.textContent); }
    return t.join(" ").replace(/[\u2018\u2019]/g, "'").replace(/\s+/g, " ").toLowerCase(); };
  out.deep = [];
  for (const li of document.querySelectorAll(".deep > li")) {
    const fig = document.getElementById(li.dataset.deep || ""), via = li.dataset.via, q = (li.querySelector(".q") || li).textContent.trim();
    const row = { q: q.slice(0, 60), clicks: via ? 1 : 0, missing: "" };
    if (!fig || fig.closest("details")) { row.missing = "no main-flow figure #" + li.dataset.deep; out.deep.push(row); continue; }
    const multi = fig.matches(".multiples"), panel = multi && via ? fig.querySelector(`.panel[data-s="${via}"]`) : null;
    if (multi) { row.clicks = 0; if (via && !panel) { row.missing = "no panel " + via; out.deep.push(row); continue; } }
    else if (via) { const b = fig.querySelector(`.scen [data-s="${via}"], [role=tab][data-s="${via}"]`); if (!b) { row.missing = "no button " + via; out.deep.push(row); continue; } b.click(); await sleep(fig.matches(".trace") ? 6000 : 500); }
    const seen = seenText(panel || fig);
    row.missing = [...li.querySelectorAll(".blank")].map((b) => b.textContent.trim()).filter((b) => !seen.includes(b.replace(/\s+/g, " ").toLowerCase())).join(", ");
    row.y = Math.round(fig.getBoundingClientRect().top + scrollY);
    out.deep.push(row);
  }
  // Guess lifecycle: asked button (question shows), Show me, then another button (the GUESS row must hide fully).
  for (const f of asked) {
    const b = f.querySelector(`.scen [data-s="${f.dataset.ask}"]`), other = [...f.querySelectorAll(".scen [data-s]")].find((x) => x !== b);
    if (!b) continue;
    b.click(); await sleep(50); if (bad(f) || !rowOn(f)) out.desync.push((f.id || "?") + " after clicking the asked button");
    const sm = f.querySelector(".ask .showme"); if (sm && !sm.hidden) { sm.click(); await sleep(400); }
    if (bad(f)) out.desync.push((f.id || "?") + " after Show me");
    if (other) { other.click(); await sleep(50); if (rowOn(f)) out.desync.push((f.id || "?") + " after switching to another button"); }
  }
  const pre = document.createElement("pre"); pre.id = "__budget"; pre.textContent = JSON.stringify(out); document.body.append(pre);
}, 3000));
JS
# SVG text that renders under 12px: computed font size times the element's on-screen scale. Hidden drawings (the other of wide/tall) are skipped.
cat > "$TMP/small.js" <<'JS'
() => [...document.querySelectorAll("svg text")].filter((t) => t.textContent.trim() && t.getClientRects().length).map((t) => {
  const m = t.getScreenCTM(); return { px: Math.round(parseFloat(getComputedStyle(t).fontSize) * Math.hypot(m.a, m.b) * 10) / 10, text: t.textContent.trim().slice(0, 24) };
}).filter((x) => x.px < 11.95)
JS
# 390 pass: the page runs in a 390x844 srcdoc iframe and reports back to the parent.
cat > "$TMP/narrow.js" <<'JS'
addEventListener("load", () => setTimeout(async () => {
  const clip = (f) => [...f.querySelectorAll(".panel svg")].reduce((a, g) => { const v = g.getBoundingClientRect(); return a + [...g.querySelectorAll("text")].filter((t) => { const b = t.getBoundingClientRect(); return b.width && (b.left < v.left - 1 || b.right > v.right + 1 || b.top < v.top - 1 || b.bottom > v.bottom + 1); }).length; }, 0);
  const multi = [...document.querySelectorAll("figure.multiples")].map((f) => ({ id: f.id || "?", clip: clip(f), over: Math.round(Math.max(0, f.scrollWidth - f.clientWidth,
    ...[...f.querySelectorAll(".panel")].map((p) => Math.max(p.scrollWidth - p.clientWidth, ...[...p.querySelectorAll("svg")].map((g) => g.getBoundingClientRect().right - p.getBoundingClientRect().right))))) }));
  const out = { width: innerWidth, overflow: Math.max(0, document.documentElement.scrollWidth - innerWidth), small: (SMALL)(), multi };
  // Hero story at 390: one height on every step, nothing inside it scrolls, and no step's board text renders under 12px.
  const hs = document.querySelector(".herostory"), HS = window.heroStory;
  if (hs && HS) { const sizes = [], scroll = new Set(), small = [];
    for (let n = 1; n <= HS.N; n++) { HS.set(n, "user"); await new Promise((r) => setTimeout(r, 450));
      sizes.push(Math.round(hs.getBoundingClientRect().height * 10) / 10);
      [hs, ...hs.querySelectorAll("*")].forEach((e) => { const c = getComputedStyle(e); if ((/(auto|scroll)/.test(c.overflow + c.overflowX + c.overflowY) && (e.scrollHeight > e.clientHeight + 1 || e.scrollWidth > e.clientWidth + 1)) || (e === hs && e.scrollWidth > e.clientWidth + 1)) scroll.add(String(e.className.baseVal ?? e.className) || e.tagName); });
      (SMALL)().forEach((x) => small.push(`step ${n}: "${x.text}" ${x.px}px`)); }
    HS.set(1, "force");
    out.hero = { sizes, shift: Math.max(...sizes) - Math.min(...sizes), scroll: [...scroll], small: [...new Set(small)] }; }
  const pre = parent.document.createElement("pre"); pre.id = "__narrow"; pre.textContent = JSON.stringify(out); parent.document.body.append(pre);
}, 1500));
JS
# Reduced-motion pass: the hero story stacks one frame per step, each showing that step's marks.
cat > "$TMP/reduce.js" <<'JS'
addEventListener("load", () => setTimeout(() => {
  const hs = document.querySelector(".herostory"), out = { hero: !!hs };
  if (hs) { const frames = [...hs.querySelectorAll(".hs-frames > .hs-frame")], live = hs.querySelector(".hs-board svg.board");
    out.stacked = hs.classList.contains("stacked"); out.n = hs.querySelectorAll(".hs-caps > li").length; out.frames = frames.length;
    out.liveShown = !!live && live.getClientRects().length > 0;
    out.wrong = frames.map((f, i) => { const b = f.querySelector("svg"); if (!b) return i + 1;
      const shown = [...b.querySelectorAll("[data-on]")].filter((el) => !el.classList.contains("off")).map((el) => el.dataset.on);
      const want = [...b.querySelectorAll("[data-on]")].filter((el) => el.dataset.on.split(/\s+/).includes(String(i + 1))).map((el) => el.dataset.on);
      return JSON.stringify(shown) === JSON.stringify(want) ? 0 : i + 1; }).filter(Boolean); }
  const pre = document.createElement("pre"); pre.id = "__reduce"; pre.textContent = JSON.stringify(out); document.body.append(pre);
}, 1500));
JS
node -e 'const fs = require("fs"), [src, js, econ, small, narrow, out, nout, dir] = process.argv.slice(1);
const sm = fs.readFileSync(small, "utf8").trim();
const probe = fs.readFileSync(js, "utf8").replace("ECONOMY", () => fs.readFileSync(econ, "utf8").trim().replace(/;$/, "")).replace("SMALL()", () => "(" + sm + ")()");
const page = fs.readFileSync(src, "utf8");
fs.writeFileSync(out, page.replace("</body>", () => "<script>" + probe + "</script></body>"));
fs.writeFileSync(out.replace(/_probe\.html$/, "_reduce.html"), page.replace("</body>", () => "<script>" + fs.readFileSync(js.replace("probe.js", "reduce.js"), "utf8") + "</script></body>"));
const inner = page.replace("<head>", () => `<head><base href="file://${dir}/">`).replace("</body>", () => "<script>" + fs.readFileSync(narrow, "utf8").replace(/SMALL/g, () => sm) + "</script></body>");
const esc = inner.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
fs.writeFileSync(nout, `<!doctype html><html><body style="margin:0"><iframe style="border:0;display:block" width="390" height="844" srcdoc="${esc}"></iframe></body></html>`);' \
  "$SRC" "$TMP/probe.js" "$(dirname "$0")/economy.js" "$TMP/small.js" "$TMP/narrow.js" "$(dirname "$SRC")/.__budget_${PAGEKEY}_probe.html" "$(dirname "$SRC")/.__budget_${PAGEKEY}_narrow.html" "$(dirname "$SRC")"
"$CH" --headless=new --disable-gpu --window-size=1440,900 --virtual-time-budget=60000 --dump-dom "file://$(dirname "$SRC")/.__budget_${PAGEKEY}_probe.html" 2>/dev/null \
  | sed -n 's#.*<pre id="__budget">\(.*\)</pre>.*#\1#p' | sed 's/&quot;/"/g;s/&lt;/</g;s/&gt;/>/g;s/&amp;/\&/g' > "$TMP/out.json"
"$CH" --headless=new --disable-gpu --force-prefers-reduced-motion --window-size=1440,900 --virtual-time-budget=6000 --dump-dom "file://$(dirname "$SRC")/.__budget_${PAGEKEY}_reduce.html" 2>/dev/null \
  | sed -n 's#.*<pre id="__reduce">\(.*\)</pre>.*#\1#p' | sed 's/&quot;/"/g;s/&lt;/</g;s/&gt;/>/g;s/&amp;/\&/g' > "$TMP/reduce.json"
"$CH" --headless=new --disable-gpu --window-size=500,900 --virtual-time-budget=20000 --dump-dom "file://$(dirname "$SRC")/.__budget_${PAGEKEY}_narrow.html" 2>/dev/null \
  | sed -n 's#.*<pre id="__narrow">\(.*\)</pre>.*#\1#p' | sed 's/&quot;/"/g;s/&lt;/</g;s/&gt;/>/g;s/&amp;/\&/g' > "$TMP/narrow.json"
node -e '
const o = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"));
const caps = { visible: 900, prose: 250, first: 60 };
let fail = 0;
const row = (k, v, cap, hard) => { const bad = cap != null && v > cap; if (bad && hard) fail = 1;
  console.log(`${bad ? (hard ? "FAIL" : "WARN") : "ok  "}  ${k.padEnd(9)} ${String(v).padStart(5)}${cap != null ? "  / " + cap : ""}`); };
row("visible", o.visible, caps.visible, true);
row("prose", o.prose, caps.prose, true);
row("first", o.first, caps.first, true);
const e = o.econ;
row("drawers", e.drawers, e.drawerCap, true);
// The economy judge measures these five; each fails hard.
const j = o.judge;
console.log(`${j.effective > 1000 ? "FAIL" : "ok  "}  effective ${String(j.effective).padStart(5)}  / 1000 (judge: visible ${j.visible}, all ${j.all})`);
if (j.effective > 1000) fail = 1;
const fat = Object.entries(o.bands).filter(([, w]) => w > 180);
if (fat.length) fail = 1;
console.log(`${fat.length ? "FAIL" : "ok  "}  band      ${String(Math.max(0, ...Object.values(o.bands))).padStart(5)}  / 180 per 900px  {${Object.entries(o.bands).map(([k, w]) => k + ":" + w).join(", ")}}`);
const items = Math.max(o.recall.items, o.recall.counter);
if (items > 12) fail = 1;
console.log(`${items > 12 ? "FAIL" : "ok  "}  recall    ${String(items).padStart(5)}  / 12${o.recall.counter && o.recall.counter !== o.recall.items ? "  (counter says " + o.recall.counter + ", markup has " + o.recall.items + ")" : ""}`);
if (o.repeats.length) fail = 1;
console.log(`${o.repeats.length ? "FAIL" : "ok  "}  repeat    ${String(o.repeats.length).padStart(5)}${o.repeats.length ? "  6-word runs printed twice: " + o.repeats.slice(0, 4).map((g) => JSON.stringify(g)).join(", ") + (o.repeats.length > 4 ? ", ..." : "") : ""}`);
if (o.leaks.length) fail = 1;
console.log(`${o.leaks.length ? "FAIL" : "ok  "}  cite-leak ${String(o.leaks.length).padStart(5)}${o.leaks.length ? "  move to data-src: " + [...new Set(o.leaks)].slice(0, 4).join(", ") : ""}`);
if (o.codes.length) fail = 1;
console.log(`${o.codes.length ? "FAIL" : "ok  "}  codes     ${String(o.codes.length).padStart(5)}${o.codes.length ? "  gloss once (data-gloss) or list in its figure .legend: " + o.codes.map((c) => c.t + " (" + c.at + ")").join("; ") : ""}`);
row("hover", o.hover, null, false);
// The core picture is the first screen: it must end above the fold, and its first scenario should show where something stops.
if (o.core < 0) { fail = 1; console.log("FAIL  core      none  (the first screen needs a .core figure)"); }
else row("core", o.core, 900, true);
if (o.core >= 0) console.log(`${o.stop < 0 ? "WARN  stop      none  (first scenario marks no data-stop; fine only if nothing is rejected)" : o.stop > 900 ? "FAIL  stop     " + String(o.stop).padStart(5) + "  / 900 (the rejection is below the fold)" : "ok    stop     " + String(o.stop).padStart(5) + "  / 900"}`);
if (o.stop > 900) fail = 1;
row("checks", o.checks, 0, true);
if (e.facts.length !== 5) { fail = 1; console.log(`FAIL  facts     ${String(e.facts.length).padStart(5)}  / 5 (end the page with a .keep list of 5 facts)`); }
for (const f of e.facts) { if (!f.onScreen) fail = 1;
  console.log(`${f.onScreen ? "ok  " : "FAIL"}  fact ${f.fact}    y ${String(f.y).padStart(5)}${f.onScreen ? "" : "  not on screen in its figure: " + (f.missing || "no data-fact figure")}`); }
const n = JSON.parse(require("fs").readFileSync(process.argv[2], "utf8") || "{}");
const zero = (k, v, why) => { if (v !== 0) fail = 1; console.log(`${v === 0 ? "ok  " : "FAIL"}  ${k.padEnd(9)} ${String(v).padStart(5)}${v ? "  " + why : ""}`); };
zero("desync", o.desync.length, o.desync.join("; "));
zero("small1440", o.small.length, o.small.slice(0, 6).map((x) => `"${x.text}" ${x.px}px`).join(", "));
if (n.width !== 390) { fail = 1; console.log(`FAIL  narrow    the 390 pass did not run (width ${n.width})`); }
else {
  zero("small390", n.small.length, n.small.slice(0, 6).map((x) => `"${x.text}" ${x.px}px`).join(", ") + (n.small.length > 6 ? ", ..." : "") + " (draw a .tall svg for phones)");
  zero("overflow", n.overflow, `page is ${390 + n.overflow}px wide at 390`);
}
for (const m of o.multiples || []) {
  const nm = (n.multi || []).find((x) => x.id === m.id) || { over: -1, clip: 0 }, over = nm.over;
  const why = [m.panels < 2 || m.panels > 4 ? `${m.panels} panels (2 to 4)` : "", m.vbs !== 1 ? `${m.vbs} viewBoxes (one shared)` : "",
    m.outs < m.panels ? `${m.panels - m.outs} panel(s) without an .out line` : "", m.diff < m.panels ? `${m.panels - m.diff} panel(s) without a data-diff accent` : "",
    m.labels > 12 ? `${m.labels} labels (12 a figure)` : "", m.per.some((x) => x > 4) ? `a panel prints over 4 labels` : "", m.ask ? "data-ask on a multiples figure" : "",
    over !== 0 ? (over < 0 ? "390 pass did not see it" : `${over}px overflow at 390`) : "",
    m.clip ? `${m.clip} SVG text(s) cut off at the viewBox edge at 1440` : "", nm.clip ? `${nm.clip} SVG text(s) cut off at the viewBox edge at 390` : ""].filter(Boolean);
  if (why.length) fail = 1;
  console.log(`${why.length ? "FAIL" : "ok  "}  multiples #${m.id}  panels ${m.panels}, labels ${m.labels}/12 (${m.per.join(",")}), overflow390 ${over}${why.length ? "  " + why.join("; ") : ""}`);
}
for (const t of o.toggles || []) console.log(`WARN  toggles   #${t.id} switches ${t.n} scenarios; draw them as multiples unless their order matters`);
const deepBad = o.deep.filter((d) => d.missing).length;
if (!o.deep.length) console.log("WARN  deep      none  (add up to 6 deep items under the facts)");
else zero("deep", deepBad, "deep items not printed within 1 click");
for (const d of o.deep) console.log(`${d.missing ? "FAIL" : "ok  "}  deep      clicks ${d.clicks}  y ${String(d.y ?? -1).padStart(5)}  ${d.q}${d.missing ? "  missing: " + d.missing : ""}`);
for (const s of o.sections) {
  const bad = s.figures === 0; if (bad) fail = 1;
  console.log(`${bad ? "FAIL" : s.prose > 45 ? "WARN" : "ok  "}  #${s.id.padEnd(8)} prose ${String(s.prose).padStart(4)} / 45, figures ${s.figures}${bad ? "  (no figure: delete the section or give it one)" : ""}`);
}
const H = o.hero, rd = JSON.parse(require("fs").readFileSync(process.argv[3], "utf8") || "{}"), nh = n.hero;
if (H) {
  const why = [H.n < 3 || H.n > 5 ? `${H.n} steps (3 to 5)` : "", H.nosrc.length ? `no data-src on step ${H.nosrc.join(", ")}` : "",
    H.long.length ? H.long.map(([k, w]) => `step ${k} caption ${w} words (20)`).join(", ") : "", !H.engine ? "no hero story engine (window.heroStory)" : "",
    H.engine && !H.first ? "a fresh load does not paint exactly step 1" : "", H.engine && !H.firstCaption ? "step 1 caption not shown at load" : "",
    H.engine && !H.hash ? "#hero-2 did not load step 2" : "", H.shift > 1 ? `layout shift ${H.shift}px at 1440 (${H.sizes.map((x) => x.fig).join(", ")})` : "",
    nh && nh.shift > 1 ? `layout shift ${nh.shift}px at 390 (${nh.sizes.join(", ")})` : "", !nh ? "the 390 pass did not see the hero" : "",
    nh && nh.scroll.length ? `inner scroll at 390 in ${nh.scroll.join(", ")}` : "", nh && nh.small.length ? `text under 12px at 390: ${nh.small.slice(0, 3).join("; ")}` : "",
    ...(H.guess || []).map((g) => "guess: " + g),
    !rd.hero ? "the reduced-motion pass did not run" : !rd.stacked || rd.liveShown ? "reduced motion does not stack frames" : rd.frames !== rd.n ? `reduced motion shows ${rd.frames} frames for ${rd.n} steps` : "",
    rd.wrong && rd.wrong.length ? `stacked frame ${rd.wrong.join(", ")} shows the wrong marks` : ""].filter(Boolean);
  if (why.length) fail = 1;
  console.log(`${why.length ? "FAIL" : "ok  "}  herostory ${String(H.n).padStart(5)}  / 5 steps, height ${H.sizes ? H.sizes[0].fig : "?"}px at 1440 and ${nh ? nh.sizes[0] : "?"}px at 390 on every step${why.length ? "  " + why.join("; ") : ""}`);
  if (H.states) { require("fs").writeFileSync(process.argv[4], H.states.map((x) => [`Step ${x.n}  [source ${x.src}]`, `Caption: ${x.caption}`,
      `Board words: ${x.words.join(" | ")}`, ...(x.stops.length ? [`Rejected at: ${x.stops.join(", ")}`] : []), `Board marks: ${x.marks.join("; ")}`].join("\n")).join("\n\n") + "\n");
    console.log(`ok    states    ${String(H.states.length).padStart(5)}  written to ${process.argv[4]}`); }
}
process.exit(fail);
' "$TMP/out.json" "$TMP/narrow.json" "$TMP/reduce.json" "$STATES"
