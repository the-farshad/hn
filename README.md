# hn.thefarshad.com

A small static reader for Hacker News. Pulls the front page (or newest)
from the public Algolia HN API in the browser &mdash; no backend.

## Layout

```
index.html      single-page reader
scripts/hn.js   fetches and renders stories
styles/         CSS
assets/         favicon
CNAME           custom domain
```

## Local preview

```sh
python3 -m http.server 8000
```

## API

Uses [Algolia HN Search](https://hn.algolia.com/api):

- Front page: `/api/v1/search?tags=front_page`
- Newest: `/api/v1/search_by_date?tags=story`
