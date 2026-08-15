#!/usr/bin/env python3
"""
Сборка прототипа Foodbeer.

Зачем сборщик, если на выходе нужны обычные HTML-страницы: шапка и подвал
одинаковы на 35 страницах, и держать 35 их копий руками нельзя — они
разъедутся на второй же правке. Здесь они лежат один раз в _src/partials,
а на выходе получаются самостоятельные .html-файлы, которые открываются
двойным кликом и ничего не требуют.

    python3 build.py

Синтаксис шаблонов минимальный:
    {{> partial }}              вставить _src/partials/partial.html
    {{> partial arg=значение }} то же, с подстановкой {{arg}} внутри партиала
    {{ключ}}                    значение из meta страницы или из аргумента
    {{#ключ}}…{{/ключ}}         блок выводится, только если значение непустое
    {{^ключ}}…{{/ключ}}         блок выводится, только если значение пустое
"""

import json
import re
import shutil
from pathlib import Path

ROOT = Path(__file__).parent
SRC = ROOT / "_src"
PAGES = SRC / "pages"
PARTIALS = SRC / "partials"

META_RE = re.compile(r"^<!--meta\s*(\{.*?\})\s*-->\s*", re.S)
PARTIAL_RE = re.compile(r"\{\{>\s*([a-z0-9\-]+)\s*((?:[^{}]|\{(?!\{)|\}(?!\}))*?)\}\}", re.S)
VAR_RE = re.compile(r"\{\{([a-zA-Z0-9_\-]+)\}\}")
SECTION_RE = re.compile(r"\{\{([#^])([a-zA-Z0-9_\-]+)\}\}(.*?)\{\{/\2\}\}", re.S)
# Значение аргумента: в кавычках (с поддержкой \" внутри) либо без пробелов.
ARG_RE = re.compile(
    r"([a-zA-Z0-9_\-]+)="
    r'(?:"((?:[^"\\]|\\.)*)"'
    r"|'((?:[^'\\]|\\.)*)'"
    r"|(\S+))",
    re.S,
)


def read(p: Path) -> str:
    return p.read_text(encoding="utf-8")


def unescape_arg(v: str) -> str:
    return re.sub(r"\\(.)", r"\1", v)


def expand(text: str, ctx: dict, depth: int = 0) -> str:
    """Разворачивает партиалы, условные блоки и переменные."""
    if depth > 12:
        raise RuntimeError("слишком глубокая вложенность партиалов")

    def sub_partial(m):
        name = m.group(1)
        raw_args = m.group(2) or ""
        local = dict(ctx)
        for a in ARG_RE.finditer(raw_args):
            raw = a.group(2) if a.group(2) is not None else (
                a.group(3) if a.group(3) is not None else a.group(4)
            )
            local[a.group(1)] = unescape_arg(raw or "")
        f = PARTIALS / f"{name}.html"
        if not f.exists():
            raise FileNotFoundError(f"нет партиала: {name}")
        return expand(read(f), local, depth + 1)

    text = PARTIAL_RE.sub(sub_partial, text)

    # Условные блоки — повторяем, пока разворачиваются вложенные
    for _ in range(6):
        new = SECTION_RE.sub(
            lambda m: (m.group(3) if (m.group(1) == "#") == bool(str(ctx.get(m.group(2), "")).strip()) else ""),
            text,
        )
        if new == text:
            break
        text = new

    text = VAR_RE.sub(lambda m: str(ctx.get(m.group(1), "")), text)
    return text


def build():
    layout = read(SRC / "layout.html")
    pages = sorted(PAGES.glob("*.html"))
    if not pages:
        raise SystemExit("нет страниц в _src/pages")

    index = []
    for f in pages:
        raw = read(f)
        m = META_RE.match(raw)
        if not m:
            raise SystemExit(f"{f.name}: нет блока <!--meta {{...}} -->")
        meta = json.loads(m.group(1))
        body = raw[m.end():]

        slug = f.stem
        ctx = dict(meta)
        ctx["slug"] = slug
        ctx.setdefault("desc", "")
        ctx.setdefault("bodyclass", "")

        html = expand(layout.replace("{{BODY}}", body), ctx)
        (ROOT / f"{slug}.html").write_text(html, encoding="utf-8")

        meta["file"] = f"{slug}.html"
        index.append(meta)

    (ROOT / "_pages.json").write_text(
        json.dumps(index, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(f"собрано страниц: {len(index)}")
    for m in index:
        print(f"  {m['file']:<34} {m.get('url','')}")


if __name__ == "__main__":
    build()
