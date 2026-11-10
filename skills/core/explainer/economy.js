// Economy and reach self-check. Paste into the browser console on the page, or let budget.sh inject it.
// It closes every drawer, then counts words the way a reader meets them:
//   visible   = words rendered on the page with drawers closed (labels, buttons, nav included)
//   all       = every word in the body, open or not
//   effective = visible + 0.3 x (all - visible), the economy measure
//   drawers   = words inside <details>, which must stay under half of visible
// and, for each of the 5 facts in .keep, whether its blank words are on screen in its figure right now.
(() => {
  document.querySelectorAll("details[open]").forEach((d) => (d.open = false));
  const words = (s) => (s.match(/[\p{L}\p{N}][\p{L}\p{N}'._\/-]*/gu) || []).length;
  const norm = (t) => t.replace(/[‘’]/g, "'").replace(/\s+/g, " ").trim().toLowerCase();
  const hidden = (el) => {
    const d = el.closest("details"); if (d && !el.closest("summary")) return true;
    for (let e = el; e && e.nodeType === 1; e = e.parentElement) { const cs = getComputedStyle(e); if (cs.display === "none" || cs.visibility === "hidden") return true; }
    return false;
  };
  const textOf = (root, keep) => { const out = []; const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let n; (n = w.nextNode()); ) { const el = n.parentElement; if (!el.closest("script,style,noscript,.authorwarn") && keep(el)) out.push(n.textContent); } return out.join(" "); };
  const all = words(textOf(document.body, () => true));
  const visible = words(textOf(document.body, (el) => !hidden(el)));
  const drawers = words(textOf(document.body, (el) => !!el.closest("details") && !el.closest("summary")));
  const facts = [...document.querySelectorAll(".keep > li")].map((li, k) => {
    const n = li.dataset.fact || String(k + 1), fig = [...document.querySelectorAll(`[data-fact~="${n}"]`)].find((f) => !f.closest(".keep"));
    const seen = fig ? norm(textOf(fig, (el) => !hidden(el))) : "";
    const missing = [...li.querySelectorAll(".blank")].map((b) => b.textContent.trim()).filter((b) => !seen.includes(norm(b)));
    return { fact: n, y: fig ? Math.round(fig.getBoundingClientRect().top + scrollY) : -1, onScreen: !!fig && !missing.length, missing: missing.join(", ") };
  });
  const out = { visible, all, effective: Math.round(visible + 0.3 * (all - visible)), drawers, drawerCap: Math.floor(visible / 2), facts };
  console.table(facts); console.log(JSON.stringify({ ...out, facts: undefined }));
  return out;
})();
