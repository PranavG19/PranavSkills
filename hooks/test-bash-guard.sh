#!/bin/bash
set -u

guard="$(cd "$(dirname "$0")" && pwd)/bash-guard.sh"
failures=0

expect_block() {
  local command=$1
  local output
  local status

  output=$(jq -nc --arg command "$command" '{tool_input: {command: $command}}' | "$guard" 2>&1)
  status=$?
  if [[ $status -ne 2 || "$output" != BLOCKED:* ]]; then
    printf 'FAIL expected block: %s (status=%s, output=%s)\n' "$command" "$status" "$output"
    failures=$((failures + 1))
  fi
}

expect_allow() {
  local command=$1
  local output
  local status

  output=$(jq -nc --arg command "$command" '{tool_input: {command: $command}}' | "$guard" 2>&1)
  status=$?
  if [[ $status -ne 0 || -n "$output" ]]; then
    printf 'FAIL expected allow: %s (status=%s, output=%s)\n' "$command" "$status" "$output"
    failures=$((failures + 1))
  fi
}

# Same checks with the hook payload's cwd set, for rules that depend on the repository.
expect_block_in() {
  local cwd=$1 command=$2 output status
  output=$(jq -nc --arg command "$command" --arg cwd "$cwd" '{tool_input: {command: $command}, cwd: $cwd}' | "$guard" 2>&1)
  status=$?
  if [[ $status -ne 2 || "$output" != BLOCKED:* ]]; then
    printf 'FAIL expected block in %s: %s (status=%s, output=%s)\n' "$cwd" "$command" "$status" "$output"
    failures=$((failures + 1))
  fi
}

expect_allow_in() {
  local cwd=$1 command=$2 output status
  output=$(jq -nc --arg command "$command" --arg cwd "$cwd" '{tool_input: {command: $command}, cwd: $cwd}' | "$guard" 2>&1)
  status=$?
  if [[ $status -ne 0 || -n "$output" ]]; then
    printf 'FAIL expected allow in %s: %s (status=%s, output=%s)\n' "$cwd" "$command" "$status" "$output"
    failures=$((failures + 1))
  fi
}

export BASH_GUARD_NO_PUSH_HOSTS='git\.review\.example'
tmp=$(mktemp -d)
trap 'rm -r "$tmp"' EXIT
git init -q "$tmp/gh" && git -C "$tmp/gh" remote add origin https://github.com/example/app.git
git init -q "$tmp/review" && git -C "$tmp/review" remote add origin ssh://git.review.example:2222/pkg/Example
git -C "$tmp/review" remote add mirror https://github.com/example/mirror.git
mkdir "$tmp/plain"

# Pushing: one plain push from a repository with no review-only remote, never forced, deleting or bypassing hooks.
expect_block_in "$tmp/plain" "git push"
expect_block_in "$tmp/plain" "git -C repo push origin main"
expect_block_in "$tmp/gh" "/usr/bin/git push"
expect_allow_in "$tmp/gh" "git push"
expect_allow_in "$tmp/gh" "git push -u origin HEAD"
expect_allow_in "$tmp/gh" "git push origin main"
expect_allow_in "$tmp/gh" "git push --dry-run origin main"
expect_allow_in "$tmp/plain" "git -C $tmp/gh push origin task-1"
expect_allow_in "$tmp/plain" "cd $tmp/gh && git push origin main"
expect_allow_in "$tmp" "git -C gh push origin main"
expect_block_in "$tmp/review" "git push origin main"
expect_block_in "$tmp/review" "git push mirror main"
expect_block_in "$tmp/plain" "git -C $tmp/review push mirror main"
expect_block_in "$tmp/review" "git push origin main # $tmp/gh"
expect_block_in "$tmp/gh" "git push ssh://git.review.example:2222/pkg/Example main"
expect_block_in "$tmp/gh" "git push --force origin main"
expect_block_in "$tmp/gh" "git push -f origin main"
expect_block_in "$tmp/gh" "git push -uf origin main"
expect_block_in "$tmp/gh" "git push --force-with-lease origin main"
expect_block_in "$tmp/gh" "git push --forc origin main"
expect_block_in "$tmp/gh" "git push origin +HEAD:main"
expect_block_in "$tmp/gh" "git push origin :old"
# The shell strips quotes and escapes before git sees them, so quoted push arguments must not slip past the option checks.
expect_block_in "$tmp/gh" "git push \"--force\" origin main"
expect_block_in "$tmp/gh" "git push '--force-with-lease' origin main"
expect_block_in "$tmp/gh" "git push origin '+HEAD:main'"
expect_block_in "$tmp/gh" "git push origin \":old\""
expect_block_in "$tmp/gh" "git push \\--force origin main"
# Brace expansion, globs and newlines also rewrite the words git receives.
expect_block_in "$tmp/gh" "git push {--force,origin} main"
expect_block_in "$tmp/gh" "git push --{force,force} origin main"
expect_block_in "$tmp/gh" "git push {origin,+HEAD:main}"
expect_block_in "$tmp/gh" "git push origin {main,:old}"
expect_block_in "$tmp/gh" "git push --forc[e] origin main"
expect_block_in "$tmp/gh" "git push origin main
echo hi"
expect_block_in "$tmp/gh" "git push origin main #
git push --force origin main"
# A brace or glob in the repository path expands into extra arguments, so a literal directory with that name must not help.
mkdir "$tmp/gh/{.,push,--force,origin}"
expect_block_in "$tmp/gh" "git -C {.,push,--force,origin} push main"
expect_block_in "$tmp/gh" "cd {.,push,--force,origin} && git push main"
expect_block_in "$tmp/gh" "git -C '$tmp/gh' push origin main"
# The shell resolves ~+, ~-, ~user and a bare - to other directories, so the guard would read the wrong remotes.
# Each decoy is a literal directory holding an allowed repository inside the review-only one.
for decoy in '~+' '~-' '-' '~root'; do
  git init -q "$tmp/review/$decoy" && git -C "$tmp/review/$decoy" remote add origin https://github.com/example/decoy.git
done
expect_block_in "$tmp/review" "git -C ~+ push origin main"
expect_block_in "$tmp/review" "cd ~+ && git push origin main"
expect_block_in "$tmp/review" "cd ~- && git push origin main"
expect_block_in "$tmp/review" "cd - && git push origin main"
expect_block_in "$tmp/review" "git -C ~root push origin main"
# cd resolves .. without following symlinks and zsh reads +N as the directory stack, so both can land somewhere other than the literal path.
for decoy in '+0' '+00'; do
  git init -q "$tmp/review/$decoy" && git -C "$tmp/review/$decoy" remote add origin https://github.com/example/decoy.git
done
git init -q "$tmp/decoy" && git -C "$tmp/decoy" remote add origin https://github.com/example/decoy.git
mkdir "$tmp/decoy/sub" && ln -s "$tmp/decoy/sub" "$tmp/review/link"
expect_block_in "$tmp/review" "cd +0 && git push origin main"
expect_block_in "$tmp/review" "cd +00 && git push origin main"
expect_block_in "$tmp/review" "cd link/.. && git push origin main"
expect_block_in "$tmp/review/link" "cd .. && git push origin main"
expect_allow_in "$tmp/review" "git -C link/.. push origin main"
# A redirection glued to the word still hands git the remaining arguments.
expect_block_in "$tmp/gh" "git push>/dev/null --force origin main"
expect_block_in "$tmp/gh" "git push</dev/null --delete origin old"
expect_block_in "$tmp/review" "git push>/dev/null origin main"
# An all-zero source is the null object id, which deletes the destination ref.
expect_block_in "$tmp/gh" "git push origin 0000000000000000000000000000000000000000:main"
expect_block_in "$tmp/gh" "git push origin 0000000000000000000000000000000000000000000000000000000000000000:main"
# Hostnames are case-insensitive.
expect_block_in "$tmp/gh" "git push ssh://GIT.REVIEW.EXAMPLE:2222/pkg/Example main"
git init -q "$tmp/upper" && git -C "$tmp/upper" remote add origin ssh://Git.Review.Example:2222/pkg/Example
expect_block_in "$tmp/upper" "git push origin main"

# Without jq, a Codex denial still has to reach Codex as a block.
nojq="$tmp/nojq-bin"
mkdir "$nojq" && ln -s "$(command -v cat)" "$nojq/cat"
codex_output=$(printf '{"tool_input":{"command":"git push --force origin main"}}' | PATH="$nojq" "$guard" codex 2>/dev/null)
if [[ "$codex_output" != *'"permissionDecision":"deny"'* ]]; then
  printf 'FAIL expected a Codex deny without jq (output=%s)\n' "$codex_output"
  failures=$((failures + 1))
fi
codex_output=$(jq -nc '{tool_input: {command: "git push>/dev/null --force origin main"}}' | "$guard" codex 2>/dev/null)
if [[ "$codex_output" != *'"permissionDecision":"deny"'* ]]; then
  printf 'FAIL expected a Codex deny for a redirected forced push (output=%s)\n' "$codex_output"
  failures=$((failures + 1))
fi
expect_block_in "$tmp/gh" "git push --delete origin old"
expect_block_in "$tmp/gh" "git push -d origin old"
expect_block_in "$tmp/gh" "git push --mirror origin"
expect_block_in "$tmp/gh" "git push --no-verify origin task-1"
expect_block_in "$tmp/gh" "git push --prune origin"
expect_block_in "$tmp/gh" "git push --all origin"
expect_block_in "$tmp/gh" "git status && git push origin main"
expect_block_in "$tmp/gh" "bash -c 'git push origin main'"
expect_block_in "$tmp/gh" "git push origin \$(git branch --show-current)"
expect_block_in "$tmp/gh" "FOO=1 git push origin main"
expect_block "git reset --hard"
expect_block "git -C repo reset --hard"
expect_block "git checkout ."
expect_block "git -C repo checkout -- ."
expect_block "git restore ."
expect_block "git -C repo restore --worktree ."
expect_block "git restore '*'"
expect_block "git restore :/"
expect_block "git clean -fd"
expect_block "git -C repo clean -df"
expect_block "git branch -D old-branch"
expect_block "git -C repo branch -D old-branch"
expect_block "git add .env"
expect_block "rm -rf build"

output=$(printf '{"tool_input": {"command": ' | "$guard" 2>&1)
status=$?
if [[ $status -ne 2 || "$output" != BLOCKED:* ]]; then
  printf 'FAIL expected block on malformed input (status=%s, output=%s)\n' "$status" "$output"
  failures=$((failures + 1))
fi

expect_allow "git status"
expect_allow "git reset --soft HEAD~1"
expect_allow "git clean -n"
expect_allow "git branch -d merged-branch"
expect_allow "git add src/app.js"
expect_allow "rm -r build"

if [[ $failures -ne 0 ]]; then
  exit 1
fi

printf 'bash guard: all checks passed\n'
