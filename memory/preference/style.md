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
