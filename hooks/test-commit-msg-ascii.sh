#!/bin/bash
# Tests for hooks/commit-msg-ascii.
# Run from the repo root: hooks/test-commit-msg-ascii.sh
set -u

hook="$(cd "$(dirname "$0")" && pwd)/commit-msg-ascii"
failures=0
tmpfile=$(mktemp)
trap 'rm -f "$tmpfile"' EXIT

expect_block() {
    local label=$1
    local msg=$2
    printf '%s\n' "$msg" > "$tmpfile"
    local output
    output=$("$hook" "$tmpfile" 2>&1)
    local status=$?
    if [ $status -eq 0 ]; then
        printf 'FAIL expected block: %s (status=%s)\n' "$label" "$status"
        failures=$((failures + 1))
    fi
}

expect_allow() {
    local label=$1
    local msg=$2
    printf '%s\n' "$msg" > "$tmpfile"
    local output
    output=$("$hook" "$tmpfile" 2>&1)
    local status=$?
    if [ $status -ne 0 ]; then
        printf 'FAIL expected allow: %s (status=%s, output=%s)\n' "$label" "$status" "$output"
        failures=$((failures + 1))
    fi
}

# --- should block ---

printf 'em dash: \xe2\x80\x94\n' > "$tmpfile"
output=$("$hook" "$tmpfile" 2>&1); status=$?
if [ $status -eq 0 ]; then printf 'FAIL expected block: em dash (status=%s)\n' "$status"; failures=$((failures + 1)); fi

printf 'en dash: \xe2\x80\x93\n' > "$tmpfile"
output=$("$hook" "$tmpfile" 2>&1); status=$?
if [ $status -eq 0 ]; then printf 'FAIL expected block: en dash (status=%s)\n' "$status"; failures=$((failures + 1)); fi

printf 'smart left quote: \xe2\x80\x9c\n' > "$tmpfile"
output=$("$hook" "$tmpfile" 2>&1); status=$?
if [ $status -eq 0 ]; then printf 'FAIL expected block: smart left quote (status=%s)\n' "$status"; failures=$((failures + 1)); fi

printf 'smart right quote: \xe2\x80\x9d\n' > "$tmpfile"
output=$("$hook" "$tmpfile" 2>&1); status=$?
if [ $status -eq 0 ]; then printf 'FAIL expected block: smart right quote (status=%s)\n' "$status"; failures=$((failures + 1)); fi

printf 'ellipsis: \xe2\x80\xa6\n' > "$tmpfile"
output=$("$hook" "$tmpfile" 2>&1); status=$?
if [ $status -eq 0 ]; then printf 'FAIL expected block: ellipsis (status=%s)\n' "$status"; failures=$((failures + 1)); fi

printf 'non-breaking space: foo\xc2\xa0bar\n' > "$tmpfile"
output=$("$hook" "$tmpfile" 2>&1); status=$?
if [ $status -eq 0 ]; then printf 'FAIL expected block: non-breaking space (status=%s)\n' "$status"; failures=$((failures + 1)); fi

printf 'right arrow: \xe2\x86\x92\n' > "$tmpfile"
output=$("$hook" "$tmpfile" 2>&1); status=$?
if [ $status -eq 0 ]; then printf 'FAIL expected block: right arrow (status=%s)\n' "$status"; failures=$((failures + 1)); fi

printf 'bullet: \xe2\x80\xa2\n' > "$tmpfile"
output=$("$hook" "$tmpfile" 2>&1); status=$?
if [ $status -eq 0 ]; then printf 'FAIL expected block: bullet (status=%s)\n' "$status"; failures=$((failures + 1)); fi

# --- should allow ---

expect_allow "plain ASCII subject" "fix: correct the widget count"
expect_allow "subject and body" "feat: add pagination

Add limit/offset params to the query layer.
Update the route handler to accept page/pageSize."
expect_allow "with comment lines" "fix: repair the thing
# This is a git comment and should be ignored
Even if it had non-ASCII."
expect_allow "empty body" "chore: bump version"
expect_allow "all printable ASCII" 'Subject with !@#$%^&*()_+-=[]{}|;:,.<>?/~ chars'
expect_allow "tabs in body" "fix: something

	indented with tab"

# --- edge cases ---

# Comment lines with non-ASCII should be ignored (git strips them)
printf 'fix: clean subject\n# comment with \xe2\x80\x94 dash\n' > "$tmpfile"
output=$("$hook" "$tmpfile" 2>&1); status=$?
if [ $status -ne 0 ]; then printf 'FAIL expected allow: comment with non-ASCII (status=%s)\n' "$status"; failures=$((failures + 1)); fi

# Non-ASCII only in the subject line
expect_block "non-ASCII in subject only" "$(printf 'fix: use the \xe2\x80\x94 approach')"

if [ $failures -ne 0 ]; then
    printf '\n%d test(s) FAILED\n' "$failures"
    exit 1
fi

printf 'commit-msg-ascii: all checks passed\n'
