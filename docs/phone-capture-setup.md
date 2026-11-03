# Phone capture tile — setup (⏱ ~10 min)

The phone ramp from build-plan slice 1: home-screen tile → POST → `vault/inbox/`.
Same shape the spike validated, now pointed at the real vault with the token required.

▶ **First action:** step 1 (two commands on the desktop, 30 seconds).
✓ **Done when:** a thought tapped on the tile lands as a file in `vault/inbox/`
and `pkms today` shows it as "1 new to fold in".

## 1. Desktop side

```sh
tailscale up
cat .secrets/capture-token   # you'll paste this on the phone
```

Make sure the capture service is running (`pkms serve`, port 8765;
health check: `curl http://127.0.0.1:8765/health`).

The service binds `127.0.0.1` by default. All phone paths go through the
`tailscale serve` HTTPS URL (e.g. `https://<desktop>.<tailnet>.ts.net/capture?source=phone`).
Use `--host 0.0.0.0` only if you deliberately need a raw port reachable without tailscale.

## 2. Phone side — HTTP Shortcuts

On the phone (OnePlus 15, Android), install **HTTP Shortcuts** from the Play Store and
create a shortcut:

| Field | Value |
|---|---|
| Method | `POST` |
| URL | `https://<desktop>.<tailnet>.ts.net/capture?source=phone` |
| Header | `X-Capture-Token: <paste the token>` |
| Body | Custom text → one **Text input** variable (keyboard up on launch) |
| Response | Toast, show response text (you'll see "saved ✓ <filename>") |
| **Retry on failure: ON** | this is the offline-capture story — a tailnet blip queues the send instead of losing the thought |

`<desktop-tailnet-ip>` is the desktop's tailnet IP (`tailscale ip -4`); the tailnet DNS
name works too if MagicDNS is on.

Put it on the ramp: home-screen widget AND the Quick Settings tile (the QS tile won the
spike test — one swipe + tap from anywhere).

## 3. Verify (the actual test)

Fire one real thought from the QS tile. On the desktop:

```sh
pkms today    # → "1 new to fold in"
```

## If the phone can't reach it

- `tailscale status` on both ends — both connected?
- Firewall: the desktop runs `ufw`. If the phone can't reach port 8765, allow it on the
  tailnet interface only:
  ```sh
  sudo ufw allow in on tailscale0 to any port 8765 proto tcp
  ```
- Sanity-check from the phone browser first: `http://<desktop-tailnet-ip>:8765/health` → "ok"
  (no token needed for health). The capture page at `/?token=<token>` is a fallback ramp
  from any browser.
