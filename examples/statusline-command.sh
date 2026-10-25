#!/bin/bash
# Example status line for statusline-toggle: directory, git branch, model, and
# context usage + reasoning effort right-aligned.
# Parses the JSON with bash regexes (no jq/sed/awk): each extra process costs ~30ms on Windows.
input=$(cat)

# statusline-toggle: /sl writes "off" here to hide the status line
read -r sl_state 2>/dev/null < "${CLAUDE_CONFIG_DIR:-$HOME/.claude}/statusline-state"
[ "$sl_state" = "off" ] && exit 0

# json_str KEY / json_num KEY: first value of "KEY" in $input, into $REPLY
json_str() { REPLY=""; [[ $input =~ \"$1\"[[:space:]]*:[[:space:]]*\"([^\"]*)\" ]] && REPLY=${BASH_REMATCH[1]}; }
json_num() { REPLY=""; [[ $input =~ \"$1\"[[:space:]]*:[[:space:]]*([0-9.]+) ]] && REPLY=${BASH_REMATCH[1]}; }

json_str current_dir; dir=${REPLY//\\\\/\\}   # unescape JSON backslashes (Windows paths)
json_str display_name; model=$REPLY
[[ $input =~ \"effort\"[[:space:]]*:[[:space:]]*\{[[:space:]]*\"level\"[[:space:]]*:[[:space:]]*\"([^\"]*)\" ]] && effort=${BASH_REMATCH[1]}
json_num total_input_tokens; ctx_used=$REPLY
json_num context_window_size; ctx_size=$REPLY
# rate_limits also has used_percentage; the one followed by remaining_percentage is the context window's
[[ $input =~ \"used_percentage\"[[:space:]]*:[[:space:]]*([0-9]+)[0-9.]*[[:space:]]*,[[:space:]]*\"remaining_percentage\" ]] && ctx_pct=${BASH_REMATCH[1]}

# Git branch: read .git/HEAD directly instead of spawning git
cd_dir=$dir
if [[ $dir =~ ^([A-Za-z]):[\\/](.*)$ ]]; then
  cd_dir="/${BASH_REMATCH[1],,}/${BASH_REMATCH[2]//\\//}"
fi
branch=""
d=$cd_dir
while [ -n "$d" ] && [ "$d" != "/" ]; do
  if [ -f "$d/.git/HEAD" ]; then
    read -r head < "$d/.git/HEAD"
    if [[ $head == "ref: refs/heads/"* ]]; then branch=${head#ref: refs/heads/}; else branch=${head:0:7}; fi
    break
  fi
  [ -e "$d/.git" ] && break   # worktree/submodule .git file: skip rather than spawn git
  d=${d%/*}
done

# 85988 -> 86k, 1000000 -> 1M, 1500000 -> 1.5M
human_tokens() {
  local n=$1
  if (( n >= 1000000 )); then
    local tenths=$(( (n + 50000) / 100000 ))
    if (( tenths % 10 == 0 )); then REPLY="$(( tenths / 10 ))M"; else REPLY="$(( tenths / 10 )).$(( tenths % 10 ))M"; fi
  elif (( n >= 1000 )); then REPLY="$(( (n + 500) / 1000 ))k"
  else REPLY=$n
  fi
}

E=$'\033'
out="$E[36m${dir:-$PWD}$E[0m"
plain="${dir:-$PWD}"
[ -n "$branch" ] && out+=" $E[33m($branch)$E[0m" && plain+=" ($branch)"
[ -n "$model" ] && out+=" $E[2m[$model]$E[0m" && plain+=" [$model]"

# Right side: context usage (green <50%, yellow <80%, red beyond), then effort
right=""
right_colored=""
if [ -n "$ctx_used" ] && [ -n "$ctx_size" ]; then
  human_tokens "${ctx_used%.*}"; used_h=$REPLY
  human_tokens "${ctx_size%.*}"; size_h=$REPLY
  ctx="ctx:$used_h/$size_h${ctx_pct:+ $ctx_pct%}"
  color=32
  (( ${ctx_pct:-0} >= 50 )) && color=33
  (( ${ctx_pct:-0} >= 80 )) && color=31
  right=$ctx
  right_colored="$E[${color}m$ctx$E[0m"
fi
if [ -n "$effort" ]; then
  right="${right:+$right  }effort:$effort"
  right_colored="${right_colored:+$right_colored  }$E[35meffort:$effort$E[0m"
fi

# Right-align: pad by terminal width minus display width (CJK characters take two columns)
if [ -n "$right" ]; then
  LC_ALL=C.UTF-8
  cjk=${plain//[^一-鿿　-〿＀-￯가-힯]/}   # wide characters count one extra column
  left_w=$(( ${#plain} + ${#cjk} ))
  cols=${COLUMNS:-80}
  margin=4
  pad=$(( cols - left_w - ${#right} - margin ))
  (( pad < 1 )) && pad=1
  printf -v spaces '%*s' "$pad" ''
  out+="$spaces$right_colored"
fi
printf '%s' "$out"
