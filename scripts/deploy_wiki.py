import http.cookiejar
import json
import sys
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MW = ROOT / "Web" / "mediawiki"
ENV_FILE = Path.home() / ".forgecalc-wiki.env"
USER_AGENT = "ForgeCalculatorDeploy/1.0 (https://github.com/HerocalypseDev/forge_calculator)"

PAGES = [
    ("Data:Ores.json", MW / "Data-Ores.json"),
    ("Data:Weapons.json", MW / "Data-Weapons.json"),
    ("Data:Runes.json", MW / "Data-Runes.json"),
    ("Data:Races.json", MW / "Data-Races.json"),
    ("Data:Achievements.json", MW / "Data-Achievements.json"),
    ("Data:OreRarity.json", MW / "Data-OreRarity.json"),
    ("Template:ForgeCalculator/styles.css", MW / "Template-ForgeCalculator-styles.css"),
    ("MediaWiki:ForgeCalculator.js", MW / "MediaWiki-ForgeCalculator.js"),
]


def load_env():
    text = ENV_FILE.read_text(encoding="utf-8-sig")
    env = {k.strip(): v.strip() for k, v in (line.split("=", 1) for line in text.splitlines() if "=" in line)}
    return env["FC_WIKI_API"], env["FC_WIKI_USER"], env["FC_WIKI_PASS"]


class Wiki:
    def __init__(self, api):
        self.api = api
        self.opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))

    def call(self, params, post=False):
        params = dict(params, format="json", formatversion="2")
        data = urllib.parse.urlencode(params).encode()
        if post:
            req = urllib.request.Request(self.api, data=data, headers={"User-Agent": USER_AGENT})
        else:
            req = urllib.request.Request(self.api + "?" + data.decode(), headers={"User-Agent": USER_AGENT})
        with self.opener.open(req, timeout=60) as resp:
            out = json.loads(resp.read().decode("utf-8"))
        if "error" in out:
            raise RuntimeError(f"{out['error'].get('code')}: {out['error'].get('info')}")
        return out

    def token(self, kind):
        return self.call({"action": "query", "meta": "tokens", "type": kind})["query"]["tokens"][f"{kind}token"]

    def login(self, user, password):
        result = self.call({"action": "login", "lgname": user, "lgpassword": password,
                            "lgtoken": self.token("login")}, post=True)["login"]
        if result.get("result") != "Success":
            raise RuntimeError(f"login failed: {result.get('result')} {result.get('reason', '')}")

    def content(self, title):
        page = self.call({"action": "query", "prop": "revisions", "titles": title,
                          "rvprop": "content", "rvslots": "main"})["query"]["pages"][0]
        if page.get("missing"):
            return None
        return page["revisions"][0]["slots"]["main"]["content"]

    def edit(self, title, text, summary):
        return self.call({"action": "edit", "title": title, "text": text, "summary": summary,
                          "bot": "1", "token": self.token("csrf")}, post=True)["edit"]


def same(title, local, remote):
    if remote is None:
        return False
    if title.endswith(".json"):
        return json.loads(local) == json.loads(remote)
    return local.strip() == remote.strip()


def main():
    apply = "--apply" in sys.argv
    summary = next((a.split("=", 1)[1] for a in sys.argv if a.startswith("--summary=")),
                   "")
    api, user, password = load_env()
    wiki = Wiki(api)
    wiki.login(user, password)
    print(f"logged in to {api} as {user}")
    failures = 0
    for title, path in PAGES:
        local = path.read_text(encoding="utf-8")
        remote = wiki.content(title)
        if same(title, local, remote):
            print(f"  unchanged  {title}")
            continue
        if not apply:
            print(f"  WOULD EDIT {title} ({'new page' if remote is None else 'differs'})")
            continue
        result = wiki.edit(title, local, summary)
        ok = same(title, local, wiki.content(title))
        failures += 0 if ok else 1
        print(f"  {'edited' if ok else 'MISMATCH'}     {title} -> {result.get('result')} rev {result.get('newrevid', '-')}")
    sys.exit(1 if failures else 0)


if __name__ == "__main__":
    main()
