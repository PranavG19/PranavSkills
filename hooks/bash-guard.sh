#!/bin/bash
# Shared Claude/Codex PreToolUse policy for destructive shell commands.

input=$(cat)
client=${1:-claude}
segment_boundary='[[:space:];|&()]'

block() {
  local reason=$1

  if [[ "$client" == "codex" ]]; then
    # Codex reads the decision from stdout and treats empty output as allow, so a missing jq
    # must still print a deny.
    jq -nc --arg reason "$reason" '{
      decision: "block",
      reason: $reason,
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "deny",
        permissionDecisionReason: $reason
      }
    }' 2>/dev/null ||
      printf '%s\n' '{"decision":"block","reason":"the shell guard blocked this command (install jq to see why).","hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"the shell guard blocked this command (install jq to see why)."}}'
    exit 0
  fi

  echo "BLOCKED: $reason" >&2
  exit 2
}

# An input the guard cannot parse is refused, never waved through.
if ! command=$(jq -r '
  (.tool_input.command // .tool_input.cmd // .command // .cmd // "")
  | if type == "array" then join(" ") else tostring end
' <<<"$input" 2>/dev/null); then
  block "the shell guard could not parse its input, so the command was not run."
fi
if ! file_path=$(jq -r '.tool_input.file_path // .file_path // ""' <<<"$input" 2>/dev/null); then
  block "the shell guard could not parse its input, so the command was not run."
fi

# Pushing (Pranav, 2026-11-05): agents may push once an independent Opus 5.5 review and an
# independent Sol 6.1 review, neither the diff's author, both approve the diff. The guard cannot see
# reviews, so it holds what it can check: one plain push, from a repository with no review-only remote,
# never forced, deleting, mirroring, pruning or skipping hooks. A repository's own pre-push hooks
# still grade what git sends.
# BASH_GUARD_NO_PUSH_HOSTS is an extended regex of hosts whose repositories take changes through
# their own review tool, never a push. Unset, no host is review-only.
# Push arguments and repository paths use an allowlist of characters: quotes, escapes, braces
# and globs all rewrite the words before git sees them, so "--force" or {--force,origin} would
# slip past the checks below. Only spaces and tabs separate words, so a newline cannot start a
# second command.
no_push_hosts=${BASH_GUARD_NO_PUSH_HOSTS:-}
push_word="(^|[[:space:];|&()\"'\`])([^[:space:];|&()\"'\`]*/)?git([^;|&()]*)[[:space:]]push($segment_boundary|[\"'\`]|$)"
blank=$' \t'
path_word='~?[A-Za-z0-9._/@=+-]+'
push_arg='[A-Za-z0-9._/:@=+^~-]+'
plain_push="^[$blank]*(cd[$blank]+($path_word)[$blank]*&&[$blank]*)?git([$blank]+-C[$blank]+($path_word))?[$blank]+push(([$blank]+$push_arg)*)[$blank]*\$"

push_dir() {
  local base=$1 path=$2
  [[ "$path" == "~" || "$path" == "~/"* ]] && path="$HOME${path:1}"
  if [[ "$path" == /* ]]; then printf '%s' "$path"; else printf '%s/%s' "$base" "$path"; fi
}

if [[ "$command" =~ $push_word ]]; then
  if [[ ! "$command" =~ $plain_push ]]; then
    block "push only as one plain command: [cd <repo> &&] git [-C <repo>] push [options] [remote] [refs], with nothing else on the line, and only after an independent Opus 5.5 review and an independent Sol 6.1 review approved the diff."
  fi
  cd_path=${BASH_REMATCH[2]}
  c_path=${BASH_REMATCH[4]}
  read -r -a push_args <<<"${BASH_REMATCH[5]}"
  for arg in "${push_args[@]}"; do
    case "$arg" in
      --*)
        name=${arg#--}
        name=${name%%=*}
        for denied in force force-with-lease force-if-includes no-verify mirror delete prune all; do
          if [[ -n "$name" && "$denied" == "$name"* ]]; then
            block "git push --$name is disabled: no forced, deleting, mirroring, pruning or hook-skipping push."
          fi
        done
        ;;
      -*)
        if [[ "$arg" =~ ^-[[:alnum:]]*[fd] ]]; then
          block "git push $arg is disabled: no forced or deleting push."
        fi
        ;;
      +* | :*)
        block "git push $arg is disabled: a + refspec forces and a : refspec deletes."
        ;;
    esac
    if [[ -n "$no_push_hosts" && "$arg" =~ $no_push_hosts ]]; then
      block "$arg is a review-only host: send the change through its review tool, not a push."
    fi
  done
  repo=$(jq -r '.cwd // empty' <<<"$input")
  [[ -n "$repo" ]] || repo=$PWD
  [[ -n "$cd_path" ]] && repo=$(push_dir "$repo" "$cd_path")
  [[ -n "$c_path" ]] && repo=$(push_dir "$repo" "$c_path")
  if ! remotes=$(git -C "$repo" remote -v 2>/dev/null); then
    block "git push from $repo: not a git repository the guard can read."
  fi
  if [[ -n "$no_push_hosts" && "$remotes" =~ $no_push_hosts ]]; then
    block "$repo has a review-only remote: send the change through its review tool, not a push."
  fi
fi

if [[ "$command" =~ (^|[[:space:]\;\|\&\(])([^[:space:]\;\|\&\(]*/)?rm([[:space:]]|$) ]]; then
  rm_has_recursive=false
  rm_has_force=false

  if [[ "$command" =~ (^|[[:space:]])--recursive([[:space:]]|$) ]] ||
     [[ "$command" =~ (^|[[:space:]])-[[:alpha:]]*[rR][[:alpha:]]*([[:space:]]|$) ]]; then
    rm_has_recursive=true
  fi
  if [[ "$command" =~ (^|[[:space:]])--force([[:space:]]|$) ]] ||
     [[ "$command" =~ (^|[[:space:]])-[[:alpha:]]*f[[:alpha:]]*([[:space:]]|$) ]]; then
    rm_has_force=true
  fi

  if [[ "$rm_has_recursive" == true && "$rm_has_force" == true ]]; then
    block "recursive forced deletion (rm -rf/-fr/-r -f) is disabled by your global agent safety policy. Delete specific paths without -f, or ask the human to remove the directory."
  fi
fi

if [[ "$command" =~ (^|$segment_boundary)([^[:space:]\;\|\&\(]*/)?git([^;\|\&\(\)]*)[[:space:]]reset[[:space:]]+--hard($segment_boundary|$) ]]; then
  block "git reset --hard will discard all uncommitted changes. This is irreversible. Use 'git stash' to save changes, or 'git checkout -- <file>' to revert specific files."
fi

if [[ "$command" =~ (^|$segment_boundary)([^[:space:]\;\|\&\(]*/)?git([^;\|\&\(\)]*)[[:space:]]checkout[[:space:]]+(--[[:space:]]+)?\.($segment_boundary|$) ]]; then
  block "git checkout . will discard all unstaged changes. This is irreversible. Revert a specific file with 'git checkout -- <file>', or 'git stash' to save everything first."
fi

if [[ "$command" =~ (^|$segment_boundary)([^[:space:]\;\|\&\(]*/)?git([^;\|\&\(\)]*)[[:space:]]restore([^;\|\&\(\)]*)[[:space:]](\.|[\"\']?\*[\"\']?|[\"\']?:/[\"\']?|[\"\']?:\(top\)[\"\']?)($segment_boundary|$) ]]; then
  block "A broad git restore pathspec will discard changes across the worktree. Use 'git stash' to save them, or restore only explicitly requested paths."
fi

if [[ "$command" =~ (^|$segment_boundary)([^[:space:]\;\|\&\(]*/)?git([^;\|\&\(\)]*)[[:space:]]clean[[:space:]]+([^;\|\&\(\)]*[[:space:]])?(-[^[:space:]]*f[^[:space:]]*|--force)($segment_boundary|$) ]]; then
  block "git clean -f will permanently delete untracked files. Run 'git clean -n' to preview, then delete specific paths, or ask the human to confirm."
fi

if [[ "$command" =~ (^|$segment_boundary)([^[:space:]\;\|\&\(]*/)?git([^;\|\&\(\)]*)[[:space:]]branch[[:space:]]+-D($segment_boundary|$) ]]; then
  block "git branch -D force-deletes a branch. Use 'git branch -d' after it is merged, or ask the human to confirm the force deletion."
fi

if [[ "$command" =~ (^|$segment_boundary)([^[:space:]\;\|\&\(]*/)?git([^;\|\&\(\)]*)[[:space:]]add([^;\|\&\(\)]*)\.env ]]; then
  block "Attempting to stage .env file. These typically contain secrets and should not be committed. Add it to .gitignore, or stage only the intended files by path."
fi

if [[ "$file_path" =~ (\.env($|\.)|credentials\.json$|\.pem$) ]]; then
  echo "WARNING: Writing to a file that may contain secrets ($file_path). Ensure no credentials are hardcoded." >&2
  exit 1
fi
