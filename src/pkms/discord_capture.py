"""Slice 8 — Discord bot ramp. A message from the user (DM, or in the one
allowed channel) is POSTed to the capture service as source=discord, deduped
by Discord message id against an append-only ledger in .index/discord-ledger.txt.

The discord.py wiring lives in run_bot() and is imported lazily — the test
suite runs without discord.py installed and must stay that way.
"""

from __future__ import annotations

from collections.abc import Callable
from pathlib import Path
from urllib.error import HTTPError
from urllib.request import Request, urlopen

DISCORD_LEDGER = "discord-ledger.txt"


# --- ledger ---


def load_discord_ledger(index_dir: Path) -> set[str]:
    p = index_dir / DISCORD_LEDGER
    if not p.exists():
        return set()
    return {ln.strip() for ln in p.read_text(encoding="utf-8").splitlines() if ln.strip()}


def append_discord_ledger(index_dir: Path, ids: list[str]) -> None:
    index_dir.mkdir(parents=True, exist_ok=True)
    with (index_dir / DISCORD_LEDGER).open("a", encoding="utf-8") as f:
        for mid in ids:
            f.write(mid + "\n")


# --- routing ---


def should_capture(
    *,
    author_is_bot: bool,
    is_dm: bool,
    channel_id: str | None,
    allowed_channel_id: str | None,
) -> bool:
    if author_is_bot:
        return False
    if is_dm:
        return True
    return allowed_channel_id is not None and channel_id == allowed_channel_id


# --- poster ---


def make_poster(base_url: str, token: str) -> Callable[[str], None]:
    def post(text: str) -> None:
        url = f"{base_url.rstrip('/')}/capture?source=discord"
        req = Request(  # noqa: S310
            url,
            data=text.encode("utf-8"),
            headers={
                "X-Capture-Token": token,
                "Content-Type": "text/plain; charset=utf-8",
            },
            method="POST",
        )
        # HTTPError propagates on non-2xx — caller sees the failure and the id
        # is intentionally NOT ledgered so a retry can succeed.
        with urlopen(req):  # noqa: S310
            pass

    return post


# --- dedupe + ledger ---


def capture_message(
    text: str,
    message_id: str,
    index_dir: Path,
    *,
    post: Callable[[str], None],
) -> bool:
    if message_id in load_discord_ledger(index_dir):
        return False
    post(text)  # let exceptions propagate
    append_discord_ledger(index_dir, [message_id])
    return True


# --- discord.py wiring (NOT under test; lazy import) ---


def run_bot(
    bot_token: str,
    index_dir: Path,
    *,
    base_url: str,
    capture_token: str,
    allowed_channel_id: str | None = None,
) -> None:
    import discord  # lazy: tests run with discord.py uninstalled

    intents = discord.Intents.default()
    intents.message_content = True
    client = discord.Client(intents=intents)
    post = make_poster(base_url, capture_token)

    @client.event
    async def on_message(message: discord.Message) -> None:
        if message.author.bot:
            return
        is_dm = message.guild is None
        channel_id = str(message.channel.id)
        if not should_capture(
            author_is_bot=False,
            is_dm=is_dm,
            channel_id=channel_id,
            allowed_channel_id=str(allowed_channel_id) if allowed_channel_id else None,
        ):
            return
        try:
            ok = capture_message(
                message.content or "",
                str(message.id),
                index_dir,
                post=post,
            )
        except HTTPError:
            return  # service down — Discord won't retry; drop quietly
        if ok:
            try:
                await message.add_reaction("✅")
            except discord.HTTPException:
                pass

    client.run(bot_token)
