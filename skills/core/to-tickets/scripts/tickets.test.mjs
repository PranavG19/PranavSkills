import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const script = fileURLToPath(new URL("./tickets.mjs", import.meta.url));

function run(board, ...args) {
  return execFileSync(process.execPath, [script, "--dir", board, ...args], { encoding: "utf8" }).trim();
}

function ticket({ id, title, status = "backlog", dependencies = "", owner = "" }) {
  return `---
id: ${id}
title: ${title}
status: ${status}
priority: 2
mode: afk
depends-on: ${dependencies}
claimed-by: ${owner}
spec: spec.md
---

## Outcome

Observable behavior.

## Acceptance criteria

1. Observable criterion.

## Context

Settled context.

## Verification

Focused command and oracle.

## Ownership

One writer.
`;
}

test("validates dependencies and drives claim-review-done lifecycle", () => {
  const root = mkdtempSync(join(tmpdir(), "tickets-"));
  const board = join(root, ".agents", "tickets");
  try {
    run(board, "init");
    writeFileSync(join(board, "T-001-first.md"), ticket({ id: "T-001", title: "First", status: "ready" }));
    writeFileSync(join(board, "T-002-second.md"), ticket({
      id: "T-002",
      title: "Second",
      dependencies: "T-001",
    }));

    assert.equal(run(board, "validate"), "Valid board: 2 ticket(s)");
    assert.match(run(board, "ready"), /T-001/);
    assert.doesNotMatch(run(board, "ready"), /T-002/);

    assert.equal(run(board, "claim", "T-001", "--by", "agent-a"), "Claimed T-001 by agent-a");
    assert.match(readFileSync(join(board, "T-001-first.md"), "utf8"), /status: in-progress/);
    assert.equal(run(board, "ready"), "No tickets.");

    run(board, "move", "T-001", "review");
    run(board, "move", "T-001", "in-progress");
    run(board, "move", "T-001", "review");
    run(board, "move", "T-001", "approved");
    run(board, "move", "T-001", "done");
    run(board, "move", "T-002", "ready");
    assert.match(run(board, "ready"), /T-002/);

    const invalidMove = spawnSync(
      process.execPath,
      [script, "--dir", board, "move", "T-001", "ready"],
      { encoding: "utf8" },
    );
    assert.equal(invalidMove.status, 1);
    assert.match(invalidMove.stderr, /invalid transition/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("rejects cycles and direct claims of blocked work", () => {
  const root = mkdtempSync(join(tmpdir(), "tickets-"));
  const board = join(root, ".agents", "tickets");
  try {
    run(board, "init");
    writeFileSync(join(board, "T-001-first.md"), ticket({
      id: "T-001",
      title: "First",
      dependencies: "T-002",
    }));
    writeFileSync(join(board, "T-002-second.md"), ticket({
      id: "T-002",
      title: "Second",
      dependencies: "T-001",
    }));

    const validation = spawnSync(process.execPath, [script, "--dir", board, "validate"], { encoding: "utf8" });
    assert.equal(validation.status, 1);
    assert.match(validation.stderr, /dependency cycle/);

    const claim = spawnSync(
      process.execPath,
      [script, "--dir", board, "claim", "T-001", "--by", "agent-a"],
      { encoding: "utf8" },
    );
    assert.equal(claim.status, 1);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("does not claim backlog tickets and rejects missing required sections", () => {
  const root = mkdtempSync(join(tmpdir(), "tickets-"));
  const board = join(root, ".agents", "tickets");
  try {
    run(board, "init");
    writeFileSync(join(board, "T-001-backlog.md"), ticket({
      id: "T-001",
      title: "Not approved",
      status: "backlog",
    }));
    assert.equal(run(board, "ready"), "No tickets.");

    const claim = spawnSync(
      process.execPath,
      [script, "--dir", board, "claim", "T-001", "--by", "agent-a"],
      { encoding: "utf8" },
    );
    assert.equal(claim.status, 1);

    writeFileSync(
      join(board, "T-002-invalid.md"),
      ticket({ id: "T-002", title: "Missing section" }).replace("## Verification", "## Checks"),
    );
    const validation = spawnSync(
      process.execPath,
      [script, "--dir", board, "validate"],
      { encoding: "utf8" },
    );
    assert.equal(validation.status, 1);
    assert.match(validation.stderr, /missing section "Verification"/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
