CREATE TABLE IF NOT EXISTS adminflow.news_categories (id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE, name_key TEXT NOT NULL UNIQUE);
CREATE TABLE IF NOT EXISTS adminflow.news_tags (id TEXT PRIMARY KEY, name TEXT NOT NULL, name_key TEXT NOT NULL UNIQUE);
CREATE TABLE IF NOT EXISTS adminflow.news_article_tags (
  article_id TEXT NOT NULL REFERENCES adminflow.news_articles(id) ON DELETE CASCADE,
  tag_id TEXT NOT NULL REFERENCES adminflow.news_tags(id) ON DELETE CASCADE,
  PRIMARY KEY (article_id, tag_id)
);
CREATE INDEX IF NOT EXISTS news_article_tags_tag_idx ON adminflow.news_article_tags(tag_id);
ALTER TABLE adminflow.news_articles ADD COLUMN IF NOT EXISTS category_id TEXT REFERENCES adminflow.news_categories(id) ON DELETE RESTRICT;
INSERT INTO adminflow.news_categories (id, name, name_key) VALUES ('default', 'Umum', 'umum') ON CONFLICT DO NOTHING;
INSERT INTO adminflow.news_categories (id, name, name_key)
SELECT 'legacy:' || LOWER(TRIM(category)), MIN(category), LOWER(TRIM(category)) FROM adminflow.news_articles
WHERE TRIM(category) <> '' GROUP BY LOWER(TRIM(category)) ON CONFLICT DO NOTHING;
UPDATE adminflow.news_articles SET category_id = COALESCE((SELECT id FROM adminflow.news_categories WHERE name_key = LOWER(TRIM(news_articles.category))), 'default') WHERE category_id IS NULL;
CREATE INDEX IF NOT EXISTS news_articles_category_idx ON adminflow.news_articles(category_id);
ALTER TABLE adminflow.news_categories ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON adminflow.news_categories FROM PUBLIC;
ALTER TABLE adminflow.news_tags ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON adminflow.news_tags FROM PUBLIC;
ALTER TABLE adminflow.news_article_tags ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON adminflow.news_article_tags FROM PUBLIC;
