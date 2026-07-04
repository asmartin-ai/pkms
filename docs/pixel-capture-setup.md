# Pixel 6 capture tile — setup (⏱ ~10 min)

The phone ramp from build-plan slice 1: home-screen tile → POST → `vault/inbox/`.
Same shape the spike validated, now pointed at the real vault with the token required.

▶ **First action:** step 1 (two commands on the desktop, 30 seconds).
✓ **Done when:** a thought tapped on the tile lands as a file in `vault/inbox/`
and `pkms today` shows it as "1 new to fold in".

## 1. Desktop side (PowerShell)

```powershell
tailscale up
Get-Content .secrets\capture-token   # you'll paste this on the phone
```

The capture service itself is already running (startup shortcut "PKMS capture service";
health check: `Invoke-WebRequest http://127.0.0.1:8765/health`).

## 2. Phone side — HTTP Shortcuts (already installed from the spike test)

Edit the spike shortcut (or create new):

| Field | Value |
|---|---|
| Method | `POST` |
| URL | `http://100.75.140.1:8765/capture?source=phone` |
| Header | `X-Capture-Token: <paste the token>` |
| Body | Custom text → one **Text input** variable (keyboard up on launch) |
| Response | Toast, show response text (you'll see "saved ✓ <filename>") |
| **Retry on failure: ON** | this is the offline-capture story — a tailnet blip queues the send instead of losing the thought |

`100.75.140.1` is this desktop's tailnet IP (`tailscale ip -4`); the tailnet DNS name
works too if MagicDNS is on.

Put it on the ramp: home-screen widget AND the Quick Settings tile (the QS tile won the
spike test — one swipe + tap from anywhere).

## 3. Verify (the actual test)

Fire one real thought from the QS tile. On the desktop:

```powershell
pkms today    # → "1 new to fold in"
```

## If the phone can't reach it

- `tailscale status` on both ends — both connected?
- Firewall: the spike ran under `python.exe`; the service now runs under **pythonw.exe**,
  which may need its own inbound rule. From an **admin** PowerShell:
  ```powershell
  New-NetFirewallRule -DisplayName "PKMS capture 8765" -Direction Inbound -Action Allow -Protocol TCP -LocalPort 8765
  ```
- Sanity-check from the phone browser first: `http://100.75.140.1:8765/health` → "ok"
  (no token needed for health). The capture page at `/?token=<token>` is a fallback ramp
  from any browser.
