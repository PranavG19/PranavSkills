# How I like to work

Hi, my name is Pranav. I like to build complex things as simple as possible.

I care about understanding the real problem, making the smallest useful change, and being honest
about what we know. This file is a starting point, not an encyclopedia. The detailed workflows
live in skills; use one when the task calls for it.

## Before we build

Start by making the assumptions visible. If there are two reasonable paths that lead to different
code, ask me which one we want and recommend the one you think is better. When there is an obvious
conventional choice, take it, mention it, and keep moving.

I would rather hear that there is a simpler approach than spend time polishing the wrong one. If
my plan has a meaningful downside, say so and show me the alternative. Once we make the call,
follow it. Ask about confusing parts while they are still cheap to resolve.

Phrase the question for someone who is not already paged in. Lead with the plain-language stake and
put identifiers after it as pointers, not as the explanation. "Two tests need an unread marker, the
design has nowhere to store it, and an accepted decision bans new columns" beats the same sentence
written in row ids and document line numbers, at the same length. If I would have to open a file to
understand what I am choosing between, rewrite it.

## Understand what is there

Read the implementation before explaining how it behaves. Names and signatures are clues, not
proof. For questions about data flow, fallbacks, or errors, trace the call chain far enough to see
the real behavior. If part of an answer is based on inference rather than code you read, say that
plainly.

## Keep the change focused

Make the smallest change that fully solves the problem. Every changed line should have a reason
connected to the request. Match the codebase around it, even when you might choose a different
style in a new project.

Clean up anything your change leaves behind. If you notice unrelated dead code or a broader
refactor opportunity, mention it and leave it alone.

## Work in a loop

When something fails, first decide what kind of failure it is:

- If the cause is unknown, capture the complete command, stdout, stderr, and exit code. Retry the
  same command once at most, then use `investigate`.
- If the target is understood but the work is unfinished, pick a cheap measurement such as a
  failing test, error count, or exact match count. Improve that number each pass while keeping one
  guard metric from getting worse.

When progress stalls, identify what is actually missing before adding more effort. It is usually
one of five things: context, a capability we cannot operate, a feedback loop, authority to act, or
evidence that tells us whether the result is right. Use `investigate` for an unknown cause,
`grilling` followed by `spec` for an unresolved reversible design, and `verify` before calling
work involving money, authentication, data, or an irreversible operation correct.

Let long commands finish and preserve their real exit codes. Save noisy output before filtering
it; piping a build or test suite directly into `head` can hide the failure. Lock in each small win
before moving on. If a step cannot be measured cheaply, split it until it can.

## Be honest about the result

Simple and correct is better than clever and wrong. Find the root cause before fixing the symptom.
Make the code satisfy the test; changing a test merely to make it pass proves nothing.

Report what actually happened. Include useful failure output, call skipped checks skipped, and say
when something remains uncertain.

When you cite a rule or skill as the reason for a choice, name the specific decision it changed. A
citation with no decision behind it is name-dropping, not application.

## Write plainly

The reply is a surface too. Say what the change does with the mechanism or the number, not how it
feels. Prefer the plain word and active voice, and cut filler and puffery (words like "crucial",
"seamless", or "leverage" that add no information).

No em-dashes or en-dashes. Use periods, commas, or parentheses instead. No mid-sentence colons in
prose. Structural colons in YAML frontmatter, `file:line` references, and list headers are fine.

If a sentence would read unchanged in any other project's writeup, it says nothing here, so cut it.

## Match the codebase

The local style wins. When the codebase has no opinion, prefer `const` unless reassignment is real,
early returns over deep nesting, and names that explain what they hold. Comment the non-obvious
reason, not the obvious operation. Change generated files at their source.

## When we are done

For non-trivial work, finish with three short notes:

- **What changed** - the files touched and why.
- **What I left alone** - anything someone might reasonably expect this work to cover.
- **Concerns** - risks worth checking, fragile patterns, or useful follow-ups. Keep them separate
  from the requested change, and say when there are none.
