import asyncio
import csv
import json
import os
import random
import sys
from datetime import datetime, timezone
from pathlib import Path

import discord
from dotenv import load_dotenv

sys.path.insert(0, str(Path(__file__).parent))
from builds import BUILD_MATRIX

load_dotenv(Path(__file__).parent / ".env")

BOT_TOKEN = os.environ.get("DISCORD_BOT_TOKEN")
CHANNEL_ID = int(os.environ.get("FORGER_CHANNEL_ID", "0"))
_target_bot_id = os.environ.get("FORGER_BOT_ID")
TARGET_BOT_ID = int(_target_bot_id) if _target_bot_id else None
REPLY_TIMEOUT = float(os.environ.get("FORGER_REPLY_TIMEOUT", "30"))
MIN_DELAY = float(os.environ.get("FORGER_MIN_DELAY", "3"))
MAX_DELAY = float(os.environ.get("FORGER_MAX_DELAY", "5"))

OUTPUT_DIR = Path(__file__).parent / "output"


def build_command_text(build):
    parts = [f"weapon:{build['weapon']}"]
    for i, ore in enumerate(build["ores"], start=1):
        parts.append(f"ore{i}:{ore}")
    parts.append(f"quality:{build['quality']}")
    return "/forge " + " ".join(parts)


def serialize_message(message):
    return {
        "author": str(message.author),
        "author_id": message.author.id,
        "content": message.content,
        "embeds": [embed.to_dict() for embed in message.embeds],
        "created_at": message.created_at.isoformat(),
    }


class ForgerFuzzClient(discord.Client):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.results = []

    async def on_ready(self):
        print(f"Logged in as {self.user} (id={self.user.id})")
        channel = self.get_channel(CHANNEL_ID) or await self.fetch_channel(CHANNEL_ID)
        await self.run_fuzz(channel)
        await self.close()

    def reply_check(self, channel):
        def check(message):
            if message.channel.id != channel.id:
                return False
            if message.author.id == self.user.id:
                return False
            if not message.author.bot:
                return False
            if TARGET_BOT_ID is not None and message.author.id != TARGET_BOT_ID:
                return False
            return True

        return check

    async def run_fuzz(self, channel):
        for index, build in enumerate(BUILD_MATRIX, start=1):
            command_text = build_command_text(build)
            print("\n" + "=" * 60)
            print(f"Build {index}/{len(BUILD_MATRIX)}: {build['label']}")
            print(f"Paste this into #{channel.name} using the /forge slash command:")
            print(f"  {command_text}")
            await asyncio.to_thread(input, "Press Enter once you've submitted it in Discord... ")

            try:
                reply = await self.wait_for(
                    "message", check=self.reply_check(channel), timeout=REPLY_TIMEOUT
                )
                captured = serialize_message(reply)
                print(f"Captured reply from {captured['author']}")
            except asyncio.TimeoutError:
                captured = None
                print(f"No reply captured within {REPLY_TIMEOUT}s, recording as null.")

            self.results.append(
                {
                    "build_index": index,
                    "label": build["label"],
                    "input": build,
                    "command_text": command_text,
                    "output": captured,
                    "captured_at": datetime.now(timezone.utc).isoformat(),
                }
            )

            if index < len(BUILD_MATRIX):
                delay = random.uniform(MIN_DELAY, MAX_DELAY)
                print(f"Waiting {delay:.1f}s before the next build...")
                await asyncio.sleep(delay)

        self.export_results()

    def export_results(self):
        OUTPUT_DIR.mkdir(exist_ok=True)
        stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
        json_path = OUTPUT_DIR / f"forger_results_{stamp}.json"
        csv_path = OUTPUT_DIR / f"forger_results_{stamp}.csv"

        json_path.write_text(json.dumps(self.results, indent=2))

        with csv_path.open("w", newline="", encoding="utf-8") as f:
            writer = csv.writer(f)
            writer.writerow(
                [
                    "build_index",
                    "label",
                    "weapon",
                    "ore1",
                    "ore2",
                    "ore3",
                    "ore4",
                    "quality",
                    "command_text",
                    "raw_content",
                    "raw_embeds",
                ]
            )
            for r in self.results:
                b = r["input"]
                out = r["output"]
                raw_content = out["content"] if out else ""
                raw_embeds = json.dumps(out["embeds"]) if out else ""
                writer.writerow(
                    [
                        r["build_index"],
                        r["label"],
                        b["weapon"],
                        *b["ores"],
                        b["quality"],
                        r["command_text"],
                        raw_content,
                        raw_embeds,
                    ]
                )

        print(f"\nSaved {len(self.results)} results to:\n  {json_path}\n  {csv_path}")


def main():
    if not BOT_TOKEN:
        sys.exit("DISCORD_BOT_TOKEN is not set. Copy .env.example to .env and fill it in.")
    if not CHANNEL_ID:
        sys.exit("FORGER_CHANNEL_ID is not set. Copy .env.example to .env and fill it in.")

    intents = discord.Intents.default()
    intents.message_content = True
    client = ForgerFuzzClient(intents=intents)
    client.run(BOT_TOKEN)


if __name__ == "__main__":
    main()
