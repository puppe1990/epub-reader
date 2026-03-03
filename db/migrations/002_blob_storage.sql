ALTER TABLE books ADD COLUMN file_storage TEXT;
ALTER TABLE books ADD COLUMN file_key TEXT;
ALTER TABLE books ADD COLUMN chunk_count INTEGER;

CREATE INDEX IF NOT EXISTS idx_books_file_key ON books(file_key);
