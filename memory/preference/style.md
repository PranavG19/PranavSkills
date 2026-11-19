---
title: writing-and-cr-style
type: convention
scope: personal
aliases: [writing-style, cr-style, commit-style, code-style, formatting]
learned-at: 2026-09-19
confidence: high
---
# writing and CR style

build complex things simple. smallest useful change. honest about unknowns.

plain words, active voice. no em/en dashes, no mid-sentence colons.
cut filler ("crucial", "seamless", "leverage"). if a sentence reads
unchanged in any project writeup, it says nothing here.

CR descriptions: pure ASCII. no smart quotes, arrows, ellipses.
check with: git log -1 --format=%B | LC_ALL=C command grep -n '[^[:blank:] -~]'

match codebase style. const unless reassignment. early returns. names
explain what they hold. comment the non-obvious reason.

## Doc rules

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
