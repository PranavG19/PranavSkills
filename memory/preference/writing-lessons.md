# writing lessons

Read before writing any doc, description, or summary. The standing rules live in
`style.md` under "Doc rules". This file holds the rejected examples behind them. When Pranav or a
reviewer rejects wording, add one entry under Lessons in the same turn: the rejected text, why
it failed, a better version, and the rule. Fold a repeat into its existing rule. Add a new rule
to `style.md` only when the same lesson recurs in a second doc.

## Lessons

- **Backup monitor doc opening.** Rejected: "Today we learn that backups fail when someone
  tries a restore; the last failure went unnoticed for 6 days." It opens on a clumsy "we learn
  ... when" frame, splices two claims with a semicolon, buries the 6 days at the end, and
  assumes the reader knows "the last failure". Better: "Nightly backups failed for 6 days before
  anyone noticed. A developer found the empty archive while restoring a test database." Rules 1
  to 4. (Check every number in an example too. A number the research cannot confirm stays out.)
- **Backup monitor short doc.** Rejected: "The case 2 check needs phase 3" and "Approve our
  changes and D7", in a cut-down doc that never numbered the cases, never defined phases, and
  kept only some of its decisions. A short version inherits labels from its long source, and the
  reader cannot resolve them. Better: "The empty-archive check needs the archive size field" and
  "Approve our changes and alerting on a zero-byte archive (D7)". Rule: every label (case
  number, phase, decision or change id) is defined in the same doc before its first use, or
  replaced by the thing it names.
- **Backup monitor step 2.** Rejected: "After the nightly job, checks the archive in storage,
  the bucket the job writes to. The check asks for a size with no download." "Checks" has no
  subject, and the comma aside breaks the sentence. Better: "After the nightly job, the monitor
  checks the archive in its storage bucket. The check reads the size without downloading the
  file." Rule 5.
