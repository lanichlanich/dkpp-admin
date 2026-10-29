// Kept portable for the local SQLite adapter and the PostgreSQL migration.
export const LIBRARY_SCHEMA = `
CREATE TABLE IF NOT EXISTS library_books (
  id TEXT PRIMARY KEY,
  inventory_code TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  publication_year TEXT NOT NULL DEFAULT '',
  publication_place TEXT NOT NULL DEFAULT '',
  publisher TEXT NOT NULL DEFAULT '',
  isbn TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT '',
  copies INTEGER NOT NULL CHECK (copies BETWEEN 0 AND 100000),
  shelf TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS library_books_title_idx ON library_books(title);
CREATE TABLE IF NOT EXISTS library_visitors (
  id TEXT PRIMARY KEY,
  card_number TEXT NOT NULL UNIQUE,
  employee_nip TEXT UNIQUE,
  name TEXT NOT NULL,
  organization TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '',
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS library_visitors_name_idx ON library_visitors(name);
CREATE TABLE IF NOT EXISTS library_visits (
  id TEXT PRIMARY KEY,
  visitor_id TEXT NOT NULL REFERENCES library_visitors(id) ON DELETE RESTRICT,
  visit_date TEXT NOT NULL,
  purpose TEXT NOT NULL DEFAULT '',
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS library_visits_date_idx ON library_visits(visit_date);
CREATE INDEX IF NOT EXISTS library_visits_visitor_idx ON library_visits(visitor_id);
CREATE TABLE IF NOT EXISTS library_loans (
  id TEXT PRIMARY KEY,
  book_id TEXT NOT NULL REFERENCES library_books(id) ON DELETE RESTRICT,
  visitor_id TEXT NOT NULL REFERENCES library_visitors(id) ON DELETE RESTRICT,
  quantity INTEGER NOT NULL CHECK (quantity BETWEEN 1 AND 100000),
  loan_date TEXT NOT NULL,
  due_date TEXT NOT NULL CHECK (due_date >= loan_date),
  return_date TEXT CHECK (return_date >= loan_date),
  notes TEXT NOT NULL DEFAULT '',
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS library_loans_book_idx ON library_loans(book_id, return_date);
CREATE INDEX IF NOT EXISTS library_loans_visitor_idx ON library_loans(visitor_id);
CREATE INDEX IF NOT EXISTS library_loans_due_idx ON library_loans(return_date, due_date);
`;
