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
