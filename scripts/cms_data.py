"""
IT Wala Dai — structured content (single source of truth, edited in the admin CMS).

The admin panel writes the published records to content/data/<name>.json; every generator/renderer reads them
from here so the home cards, list pages and detail pages always show the same data.
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / 'content' / 'data'


def load(name):
    with open(DATA / ('%s.json' % name), encoding='utf-8') as f:
        return json.load(f)


def pairs(items):
    """[{'q':..,'a':..}] -> [(q, a)] (the format the HTML builders use)."""
    return [(i['q'], i['a']) for i in items]
