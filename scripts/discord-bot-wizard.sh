#!/usr/bin/env bash

set -euo pipefail

if [[ -t 1 ]] && command -v tput >/dev/null 2>&1 && [[ "$(tput colors 2>/dev/null || echo 0)" -ge 8 ]]; then
  BOLD=$(tput bold); DIM=$(tput dim); RESET=$(tput sgr0)
  BLUE=$(tput setaf 4); GREEN=$(tput setaf 2); YELLOW=$(tput setaf 3); RED=$(tput setaf 1)
else
  BOLD=""; DIM=""; RESET=""; BLUE=""; GREEN=""; YELLOW=""; RED=""
fi

TOTAL_STAGES=0

_STAGE_INDEX=0
ENV_FILE="${ENV_FILE:-.env}"
WRITTEN_ENV=()
WRITTEN_SECRET=()
SKIPPED=()

_clear() {
  [[ -t 1 ]] || return 0
  if command -v tput >/dev/null 2>&1; then tput clear; else printf '\033[2J\033[3J\033[H'; fi
}

banner() {
  _clear
  printf '\n%s%s  %s%s\n' "$BOLD" "$BLUE" "$1" "$RESET"
  printf '%s  %s stages%s\n\n' "$DIM" "$TOTAL_STAGES" "$RESET"
  printf '%s  You drive the browser; this wizard tells you exactly what to do and\n' "$DIM"
  printf '  captures the values you copy back. Stop any time with Ctrl-C and re-run\n'
  printf '  later — it remembers values already saved.%s\n' "$RESET"
  pause "Ready to start?"
}

stage() {
  _clear
  _STAGE_INDEX=$((_STAGE_INDEX + 1))
  printf '\n%s%s▸ Stage %s/%s · %s%s\n' \
    "$BOLD" "$BLUE" "$_STAGE_INDEX" "$TOTAL_STAGES" "$1" "$RESET"
}

say()  { printf '  %s\n' "$1"; }
step() { printf '  %s•%s %s\n' "$BLUE" "$RESET" "$1"; }
note() { printf '  %s%s%s\n' "$DIM" "$1" "$RESET"; }
warn() { printf '  %s⚠ %s%s\n' "$YELLOW" "$1" "$RESET"; }

open_url() {
  local url="$1"
  printf '  %s↗ opening%s %s\n' "$GREEN" "$RESET" "$url"
  { if   command -v wslview     >/dev/null 2>&1; then wslview "$url"
    elif command -v explorer.exe >/dev/null 2>&1; then explorer.exe "$url"
    elif command -v xdg-open    >/dev/null 2>&1; then xdg-open "$url"
    elif command -v open        >/dev/null 2>&1; then open "$url"
    else warn "couldn't open a browser — visit it manually: $url"; fi
  } >/dev/null 2>&1 || warn "couldn't open a browser — visit it manually: $url"
}

pause() {
  printf '  %s%s%s ' "$DIM" "${1:-Press Enter to continue}" "$RESET"
  read -r _ || true
}

confirm() {
  local reply=""
  printf '  %s? %s [y/N] ' "$YELLOW" "$1"
  read -r reply || true
  [[ "$reply" =~ ^[Yy] ]]
}

_existing() {
  [[ -f "$ENV_FILE" ]] || return 1
  local line; line=$(grep -E "^${1}=" "$ENV_FILE" | tail -n1) || return 1
  printf '%s' "${line#*=}"
}

ask() {
  local key="$1" prompt="$2" current input
  current=$(_existing "$key" || true)
  if [[ -n "$current" ]]; then
    printf '  %s%s%s %s[Enter keeps current]%s ' "$BOLD" "$prompt" "$RESET" "$DIM" "$RESET"
  else
    printf '  %s%s%s ' "$BOLD" "$prompt" "$RESET"
  fi
  read -r input || true
  [[ -z "$input" && -n "$current" ]] && input="$current"
  printf -v "$key" '%s' "$input"
}

ask_secret() {
  local key="$1" prompt="$2" current input
  current=$(_existing "$key" || true)
  if [[ -n "$current" ]]; then
    printf '  %s%s%s %s[Enter keeps current]%s ' "$BOLD" "$prompt" "$RESET" "$DIM" "$RESET"
  else
    printf '  %s%s%s ' "$BOLD" "$prompt" "$RESET"
  fi
  read -rs input || true
  printf '\n'
  [[ -z "$input" && -n "$current" ]] && input="$current"
  printf -v "$key" '%s' "$input"
}

write_env() {
  local key="$1" value="$2" tmp
  touch "$ENV_FILE"
  tmp=$(mktemp)
  grep -vE "^${key}=" "$ENV_FILE" > "$tmp" || true
  printf '%s=%s\n' "$key" "$value" >> "$tmp"
  mv "$tmp" "$ENV_FILE"
  WRITTEN_ENV+=("$key")
  printf '  %s✓ wrote%s %s → %s\n' "$GREEN" "$RESET" "$key" "$ENV_FILE"
}

set_secret() {
  local name="$1" value="$2"
  if command -v gh >/dev/null 2>&1 && gh auth status >/dev/null 2>&1; then
    if printf '%s' "$value" | gh secret set "$name" >/dev/null 2>&1; then
      WRITTEN_SECRET+=("$name")
      printf '  %s✓ set%s GitHub secret %s\n' "$GREEN" "$RESET" "$name"
      return
    fi
  fi
  SKIPPED+=("GitHub secret $name (set it manually: gh secret set $name)")
  warn "skipped GitHub secret $name — gh not ready; set it later"
}

set_var() {
  local name="$1" value="$2"
  if command -v gh >/dev/null 2>&1 && gh auth status >/dev/null 2>&1; then
    if gh variable set "$name" --body "$value" >/dev/null 2>&1; then
      printf '  %s✓ set%s GitHub variable %s\n' "$GREEN" "$RESET" "$name"
      return
    fi
  fi
  SKIPPED+=("GitHub variable $name")
  warn "skipped GitHub variable $name — gh not ready; set it later"
}

finish() {
  _clear
  printf '\n%s%s  ✓ Setup complete%s\n' "$BOLD" "$GREEN" "$RESET"
  (( ${#WRITTEN_ENV[@]} ))    && note "wrote ${#WRITTEN_ENV[@]} value(s) to $ENV_FILE: ${WRITTEN_ENV[*]}"
  (( ${#WRITTEN_SECRET[@]} )) && note "set ${#WRITTEN_SECRET[@]} GitHub secret(s): ${WRITTEN_SECRET[*]}"
  if (( ${#SKIPPED[@]} )); then
    printf '\n'; warn "still to do by hand:"
    for s in "${SKIPPED[@]}"; do note "  - $s"; done
  fi
  printf '\n'
}

TOTAL_STAGES=5

banner "Discord bot setup for PKMS"

stage "Create the Discord application + bot"
say "The bot token lives locally in .secrets/discord-bot-token (gitignored)."
say "Creating the app is a one-time manual step in the Discord developer portal."
open_url "https://discord.com/developers/applications"
step "Click 'New Application', name it (e.g. 'PKMS capture'), Create."
step "Left nav → 'Bot' → click 'Add Bot' → confirm."
pause "Done creating the bot?"

stage "Enable Message Content Intent"
say "Without this, the bot receives empty message bodies — nothing gets captured."
open_url "https://discord.com/developers/applications"
step "Left nav → 'Bot' → under 'Privileged Gateway Intents', toggle ON"
step "  'Message Content Intent' → Save Changes."
pause "Intent enabled?"

stage "Grab the bot token"
TOKEN_FILE=".secrets/discord-bot-token"
if [[ -s "$TOKEN_FILE" ]] && ! confirm "Token already present at $TOKEN_FILE — overwrite it?"; then
  say "Leaving the existing token in place."
  SKIPPED+=("discord token overwrite")
  pause
else
  open_url "https://discord.com/developers/applications"
  step "Left nav → 'Bot' → click 'Reset Token' → confirm → copy it."
  ask_secret DISCORD_BOT_TOKEN "Paste the bot token:"
  if [[ -z "$DISCORD_BOT_TOKEN" ]]; then
    warn "No token captured — skipping the write. Re-run to finish."
    SKIPPED+=("discord bot token")
  else
    mkdir -p .secrets
    printf '%s' "$DISCORD_BOT_TOKEN" > "$TOKEN_FILE"
    printf '  %s✓ wrote%s discord-bot-token → %s\n' "$GREEN" "$RESET" "$TOKEN_FILE"
  fi
fi

stage "Invite the bot to a server"
say "DMs work once you share a server with the bot; the invite grants access."
open_url "https://discord.com/developers/applications"
step "Left nav → 'OAuth2' → 'URL Generator'."
step "Scopes: check 'bot'. Bot permissions: check 'View Channels' + 'Send Messages' + 'Add Reactions'."
step "Copy the generated URL at the bottom and open it in a new tab."
step "Choose your server, Authorize (you must own or have Manage Server on it)."
pause "Bot invited to the server?"

stage "Capture your allowed Discord user ids"
say "The bot answers commands and captures messages only for these accounts."
say "An empty list denies everyone. Scheduled ping recipients are configured separately."
step "Discord → User Settings → Advanced → enable 'Developer Mode'."
step "Right-click each of your accounts → 'Copy User ID'."
USER_ID_FILE=".secrets/discord-user-ids"
if [[ -s "$USER_ID_FILE" ]]; then
  say "Already present at $USER_ID_FILE — leaving it in place."
  SKIPPED+=("discord user ids")
else
  ask DISCORD_USER_ID "Paste your user ids, separated by commas:"
  if [[ -z "$DISCORD_USER_ID" ]]; then
    warn "No user ids captured — the bot stays silent until they are written."
    SKIPPED+=("discord user ids")
  else
    mkdir -p .secrets
    printf '%s' "$DISCORD_USER_ID" > "$USER_ID_FILE"
    printf '  %s✓ wrote%s discord-user-ids → %s\n' "$GREEN" "$RESET" "$USER_ID_FILE"
  fi
fi

finish
