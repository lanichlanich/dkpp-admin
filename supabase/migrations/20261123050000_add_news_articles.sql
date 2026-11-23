CREATE TABLE IF NOT EXISTS adminflow.news_articles (
  id TEXT PRIMARY KEY, slug TEXT NOT NULL UNIQUE, title TEXT NOT NULL, summary TEXT NOT NULL,
  category TEXT NOT NULL, body_html TEXT NOT NULL, cover_url TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('draft','published')),
  revision INTEGER NOT NULL DEFAULT 1 CHECK (revision > 0),
  published_at TIMESTAMPTZ, updated_at TIMESTAMPTZ NOT NULL,
  CHECK ((status = 'published') = (published_at IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS news_publication_idx ON adminflow.news_articles(status, published_at DESC);
ALTER TABLE adminflow.news_articles ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON adminflow.news_articles FROM PUBLIC;
