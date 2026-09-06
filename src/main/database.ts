import { backup as sqliteBackup, DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';

import { DASHBOARD_RULES } from '../shared/dashboard.ts';

import type {
  AiOrganizationDraft,
  AiProviderId,
  AiReviewStatus,
  AnnualSummary,
  AnnualSummaryResult,
  DashboardCard,
  DashboardCardStatus,
  DashboardState,
  KnowledgeChunk,
  KnowledgeSource,
  KnowledgeSourceKind,
  LinkedMarkdownDocument,
  MonthlySummary,
  MonthlySummaryResult,
  ProjectSummary,
  ProjectSummaryResult,
  QuarterlySummary,
  QuarterlySummaryResult,
  RagResult,
  SavedRagConnection,
  SemesterSummary,
  SemesterSummaryResult,
  TeacherRecord,
  TopicSource,
  TopicState,
  TopicSummary,
  TopicSuggestion,
  WeeklySummary,
  WeeklySummaryResult,
} from '../shared/contracts';

interface RecordRow {
  id: string;
  record_date: string;
  content: string;
  categories_json: string;
  markdown_path: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  ai_status: AiReviewStatus;
  ai_review_json: string | null;
}

interface NewRecord {
  id: string;
  recordDate: string;
  content: string;
  categories: string[];
  markdownPath: string;
  createdAt: string;
  aiStatus?: AiReviewStatus;
  aiReview?: AiOrganizationDraft | null;
}

export interface StudentAliasRow {
  id: string;
  academic_year: number;
  encrypted_name: Uint8Array;
  alias: string;
  created_at: string;
}

interface TopicRow {
  id: string;
  name: string;
  normalized_name: string;
  source: TopicSource;
  pinned: number;
  hidden: number;
  created_at: string;
  updated_at: string;
  record_count: number;
}

interface TopicSuggestionRow {
  normalized_name: string;
  name: string;
  record_count: number;
  record_ids: string;
}

interface DashboardPreferenceRow {
  card_key: string;
  pinned: number;
  status: DashboardCardStatus;
}

interface WeeklySummaryRow {
  id: string;
  week_start: string;
  week_end: string;
  record_ids_json: string;
  provider: AiProviderId;
  model: string;
  result_json: string;
  markdown_path: string;
  created_at: string;
  updated_at: string;
}

interface NewWeeklySummary {
  id: string;
  weekStart: string;
  weekEnd: string;
  recordIds: string[];
  provider: AiProviderId;
  model: string;
  result: WeeklySummaryResult;
  markdownPath: string;
  createdAt: string;
}

interface MonthlySummaryRow {
  id: string;
  month_key: string;
  month_start: string;
  month_end: string;
  record_ids_json: string;
  provider: AiProviderId;
  model: string;
  result_json: string;
  markdown_path: string;
  created_at: string;
  updated_at: string;
}

interface NewMonthlySummary {
  id: string;
  monthKey: string;
  monthStart: string;
  monthEnd: string;
  recordIds: string[];
  provider: AiProviderId;
  model: string;
  result: MonthlySummaryResult;
  markdownPath: string;
  createdAt: string;
}

interface QuarterlySummaryRow {
  id: string;
  quarter_key: string;
  quarter_start: string;
  quarter_end: string;
  record_ids_json: string;
  provider: AiProviderId;
  model: string;
  result_json: string;
  markdown_path: string;
  created_at: string;
  updated_at: string;
}

interface NewQuarterlySummary {
  id: string;
  quarterKey: string;
  quarterStart: string;
  quarterEnd: string;
  recordIds: string[];
  provider: AiProviderId;
  model: string;
  result: QuarterlySummaryResult;
  markdownPath: string;
  createdAt: string;
}

interface SemesterSummaryRow {
  id: string;
  semester_key: string;
  semester_start: string;
  semester_end: string;
  record_ids_json: string;
  provider: AiProviderId;
  model: string;
  result_json: string;
  markdown_path: string;
  created_at: string;
  updated_at: string;
}

interface NewSemesterSummary {
  id: string;
  semesterKey: string;
  semesterStart: string;
  semesterEnd: string;
  recordIds: string[];
  provider: AiProviderId;
  model: string;
  result: SemesterSummaryResult;
  markdownPath: string;
  createdAt: string;
}

interface AnnualSummaryRow {
  id: string;
  academic_year: string;
  year_start: string;
  year_end: string;
  record_ids_json: string;
  provider: AiProviderId;
  model: string;
  result_json: string;
  markdown_path: string;
  created_at: string;
  updated_at: string;
}

interface NewAnnualSummary {
  id: string;
  academicYear: string;
  yearStart: string;
  yearEnd: string;
  recordIds: string[];
  provider: AiProviderId;
  model: string;
  result: AnnualSummaryResult;
  markdownPath: string;
  createdAt: string;
}

interface ProjectSummaryRow {
  id: string;
  title: string;
  seed_question: string;
  period_start: string;
  period_end: string;
  record_ids_json: string;
  knowledge_chunk_ids_json: string;
  provider: AiProviderId;
  model: string;
  result_json: string;
  markdown_path: string;
  created_at: string;
  updated_at: string;
}

interface NewProjectSummary {
  id: string;
  title: string;
  seedQuestion: string;
  periodStart: string;
  periodEnd: string;
  recordIds: string[];
  knowledgeChunkIds: string[];
  provider: AiProviderId;
  model: string;
  result: ProjectSummaryResult;
  markdownPath: string;
  createdAt: string;
}

interface KnowledgeSourceRow {
  id: string;
  title: string;
  original_name: string;
  kind: KnowledgeSourceKind;
  file_type: KnowledgeSource['fileType'];
  stored_path: string;
  content_hash: string;
  character_count: number;
  chunk_count: number;
  created_at: string;
}

interface KnowledgeChunkRow {
  id: string;
  source_id: string;
  source_title: string;
  source_kind: KnowledgeSourceKind;
  chunk_index: number;
  content: string;
}

interface NewKnowledgeSource {
  id: string;
  title: string;
  originalName: string;
  kind: KnowledgeSourceKind;
  fileType: KnowledgeSource['fileType'];
  storedPath: string;
  contentHash: string;
  characterCount: number;
  chunks: Array<{ id: string; content: string }>;
  createdAt: string;
}

interface RagConnectionRow {
  id: string;
  record_id: string;
  query: string;
  chunk_ids_json: string;
  provider: AiProviderId;
  model: string;
  result_json: string;
  markdown_path: string;
  created_at: string;
}

interface NewRagConnection {
  id: string;
  recordId: string;
  query: string;
  chunkIds: string[];
  provider: AiProviderId;
  model: string;
  result: RagResult;
  markdownPath: string;
  createdAt: string;
}

let database: DatabaseSync | null = null;

const getDatabase = () => {
  if (!database) {
    throw new Error('기록 보관함을 열지 못했습니다. 앱을 다시 시작해 주세요.');
  }
  return database;
};

export const cleanTopicName = (value: string) => value
  .trim()
  .normalize('NFC')
  .replace(/\s+/g, ' ')
  .slice(0, 50);

export const normalizeTopicName = (value: string) =>
  cleanTopicName(value).toLocaleLowerCase('ko-KR');

const syncAiTopicSuggestions = (recordId: string, topics: string[]) => {
  const db = getDatabase();
  db.prepare(`
    DELETE FROM topic_suggestions
    WHERE record_id = ? AND status = 'pending'
  `).run(recordId);

  for (const rawName of topics) {
    const name = cleanTopicName(rawName);
    const normalizedName = normalizeTopicName(name);
    if (!name || !normalizedName) {
      continue;
    }

    const confirmed = db.prepare('SELECT id FROM topics WHERE normalized_name = ?')
      .get(normalizedName) as { id: string } | undefined;
    if (confirmed) {
      db.prepare(`
        INSERT OR IGNORE INTO record_topics (topic_id, record_id, created_at)
        VALUES (?, ?, ?)
      `).run(confirmed.id, recordId, new Date().toISOString());
      continue;
    }

    db.prepare(`
      INSERT INTO topic_suggestions (
        id, record_id, name, normalized_name, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, 'pending', ?, ?)
      ON CONFLICT(record_id, normalized_name) DO UPDATE SET
        name = excluded.name,
        updated_at = excluded.updated_at
    `).run(
      randomUUID(),
      recordId,
      name,
      normalizedName,
      new Date().toISOString(),
      new Date().toISOString(),
    );
  }
};

const mapRecord = (row: RecordRow): TeacherRecord => ({
  id: row.id,
  recordDate: row.record_date,
  content: row.content,
  categories: JSON.parse(row.categories_json) as string[],
  markdownPath: row.markdown_path,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  deletedAt: row.deleted_at,
  aiStatus: row.ai_status ?? 'none',
  aiReview: row.ai_review_json
    ? JSON.parse(row.ai_review_json) as AiOrganizationDraft
    : null,
});

const migrateKnowledgeFileTypes = (db: DatabaseSync) => {
  const table = db.prepare(`
    SELECT sql FROM sqlite_master
    WHERE type = 'table' AND name = 'knowledge_sources'
  `).get() as { sql: string } | undefined;
  if (!table || table.sql.includes("'docx'") && table.sql.includes("'hwpx'")) return;

  db.exec('PRAGMA foreign_keys = OFF;');
  try {
    db.exec(`
      BEGIN IMMEDIATE;
      DROP INDEX IF EXISTS knowledge_chunks_source_index;
      DROP INDEX IF EXISTS knowledge_sources_active_index;
      ALTER TABLE knowledge_chunks RENAME TO knowledge_chunks_legacy_019;
      ALTER TABLE knowledge_sources RENAME TO knowledge_sources_legacy_019;

      CREATE TABLE knowledge_sources (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        original_name TEXT NOT NULL,
        kind TEXT NOT NULL CHECK (kind IN ('curriculum', 'theory', 'other')),
        file_type TEXT NOT NULL CHECK (file_type IN ('pdf', 'docx', 'hwpx', 'markdown', 'text')),
        stored_path TEXT NOT NULL UNIQUE,
        content_hash TEXT NOT NULL,
        character_count INTEGER NOT NULL CHECK (character_count >= 0),
        chunk_count INTEGER NOT NULL CHECK (chunk_count >= 0),
        created_at TEXT NOT NULL,
        deleted_at TEXT
      ) STRICT;

      INSERT INTO knowledge_sources
      SELECT * FROM knowledge_sources_legacy_019;

      CREATE TABLE knowledge_chunks (
        id TEXT PRIMARY KEY,
        source_id TEXT NOT NULL REFERENCES knowledge_sources(id) ON DELETE CASCADE,
        chunk_index INTEGER NOT NULL,
        content TEXT NOT NULL,
        created_at TEXT NOT NULL,
        UNIQUE (source_id, chunk_index)
      ) STRICT;

      INSERT INTO knowledge_chunks
      SELECT * FROM knowledge_chunks_legacy_019;

      DROP TABLE knowledge_chunks_legacy_019;
      DROP TABLE knowledge_sources_legacy_019;

      CREATE INDEX knowledge_sources_active_index
        ON knowledge_sources(deleted_at, created_at DESC);
      CREATE INDEX knowledge_chunks_source_index
        ON knowledge_chunks(source_id, chunk_index);
    `);
    const violations = db.prepare('PRAGMA foreign_key_check').all();
    if (violations.length > 0) {
      throw new Error('교육자료 보관함 형식을 확장하는 중 연결 무결성을 확인하지 못했습니다.');
    }
    db.exec('COMMIT;');
  } catch (error) {
    try {
      db.exec('ROLLBACK;');
    } catch {
      // 이미 종료된 트랜잭션은 추가로 되돌릴 필요가 없습니다.
    }
    throw error;
  } finally {
    db.exec('PRAGMA foreign_keys = ON;');
  }
};

export const initializeDatabase = (databasePath: string) => {
  database = new DatabaseSync(databasePath, { timeout: 5_000 });
  database.exec('PRAGMA journal_mode = WAL;');
  database.exec('PRAGMA foreign_keys = ON;');
  database.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    ) STRICT;

    CREATE TABLE IF NOT EXISTS records (
      id TEXT PRIMARY KEY,
      record_date TEXT NOT NULL,
      content TEXT NOT NULL,
      categories_json TEXT NOT NULL,
      markdown_path TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT
    ) STRICT;

    CREATE INDEX IF NOT EXISTS records_date_index
      ON records(record_date DESC, created_at DESC);
    CREATE INDEX IF NOT EXISTS records_deleted_index
      ON records(deleted_at);

    CREATE TABLE IF NOT EXISTS student_aliases (
      id TEXT PRIMARY KEY,
      academic_year INTEGER NOT NULL,
      encrypted_name BLOB NOT NULL,
      alias TEXT NOT NULL,
      created_at TEXT NOT NULL,
      UNIQUE (academic_year, alias)
    ) STRICT;

    CREATE INDEX IF NOT EXISTS student_aliases_year_index
      ON student_aliases(academic_year, created_at);

    CREATE TABLE IF NOT EXISTS topics (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      normalized_name TEXT NOT NULL UNIQUE,
      source TEXT NOT NULL CHECK (source IN ('teacher', 'ai')),
      pinned INTEGER NOT NULL DEFAULT 0 CHECK (pinned IN (0, 1)),
      hidden INTEGER NOT NULL DEFAULT 0 CHECK (hidden IN (0, 1)),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    ) STRICT;

    CREATE TABLE IF NOT EXISTS record_topics (
      topic_id TEXT NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
      record_id TEXT NOT NULL REFERENCES records(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL,
      PRIMARY KEY (topic_id, record_id)
    ) STRICT;

    CREATE INDEX IF NOT EXISTS record_topics_record_index
      ON record_topics(record_id, topic_id);

    CREATE TABLE IF NOT EXISTS topic_suggestions (
      id TEXT PRIMARY KEY,
      record_id TEXT NOT NULL REFERENCES records(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      normalized_name TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('pending', 'adopted', 'rejected')),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE (record_id, normalized_name)
    ) STRICT;

    CREATE INDEX IF NOT EXISTS topic_suggestions_status_index
      ON topic_suggestions(status, normalized_name);

    CREATE TABLE IF NOT EXISTS dashboard_card_preferences (
      card_key TEXT PRIMARY KEY,
      pinned INTEGER NOT NULL DEFAULT 0 CHECK (pinned IN (0, 1)),
      status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'hidden', 'dismissed')),
      updated_at TEXT NOT NULL
    ) STRICT;

    CREATE TABLE IF NOT EXISTS weekly_summaries (
      id TEXT PRIMARY KEY,
      week_start TEXT NOT NULL,
      week_end TEXT NOT NULL,
      record_ids_json TEXT NOT NULL,
      provider TEXT NOT NULL CHECK (provider IN ('upstage', 'google')),
      model TEXT NOT NULL,
      result_json TEXT NOT NULL,
      markdown_path TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    ) STRICT;

    CREATE INDEX IF NOT EXISTS weekly_summaries_week_index
      ON weekly_summaries(week_start DESC, created_at DESC);

    CREATE TABLE IF NOT EXISTS monthly_summaries (
      id TEXT PRIMARY KEY,
      month_key TEXT NOT NULL,
      month_start TEXT NOT NULL,
      month_end TEXT NOT NULL,
      record_ids_json TEXT NOT NULL,
      provider TEXT NOT NULL CHECK (provider IN ('upstage', 'google')),
      model TEXT NOT NULL,
      result_json TEXT NOT NULL,
      markdown_path TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    ) STRICT;

    CREATE INDEX IF NOT EXISTS monthly_summaries_month_index
      ON monthly_summaries(month_key DESC, created_at DESC);

    CREATE TABLE IF NOT EXISTS quarterly_summaries (
      id TEXT PRIMARY KEY,
      quarter_key TEXT NOT NULL,
      quarter_start TEXT NOT NULL,
      quarter_end TEXT NOT NULL,
      record_ids_json TEXT NOT NULL,
      provider TEXT NOT NULL CHECK (provider IN ('upstage', 'google')),
      model TEXT NOT NULL,
      result_json TEXT NOT NULL,
      markdown_path TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    ) STRICT;

    CREATE INDEX IF NOT EXISTS quarterly_summaries_quarter_index
      ON quarterly_summaries(quarter_key DESC, created_at DESC);

    CREATE TABLE IF NOT EXISTS semester_summaries (
      id TEXT PRIMARY KEY,
      semester_key TEXT NOT NULL,
      semester_start TEXT NOT NULL,
      semester_end TEXT NOT NULL,
      record_ids_json TEXT NOT NULL,
      provider TEXT NOT NULL CHECK (provider IN ('upstage', 'google')),
      model TEXT NOT NULL,
      result_json TEXT NOT NULL,
      markdown_path TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    ) STRICT;

    CREATE INDEX IF NOT EXISTS semester_summaries_semester_index
      ON semester_summaries(semester_key DESC, created_at DESC);

    CREATE TABLE IF NOT EXISTS annual_summaries (
      id TEXT PRIMARY KEY,
      academic_year TEXT NOT NULL,
      year_start TEXT NOT NULL,
      year_end TEXT NOT NULL,
      record_ids_json TEXT NOT NULL,
      provider TEXT NOT NULL CHECK (provider IN ('upstage', 'google')),
      model TEXT NOT NULL,
      result_json TEXT NOT NULL,
      markdown_path TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    ) STRICT;

    CREATE INDEX IF NOT EXISTS annual_summaries_year_index
      ON annual_summaries(academic_year DESC, created_at DESC);

    CREATE TABLE IF NOT EXISTS project_summaries (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      seed_question TEXT NOT NULL,
      period_start TEXT NOT NULL,
      period_end TEXT NOT NULL,
      record_ids_json TEXT NOT NULL,
      knowledge_chunk_ids_json TEXT NOT NULL DEFAULT '[]',
      provider TEXT NOT NULL CHECK (provider IN ('upstage', 'google')),
      model TEXT NOT NULL,
      result_json TEXT NOT NULL,
      markdown_path TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    ) STRICT;

    CREATE INDEX IF NOT EXISTS project_summaries_period_index
      ON project_summaries(period_start DESC, created_at DESC);

    CREATE TABLE IF NOT EXISTS knowledge_sources (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      original_name TEXT NOT NULL,
      kind TEXT NOT NULL CHECK (kind IN ('curriculum', 'theory', 'other')),
      file_type TEXT NOT NULL CHECK (file_type IN ('pdf', 'docx', 'hwpx', 'markdown', 'text')),
      stored_path TEXT NOT NULL UNIQUE,
      content_hash TEXT NOT NULL,
      character_count INTEGER NOT NULL CHECK (character_count >= 0),
      chunk_count INTEGER NOT NULL CHECK (chunk_count >= 0),
      created_at TEXT NOT NULL,
      deleted_at TEXT
    ) STRICT;

    CREATE INDEX IF NOT EXISTS knowledge_sources_active_index
      ON knowledge_sources(deleted_at, created_at DESC);

    CREATE TABLE IF NOT EXISTS knowledge_chunks (
      id TEXT PRIMARY KEY,
      source_id TEXT NOT NULL REFERENCES knowledge_sources(id) ON DELETE CASCADE,
      chunk_index INTEGER NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL,
      UNIQUE (source_id, chunk_index)
    ) STRICT;

    CREATE INDEX IF NOT EXISTS knowledge_chunks_source_index
      ON knowledge_chunks(source_id, chunk_index);

    CREATE TABLE IF NOT EXISTS rag_connections (
      id TEXT PRIMARY KEY,
      record_id TEXT NOT NULL REFERENCES records(id),
      query TEXT NOT NULL,
      chunk_ids_json TEXT NOT NULL,
      provider TEXT NOT NULL CHECK (provider IN ('upstage', 'google')),
      model TEXT NOT NULL,
      result_json TEXT NOT NULL,
      markdown_path TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL
    ) STRICT;

    CREATE INDEX IF NOT EXISTS rag_connections_record_index
      ON rag_connections(record_id, created_at DESC);
  `);

  migrateKnowledgeFileTypes(database);

  const recordColumns = new Set(
    (database.prepare('PRAGMA table_info(records)').all() as Array<{ name: string }>)
      .map((column) => column.name),
  );
  if (!recordColumns.has('ai_status')) {
    database.exec("ALTER TABLE records ADD COLUMN ai_status TEXT NOT NULL DEFAULT 'none';");
  }
  if (!recordColumns.has('ai_review_json')) {
    database.exec('ALTER TABLE records ADD COLUMN ai_review_json TEXT;');
  }

  const projectSummaryColumns = new Set(
    (database.prepare('PRAGMA table_info(project_summaries)').all() as Array<{ name: string }>)
      .map((column) => column.name),
  );
  if (!projectSummaryColumns.has('knowledge_chunk_ids_json')) {
    database.exec("ALTER TABLE project_summaries ADD COLUMN knowledge_chunk_ids_json TEXT NOT NULL DEFAULT '[]';");
  }

  const adoptedRows = database.prepare(`
    SELECT id, ai_review_json
    FROM records
    WHERE ai_status = 'adopted' AND ai_review_json IS NOT NULL
  `).all() as Array<{ id: string; ai_review_json: string }>;
  for (const row of adoptedRows) {
    try {
      const review = JSON.parse(row.ai_review_json) as AiOrganizationDraft;
      syncAiTopicSuggestions(row.id, review.result.topics ?? []);
    } catch {
      // 손상된 이전 AI 데이터는 기록 본문을 막지 않고 주제 이관에서만 제외합니다.
    }
  }
};

export const closeDatabase = () => {
  if (database?.isOpen) {
    database.close();
  }
  database = null;
};

export const backupDatabase = async (destinationPath: string) =>
  sqliteBackup(getDatabase(), destinationPath);

export const listAllRecordsForBackup = () => {
  const rows = getDatabase().prepare(`
    SELECT * FROM records ORDER BY record_date, created_at
  `).all() as unknown as RecordRow[];
  return rows.map(mapRecord);
};

export const getBackupCounts = () => {
  const count = (table: string) => Number((getDatabase().prepare(`
    SELECT COUNT(*) AS count FROM ${table}
  `).get() as { count: number }).count);
  return {
    records: count('records'),
    weeklySummaries: count('weekly_summaries'),
    monthlySummaries: count('monthly_summaries'),
    quarterlySummaries: count('quarterly_summaries'),
    semesterSummaries: count('semester_summaries'),
    annualSummaries: count('annual_summaries'),
    projectSummaries: count('project_summaries'),
    knowledgeSources: Number((getDatabase().prepare(`
      SELECT COUNT(*) AS count FROM knowledge_sources WHERE deleted_at IS NULL
    `).get() as { count: number }).count),
    knowledgeConnections: count('rag_connections'),
    topics: count('topics'),
    studentAliases: count('student_aliases'),
  };
};

export const updateRecordMarkdownPath = (recordId: string, markdownPath: string) => {
  getDatabase().prepare('UPDATE records SET markdown_path = ? WHERE id = ?')
    .run(markdownPath, recordId);
};

export const updateWeeklySummaryMarkdownPath = (summaryId: string, markdownPath: string) => {
  getDatabase().prepare('UPDATE weekly_summaries SET markdown_path = ? WHERE id = ?')
    .run(markdownPath, summaryId);
};

export const updateMonthlySummaryMarkdownPath = (summaryId: string, markdownPath: string) => {
  getDatabase().prepare('UPDATE monthly_summaries SET markdown_path = ? WHERE id = ?')
    .run(markdownPath, summaryId);
};

export const updateQuarterlySummaryMarkdownPath = (summaryId: string, markdownPath: string) => {
  getDatabase().prepare('UPDATE quarterly_summaries SET markdown_path = ? WHERE id = ?')
    .run(markdownPath, summaryId);
};

export const updateSemesterSummaryMarkdownPath = (summaryId: string, markdownPath: string) => {
  getDatabase().prepare('UPDATE semester_summaries SET markdown_path = ? WHERE id = ?')
    .run(markdownPath, summaryId);
};

export const updateAnnualSummaryMarkdownPath = (summaryId: string, markdownPath: string) => {
  getDatabase().prepare('UPDATE annual_summaries SET markdown_path = ? WHERE id = ?')
    .run(markdownPath, summaryId);
};

export const updateProjectSummaryMarkdownPath = (summaryId: string, markdownPath: string) => {
  getDatabase().prepare('UPDATE project_summaries SET markdown_path = ? WHERE id = ?')
    .run(markdownPath, summaryId);
};

export const updateKnowledgeSourceStoredPath = (sourceId: string, storedPath: string) => {
  getDatabase().prepare('UPDATE knowledge_sources SET stored_path = ? WHERE id = ?')
    .run(storedPath, sourceId);
};

export const updateRagConnectionMarkdownPath = (connectionId: string, markdownPath: string) => {
  getDatabase().prepare('UPDATE rag_connections SET markdown_path = ? WHERE id = ?')
    .run(markdownPath, connectionId);
};

export const getSetting = (key: string) => {
  const row = getDatabase()
    .prepare('SELECT value FROM settings WHERE key = ?')
    .get(key) as { value: string } | undefined;
  return row?.value ?? null;
};

export const setSetting = (key: string, value: string) => {
  getDatabase()
    .prepare(`
      INSERT INTO settings (key, value, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET
        value = excluded.value,
        updated_at = excluded.updated_at
    `)
    .run(key, value, new Date().toISOString());
};

export const createRecord = (record: NewRecord) => {
  getDatabase()
    .prepare(`
      INSERT INTO records (
        id, record_date, content, categories_json, markdown_path,
        created_at, updated_at, deleted_at, ai_status, ai_review_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)
    `)
    .run(
      record.id,
      record.recordDate,
      record.content,
      JSON.stringify(record.categories),
      record.markdownPath,
      record.createdAt,
      record.createdAt,
      record.aiStatus ?? 'none',
      record.aiReview ? JSON.stringify(record.aiReview) : null,
    );

  syncAiTopicSuggestions(
    record.id,
    record.aiStatus === 'adopted' ? record.aiReview?.result.topics ?? [] : [],
  );

  return getRecord(record.id);
};

export const getRecord = (recordId: string) => {
  const row = getDatabase()
    .prepare('SELECT * FROM records WHERE id = ?')
    .get(recordId) as RecordRow | undefined;
  return row ? mapRecord(row) : null;
};

export const getRecordByDateAndContent = (recordDate: string, content: string) => {
  const row = getDatabase()
    .prepare(`
      SELECT * FROM records
      WHERE record_date = ? AND content = ?
      ORDER BY created_at ASC
      LIMIT 1
    `)
    .get(recordDate, content) as RecordRow | undefined;
  return row ? mapRecord(row) : null;
};

export const listRecords = ({
  query = '',
  includeDeleted = false,
  limit = 100,
  topicId = '',
  dateStart = '',
  dateEnd = '',
}: {
  query?: string;
  includeDeleted?: boolean;
  limit?: number;
  topicId?: string;
  dateStart?: string;
  dateEnd?: string;
} = {}) => {
  const normalizedQuery = query.trim().slice(0, 200);
  const search = `%${normalizedQuery}%`;
  const deletedClause = includeDeleted ? 'deleted_at IS NOT NULL' : 'deleted_at IS NULL';
  const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), 500);

  const rows = getDatabase()
    .prepare(`
      SELECT * FROM records
      WHERE ${deletedClause}
        AND (? = '' OR record_date >= ?)
        AND (? = '' OR record_date <= ?)
        AND (
          ? = ''
          OR EXISTS (
            SELECT 1 FROM record_topics
            WHERE record_topics.record_id = records.id
              AND record_topics.topic_id = ?
          )
        )
        AND (
          ? = ''
          OR content LIKE ?
          OR categories_json LIKE ?
          OR record_date LIKE ?
          OR ai_review_json LIKE ?
          OR EXISTS (
            SELECT 1
            FROM record_topics
            INNER JOIN topics ON topics.id = record_topics.topic_id
            WHERE record_topics.record_id = records.id
              AND topics.name LIKE ?
          )
        )
      ORDER BY record_date DESC, created_at DESC
      LIMIT ?
    `)
    .all(
      dateStart,
      dateStart,
      dateEnd,
      dateEnd,
      topicId,
      topicId,
      normalizedQuery,
      search,
      search,
      search,
      search,
      search,
      safeLimit,
    ) as unknown as RecordRow[];

  return rows.map(mapRecord);
};

export const updateRecord = (
  recordId: string,
  content: string,
  categories: string[],
  aiStatus: AiReviewStatus = 'none',
  aiReview: AiOrganizationDraft | null = null,
) => {
  const updatedAt = new Date().toISOString();
  const result = getDatabase()
    .prepare(`
      UPDATE records
      SET content = ?, categories_json = ?, updated_at = ?, ai_status = ?, ai_review_json = ?
      WHERE id = ? AND deleted_at IS NULL
    `)
    .run(
      content,
      JSON.stringify(categories),
      updatedAt,
      aiStatus,
      aiReview ? JSON.stringify(aiReview) : null,
      recordId,
    );

  if (Number(result.changes) !== 1) {
    throw new Error('수정할 기록을 찾지 못했습니다.');
  }

  syncAiTopicSuggestions(
    recordId,
    aiStatus === 'adopted' ? aiReview?.result.topics ?? [] : [],
  );

  return getRecord(recordId);
};

export const trashRecord = (recordId: string) => {
  const result = getDatabase()
    .prepare('UPDATE records SET deleted_at = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL')
    .run(new Date().toISOString(), new Date().toISOString(), recordId);
  return Number(result.changes) === 1;
};

export const restoreRecord = (recordId: string) => {
  const result = getDatabase()
    .prepare('UPDATE records SET deleted_at = NULL, updated_at = ? WHERE id = ? AND deleted_at IS NOT NULL')
    .run(new Date().toISOString(), recordId);
  return Number(result.changes) === 1;
};

const mapTopic = (row: TopicRow): TopicSummary => ({
  id: row.id,
  name: row.name,
  source: row.source,
  pinned: row.pinned === 1,
  hidden: row.hidden === 1,
  recordCount: Number(row.record_count),
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export const listTopicState = (): TopicState => {
  const topics = getDatabase().prepare(`
    SELECT
      topics.*,
      COUNT(records.id) AS record_count
    FROM topics
    LEFT JOIN record_topics ON record_topics.topic_id = topics.id
    LEFT JOIN records
      ON records.id = record_topics.record_id
      AND records.deleted_at IS NULL
    GROUP BY topics.id
    ORDER BY topics.hidden, topics.pinned DESC, record_count DESC, topics.updated_at DESC
  `).all() as unknown as TopicRow[];

  const suggestionRows = getDatabase().prepare(`
    SELECT
      topic_suggestions.normalized_name,
      MAX(topic_suggestions.name) AS name,
      COUNT(DISTINCT topic_suggestions.record_id) AS record_count,
      GROUP_CONCAT(DISTINCT topic_suggestions.record_id) AS record_ids
    FROM topic_suggestions
    INNER JOIN records ON records.id = topic_suggestions.record_id
    WHERE topic_suggestions.status = 'pending'
      AND records.deleted_at IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM topics
        WHERE topics.normalized_name = topic_suggestions.normalized_name
      )
    GROUP BY topic_suggestions.normalized_name
    ORDER BY record_count DESC, MAX(topic_suggestions.updated_at) DESC
  `).all() as unknown as TopicSuggestionRow[];

  const suggestions: TopicSuggestion[] = suggestionRows.map((row) => ({
    normalizedName: row.normalized_name,
    name: row.name,
    recordCount: Number(row.record_count),
    recordIds: row.record_ids ? row.record_ids.split(',') : [],
  }));

  return { topics: topics.map(mapTopic), suggestions };
};

const getTopicRow = (topicId: string) => getDatabase().prepare(`
  SELECT topics.*, COUNT(records.id) AS record_count
  FROM topics
  LEFT JOIN record_topics ON record_topics.topic_id = topics.id
  LEFT JOIN records
    ON records.id = record_topics.record_id
    AND records.deleted_at IS NULL
  WHERE topics.id = ?
  GROUP BY topics.id
`).get(topicId) as TopicRow | undefined;

export const getTopicRecordIds = (topicId: string) => (
  getDatabase().prepare(`
    SELECT record_topics.record_id
    FROM record_topics
    INNER JOIN records ON records.id = record_topics.record_id
    WHERE record_topics.topic_id = ? AND records.deleted_at IS NULL
    ORDER BY records.record_date DESC, records.created_at DESC
  `).all(topicId) as Array<{ record_id: string }>
).map((row) => row.record_id);

export const listRecordTopicNames = (recordId: string) => (
  getDatabase().prepare(`
    SELECT topics.name
    FROM topics
    INNER JOIN record_topics ON record_topics.topic_id = topics.id
    WHERE record_topics.record_id = ?
    ORDER BY topics.pinned DESC, topics.name
  `).all(recordId) as Array<{ name: string }>
).map((row) => row.name);

export const linkRecordToTopic = (topicId: string, recordId: string) => {
  if (!getTopicRow(topicId)) {
    throw new Error('기록을 연결할 주제를 찾지 못했습니다.');
  }
  const record = getRecord(recordId);
  if (!record || record.deletedAt) {
    throw new Error('주제에 연결할 기록을 찾지 못했습니다.');
  }
  getDatabase().prepare(`
    INSERT OR IGNORE INTO record_topics (topic_id, record_id, created_at)
    VALUES (?, ?, ?)
  `).run(topicId, recordId, new Date().toISOString());
};

export const unlinkRecordFromTopic = (topicId: string, recordId: string) => {
  const result = getDatabase().prepare(`
    DELETE FROM record_topics WHERE topic_id = ? AND record_id = ?
  `).run(topicId, recordId);
  if (Number(result.changes) !== 1) {
    throw new Error('해제할 기록 연결을 찾지 못했습니다.');
  }
};

export const createTopic = (
  rawName: string,
  source: TopicSource = 'teacher',
  recordIds: string[] = [],
) => {
  const name = cleanTopicName(rawName);
  const normalizedName = normalizeTopicName(name);
  if (!name) {
    throw new Error('주제 이름을 입력해 주세요.');
  }
  if (getDatabase().prepare('SELECT id FROM topics WHERE normalized_name = ?').get(normalizedName)) {
    throw new Error('같은 이름의 주제가 이미 있습니다. 기존 주제를 선택해 주세요.');
  }

  const id = randomUUID();
  const now = new Date().toISOString();
  const db = getDatabase();
  db.exec('BEGIN IMMEDIATE;');
  try {
    db.prepare(`
      INSERT INTO topics (
        id, name, normalized_name, source, pinned, hidden, created_at, updated_at
      ) VALUES (?, ?, ?, ?, 0, 0, ?, ?)
    `).run(id, name, normalizedName, source, now, now);
    for (const recordId of [...new Set(recordIds)]) {
      db.prepare(`
        INSERT OR IGNORE INTO record_topics (topic_id, record_id, created_at)
        VALUES (?, ?, ?)
      `).run(id, recordId, now);
    }
    db.exec('COMMIT;');
  } catch (error) {
    db.exec('ROLLBACK;');
    throw error;
  }
  return mapTopic(getTopicRow(id) as TopicRow);
};

export const adoptTopicSuggestion = (rawNormalizedName: string, rawName: string) => {
  const suggestionName = normalizeTopicName(rawNormalizedName);
  const name = cleanTopicName(rawName);
  if (!suggestionName || !name) {
    throw new Error('채택할 주제 후보를 확인해 주세요.');
  }

  const db = getDatabase();
  const suggestions = db.prepare(`
    SELECT record_id
    FROM topic_suggestions
    WHERE normalized_name = ? AND status = 'pending'
  `).all(suggestionName) as Array<{ record_id: string }>;
  const recordIds = [...new Set(suggestions.map((row) => row.record_id))];
  if (recordIds.length === 0) {
    throw new Error('채택할 주제 후보를 찾지 못했습니다.');
  }

  const normalizedName = normalizeTopicName(name);
  const existing = db.prepare('SELECT id FROM topics WHERE normalized_name = ?')
    .get(normalizedName) as { id: string } | undefined;
  const topicId = existing?.id ?? randomUUID();
  const now = new Date().toISOString();
  db.exec('BEGIN IMMEDIATE;');
  try {
    if (!existing) {
      db.prepare(`
        INSERT INTO topics (
          id, name, normalized_name, source, pinned, hidden, created_at, updated_at
        ) VALUES (?, ?, ?, 'ai', 0, 0, ?, ?)
      `).run(topicId, name, normalizedName, now, now);
    }
    for (const recordId of recordIds) {
      db.prepare(`
        INSERT OR IGNORE INTO record_topics (topic_id, record_id, created_at)
        VALUES (?, ?, ?)
      `).run(topicId, recordId, now);
    }
    db.prepare(`
      UPDATE topic_suggestions
      SET status = 'adopted', updated_at = ?
      WHERE normalized_name = ? AND status = 'pending'
    `).run(now, suggestionName);
    db.exec('COMMIT;');
  } catch (error) {
    db.exec('ROLLBACK;');
    throw error;
  }
  return { topic: mapTopic(getTopicRow(topicId) as TopicRow), recordIds };
};

export const dismissTopicSuggestion = (rawNormalizedName: string) => {
  const normalizedName = normalizeTopicName(rawNormalizedName);
  if (!normalizedName) {
    throw new Error('숨길 주제 후보를 확인해 주세요.');
  }
  getDatabase().prepare(`
    UPDATE topic_suggestions
    SET status = 'rejected', updated_at = ?
    WHERE normalized_name = ? AND status = 'pending'
  `).run(new Date().toISOString(), normalizedName);
};

export const updateTopic = (
  topicId: string,
  changes: { name?: string; pinned?: boolean; hidden?: boolean },
) => {
  const current = getTopicRow(topicId);
  if (!current) {
    throw new Error('수정할 주제를 찾지 못했습니다.');
  }
  const name = changes.name === undefined ? current.name : cleanTopicName(changes.name);
  if (!name) {
    throw new Error('주제 이름을 입력해 주세요.');
  }
  const normalizedName = normalizeTopicName(name);
  const duplicate = getDatabase().prepare(`
    SELECT id FROM topics WHERE normalized_name = ? AND id <> ?
  `).get(normalizedName, topicId);
  if (duplicate) {
    throw new Error('같은 이름의 주제가 있습니다. 두 주제를 병합해 주세요.');
  }
  getDatabase().prepare(`
    UPDATE topics
    SET name = ?, normalized_name = ?, pinned = ?, hidden = ?, updated_at = ?
    WHERE id = ?
  `).run(
    name,
    normalizedName,
    changes.pinned === undefined ? current.pinned : Number(changes.pinned),
    changes.hidden === undefined ? current.hidden : Number(changes.hidden),
    new Date().toISOString(),
    topicId,
  );
  return mapTopic(getTopicRow(topicId) as TopicRow);
};

export const mergeTopics = (sourceId: string, targetId: string) => {
  if (sourceId === targetId) {
    throw new Error('서로 다른 두 주제를 선택해 주세요.');
  }
  const source = getTopicRow(sourceId);
  const target = getTopicRow(targetId);
  if (!source || !target) {
    throw new Error('병합할 주제를 찾지 못했습니다.');
  }
  const recordIds = [...new Set([
    ...getTopicRecordIds(sourceId),
    ...getTopicRecordIds(targetId),
  ])];
  const db = getDatabase();
  db.exec('BEGIN IMMEDIATE;');
  try {
    db.prepare(`
      INSERT OR IGNORE INTO record_topics (topic_id, record_id, created_at)
      SELECT ?, record_id, ? FROM record_topics WHERE topic_id = ?
    `).run(targetId, new Date().toISOString(), sourceId);
    db.prepare('DELETE FROM topics WHERE id = ?').run(sourceId);
    db.prepare('UPDATE topics SET updated_at = ? WHERE id = ?')
      .run(new Date().toISOString(), targetId);
    db.exec('COMMIT;');
  } catch (error) {
    db.exec('ROLLBACK;');
    throw error;
  }
  return { topic: mapTopic(getTopicRow(targetId) as TopicRow), recordIds };
};

export const deleteTopic = (topicId: string) => {
  const topic = getTopicRow(topicId);
  if (!topic) {
    throw new Error('삭제할 주제를 찾지 못했습니다.');
  }
  const recordIds = getTopicRecordIds(topicId);
  getDatabase().prepare('DELETE FROM topics WHERE id = ?').run(topicId);
  return { recordIds };
};

const localDateKey = (date: Date) => [
  date.getFullYear(),
  String(date.getMonth() + 1).padStart(2, '0'),
  String(date.getDate()).padStart(2, '0'),
].join('-');

const getWeekRange = (referenceDate: Date) => {
  const start = new Date(
    referenceDate.getFullYear(),
    referenceDate.getMonth(),
    referenceDate.getDate(),
    12,
  );
  const daysFromMonday = (start.getDay() + 6) % 7;
  start.setDate(start.getDate() - daysFromMonday);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  return { start: localDateKey(start), end: localDateKey(end) };
};

const dashboardPreferences = () => {
  const rows = getDatabase().prepare(`
    SELECT card_key, pinned, status FROM dashboard_card_preferences
  `).all() as unknown as DashboardPreferenceRow[];
  return new Map(rows.map((row) => [row.card_key, row]));
};

export const getDashboardState = (referenceDate = new Date()): DashboardState => {
  const records = listRecords({ limit: 500 });
  const recordsById = new Map(records.map((record) => [record.id, record]));
  const topicState = listTopicState();
  const preferences = dashboardPreferences();
  const candidates: DashboardCard[] = [];

  const evidenceRecords = (recordIds: string[]) => recordIds
    .map((recordId) => recordsById.get(recordId))
    .filter((record): record is TeacherRecord => Boolean(record))
    .slice(0, DASHBOARD_RULES.maximumEvidenceRecords);

  for (const suggestion of topicState.suggestions.filter(
    (item) => item.recordCount >= DASHBOARD_RULES.newTopicMinimumRecords,
  )) {
    candidates.push({
      key: `suggestion:${suggestion.normalizedName}`,
      kind: 'new-topic',
      title: `‘${suggestion.name}’가 새 주제로 보입니다`,
      description: `${suggestion.recordCount}개의 기록에서 같은 흐름이 발견됐습니다. 이름과 근거를 확인한 뒤 주제로 채택할 수 있습니다.`,
      reason: `AI 정리를 채택한 서로 다른 기록 ${suggestion.recordCount}개에서 같은 주제 후보가 반복되었습니다.`,
      priority: 100 + Math.min(suggestion.recordCount, 20),
      pinned: false,
      status: 'active',
      action: 'topics',
      actionLabel: '주제 후보 검토',
      actionQuery: null,
      evidenceRecords: evidenceRecords(suggestion.recordIds),
    });
  }

  for (const topic of topicState.topics.filter(
    (item) => !item.hidden && item.recordCount >= DASHBOARD_RULES.connectedTopicMinimumRecords,
  )) {
    const recordIds = getTopicRecordIds(topic.id);
    candidates.push({
      key: `topic:${topic.id}`,
      kind: 'connected-records',
      title: `‘${topic.name}’ 기록이 계속 이어지고 있어요`,
      description: `${topic.recordCount}개의 기록을 한 흐름으로 살펴보며 수업이나 생활지도의 변화를 확인해 보세요.`,
      reason: `교사가 확정한 ‘${topic.name}’ 주제에 활성 기록 ${topic.recordCount}개가 연결되어 있습니다.`,
      priority: 85 + Math.min(topic.recordCount, 20),
      pinned: false,
      status: 'active',
      action: 'topics',
      actionLabel: '연결된 기록 보기',
      actionQuery: null,
      evidenceRecords: evidenceRecords(recordIds),
    });
  }

  const confirmedTopicNames = new Set(
    topicState.topics.map((topic) => normalizeTopicName(topic.name)),
  );
  const categoryRecords = new Map<string, { name: string; recordIds: string[] }>();
  for (const record of records) {
    for (const category of record.categories) {
      const name = cleanTopicName(category);
      const normalizedName = normalizeTopicName(name);
      if (!name || normalizedName === normalizeTopicName('교실기록')) {
        continue;
      }
      const existing = categoryRecords.get(normalizedName) ?? { name, recordIds: [] };
      if (!existing.recordIds.includes(record.id)) {
        existing.recordIds.push(record.id);
      }
      categoryRecords.set(normalizedName, existing);
    }
  }
  for (const [normalizedName, category] of categoryRecords) {
    if (
      category.recordIds.length < DASHBOARD_RULES.categoryPatternMinimumRecords
      || confirmedTopicNames.has(normalizedName)
    ) {
      continue;
    }
    candidates.push({
      key: `category:${normalizedName}`,
      kind: 'category-pattern',
      title: `‘${category.name}’ 기록이 자주 나타납니다`,
      description: '반복되는 카테고리를 새 주제로 발전시키거나 그동안의 실천을 함께 살펴볼 수 있습니다.',
      reason: `교사가 지정하거나 채택한 ‘${category.name}’ 카테고리가 활성 기록 ${category.recordIds.length}개에 있습니다.`,
      priority: 65 + Math.min(category.recordIds.length, 20),
      pinned: false,
      status: 'active',
      action: 'records',
      actionLabel: '이 기록들 보기',
      actionQuery: category.name,
      evidenceRecords: evidenceRecords(category.recordIds),
    });
  }

  const week = getWeekRange(referenceDate);
  const weeklyRecords = records.filter((record) =>
    record.aiStatus === 'adopted'
      && record.recordDate >= week.start
      && record.recordDate <= week.end,
  );
  if (
    weeklyRecords.length >= DASHBOARD_RULES.weeklySummaryMinimumRecords
    && listWeeklySummaries(week.start, week.end).length === 0
  ) {
    candidates.push({
      key: `weekly:${week.start}`,
      kind: 'weekly-summary',
      title: '이번 주 기록을 교무수첩으로 묶을 때입니다',
      description: `이번 주에 교사가 검토·채택한 기록이 ${weeklyRecords.length}개 쌓였습니다.`,
      reason: `${week.start}부터 ${week.end}까지 AI 정리를 채택한 기록이 3개 이상입니다.`,
      priority: 75 + Math.min(weeklyRecords.length, 20),
      pinned: false,
      status: 'active',
      action: 'weekly',
      actionLabel: '주간 교무수첩 만들기',
      actionQuery: null,
      evidenceRecords: weeklyRecords.slice(0, DASHBOARD_RULES.maximumEvidenceRecords),
    });
  }

  const latestNextActionRecord = records.find((record) =>
    record.aiStatus === 'adopted' && Boolean(record.aiReview?.result.nextActions[0]),
  );
  if (latestNextActionRecord?.aiReview) {
    candidates.push({
      key: `next-action:${latestNextActionRecord.id}`,
      kind: 'next-action',
      title: '최근 기록의 다음 실천을 이어가 볼까요?',
      description: latestNextActionRecord.aiReview.result.nextActions[0] ?? '',
      reason: `${latestNextActionRecord.recordDate} 기록에서 교사가 채택한 ‘다음 실천’이 아직 첫 화면에서 확인되지 않았습니다.`,
      priority: 60,
      pinned: false,
      status: 'active',
      action: 'record',
      actionLabel: '근거 기록 열기',
      actionQuery: null,
      evidenceRecords: [latestNextActionRecord],
    });
  }

  const resolved = candidates.map((card) => {
    const preference = preferences.get(card.key);
    return {
      ...card,
      pinned: preference?.pinned === 1,
      status: preference?.status ?? 'active',
    };
  }).sort((left, right) =>
    Number(right.pinned) - Number(left.pinned)
      || right.priority - left.priority
      || left.key.localeCompare(right.key, 'ko'),
  );

  return {
    cards: resolved
      .filter((card) => card.status === 'active')
      .slice(0, DASHBOARD_RULES.maxVisibleCards),
    suppressedCards: resolved.filter((card) => card.status !== 'active'),
  };
};

export const updateDashboardCardPreference = (
  cardKey: string,
  changes: { pinned?: boolean; status?: DashboardCardStatus },
) => {
  const current = getDatabase().prepare(`
    SELECT card_key, pinned, status
    FROM dashboard_card_preferences
    WHERE card_key = ?
  `).get(cardKey) as DashboardPreferenceRow | undefined;
  const pinned = changes.pinned === undefined ? current?.pinned ?? 0 : Number(changes.pinned);
  const status = changes.status ?? current?.status ?? 'active';
  getDatabase().prepare(`
    INSERT INTO dashboard_card_preferences (card_key, pinned, status, updated_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(card_key) DO UPDATE SET
      pinned = excluded.pinned,
      status = excluded.status,
      updated_at = excluded.updated_at
  `).run(cardKey, pinned, status, new Date().toISOString());
};

const mapWeeklySummary = (row: WeeklySummaryRow): WeeklySummary => ({
  id: row.id,
  weekStart: row.week_start,
  weekEnd: row.week_end,
  recordIds: JSON.parse(row.record_ids_json) as string[],
  provider: row.provider,
  model: row.model,
  result: JSON.parse(row.result_json) as WeeklySummaryResult,
  markdownPath: row.markdown_path,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export const createWeeklySummary = (summary: NewWeeklySummary) => {
  getDatabase().prepare(`
    INSERT INTO weekly_summaries (
      id, week_start, week_end, record_ids_json, provider, model,
      result_json, markdown_path, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    summary.id,
    summary.weekStart,
    summary.weekEnd,
    JSON.stringify(summary.recordIds),
    summary.provider,
    summary.model,
    JSON.stringify(summary.result),
    summary.markdownPath,
    summary.createdAt,
    summary.createdAt,
  );
  return getWeeklySummary(summary.id);
};

export const getWeeklySummary = (summaryId: string) => {
  const row = getDatabase().prepare(`
    SELECT * FROM weekly_summaries WHERE id = ?
  `).get(summaryId) as WeeklySummaryRow | undefined;
  return row ? mapWeeklySummary(row) : null;
};

export const listWeeklySummaries = (weekStart?: string, weekEnd?: string) => {
  const rows = weekStart && weekEnd
    ? getDatabase().prepare(`
      SELECT * FROM weekly_summaries
      WHERE week_start = ? AND week_end = ?
      ORDER BY created_at DESC
    `).all(weekStart, weekEnd)
    : getDatabase().prepare(`
      SELECT * FROM weekly_summaries ORDER BY week_start DESC, created_at DESC LIMIT 100
    `).all();
  return (rows as unknown as WeeklySummaryRow[]).map(mapWeeklySummary);
};

export const listAllWeeklySummariesForBackup = () => {
  const rows = getDatabase().prepare(`
    SELECT * FROM weekly_summaries ORDER BY week_start, created_at
  `).all() as unknown as WeeklySummaryRow[];
  return rows.map(mapWeeklySummary);
};

const mapMonthlySummary = (row: MonthlySummaryRow): MonthlySummary => ({
  id: row.id,
  monthKey: row.month_key,
  monthStart: row.month_start,
  monthEnd: row.month_end,
  recordIds: JSON.parse(row.record_ids_json) as string[],
  provider: row.provider,
  model: row.model,
  result: JSON.parse(row.result_json) as MonthlySummaryResult,
  markdownPath: row.markdown_path,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export const createMonthlySummary = (summary: NewMonthlySummary) => {
  getDatabase().prepare(`
    INSERT INTO monthly_summaries (
      id, month_key, month_start, month_end, record_ids_json, provider, model,
      result_json, markdown_path, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    summary.id,
    summary.monthKey,
    summary.monthStart,
    summary.monthEnd,
    JSON.stringify(summary.recordIds),
    summary.provider,
    summary.model,
    JSON.stringify(summary.result),
    summary.markdownPath,
    summary.createdAt,
    summary.createdAt,
  );
  return getMonthlySummary(summary.id);
};

export const getMonthlySummary = (summaryId: string) => {
  const row = getDatabase().prepare(`
    SELECT * FROM monthly_summaries WHERE id = ?
  `).get(summaryId) as MonthlySummaryRow | undefined;
  return row ? mapMonthlySummary(row) : null;
};

export const listMonthlySummaries = (monthKey?: string) => {
  const rows = monthKey
    ? getDatabase().prepare(`
      SELECT * FROM monthly_summaries
      WHERE month_key = ?
      ORDER BY created_at DESC
    `).all(monthKey)
    : getDatabase().prepare(`
      SELECT * FROM monthly_summaries ORDER BY month_key DESC, created_at DESC LIMIT 100
    `).all();
  return (rows as unknown as MonthlySummaryRow[]).map(mapMonthlySummary);
};

export const listAllMonthlySummariesForBackup = () => {
  const rows = getDatabase().prepare(`
    SELECT * FROM monthly_summaries ORDER BY month_key, created_at
  `).all() as unknown as MonthlySummaryRow[];
  return rows.map(mapMonthlySummary);
};

const mapQuarterlySummary = (row: QuarterlySummaryRow): QuarterlySummary => ({
  id: row.id,
  quarterKey: row.quarter_key,
  quarterStart: row.quarter_start,
  quarterEnd: row.quarter_end,
  recordIds: JSON.parse(row.record_ids_json) as string[],
  provider: row.provider,
  model: row.model,
  result: JSON.parse(row.result_json) as QuarterlySummaryResult,
  markdownPath: row.markdown_path,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export const createQuarterlySummary = (summary: NewQuarterlySummary) => {
  getDatabase().prepare(`
    INSERT INTO quarterly_summaries (
      id, quarter_key, quarter_start, quarter_end, record_ids_json, provider, model,
      result_json, markdown_path, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    summary.id,
    summary.quarterKey,
    summary.quarterStart,
    summary.quarterEnd,
    JSON.stringify(summary.recordIds),
    summary.provider,
    summary.model,
    JSON.stringify(summary.result),
    summary.markdownPath,
    summary.createdAt,
    summary.createdAt,
  );
  return getQuarterlySummary(summary.id);
};

export const getQuarterlySummary = (summaryId: string) => {
  const row = getDatabase().prepare(`
    SELECT * FROM quarterly_summaries WHERE id = ?
  `).get(summaryId) as QuarterlySummaryRow | undefined;
  return row ? mapQuarterlySummary(row) : null;
};

export const listQuarterlySummaries = (quarterKey?: string) => {
  const rows = quarterKey
    ? getDatabase().prepare(`
      SELECT * FROM quarterly_summaries
      WHERE quarter_key = ?
      ORDER BY created_at DESC
    `).all(quarterKey)
    : getDatabase().prepare(`
      SELECT * FROM quarterly_summaries ORDER BY quarter_key DESC, created_at DESC LIMIT 100
    `).all();
  return (rows as unknown as QuarterlySummaryRow[]).map(mapQuarterlySummary);
};

export const listAllQuarterlySummariesForBackup = () => {
  const rows = getDatabase().prepare(`
    SELECT * FROM quarterly_summaries ORDER BY quarter_key, created_at
  `).all() as unknown as QuarterlySummaryRow[];
  return rows.map(mapQuarterlySummary);
};

const mapSemesterSummary = (row: SemesterSummaryRow): SemesterSummary => ({
  id: row.id,
  semesterKey: row.semester_key,
  semesterStart: row.semester_start,
  semesterEnd: row.semester_end,
  recordIds: JSON.parse(row.record_ids_json) as string[],
  provider: row.provider,
  model: row.model,
  result: JSON.parse(row.result_json) as SemesterSummaryResult,
  markdownPath: row.markdown_path,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export const createSemesterSummary = (summary: NewSemesterSummary) => {
  getDatabase().prepare(`
    INSERT INTO semester_summaries (
      id, semester_key, semester_start, semester_end, record_ids_json, provider, model,
      result_json, markdown_path, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    summary.id,
    summary.semesterKey,
    summary.semesterStart,
    summary.semesterEnd,
    JSON.stringify(summary.recordIds),
    summary.provider,
    summary.model,
    JSON.stringify(summary.result),
    summary.markdownPath,
    summary.createdAt,
    summary.createdAt,
  );
  return getSemesterSummary(summary.id);
};

export const getSemesterSummary = (summaryId: string) => {
  const row = getDatabase().prepare(`
    SELECT * FROM semester_summaries WHERE id = ?
  `).get(summaryId) as SemesterSummaryRow | undefined;
  return row ? mapSemesterSummary(row) : null;
};

export const listSemesterSummaries = (semesterKey?: string) => {
  const rows = semesterKey
    ? getDatabase().prepare(`
      SELECT * FROM semester_summaries
      WHERE semester_key = ?
      ORDER BY created_at DESC
    `).all(semesterKey)
    : getDatabase().prepare(`
      SELECT * FROM semester_summaries ORDER BY semester_key DESC, created_at DESC LIMIT 100
    `).all();
  return (rows as unknown as SemesterSummaryRow[]).map(mapSemesterSummary);
};

export const listAllSemesterSummariesForBackup = () => {
  const rows = getDatabase().prepare(`
    SELECT * FROM semester_summaries ORDER BY semester_key, created_at
  `).all() as unknown as SemesterSummaryRow[];
  return rows.map(mapSemesterSummary);
};

const mapAnnualSummary = (row: AnnualSummaryRow): AnnualSummary => ({
  id: row.id,
  academicYear: row.academic_year,
  yearStart: row.year_start,
  yearEnd: row.year_end,
  recordIds: JSON.parse(row.record_ids_json) as string[],
  provider: row.provider,
  model: row.model,
  result: JSON.parse(row.result_json) as AnnualSummaryResult,
  markdownPath: row.markdown_path,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export const createAnnualSummary = (summary: NewAnnualSummary) => {
  getDatabase().prepare(`
    INSERT INTO annual_summaries (
      id, academic_year, year_start, year_end, record_ids_json, provider, model,
      result_json, markdown_path, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    summary.id,
    summary.academicYear,
    summary.yearStart,
    summary.yearEnd,
    JSON.stringify(summary.recordIds),
    summary.provider,
    summary.model,
    JSON.stringify(summary.result),
    summary.markdownPath,
    summary.createdAt,
    summary.createdAt,
  );
  return getAnnualSummary(summary.id);
};

export const getAnnualSummary = (summaryId: string) => {
  const row = getDatabase().prepare(`
    SELECT * FROM annual_summaries WHERE id = ?
  `).get(summaryId) as AnnualSummaryRow | undefined;
  return row ? mapAnnualSummary(row) : null;
};

export const listAnnualSummaries = (academicYear?: string) => {
  const rows = academicYear
    ? getDatabase().prepare(`
      SELECT * FROM annual_summaries
      WHERE academic_year = ?
      ORDER BY created_at DESC
    `).all(academicYear)
    : getDatabase().prepare(`
      SELECT * FROM annual_summaries ORDER BY academic_year DESC, created_at DESC LIMIT 100
    `).all();
  return (rows as unknown as AnnualSummaryRow[]).map(mapAnnualSummary);
};

export const listAllAnnualSummariesForBackup = () => {
  const rows = getDatabase().prepare(`
    SELECT * FROM annual_summaries ORDER BY academic_year, created_at
  `).all() as unknown as AnnualSummaryRow[];
  return rows.map(mapAnnualSummary);
};

const mapProjectSummary = (row: ProjectSummaryRow): ProjectSummary => ({
  id: row.id,
  title: row.title,
  seedQuestion: row.seed_question,
  periodStart: row.period_start,
  periodEnd: row.period_end,
  recordIds: JSON.parse(row.record_ids_json) as string[],
  knowledgeChunkIds: JSON.parse(row.knowledge_chunk_ids_json) as string[],
  provider: row.provider,
  model: row.model,
  result: JSON.parse(row.result_json) as ProjectSummaryResult,
  markdownPath: row.markdown_path,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export const createProjectSummary = (summary: NewProjectSummary) => {
  getDatabase().prepare(`
    INSERT INTO project_summaries (
      id, title, seed_question, period_start, period_end, record_ids_json, knowledge_chunk_ids_json, provider,
      model, result_json, markdown_path, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    summary.id,
    summary.title,
    summary.seedQuestion,
    summary.periodStart,
    summary.periodEnd,
    JSON.stringify(summary.recordIds),
    JSON.stringify(summary.knowledgeChunkIds),
    summary.provider,
    summary.model,
    JSON.stringify(summary.result),
    summary.markdownPath,
    summary.createdAt,
    summary.createdAt,
  );
  return getProjectSummary(summary.id);
};

export const getProjectSummary = (summaryId: string) => {
  const row = getDatabase().prepare(`
    SELECT * FROM project_summaries WHERE id = ?
  `).get(summaryId) as ProjectSummaryRow | undefined;
  return row ? mapProjectSummary(row) : null;
};

export const listProjectSummaries = (periodStart?: string, periodEnd?: string) => {
  const rows = periodStart && periodEnd
    ? getDatabase().prepare(`
      SELECT * FROM project_summaries
      WHERE period_end >= ? AND period_start <= ?
      ORDER BY period_start DESC, created_at DESC
    `).all(periodStart, periodEnd)
    : getDatabase().prepare(`
      SELECT * FROM project_summaries ORDER BY period_start DESC, created_at DESC LIMIT 100
    `).all();
  return (rows as unknown as ProjectSummaryRow[]).map(mapProjectSummary);
};

export const listAllProjectSummariesForBackup = () => {
  const rows = getDatabase().prepare(`
    SELECT * FROM project_summaries ORDER BY period_start, created_at
  `).all() as unknown as ProjectSummaryRow[];
  return rows.map(mapProjectSummary);
};

const mapKnowledgeSource = (row: KnowledgeSourceRow): KnowledgeSource => ({
  id: row.id,
  title: row.title,
  originalName: row.original_name,
  kind: row.kind,
  fileType: row.file_type,
  storedPath: row.stored_path,
  contentHash: row.content_hash,
  characterCount: row.character_count,
  chunkCount: row.chunk_count,
  createdAt: row.created_at,
});

export const getKnowledgeSource = (sourceId: string) => {
  const row = getDatabase().prepare(`
    SELECT * FROM knowledge_sources WHERE id = ? AND deleted_at IS NULL
  `).get(sourceId) as unknown as KnowledgeSourceRow | undefined;
  return row ? mapKnowledgeSource(row) : null;
};

export const getKnowledgeSourceByHash = (contentHash: string) => {
  const row = getDatabase().prepare(`
    SELECT * FROM knowledge_sources WHERE content_hash = ? AND deleted_at IS NULL
    ORDER BY created_at DESC LIMIT 1
  `).get(contentHash) as unknown as KnowledgeSourceRow | undefined;
  return row ? mapKnowledgeSource(row) : null;
};

export const listKnowledgeSources = () => {
  const rows = getDatabase().prepare(`
    SELECT * FROM knowledge_sources
    WHERE deleted_at IS NULL
    ORDER BY created_at DESC
  `).all() as unknown as KnowledgeSourceRow[];
  return rows.map(mapKnowledgeSource);
};

export const createKnowledgeSource = (source: NewKnowledgeSource) => {
  const db = getDatabase();
  db.exec('BEGIN IMMEDIATE');
  try {
    db.prepare(`
      INSERT INTO knowledge_sources (
        id, title, original_name, kind, file_type, stored_path, content_hash,
        character_count, chunk_count, created_at, deleted_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)
    `).run(
      source.id,
      source.title,
      source.originalName,
      source.kind,
      source.fileType,
      source.storedPath,
      source.contentHash,
      source.characterCount,
      source.chunks.length,
      source.createdAt,
    );
    const insertChunk = db.prepare(`
      INSERT INTO knowledge_chunks (id, source_id, chunk_index, content, created_at)
      VALUES (?, ?, ?, ?, ?)
    `);
    source.chunks.forEach((chunk, index) => {
      insertChunk.run(chunk.id, source.id, index, chunk.content, source.createdAt);
    });
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
  return getKnowledgeSource(source.id);
};

export const removeKnowledgeSource = (sourceId: string) => {
  const changed = getDatabase().prepare(`
    UPDATE knowledge_sources SET deleted_at = ?
    WHERE id = ? AND deleted_at IS NULL
  `).run(new Date().toISOString(), sourceId).changes > 0;
  return changed;
};

const mapKnowledgeChunk = (row: KnowledgeChunkRow): KnowledgeChunk => ({
  id: row.id,
  sourceId: row.source_id,
  sourceTitle: row.source_title,
  sourceKind: row.source_kind,
  chunkIndex: row.chunk_index,
  content: row.content,
});

export const listKnowledgeChunksForSearch = () => {
  const rows = getDatabase().prepare(`
    SELECT c.id, c.source_id, s.title AS source_title, s.kind AS source_kind,
      c.chunk_index, c.content
    FROM knowledge_chunks c
    JOIN knowledge_sources s ON s.id = c.source_id
    WHERE s.deleted_at IS NULL
    ORDER BY s.created_at DESC, c.chunk_index
    LIMIT 10000
  `).all() as unknown as KnowledgeChunkRow[];
  return rows.map(mapKnowledgeChunk);
};

export const getKnowledgeChunks = (chunkIds: string[]) => {
  const uniqueIds = [...new Set(chunkIds)].slice(0, 20);
  if (uniqueIds.length === 0) return [];
  const placeholders = uniqueIds.map(() => '?').join(', ');
  const rows = getDatabase().prepare(`
    SELECT c.id, c.source_id, s.title AS source_title, s.kind AS source_kind,
      c.chunk_index, c.content
    FROM knowledge_chunks c
    JOIN knowledge_sources s ON s.id = c.source_id
    WHERE s.deleted_at IS NULL AND c.id IN (${placeholders})
  `).all(...uniqueIds) as unknown as KnowledgeChunkRow[];
  const byId = new Map(rows.map((row) => [row.id, mapKnowledgeChunk(row)]));
  return uniqueIds.flatMap((id) => byId.get(id) ?? []);
};

const mapRagConnection = (row: RagConnectionRow): SavedRagConnection => ({
  id: row.id,
  recordId: row.record_id,
  query: row.query,
  chunkIds: JSON.parse(row.chunk_ids_json) as string[],
  provider: row.provider,
  model: row.model,
  result: JSON.parse(row.result_json) as RagResult,
  markdownPath: row.markdown_path,
  createdAt: row.created_at,
});

export const createRagConnection = (connection: NewRagConnection) => {
  getDatabase().prepare(`
    INSERT INTO rag_connections (
      id, record_id, query, chunk_ids_json, provider, model, result_json, markdown_path, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    connection.id,
    connection.recordId,
    connection.query,
    JSON.stringify(connection.chunkIds),
    connection.provider,
    connection.model,
    JSON.stringify(connection.result),
    connection.markdownPath,
    connection.createdAt,
  );
  return getRagConnection(connection.id);
};

export const getRagConnection = (connectionId: string) => {
  const row = getDatabase().prepare(`
    SELECT * FROM rag_connections WHERE id = ?
  `).get(connectionId) as unknown as RagConnectionRow | undefined;
  return row ? mapRagConnection(row) : null;
};

export const listRagConnections = () => {
  const rows = getDatabase().prepare(`
    SELECT * FROM rag_connections ORDER BY created_at DESC LIMIT 100
  `).all() as unknown as RagConnectionRow[];
  return rows.map(mapRagConnection);
};

export const listAllKnowledgeSourcesForBackup = () => listKnowledgeSources();

export const listAllRagConnectionsForBackup = () => {
  const rows = getDatabase().prepare(`
    SELECT * FROM rag_connections ORDER BY created_at
  `).all() as unknown as RagConnectionRow[];
  return rows.map(mapRagConnection);
};

export const listMarkdownDocumentLinksForRecord = (
  recordId: string,
): LinkedMarkdownDocument[] => {
  const links: LinkedMarkdownDocument[] = [];
  for (const summary of listAllWeeklySummariesForBackup()) {
    if (summary.recordIds.includes(recordId)) links.push({
      kind: 'weekly-summary',
      id: summary.id,
      title: `${summary.weekStart} ~ ${summary.weekEnd} 주간 교무수첩`,
      kindLabel: '주간 정리',
      context: `${summary.recordIds.length}개 기록 연결`,
      createdAt: summary.createdAt,
    });
  }
  for (const summary of listAllMonthlySummariesForBackup()) {
    if (summary.recordIds.includes(recordId)) links.push({
      kind: 'monthly-summary',
      id: summary.id,
      title: `${summary.monthKey} 월간 교무수첩`,
      kindLabel: '월간 정리',
      context: `${summary.recordIds.length}개 기록 연결`,
      createdAt: summary.createdAt,
    });
  }
  for (const summary of listAllQuarterlySummariesForBackup()) {
    if (summary.recordIds.includes(recordId)) links.push({
      kind: 'quarterly-summary',
      id: summary.id,
      title: `${summary.quarterKey} 분기 교무수첩`,
      kindLabel: '분기 정리',
      context: `${summary.recordIds.length}개 기록 연결`,
      createdAt: summary.createdAt,
    });
  }
  for (const summary of listAllSemesterSummariesForBackup()) {
    if (summary.recordIds.includes(recordId)) links.push({
      kind: 'semester-summary',
      id: summary.id,
      title: `${summary.semesterKey} 학기 교무수첩`,
      kindLabel: '학기 정리',
      context: `${summary.recordIds.length}개 기록 연결`,
      createdAt: summary.createdAt,
    });
  }
  for (const summary of listAllAnnualSummariesForBackup()) {
    if (summary.recordIds.includes(recordId)) links.push({
      kind: 'annual-summary',
      id: summary.id,
      title: `${summary.academicYear}학년도 연간 교무수첩`,
      kindLabel: '연간 정리',
      context: `${summary.recordIds.length}개 기록 연결`,
      createdAt: summary.createdAt,
    });
  }
  for (const summary of listAllProjectSummariesForBackup()) {
    if (summary.recordIds.includes(recordId)) links.push({
      kind: 'project-summary',
      id: summary.id,
      title: summary.title,
      kindLabel: '프로젝트 정리',
      context: `${summary.periodStart} ~ ${summary.periodEnd}`,
      createdAt: summary.createdAt,
    });
  }
  for (const connection of listAllRagConnectionsForBackup()) {
    if (connection.recordId === recordId) links.push({
      kind: 'rag-connection',
      id: connection.id,
      title: connection.query || '교육자료 연결',
      kindLabel: '교육자료 연결',
      context: `${connection.chunkIds.length}개 교육자료 근거 연결`,
      createdAt: connection.createdAt,
    });
  }
  return links.sort((left, right) => right.createdAt.localeCompare(left.createdAt));
};

export const listStudentAliasRows = (academicYear: number) =>
  getDatabase()
    .prepare(`
      SELECT id, academic_year, encrypted_name, alias, created_at
      FROM student_aliases
      WHERE academic_year = ?
      ORDER BY created_at, alias
    `)
    .all(academicYear) as unknown as StudentAliasRow[];

export const createStudentAliasRow = (row: StudentAliasRow) => {
  getDatabase()
    .prepare(`
      INSERT INTO student_aliases (id, academic_year, encrypted_name, alias, created_at)
      VALUES (?, ?, ?, ?, ?)
    `)
    .run(row.id, row.academic_year, row.encrypted_name, row.alias, row.created_at);
};
