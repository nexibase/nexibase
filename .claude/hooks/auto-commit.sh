#!/bin/bash
git rev-parse --is-inside-work-tree >/dev/null 2>&1 || exit 0
[ -z "$(git status --porcelain)" ] && exit 0
MSG_FILE="${1}/.commit_message.txt"
[ -s "$MSG_FILE" ] || exit 0
[ -z "$(cat "$MSG_FILE")" ] && exit 0
git add -A
git commit -F "$MSG_FILE" -q
