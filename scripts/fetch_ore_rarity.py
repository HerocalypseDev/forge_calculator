import json
import re
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ORES_JSON = ROOT / "data" / "ores.json"
OUT_DATA = ROOT / "data" / "ore_rarity.json"
OUT_WIKI = ROOT / "Web" / "mediawiki" / "Data-OreRarity.json"
SOURCE_URL = "https://forgewiki.org/wiki/Module:Ore/Data?action=raw"
SOURCE_PAGE = "Module:Ore/Data"
USER_AGENT = "ForgeCalculatorDeploy/1.0 (https://github.com/HerocalypseDev/forge_calculator)"
RARITY_ORDER = ["Common", "Uncommon", "Rare", "Epic", "Legendary", "Mythic", "Relic", "Exotic", "Divine"]


def normalize(name):
    key = re.sub(r"[^a-z0-9]", "", name.lower())
    return key[:-3] if key.endswith("ore") and len(key) > 3 else key


def wiki_rarities(lua_text):
    found = {}
    for line in lua_text.splitlines():
        name = re.search(r'name\s*=\s*"([^"]+)"', line)
        rarity = re.search(r'rarity\s*=\s*"([^"]+)"', line)
        if name and rarity:
            found[name.group(1)] = rarity.group(1)
    return found


def main():
    request = urllib.request.Request(SOURCE_URL, headers={"User-Agent": USER_AGENT})
    lua_text = urllib.request.urlopen(request, timeout=60).read().decode("utf-8")
    wiki = wiki_rarities(lua_text)
    by_key = {normalize(name): rarity for name, rarity in wiki.items()}
    ores = json.loads(ORES_JSON.read_text(encoding="utf-8"))["ores"]
    rarities, missing, unknown = {}, [], []
    for ore in ores:
        rarity = by_key.get(normalize(ore["name"]))
        if rarity is None:
            missing.append(ore["name"])
        elif rarity not in RARITY_ORDER:
            unknown.append(f"{ore['name']}={rarity}")
        else:
            rarities[ore["name"]] = rarity
    payload = {"source": SOURCE_PAGE, "order": RARITY_ORDER, "rarities": rarities}
    text = json.dumps(payload, indent=2, ensure_ascii=False) + "\n"
    OUT_DATA.write_text(text, encoding="utf-8")
    OUT_WIKI.write_text(text, encoding="utf-8")
    print(f"{len(rarities)} of {len(ores)} ores have a rarity")
    if missing:
        print("no rarity on the wiki:", ", ".join(missing))
    if unknown:
        print("unrecognised rarity:", ", ".join(unknown))
    sys.exit(1 if unknown else 0)


if __name__ == "__main__":
    main()
