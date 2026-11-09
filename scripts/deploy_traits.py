import sys

from deploy_wiki import MW, Wiki, load_env, same

SHARED = [
    ("Module:Traits/Data", MW / "Module-Traits-Data.lua"),
    ("Module:Traits", MW / "Module-Traits.lua"),
    ("Template:Traits/styles.css", MW / "Template-Traits-styles.css"),
]
WIKI_OWNED = {"Module:Traits/Data"}
JS_FILE = MW / "MediaWiki-Traits.js"
PAGE_FILE = MW / "Traits.wikitext"


def targets(live, account):
    if live:
        js_title, page_title, loader_title = "MediaWiki:Traits.js", "Traits", "MediaWiki:Common.js"
    else:
        js_title = f"User:{account}/Traits.js"
        page_title = f"User:{account}/Traits preview"
        loader_title = f"User:{account}/common.js"
    pages = SHARED + [(js_title, JS_FILE), (page_title, PAGE_FILE)]
    return pages, loader_title, f"importScript('{js_title}');"


def sync_loader(wiki, title, line, apply, summary):
    remote = wiki.content(title) or ""
    if line in remote:
        print(f"  unchanged  {title}")
        return True
    if not apply:
        print(f"  WOULD ADD  {line} to {title}")
        return True
    text = remote.rstrip("\n") + ("\n\n" if remote.strip() else "") + line + "\n"
    wiki.edit(title, text, summary)
    ok = line in (wiki.content(title) or "")
    print(f"  {'edited' if ok else 'MISMATCH'}     {title}")
    return ok


def main():
    apply = "--apply" in sys.argv
    live = "--live" in sys.argv
    summary = next((a.split("=", 1)[1] for a in sys.argv if a.startswith("--summary=")),
                   "")
    api, user, password = load_env()
    account = user.split("@", 1)[0]
    wiki = Wiki(api)
    wiki.login(user, password)
    print(f"logged in to {api} as {user} ({'live' if live else 'preview'})")
    pages, loader_title, loader_line = targets(live, account)
    failures = 0
    for title, path in pages:
        local = path.read_text(encoding="utf-8")
        remote = wiki.content(title)
        if same(title, local, remote):
            print(f"  unchanged  {title}")
            continue
        if title in WIKI_OWNED and remote is not None:
            path.write_text(remote.rstrip("\n") + "\n", encoding="utf-8")
            print(f"  pulled     {title} (edited on the wiki, local file updated)")
            continue
        if not apply:
            print(f"  WOULD EDIT {title} ({'new page' if remote is None else 'differs'})")
            continue
        result = wiki.edit(title, local, summary)
        ok = same(title, local, wiki.content(title))
        failures += 0 if ok else 1
        print(f"  {'edited' if ok else 'MISMATCH'}     {title} -> {result.get('result')} rev {result.get('newrevid', '-')}")
    failures += 0 if sync_loader(wiki, loader_title, loader_line, apply, summary) else 1
    sys.exit(1 if failures else 0)


if __name__ == "__main__":
    main()
