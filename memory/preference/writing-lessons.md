# writing lessons

Read before writing any doc, description, or summary. When Pranav or a reviewer rejects
wording, add one entry under Lessons in the same turn: the rejected text, why it failed, a
better version, and the rule. Fold a repeat into its existing rule instead of adding a new one.

## Rules

1. **Open on the fact, not on us.** The first sentence states what happened, with the number.
   Not "Today we learn", "We propose", or "This doc describes".
2. **One claim per sentence.** No semicolon splicing two claims.
3. **Strongest evidence first.** The number that makes the case leads; it does not trail.
4. **Name the event.** Never "the last break" or "the issue" as if the reader was there. Say
   what broke, who found it, and how long it took.
5. **Every sentence names who acts.** No verb left without a subject after an opening clause.
   Move asides out of commas into parentheses or their own sentence. Fewer words, plain words,
   but not choppy: keep sentences that flow, join short ones that share a subject, and never
   drop a fact, number, condition or link to save words.

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
