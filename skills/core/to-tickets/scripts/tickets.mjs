#!/usr/bin/env node

import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { basename, join, resolve } from "node:path";

const STATUSES = new Set(["backlog", "ready", "in-progress", "review", "approved", "blocked", "done"]);
const MODES = new Set(["afk", "human"]);
const REQUIRED = ["id", "title", "status", "priority", "mode", "depends-on", "claimed-by", "spec"];
const REQUIRED_SECTIONS = ["Outcome", "Acceptance criteria", "Context", "Verification", "Ownership"];
const TRANSITIONS = {
  backlog: new Set(["ready", "blocked"]),
  ready: new Set(["blocked"]),
  "in-progress": new Set(["ready", "review", "blocked"]),
  review: new Set(["in-progress", "approved", "blocked"]),
  approved: new Set(["in-progress", "done", "blocked"]),
  blocked: new Set(["backlog", "ready"]),
  done: new Set(),
};

function fail(message) {
  console.error(`tickets: ${message}`);
  process.exit(1);
}

function takeOption(args, name) {
  const index = args.indexOf(name);
  if (index === -1) return null;
  const value = args[index + 1];
  if (!value || value.startsWith("--")) fail(`${name} requires a value`);
  args.splice(index, 2);
  return value;
}

function takeFlag(args, name) {
  const index = args.indexOf(name);
  if (index === -1) return false;
  args.splice(index, 1);
  return true;
}

function findBoard(start) {
  let current = resolve(start);
  while (true) {
    const candidate = join(current, ".agents", "tickets");
    if (existsSync(candidate)) return candidate;
    const parent = resolve(current, "..");
    if (parent === current) return join(resolve(start), ".agents", "tickets");
    current = parent;
  }
}

function boardPath(args) {
  return resolve(
    takeOption(args, "--dir")
      ?? process.env.AGENT_TICKET_DIR
      ?? findBoard(process.cwd()),
  );
}

function parseTicket(file) {
  const text = readFileSync(file, "utf8");
  const match = text.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!match) throw new Error(`${basename(file)} has no frontmatter`);

  const meta = {};
  for (const line of match[1].split("\n")) {
    const field = line.match(/^([a-z][a-z0-9-]*):\s*(.*)$/);
    if (field) meta[field[1]] = field[2].trim();
  }

  return {
    ...meta,
    dependencies: (meta["depends-on"] ?? "").split(",").map((value) => value.trim()).filter(Boolean),
    body: text.slice(match[0].length),
    file,
    text,
  };
}

function loadTickets(board) {
  if (!existsSync(board)) fail(`${board} does not exist; run init`);
  return readdirSync(board)
    .filter((name) => name.endsWith(".md"))
    .sort()
    .map((name) => parseTicket(join(board, name)));
}

function validateTickets(tickets) {
  const errors = [];
  const byId = new Map();

  for (const ticket of tickets) {
    for (const field of REQUIRED) {
      if (!(field in ticket)) errors.push(`${basename(ticket.file)}: missing ${field}`);
    }
    if (!/^T-\d{3,}$/.test(ticket.id ?? "")) errors.push(`${basename(ticket.file)}: invalid id`);
    if (byId.has(ticket.id)) errors.push(`${ticket.id}: duplicate id`);
    else if (ticket.id) byId.set(ticket.id, ticket);
    if (!STATUSES.has(ticket.status)) errors.push(`${ticket.id}: invalid status "${ticket.status}"`);
    if (!MODES.has(ticket.mode)) errors.push(`${ticket.id}: invalid mode "${ticket.mode}"`);
    if (!/^[1-5]$/.test(ticket.priority ?? "")) errors.push(`${ticket.id}: priority must be 1-5`);
    if (ticket.status === "in-progress" && !ticket["claimed-by"]) {
      errors.push(`${ticket.id}: in-progress ticket has no claimed-by`);
    }
    for (const section of REQUIRED_SECTIONS) {
      if (!new RegExp(`^## ${section}\\s*$`, "mi").test(ticket.body)) {
        errors.push(`${ticket.id}: missing section "${section}"`);
      }
    }
  }

  for (const ticket of tickets) {
    for (const dependency of ticket.dependencies) {
      if (!byId.has(dependency)) errors.push(`${ticket.id}: missing dependency ${dependency}`);
      if (dependency === ticket.id) errors.push(`${ticket.id}: depends on itself`);
    }
  }

  const visiting = new Set();
  const visited = new Set();
  function visit(id, path = []) {
    if (visiting.has(id)) {
      errors.push(`${id}: dependency cycle ${[...path, id].join(" -> ")}`);
      return;
    }
    if (visited.has(id) || !byId.has(id)) return;
    visiting.add(id);
    for (const dependency of byId.get(id).dependencies) visit(dependency, [...path, id]);
    visiting.delete(id);
    visited.add(id);
  }
  for (const id of byId.keys()) visit(id);

  return { errors, byId };
}

function readyTickets(tickets, byId) {
  return tickets.filter((ticket) =>
    ticket.status === "ready"
      && !ticket["claimed-by"]
      && ticket.dependencies.every((id) => byId.get(id)?.status === "done"),
  );
}

function summary(ticket) {
  return {
    id: ticket.id,
    status: ticket.status,
    priority: Number(ticket.priority),
    mode: ticket.mode,
    claimedBy: ticket["claimed-by"],
    dependsOn: ticket.dependencies,
    title: ticket.title,
    file: ticket.file,
  };
}

function printTickets(tickets, json) {
  const rows = tickets
    .map(summary)
    .sort((a, b) => a.priority - b.priority || a.id.localeCompare(b.id));
  if (json) {
    console.log(JSON.stringify(rows, null, 2));
    return;
  }
  if (!rows.length) {
    console.log("No tickets.");
    return;
  }
  for (const row of rows) {
    const owner = row.claimedBy ? ` @${row.claimedBy}` : "";
    const deps = row.dependsOn.length ? ` <- ${row.dependsOn.join(",")}` : "";
    console.log(`${row.id}  P${row.priority}  ${row.status.padEnd(11)}  ${row.mode.padEnd(5)}${owner}${deps}  ${row.title}`);
  }
}

function updateFields(ticket, fields) {
  let text = ticket.text;
  for (const [field, value] of Object.entries(fields)) {
    const pattern = new RegExp(`^${field}:.*$`, "m");
    if (!pattern.test(text)) fail(`${ticket.id} has no ${field} field`);
    text = text.replace(pattern, `${field}: ${value}`);
  }
  const temporary = `${ticket.file}.tmp-${process.pid}`;
  writeFileSync(temporary, text);
  renameSync(temporary, ticket.file);
}

function withLock(board, action) {
  const lock = join(board, ".claim-lock");
  try {
    mkdirSync(lock);
  } catch {
    fail(`board is locked by another process: ${lock}`);
  }
  try {
    return action();
  } finally {
    rmSync(lock, { recursive: true });
  }
}

function loadValidated(board) {
  const tickets = loadTickets(board);
  const result = validateTickets(tickets);
  if (result.errors.length) fail(result.errors.join("\n"));
  return { tickets, byId: result.byId };
}

const args = process.argv.slice(2);
const board = boardPath(args);
const json = takeFlag(args, "--json");
const command = args.shift();

switch (command) {
  case "init":
    mkdirSync(board, { recursive: true });
    console.log(board);
    break;

  case "next-id": {
    const tickets = existsSync(board) ? loadTickets(board) : [];
    const highest = tickets.reduce((max, ticket) => Math.max(max, Number(ticket.id?.slice(2)) || 0), 0);
    console.log(`T-${String(highest + 1).padStart(3, "0")}`);
    break;
  }

  case "validate": {
    const tickets = loadTickets(board);
    const { errors } = validateTickets(tickets);
    if (errors.length) fail(errors.join("\n"));
    console.log(`Valid board: ${tickets.length} ticket(s)`);
    break;
  }

  case "list": {
    const { tickets } = loadValidated(board);
    printTickets(tickets, json);
    break;
  }

  case "ready": {
    const { tickets, byId } = loadValidated(board);
    printTickets(readyTickets(tickets, byId), json);
    break;
  }

  case "show": {
    const id = args.shift();
    if (!id) fail("show requires an id");
    const { byId } = loadValidated(board);
    const ticket = byId.get(id);
    if (!ticket) fail(`unknown ticket ${id}`);
    process.stdout.write(ticket.text);
    break;
  }

  case "claim": {
    const id = args.shift();
    const owner = takeOption(args, "--by");
    if (!id || !owner) fail("claim requires an id and --by <owner>");
    withLock(board, () => {
      const { tickets, byId } = loadValidated(board);
      const ticket = byId.get(id);
      if (!ticket) fail(`unknown ticket ${id}`);
      if (!readyTickets(tickets, byId).some((candidate) => candidate.id === id)) {
        fail(`${id} is not ready or is already claimed`);
      }
      updateFields(ticket, { status: "in-progress", "claimed-by": owner });
    });
    console.log(`Claimed ${id} by ${owner}`);
    break;
  }

  case "move": {
    const id = args.shift();
    const status = args.shift();
    if (!id || !status) fail("move requires an id and status");
    if (!STATUSES.has(status)) fail(`invalid status "${status}"`);
    withLock(board, () => {
      const { byId } = loadValidated(board);
      const ticket = byId.get(id);
      if (!ticket) fail(`unknown ticket ${id}`);
      if (!TRANSITIONS[ticket.status].has(status)) {
        fail(`invalid transition ${ticket.status} -> ${status} for ${id}`);
      }
      if (status === "in-progress" && !ticket["claimed-by"]) {
        fail(`${id} needs an existing owner before returning to in-progress`);
      }
      const fields = { status };
      if (["backlog", "ready"].includes(status)) fields["claimed-by"] = "";
      updateFields(ticket, fields);
    });
    console.log(`Moved ${id} to ${status}`);
    break;
  }

  default:
    fail("usage: tickets.mjs [--dir PATH] [--json] <init|next-id|validate|list|ready|show|claim|move>");
}
