#!/usr/bin/env node
// Renders PranavSkills profiles out to each harness config dir.
// Skills and knowledge are symlinked, so they cannot drift. Context files are the one
// thing that needs generating: Claude Code supports @-imports, Codex does not.
//
//   node scripts/render.mjs              # all profiles
//   node scripts/render.mjs codex        # one profile
//   node scripts/render.mjs --dry-run

import {
  readFileSync, writeFileSync, readdirSync, mkdirSync,
  existsSync, lstatSync, rmSync, symlinkSync, realpathSync, readlinkSync, statSync,
} from "node:fs";
import { join, dirname, resolve } from "node:path";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const KNOWLEDGE_ROOT = resolve(
  process.env.AGENT_KNOWLEDGE_DIR || join(homedir(), "agents", "knowledge"),
);
const args = process.argv.slice(2);
const DRY = args.includes("--dry-run");
const only = args.filter((a) => !a.startsWith("--"));

const expand = (p) => (p.startsWith("~") ? join(homedir(), p.slice(1)) : p);
const log = [];
const note = (verb, what) => log.push(`  ${verb.padEnd(8)} ${what}`);
const isLink = (p) => { try { return lstatSync(p).isSymbolicLink(); } catch { return false; } };
const realpathSafe = (p) => { try { return realpathSync(p); } catch { return null; } };
const ownedLink = (p) => {
  if (!isLink(p)) return false;
  try {
    const resolved = resolve(dirname(p), readlinkSync(p));
    return resolved.startsWith(ROOT) || resolved.startsWith(KNOWLEDGE_ROOT);
  } catch {
    return false;
  }
};

// Point linkPath at target, replacing whatever symlink is there.
// Refuses when a real file or directory occupies the path — never deletes user data.
function link(target, linkPath, sharedTarget = false) {
  if (isLink(linkPath)) {
    if (realpathSafe(linkPath) === target) { note("ok", linkPath); return true; }
    if (sharedTarget && !ownedLink(linkPath)) return false;
    if (!DRY) rmSync(linkPath);
  } else if (existsSync(linkPath)) {
    return false;
  }
  if (!DRY) symlinkSync(target, linkPath);
  note("link", `${linkPath} -> ${target}`);
  return true;
}

// Remove symlinks we own (pointing into ROOT) that the profile no longer selects.
function retract(dir, wanted) {
  if (!existsSync(dir)) return;
  for (const entry of readdirSync(dir)) {
    if (wanted.has(entry) || entry.startsWith(".")) continue;
    const p = join(dir, entry);
    if (!isLink(p)) continue;
    if (!ownedLink(p)) continue;
    if (!DRY) rmSync(p);
    note("unlink", p);
  }
}

function renderProfile(name) {
  const profile = JSON.parse(readFileSync(join(ROOT, "profiles", `${name}.json`), "utf8"));
  const target = expand(profile.target);
  // An optional profile targets a harness that only some machines have (a second config dir,
  // an app-owned profile). Skip it rather than inventing the directory.
  if (profile.optional && !existsSync(target)) { log.push(`\n${name}  ->  ${target}  (absent, skipped)`); return; }
  log.push(`\n${name}  ->  ${target}`);
  if (!DRY) mkdirSync(target, { recursive: true });

  // --- skills: one symlink per skill, so the harness sees a flat skills/ dir ---
  const skillsDir = join(target, "skills");
  if (profile.buckets.length) {
    if (!DRY) mkdirSync(skillsDir, { recursive: true });
    const wanted = new Set(["_shared"]);
    for (const bucket of profile.buckets) {
      const bucketPath = join(ROOT, "skills", bucket);
      if (!existsSync(bucketPath)) continue;
      for (const skill of readdirSync(bucketPath)) {
        if (skill.startsWith(".") || skill.startsWith("_")) continue;
        wanted.add(skill);
        if (!link(join(bucketPath, skill), join(skillsDir, skill), profile.sharedTarget)) {
          log.push(`  BLOCKED  ${join(skillsDir, skill)} is a real directory — the harness owns it; skipping`);
        }
      }
    }
    link(join(ROOT, "skills", "_shared"), join(skillsDir, "_shared"), profile.sharedTarget);
    retract(skillsDir, wanted);
  }

  // --- knowledge: symlinked from the external vault (AGENT_KNOWLEDGE_DIR or ~/agents/knowledge) ---
  const kDir = join(target, "knowledge");
  const wantedK = new Set(profile.knowledge ?? []);
  if (wantedK.size && !DRY) mkdirSync(kDir, { recursive: true });
  for (const domain of wantedK) {
    const src = join(KNOWLEDGE_ROOT, domain);
    if (!existsSync(src)) { log.push(`  MISSING  knowledge/${domain} (not in ${KNOWLEDGE_ROOT})`); continue; }
    link(src, join(kDir, domain), profile.sharedTarget);
  }
  retract(kDir, wantedK);

  // --- hooks: symlinked, then wired into settings.json. The executable bit lives on the
  //     source in the PranavSkills hooks/ dir, so a lost chmod can't silently disable a guard. ---
  const hookNames = profile.hooks ?? [];
  if (hookNames.length) {
    const hooksDir = join(target, "hooks");
    if (!DRY) mkdirSync(hooksDir, { recursive: true });
    for (const h of hookNames) {
      const src = join(ROOT, "hooks", h);
      if (!existsSync(src)) { log.push(`  MISSING  hooks/${h}`); continue; }
      if ((statSync(src).mode & 0o111) === 0) log.push(`  WARNING  hooks/${h} is not executable — the harness will read it as a broken hook, not a block`);
      link(src, join(hooksDir, h));
    }
    retract(hooksDir, new Set(hookNames));

    if (profile.kind === "claude") {
      const sf = join(target, "settings.json");
      const settings = existsSync(sf) ? JSON.parse(readFileSync(sf, "utf8")) : {};
      if (!settings.hooks) settings.hooks = {};
      settings.hooks.PreToolUse = [
        { matcher: "Bash|Write|Edit", hooks: [{ type: "command", command: join(target, "hooks", "bash-guard.sh") }] },
        ...(hookNames.includes("webfetch-guard.sh")
          ? [{ matcher: "WebFetch", hooks: [{ type: "command", command: join(target, "hooks", "webfetch-guard.sh") }] }]
          : []),
      ];
      if (!DRY) writeFileSync(sf, JSON.stringify(settings, null, 2) + "\n");
      note("wire", `${sf} PreToolUse (${hookNames.length} hook(s))`);
    }
    if (profile.kind === "codex") {
      const hf = join(target, "hooks.json");
      const hooksConf = existsSync(hf) ? JSON.parse(readFileSync(hf, "utf8")) : {};
      if (!hooksConf.hooks) hooksConf.hooks = {};
      hooksConf.hooks.PreToolUse = [
        { matcher: "Bash|Write|Edit", hooks: [{ type: "command", command: join(target, "hooks", "bash-guard.sh") + " codex" }] },
      ];
      if (!DRY) writeFileSync(hf, JSON.stringify(hooksConf, null, 2) + "\n");
      note("wire", `${hf} PreToolUse (${hookNames.length} hook(s))`);
    }
  }

  // --- settings: keys the profile pins, merged one level deep so sibling keys survive ---
  if (profile.kind === "claude" && (profile.settings || profile.disablePlugins)) {
    const sf = join(target, "settings.json");
    const settings = existsSync(sf) ? JSON.parse(readFileSync(sf, "utf8")) : {};
    const before = JSON.stringify(settings);
    for (const [k, v] of Object.entries(profile.settings ?? {})) {
      settings[k] = v && typeof v === "object" && !Array.isArray(v) ? { ...settings[k], ...v } : v;
    }
    if (profile.disablePlugins?.length) {
      settings.enabledPlugins = { ...settings.enabledPlugins };
      for (const plugin of profile.disablePlugins) settings.enabledPlugins[plugin] = false;
    }
    if (JSON.stringify(settings) !== before) {
      if (!DRY) writeFileSync(sf, JSON.stringify(settings, null, 2) + "\n");
      note("settings", `${sf} (${Object.keys(profile.settings ?? {}).join(", ") || "plugins"})`);
    } else note("ok", `${sf} settings`);
  }
  // Codex keeps plugins in config.toml. Only flip sections that already exist: inventing a
  // section for a plugin this machine never installed would be noise, not a setting.
  if (profile.kind === "codex" && profile.disablePlugins?.length) {
    const cf = join(target, "config.toml");
    if (existsSync(cf)) {
      const before = readFileSync(cf, "utf8");
      let toml = before;
      for (const plugin of profile.disablePlugins) {
        const header = `[plugins."${plugin}"]`;
        const at = toml.indexOf(header);
        if (at < 0) continue;
        const end = toml.indexOf("\n[", at + header.length);
        const section = toml.slice(at, end < 0 ? undefined : end);
        toml = toml.replace(section, section.replace(/^enabled\s*=\s*true\s*$/m, "enabled = false"));
      }
      if (toml !== before) {
        if (!DRY) writeFileSync(cf, toml);
        note("plugins", `${cf} disabled ${profile.disablePlugins.length} plugin(s)`);
      } else note("ok", `${cf} plugins`);
    }
  }

  // --- context: imports for Claude, inlined for Codex ---
  if (!profile.context?.length) return;
  const banner = `<!-- GENERATED by ${join(ROOT, "scripts/render.mjs")} — edit the source repository, not this file. -->`;
  if (profile.kind === "claude") {
    // @-imports keep this zero-drift: the harness reads the source files directly.
    const body = [banner, "", ...profile.context.map((c) => `@${join(ROOT, c)}`), ""].join("\n");
    if (!DRY) writeFileSync(join(target, "CLAUDE.md"), body);
    note("write", `${join(target, "CLAUDE.md")} (${profile.context.length} imports)`);
  } else {
    // Codex has no import mechanism, so content is inlined.
    const parts = profile.context.map((c) => readFileSync(join(ROOT, c), "utf8").trim());
    const body = [banner, "", parts.join("\n\n---\n\n"), ""].join("\n");
    if (!DRY) writeFileSync(join(target, "AGENTS.md"), body);
    note("write", `${join(target, "AGENTS.md")} (${body.length} bytes inlined)`);
  }
}

const names = only.length
  ? only
  : readdirSync(join(ROOT, "profiles")).filter((f) => f.endsWith(".json")).map((f) => f.replace(/\.json$/, ""));

for (const n of names) renderProfile(n);
console.log(log.join("\n"));
console.log(DRY ? "\ndry run — nothing written" : "\nrendered");
