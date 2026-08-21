#!/usr/bin/env node
// Lints skills against CONVENTIONS.md and checks the rendered harnesses for drift.
//   node scripts/doctor.mjs

import { readFileSync, readdirSync, existsSync, lstatSync, realpathSync, statSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ALLOWED = new Set(["name", "description", "disable-model-invocation", "argument-hint"]);
const MAX_DESC_WORDS = 40;
const MAX_BODY_LINES = 120;
const expand = (p) => (p.startsWith("~") ? join(homedir(), p.slice(1)) : p);
const isLink = (p) => { try { return lstatSync(p).isSymbolicLink(); } catch { return false; } };
const realpathSafe = (p) => { try { return realpathSync(p); } catch { return null; } };

const problems = [];
const warnings = [];
const fail = (where, msg) => problems.push(`${where}: ${msg}`);
const warn = (where, msg) => warnings.push(`${where}: ${msg}`);

function parseFrontmatter(text) {
  const m = text.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!m) return null;
  const keys = {};
  for (const line of m[1].split("\n")) {
    const km = line.match(/^([A-Za-z][A-Za-z0-9-]*):\s*(.*)$/);
    if (km) keys[km[1]] = km[2];
  }
  return { keys, raw: m[1], body: text.slice(m[0].length) };
}

// --- skills ---
let count = 0;
for (const bucket of readdirSync(join(ROOT, "skills"))) {
  if (bucket.startsWith("_") || bucket.startsWith(".")) continue;
  const bucketPath = join(ROOT, "skills", bucket);
  if (!statSync(bucketPath).isDirectory()) continue;

  for (const skill of readdirSync(bucketPath)) {
    if (skill.startsWith(".")) continue;
    const file = join(bucketPath, skill, "SKILL.md");
    const where = `${bucket}/${skill}`;
    if (!existsSync(file)) { fail(where, "no SKILL.md"); continue; }
    count++;

    const text = readFileSync(file, "utf8");
    const fm = parseFrontmatter(text);
    if (!fm) { fail(where, "no frontmatter"); continue; }

    for (const k of Object.keys(fm.keys)) {
      if (!ALLOWED.has(k)) fail(where, `frontmatter key "${k}" is not one of the four allowed`);
    }
    if (fm.keys.name !== skill) fail(where, `name "${fm.keys.name}" does not match directory`);
    if (!fm.keys.description) fail(where, "no description");
    if (/^>-?\s*$/.test(fm.keys.description ?? "")) fail(where, "description uses a YAML block scalar; put it on one line");

    const words = (fm.keys.description ?? "").trim().split(/\s+/).length;
    if (words > MAX_DESC_WORDS) fail(where, `description is ${words} words (max ${MAX_DESC_WORDS}) — it is summarizing, not triggering`);

    const userInvoked = fm.keys["disable-model-invocation"] === "true";
    if (userInvoked && /\bUse when\b/i.test(fm.keys.description ?? ""))
      fail(where, "user-invoked skill keeps a trigger list; a human reads this description");
    if (!userInvoked && !/\bUse (when|before)\b/i.test(fm.keys.description ?? ""))
      warn(where, "model-invoked skill has no explicit trigger clause");

    const bodyLines = fm.body.split("\n").length;
    if (bodyLines > MAX_BODY_LINES) warn(where, `${bodyLines} body lines — consider progressive disclosure`);

    // Harness leakage. `learn` is exempt because the memory store genuinely differs per harness.
    const exemptFromNeutrality = new Set(["learn"]);
    for (const [pattern, better] of exemptFromNeutrality.has(skill) ? [] : [
      [/\bCLAUDE\.md\b/, "the project's agent context file"],
      [/\bthe Agent tool\b/, "dispatch parallel subagents"],
      [/\bweb_search\b|\bweb_fetch\b/, "your web search / fetch tool"],
      [/~\/\.claude\/|~\/\.codex\//, "a harness-neutral path"],
      [/\bCodex\b/, "a neutral phrasing"],
      [/\bClaude Code\b/, "a neutral phrasing"],
    ]) {
      if (pattern.test(fm.body)) warn(where, `body names a harness (${pattern}) — prefer "${better}"`);
    }
  }
}

// --- knowledge ---
for (const domain of existsSync(join(ROOT, "knowledge")) ? readdirSync(join(ROOT, "knowledge")) : []) {
  if (domain.startsWith(".")) continue;
  if (!existsSync(join(ROOT, "knowledge", domain, "INDEX.md")))
    fail(`knowledge/${domain}`, "no INDEX.md — the vault is unsearchable without a manifest");
}

// --- rendered harnesses ---
for (const f of readdirSync(join(ROOT, "profiles")).filter((f) => f.endsWith(".json"))) {
  const p = JSON.parse(readFileSync(join(ROOT, "profiles", f), "utf8"));
  const target = expand(p.target);
  const skillsDir = join(target, "skills");
  if (!existsSync(skillsDir)) { warn(f, `${skillsDir} not rendered yet`); continue; }
  const expectedSkills = new Map();
  for (const bucket of p.buckets) {
    const bucketPath = join(ROOT, "skills", bucket);
    if (!existsSync(bucketPath)) continue;
    for (const skill of readdirSync(bucketPath)) {
      if (!skill.startsWith(".") && !skill.startsWith("_")) {
        expectedSkills.set(skill, join(bucketPath, skill));
      }
    }
  }
  for (const entry of readdirSync(skillsDir)) {
    if (entry.startsWith(".")) continue;
    const ep = join(skillsDir, entry);
    if (!lstatSync(ep).isSymbolicLink()) {
      if (p.sharedTarget) continue;
      fail(f, `${ep} is a real directory — a copy that will drift from ${ROOT}`);
      continue;
    }
    try { realpathSync(ep); } catch { fail(f, `${ep} is a broken symlink`); }
  }
  for (const [skill, expected] of expectedSkills) {
    const rendered = join(skillsDir, skill);
    if (!isLink(rendered) || realpathSafe(rendered) !== expected) {
      fail(f, `${rendered} does not point to the selected repository skill`);
    }
  }
  // Amazon isolation: the personal profile must not reach internal material.
  if (/personal/.test(f)) {
    const leaks = [...readdirSync(skillsDir), ...(existsSync(join(target, "knowledge")) ? readdirSync(join(target, "knowledge")) : [])]
      .filter((e) => /amazon|brazil|pantheon/i.test(e));
    for (const l of leaks) fail(f, `Amazon-internal material "${l}" leaked into the personal profile`);
    const ctx = join(target, "CLAUDE.md");
    if (existsSync(ctx) && /amazon/i.test(readFileSync(ctx, "utf8"))) fail(f, "personal CLAUDE.md imports Amazon policy");
  }
}

console.log(`checked ${count} skills`);
if (warnings.length) console.log(`\n${warnings.length} warning(s):\n` + warnings.map((w) => `  - ${w}`).join("\n"));
if (problems.length) {
  console.log(`\n${problems.length} problem(s):\n` + problems.map((p) => `  - ${p}`).join("\n"));
  process.exit(1);
}
console.log("\nno problems");
