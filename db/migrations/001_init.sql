CREATE TABLE IF NOT EXISTS books (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  author TEXT NOT NULL,
  format TEXT NOT NULL CHECK (format IN ('epub', 'pdf')),
  cover_url TEXT,
  mime_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  file_blob BLOB NOT NULL,
  added_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS reading_progress (
  book_id TEXT PRIMARY KEY,
  location_cfi TEXT NOT NULL,
  href TEXT,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_books_added_at ON books(added_at DESC);
CREATE INDEX IF NOT EXISTS idx_books_title ON books(title);
