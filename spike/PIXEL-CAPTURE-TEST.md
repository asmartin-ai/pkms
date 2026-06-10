# Pixel 6 one-tap capture test (⏱ ~5–10 min)

Throwaway spike to answer decision gate **G2** with real data: can capture from the
Pixel hit the **<2s / zero decisions** bar? ([20-mobile-sync.md](../vault/resources/research/20-mobile-sync.md) MS-08)

▶ **First action:** step 1 below (start the server — 30 seconds).
✓ **Done when:** you've fired a capture from the home-screen widget, a file appeared
in `spike/inbox-test/`, and you've written your tap-count + felt-speed verdict at the bottom.

## Steps

1. **Start the server (desktop):**
   ```powershell
   python K:\Projects\PKMS\spike\capture_server.py
   ```
   Sanity check in a desktop browser: `http://localhost:8765/` → type something → save → file appears in `spike/inbox-test/`.

2. **Find the address your phone can reach:**
   - Tailscale running on both (the content-hoarder setup): use the desktop's tailnet name/IP — `tailscale status` shows it. URL: `http://<tailnet-ip>:8765`
   - Or same Wi-Fi LAN: `ipconfig` → IPv4 address. URL: `http://<lan-ip>:8765`
   - If nothing connects, allow port 8765 through Windows Firewall (or just answer the prompt Windows shows on first run).

3. **Phone sanity check:** open that URL in the phone browser, save a test thought from the page.

4. **Install HTTP Shortcuts** (free/FOSS) from the Play Store (or F-Droid).

5. **Create the shortcut:** new shortcut →
   - Method: `POST`, URL: `http://<your-ip>:8765/capture`
   - Request body: type **Custom text** → insert a **variable** of type *Text input* (prompts you on launch with the keyboard up)
   - (Optional, if you set `CAPTURE_TOKEN` on the server: add header `X-Capture-Token: <token>`)

6. **Put it on the ramp:** long-press home screen → widgets → HTTP Shortcuts → drop the shortcut. (Also try Quick Settings tile in the app's settings — one swipe-down + tap from anywhere, even lock screen.)

7. **The actual test:** from the home screen, capture three real thoughts. Count taps and seconds for each (tap widget → type → send → confirmation toast).

## Record your verdict (paste back to Claude or fill in)

- Taps from home screen to keyboard-up: ___
- Felt time thought→saved: ___ s
- Confirmation felt trustworthy ("saved, safe")? yes / no
- Widget vs QS tile — which felt better? ___
- Would you actually use this ramp? ✅ / ❌ / ❓ —

## Notes

- **Throwaway:** files land in `spike/inbox-test/`, not the vault; delete the whole `spike/` folder anytime. The real implementation (vault inbox, tailscale serve HTTPS, PWA) is gated on G2/G6 in [decisions.md](../vault/projects/pkms-design/decisions.md).
- HTTP Shortcuts also queues sends while offline if you enable "retry on failure" — that's the offline-capture story from MS-08, worth flipping on for the test.
