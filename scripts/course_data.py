"""
IT Wala Dai — single source of truth for the free +2 course data.

The home course cards, the /plus-two cards and the course detail pages (/plus-two/<slug>) all read
from COURSES, so title, duration, lesson count and price can never disagree between pages.
  * lessons  = sum of the module lessons (computed, never typed by hand)
  * duration = shown exactly as written
  * img      = Unsplash photo id, or a local /assets/... path
  * instructor=True shows the instructor block (Sachin Kushwaha teaches C and C++)
"""

from cms_data import load, pairs

COURSES = [dict(c, modules=[(m['name'], m['lessons']) for m in c['modules']]) for c in load('courses')]
COURSE_BY_SLUG = {c['slug']: c for c in COURSES}
COURSE_FAQ = pairs(load('faqs')['course'])


def n_lessons(c):
    return sum(len(ls) for _, ls in c['modules'])


def course_url(c):
    return '/plus-two/%s' % c['slug']


def course_img(c, unsplash):
    """Local image path, or an Unsplash photo id passed through the build helper."""
    return c['img'] if c['img'].startswith('/') else unsplash(c['img'])

