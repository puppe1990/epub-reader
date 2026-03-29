import { createClient } from '@libsql/client';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

if (!url) {
  throw new Error('Missing TURSO_DATABASE_URL. Load .env or export the variable before running migrations.');
}

if (!authToken) {
  throw new Error('Missing TURSO_AUTH_TOKEN. Load .env or export the variable before running migrations.');
}

const client = createClient({ url, authToken });

const migrationTableSql = `
  CREATE TABLE IF NOT EXISTS schema_migrations (
    name TEXT PRIMARY KEY,
    applied_at INTEGER NOT NULL
  )
`;

async function ensureMigrationTable() {
  await client.execute(migrationTableSql);
}

async function getAppliedMigrations() {
  const result = await client.execute('SELECT name FROM schema_migrations');
  return new Set(result.rows.map((row) => String(row.name)));
}

async function recordMigration(name) {
  await client.execute({
    sql: 'INSERT OR IGNORE INTO schema_migrations (name, applied_at) VALUES (?, ?)',
    args: [name, Date.now()],
  });
}

async function getTableColumns(tableName) {
  const result = await client.execute(`PRAGMA table_info(${tableName})`);
  return new Set(result.rows.map((row) => String(row.name)));
}

async function runSqlFile(name) {
  const sql = await readFile(path.join(projectRoot, 'db', 'migrations', name), 'utf8');
  const statements = sql
    .split(';')
    .map((statement) => statement.trim())
    .filter(Boolean);

  for (const statement of statements) {
    await client.execute(statement);
  }
}

async function apply001(applied) {
  const name = '001_init.sql';
  if (applied.has(name)) return `skip ${name}`;
  await runSqlFile(name);
  await recordMigration(name);
  return `applied ${name}`;
}

async function apply002(applied) {
  const name = '002_blob_storage.sql';
  if (applied.has(name)) return `skip ${name}`;

  const columns = await getTableColumns('books');
  const statements = [];
  if (!columns.has('file_storage')) statements.push('ALTER TABLE books ADD COLUMN file_storage TEXT');
  if (!columns.has('file_key')) statements.push('ALTER TABLE books ADD COLUMN file_key TEXT');
  if (!columns.has('chunk_count')) statements.push('ALTER TABLE books ADD COLUMN chunk_count INTEGER');
  statements.push('CREATE INDEX IF NOT EXISTS idx_books_file_key ON books(file_key)');

  for (const statement of statements) {
    await client.execute(statement);
  }

  await recordMigration(name);
  return statements.length > 1 ? `applied ${name}` : `skip ${name} (schema already satisfied)`;
}

async function apply003(applied) {
  const name = '003_reading_progress_extra_state.sql';
  if (applied.has(name)) return `skip ${name}`;

  const columns = await getTableColumns('reading_progress');
  if (!columns.has('extra_state')) {
    await client.execute('ALTER TABLE reading_progress ADD COLUMN extra_state TEXT');
  }

  await recordMigration(name);
  return columns.has('extra_state') ? `skip ${name} (schema already satisfied)` : `applied ${name}`;
}

async function main() {
  await ensureMigrationTable();
  const applied = await getAppliedMigrations();
  const results = [];

  results.push(await apply001(applied));
  results.push(await apply002(applied));
  results.push(await apply003(applied));

  for (const line of results) {
    console.log(line);
  }
}

try {
  await main();
} finally {
  client.close();
}
