import { existsSync, statSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';

const databasePath = process.argv[2] ? path.resolve(process.argv[2]) : '';
if (!databasePath) {
  throw new Error('확인할 SQLite 파일 경로를 입력해 주세요.');
}

const info = statSync(databasePath);
const database = new DatabaseSync(databasePath, { readOnly: true });

try {
  const quickCheck = database.prepare('PRAGMA quick_check').get();
  const tableRows = database.prepare(`
    SELECT name FROM sqlite_master WHERE type = 'table'
  `).all();
  const tables = new Set(tableRows.map((row) => row.name));
  const count = (table) => tables.has(table)
    ? Number(database.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get().count)
    : null;
  const storageRoot = tables.has('settings')
    ? database.prepare("SELECT value FROM settings WHERE key = 'storageRoot'").get()?.value ?? null
    : null;
  const linkedPathState = (table) => {
    if (!tables.has(table)) {
      return null;
    }
    const paths = database.prepare(`SELECT markdown_path FROM ${table}`).all();
    const present = paths.filter((row) => existsSync(row.markdown_path)).length;
    return { present, missing: paths.length - present };
  };

  process.stdout.write(`${JSON.stringify({
    path: databasePath,
    size: info.size,
    quickCheck: Object.values(quickCheck)[0] ?? null,
    tableCount: tables.size,
    counts: {
      records: count('records'),
      weeklySummaries: count('weekly_summaries'),
      topics: count('topics'),
      studentAliases: count('student_aliases'),
    },
    linkedMarkdown: {
      records: linkedPathState('records'),
      weeklySummaries: linkedPathState('weekly_summaries'),
    },
    storageRoot,
  }, null, 2)}\n`);
} finally {
  database.close();
}
