#!/usr/bin/env node
// Lints skills against CONVENTIONS.md and checks the rendered harnesses for drift.
//   node scripts/doctor.mjs

import { readFileSync, readdirSync, existsSync, lstatSync, realpathSync, statSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";
import { contextFile } from "./context.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ALLOWED = new Set(["name", "description", "disable-model-invocation", "argument-hint"]);
const MAX_DESC_WORDS = 60;
const MAX_TOTAL_DESC_WORDS = 1000; // model-invoked descriptions load every session; raised from 730 when five user-only skills became model-invoked and the measured misses got longer triggers
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
const skills = new Map();
let modelInvokedDescWords = 0;
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
    skills.set(skill, { where, userInvoked, body: fm.body, dir: join(bucketPath, skill) });
    if (!userInvoked) modelInvokedDescWords += words;
    if (userInvoked && /\bUse when\b/i.test(fm.keys.description ?? ""))
      fail(where, "user-invoked skill keeps a trigger list; a human reads this description");
    if (!userInvoked && !/\bUse (when|whenever|before|as soon as)\b/i.test(fm.keys.description ?? ""))
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

    // Write plainly: no em-dashes or en-dashes in the description or body (fenced code is exempt).
    const proseBody = fm.body.replace(/```[\s\S]*?```/g, "");
    if (/[—–]/.test(proseBody) || /[—–]/.test(fm.keys.description ?? ""))
      fail(where, "em-dash or en-dash present; Write plainly bans them (use periods, commas, or parentheses)");
  }
}

// --- invocation: flags, Codex policy, and cross-skill call wording ---
const allNames = [...skills.keys()].sort((a, b) => b.length - a.length).map((n) => n.replace(/[-]/g, "\\-"));
const bareCall = new RegExp(`\\b(invoke|use|run)\\s+(the\\s+)?\\*{0,2}\`(${allNames.join("|")})\``, "gi");
const toolCall = new RegExp(`Skill tool with \\*{0,2}\`(${allNames.join("|")})\``, "g");
for (const [name, s] of skills) {
  // Codex ignores disable-model-invocation; only the sidecar policy hides a skill there.
  const yaml = join(s.dir, "agents", "openai.yaml");
  const hidden = existsSync(yaml) && /allow_implicit_invocation:\s*false/.test(readFileSync(yaml, "utf8"));
  if (s.userInvoked && !hidden) fail(s.where, "user-invoked but agents/openai.yaml lacks policy.allow_implicit_invocation: false, so Codex still auto-loads it");
  if (!s.userInvoked && hidden) fail(s.where, "model-invoked but agents/openai.yaml hides it from Codex");
  const prose = s.body.replace(/```[\s\S]*?```/g, "");
  for (const line of prose.split("\n")) {
    for (const m of line.matchAll(bareCall)) {
      if (m[3] !== name && !/Skill tool/.test(line)) fail(s.where, `"${m[0]}" calls a skill without naming the Skill tool; write "call the Skill tool with \`${m[3]}\`"`);
    }
    for (const m of line.matchAll(toolCall)) {
      if (skills.get(m[1])?.userInvoked) fail(s.where, `calls user-invoked \`${m[1]}\` through the Skill tool; write "tell the user to run \`/${m[1]}\`"`);
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
  if (p.optional && !existsSync(target)) continue;
  // Pinned settings must still hold: a harness update or a manual edit can quietly revert them.
  if (p.kind === "claude" && (p.settings || p.disablePlugins)) {
    const sf = join(target, "settings.json");
    const s = existsSync(sf) ? JSON.parse(readFileSync(sf, "utf8")) : {};
    for (const [k, v] of Object.entries(p.settings ?? {})) {
      const have = v && typeof v === "object" ? Object.entries(v).every(([kk, vv]) => s[k]?.[kk] === vv) : s[k] === v;
      if (!have) fail(f, `${sf} ${k} is not ${JSON.stringify(v)}; re-render`);
    }
    for (const plugin of p.disablePlugins ?? []) {
      if (s.enabledPlugins?.[plugin] !== false) fail(f, `${sf} still enables ${plugin}; re-render`);
    }
  }
  if (p.kind === "codex" && p.disablePlugins?.length && existsSync(join(target, "config.toml"))) {
    const toml = readFileSync(join(target, "config.toml"), "utf8");
    for (const plugin of p.disablePlugins) {
      const m = toml.match(new RegExp(`\\[plugins\\."${plugin.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"\\][^\\[]*?enabled\\s*=\\s*true`));
      if (m) fail(f, `config.toml still enables ${plugin}; re-render`);
    }
  }
  // Inlined context copies go stale until the next render; Claude imports go stale if the list changes.
  const ctx = contextFile(p, ROOT, target);
  if (ctx && existsSync(target)) {
    const have = existsSync(ctx.path) ? readFileSync(ctx.path, "utf8") : null;
    if (have !== ctx.body) fail(f, `${ctx.path} does not match the rendered context; re-render`);
  }
  if (!p.buckets.length) continue;
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
    if (isLink(rendered) && realpathSafe(rendered) === expected) continue;
    // On a shared target, a skill name already held by a foreign entry (a symlink out of the repo,
    // or a harness-managed real directory) is skipped by render, never overwritten. That is a name
    // collision to report, not a broken render. A missing or broken link is still a failure.
    const rp = realpathSafe(rendered);
    if (p.sharedTarget && existsSync(rendered) && (rp === null || !rp.startsWith(ROOT))) {
      warn(f, `${skill} is held by a foreign skill at ${rendered}; the repository's ${skill} is not installed here (name collision)`);
      continue;
    }
    fail(f, `${rendered} does not point to the selected repository skill`);
  }
  // Isolation: the personal profile must not reach work-only skills.
  if (/personal/.test(f)) {
    const workDir = join(ROOT, "skills", "work");
    const workSkills = new Set(existsSync(workDir) ? readdirSync(workDir) : []);
    for (const s of readdirSync(skillsDir).filter((e) => workSkills.has(e))) fail(f, `work skill "${s}" leaked into the personal profile`);
  }
}

if (modelInvokedDescWords > MAX_TOTAL_DESC_WORDS)
  warn("descriptions", `aggregate model-invoked description budget is ${modelInvokedDescWords} words, over the soft ceiling of ${MAX_TOTAL_DESC_WORDS}; trim triggers or move detail into bodies`);

console.log(`checked ${count} skills`);
console.log(`model-invoked descriptions load ${modelInvokedDescWords} words every session (ceiling ${MAX_TOTAL_DESC_WORDS}).`);
if (warnings.length) console.log(`\n${warnings.length} warning(s):\n` + warnings.map((w) => `  - ${w}`).join("\n"));
if (problems.length) {
  console.log(`\n${problems.length} problem(s):\n` + problems.map((p) => `  - ${p}`).join("\n"));
  process.exit(1);
}
console.log("\nno problems");
