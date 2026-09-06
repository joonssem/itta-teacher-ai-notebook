import { DatabaseSync } from 'node:sqlite';
import {
  copyFile,
  mkdir,
  readFile,
  readdir,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import path from 'node:path';

import type {
  AnnualSummary,
  BackupCounts,
  BackupFileEntry,
  BackupInspection,
  BackupKind,
  BackupManifest,
  BackupMissingFile,
  BackupSummary,
  KnowledgeSource,
  MonthlySummary,
  ProjectSummary,
  QuarterlySummary,
  SemesterSummary,
  SavedRagConnection,
  TeacherRecord,
  WeeklySummary,
} from '../shared/contracts';

const MANIFEST_FILE = 'manifest.json';
const DATABASE_FILE = 'itta.sqlite3';
const MAX_MANIFEST_BYTES = 2 * 1024 * 1024;
const REQUIRED_TABLES_V1 = ['records', 'weekly_summaries', 'topics', 'student_aliases'] as const;

interface BackupSourceFile {
  entityType: BackupFileEntry['entityType'];
  entityId: string;
  sourcePath: string;
}

interface CreateBackupOptions {
  parentDirectory: string;
  baseName: string;
  kind: BackupKind;
  appVersion: string;
  storageRoot: string;
  counts: BackupCounts;
  records: TeacherRecord[];
  weeklySummaries: WeeklySummary[];
  monthlySummaries: MonthlySummary[];
  quarterlySummaries: QuarterlySummary[];
  semesterSummaries: SemesterSummary[];
  annualSummaries: AnnualSummary[];
  projectSummaries: ProjectSummary[];
  knowledgeSources: KnowledgeSource[];
  knowledgeConnections: SavedRagConnection[];
  createDatabaseSnapshot: (destinationPath: string) => Promise<unknown>;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isBackupKind = (value: unknown): value is BackupKind =>
  value === 'automatic' || value === 'manual' || value === 'pre-restore';

export const isSafeRelativePath = (value: string) => {
  if (!value || path.isAbsolute(value)) {
    return false;
  }
  const normalized = path.normalize(value);
  return normalized !== '..'
    && !normalized.startsWith(`..${path.sep}`)
    && !normalized.includes(`\0`);
};

const portablePath = (value: string) => value.split(path.sep).join('/');

const localPath = (value: string) => value.split('/').join(path.sep);

const countIsValid = (value: unknown) =>
  Number.isInteger(value) && Number(value) >= 0;

const parseManifest = (value: unknown): BackupManifest | null => {
  const formatVersion = isRecord(value)
    && (value.formatVersion === 1 || value.formatVersion === 2 || value.formatVersion === 3 || value.formatVersion === 4 || value.formatVersion === 5 || value.formatVersion === 6 || value.formatVersion === 7)
    ? value.formatVersion
    : null;
  if (!isRecord(value)
    || formatVersion === null
    || typeof value.appVersion !== 'string'
    || typeof value.createdAt !== 'string'
    || Number.isNaN(Date.parse(value.createdAt))
    || !isBackupKind(value.kind)
    || typeof value.originalStorageFolderName !== 'string'
    || typeof value.deviceBoundStudentAliases !== 'boolean'
    || !isRecord(value.counts)
    || !countIsValid(value.counts.records)
    || !countIsValid(value.counts.weeklySummaries)
    || (formatVersion >= 2 && !countIsValid(value.counts.monthlySummaries))
    || (formatVersion >= 3 && !countIsValid(value.counts.quarterlySummaries))
    || (formatVersion >= 4 && !countIsValid(value.counts.semesterSummaries))
    || (formatVersion >= 5 && !countIsValid(value.counts.annualSummaries))
    || (formatVersion >= 6 && !countIsValid(value.counts.knowledgeSources))
    || (formatVersion >= 6 && !countIsValid(value.counts.knowledgeConnections))
    || (formatVersion >= 7 && !countIsValid(value.counts.projectSummaries))
    || !countIsValid(value.counts.topics)
    || !countIsValid(value.counts.studentAliases)
    || !Array.isArray(value.files)
    || !Array.isArray(value.missingFiles)) {
    return null;
  }

  const files: BackupFileEntry[] = [];
  for (const item of value.files) {
    const validEntityType = isRecord(item)
      && (item.entityType === 'record'
        || item.entityType === 'weekly-summary'
        || (formatVersion >= 2 && item.entityType === 'monthly-summary')
        || (formatVersion >= 3 && item.entityType === 'quarterly-summary')
        || (formatVersion >= 4 && item.entityType === 'semester-summary')
        || (formatVersion >= 5 && item.entityType === 'annual-summary')
        || (formatVersion >= 6 && item.entityType === 'knowledge-source')
        || (formatVersion >= 6 && item.entityType === 'knowledge-connection')
        || (formatVersion >= 7 && item.entityType === 'project-summary'));
    if (!isRecord(item)
      || !validEntityType
      || typeof item.entityId !== 'string'
      || typeof item.relativePath !== 'string'
      || typeof item.backupPath !== 'string'
      || !countIsValid(item.size)
      || !isSafeRelativePath(localPath(item.relativePath))
      || !isSafeRelativePath(localPath(item.backupPath))) {
      return null;
    }
    const entityType = item.entityType as BackupFileEntry['entityType'];
    files.push({
      entityType,
      entityId: item.entityId,
      relativePath: portablePath(localPath(item.relativePath)),
      backupPath: portablePath(localPath(item.backupPath)),
      size: Number(item.size),
    });
  }

  const missingFiles: BackupMissingFile[] = [];
  for (const item of value.missingFiles) {
    const validEntityType = isRecord(item)
      && (item.entityType === 'record'
        || item.entityType === 'weekly-summary'
        || (formatVersion >= 2 && item.entityType === 'monthly-summary')
        || (formatVersion >= 3 && item.entityType === 'quarterly-summary')
        || (formatVersion >= 4 && item.entityType === 'semester-summary')
        || (formatVersion >= 5 && item.entityType === 'annual-summary')
        || (formatVersion >= 6 && item.entityType === 'knowledge-source')
        || (formatVersion >= 6 && item.entityType === 'knowledge-connection')
        || (formatVersion >= 7 && item.entityType === 'project-summary'));
    if (!isRecord(item)
      || !validEntityType
      || typeof item.entityId !== 'string') {
      return null;
    }
    const entityType = item.entityType as BackupFileEntry['entityType'];
    missingFiles.push({ entityType, entityId: item.entityId });
  }

  const entityKeys = [
    ...files.map((item) => `${item.entityType}:${item.entityId}`),
    ...missingFiles.map((item) => `${item.entityType}:${item.entityId}`),
  ];
  const referencedRecordCount = entityKeys.filter((key) => key.startsWith('record:')).length;
  const referencedWeeklyCount = entityKeys
    .filter((key) => key.startsWith('weekly-summary:')).length;
  const referencedMonthlyCount = entityKeys
    .filter((key) => key.startsWith('monthly-summary:')).length;
  const expectedMonthlyCount = formatVersion >= 2
    ? Number(value.counts.monthlySummaries)
    : 0;
  const referencedQuarterlyCount = entityKeys
    .filter((key) => key.startsWith('quarterly-summary:')).length;
  const expectedQuarterlyCount = formatVersion >= 3
    ? Number(value.counts.quarterlySummaries)
    : 0;
  const referencedSemesterCount = entityKeys
    .filter((key) => key.startsWith('semester-summary:')).length;
  const expectedSemesterCount = formatVersion >= 4
    ? Number(value.counts.semesterSummaries)
    : 0;
  const referencedAnnualCount = entityKeys
    .filter((key) => key.startsWith('annual-summary:')).length;
  const expectedAnnualCount = formatVersion >= 5
    ? Number(value.counts.annualSummaries)
    : 0;
  const referencedProjectCount = entityKeys
    .filter((key) => key.startsWith('project-summary:')).length;
  const expectedProjectCount = formatVersion >= 7
    ? Number(value.counts.projectSummaries)
    : 0;
  const referencedKnowledgeSourceCount = entityKeys
    .filter((key) => key.startsWith('knowledge-source:')).length;
  const expectedKnowledgeSourceCount = formatVersion >= 6
    ? Number(value.counts.knowledgeSources)
    : 0;
  const referencedKnowledgeConnectionCount = entityKeys
    .filter((key) => key.startsWith('knowledge-connection:')).length;
  const expectedKnowledgeConnectionCount = formatVersion >= 6
    ? Number(value.counts.knowledgeConnections)
    : 0;
  if (new Set(entityKeys).size !== entityKeys.length
    || referencedRecordCount !== Number(value.counts.records)
    || referencedWeeklyCount !== Number(value.counts.weeklySummaries)
    || referencedMonthlyCount !== expectedMonthlyCount
    || referencedQuarterlyCount !== expectedQuarterlyCount
    || referencedSemesterCount !== expectedSemesterCount
    || referencedAnnualCount !== expectedAnnualCount
    || referencedProjectCount !== expectedProjectCount
    || referencedKnowledgeSourceCount !== expectedKnowledgeSourceCount
    || referencedKnowledgeConnectionCount !== expectedKnowledgeConnectionCount) {
    return null;
  }

  return {
    formatVersion,
    appVersion: value.appVersion,
    createdAt: value.createdAt,
    kind: value.kind,
    originalStorageFolderName: value.originalStorageFolderName,
    deviceBoundStudentAliases: value.deviceBoundStudentAliases,
    counts: {
      records: Number(value.counts.records),
      weeklySummaries: Number(value.counts.weeklySummaries),
      monthlySummaries: expectedMonthlyCount,
      quarterlySummaries: expectedQuarterlyCount,
      semesterSummaries: expectedSemesterCount,
      annualSummaries: expectedAnnualCount,
      projectSummaries: expectedProjectCount,
      knowledgeSources: expectedKnowledgeSourceCount,
      knowledgeConnections: expectedKnowledgeConnectionCount,
      topics: Number(value.counts.topics),
      studentAliases: Number(value.counts.studentAliases),
    },
    files,
    missingFiles,
  };
};

const uniqueDirectory = async (parentDirectory: string, baseName: string) => {
  await mkdir(parentDirectory, { recursive: true });
  for (let suffix = 0; suffix < 1_000; suffix += 1) {
    const name = suffix === 0 ? baseName : `${baseName}_${suffix + 1}`;
    const candidate = path.resolve(parentDirectory, name);
    try {
      await mkdir(candidate);
      return candidate;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== 'EEXIST') {
        throw error;
      }
    }
  }
  throw new Error('새 백업 폴더 이름을 만들지 못했습니다.');
};

const resolveManagedRelativePath = (
  storageRoot: string,
  item: BackupSourceFile,
) => {
  const relative = path.relative(path.resolve(storageRoot), path.resolve(item.sourcePath));
  if (isSafeRelativePath(relative)) {
    return portablePath(relative);
  }
  return portablePath(path.join('복원파일', item.entityType, `${item.entityId}.md`));
};

export const createBackupBundle = async (options: CreateBackupOptions) => {
  const bundlePath = await uniqueDirectory(options.parentDirectory, options.baseName);
  const files: BackupFileEntry[] = [];
  const missingFiles: BackupMissingFile[] = [];
  const sources: BackupSourceFile[] = [
    ...options.records.map((record) => ({
      entityType: 'record' as const,
      entityId: record.id,
      sourcePath: record.markdownPath,
    })),
    ...options.weeklySummaries.map((summary) => ({
      entityType: 'weekly-summary' as const,
      entityId: summary.id,
      sourcePath: summary.markdownPath,
    })),
    ...options.monthlySummaries.map((summary) => ({
      entityType: 'monthly-summary' as const,
      entityId: summary.id,
      sourcePath: summary.markdownPath,
    })),
    ...options.quarterlySummaries.map((summary) => ({
      entityType: 'quarterly-summary' as const,
      entityId: summary.id,
      sourcePath: summary.markdownPath,
    })),
    ...options.semesterSummaries.map((summary) => ({
      entityType: 'semester-summary' as const,
      entityId: summary.id,
      sourcePath: summary.markdownPath,
    })),
    ...options.annualSummaries.map((summary) => ({
      entityType: 'annual-summary' as const,
      entityId: summary.id,
      sourcePath: summary.markdownPath,
    })),
    ...options.projectSummaries.map((summary) => ({
      entityType: 'project-summary' as const,
      entityId: summary.id,
      sourcePath: summary.markdownPath,
    })),
    ...options.knowledgeSources.map((source) => ({
      entityType: 'knowledge-source' as const,
      entityId: source.id,
      sourcePath: source.storedPath,
    })),
    ...options.knowledgeConnections.map((connection) => ({
      entityType: 'knowledge-connection' as const,
      entityId: connection.id,
      sourcePath: connection.markdownPath,
    })),
  ];

  try {
    await options.createDatabaseSnapshot(path.join(bundlePath, DATABASE_FILE));
    for (const item of sources) {
      try {
        const sourceInfo = await stat(item.sourcePath);
        if (!sourceInfo.isFile()) {
          throw new Error('not a file');
        }
        const relativePath = resolveManagedRelativePath(options.storageRoot, item);
        const backupPath = portablePath(path.join('files', item.entityType, localPath(relativePath)));
        const destinationPath = path.join(bundlePath, localPath(backupPath));
        await mkdir(path.dirname(destinationPath), { recursive: true });
        await copyFile(item.sourcePath, destinationPath);
        files.push({
          entityType: item.entityType,
          entityId: item.entityId,
          relativePath,
          backupPath,
          size: sourceInfo.size,
        });
      } catch {
        missingFiles.push({ entityType: item.entityType, entityId: item.entityId });
      }
    }

    const manifest: BackupManifest = {
      formatVersion: 7,
      appVersion: options.appVersion,
      createdAt: new Date().toISOString(),
      kind: options.kind,
      originalStorageFolderName: path.basename(path.resolve(options.storageRoot)),
      deviceBoundStudentAliases: options.counts.studentAliases > 0,
      counts: options.counts,
      files,
      missingFiles,
    };
    await writeFile(
      path.join(bundlePath, MANIFEST_FILE),
      `${JSON.stringify(manifest, null, 2)}\n`,
      'utf8',
    );
    return { bundlePath, manifest };
  } catch (error) {
    const parent = path.resolve(options.parentDirectory);
    const target = path.resolve(bundlePath);
    if (target.startsWith(`${parent}${path.sep}`)) {
      await rm(target, { recursive: true, force: true });
    }
    throw error;
  }
};

const readManifest = async (bundlePath: string) => {
  const manifestPath = path.join(bundlePath, MANIFEST_FILE);
  const info = await stat(manifestPath);
  if (!info.isFile() || info.size > MAX_MANIFEST_BYTES) {
    throw new Error('백업 설명 파일의 크기나 형식이 올바르지 않습니다.');
  }
  const parsed = JSON.parse(await readFile(manifestPath, 'utf8')) as unknown;
  const manifest = parseManifest(parsed);
  if (!manifest) {
    throw new Error('잇다 백업 설명 파일의 형식이 올바르지 않습니다.');
  }
  return manifest;
};

export const inspectBackupBundle = async (bundlePath: string): Promise<BackupInspection> => {
  const resolvedBundlePath = path.resolve(bundlePath);
  const warnings: string[] = [];
  let manifest: BackupManifest | null = null;
  try {
    manifest = await readManifest(resolvedBundlePath);
    const databasePath = path.join(resolvedBundlePath, DATABASE_FILE);
    const databaseInfo = await stat(databasePath);
    if (!databaseInfo.isFile()) {
      throw new Error('백업 데이터베이스 파일이 없습니다.');
    }

    const database = new DatabaseSync(databasePath, { readOnly: true });
    try {
      const quickCheck = database.prepare('PRAGMA quick_check').get() as Record<string, unknown>;
      if (!Object.values(quickCheck).includes('ok')) {
        throw new Error('백업 데이터베이스 무결성 검사에 실패했습니다.');
      }
      const tableRows = database.prepare(`
        SELECT name FROM sqlite_master WHERE type = 'table'
      `).all() as Array<{ name: string }>;
      const tables = new Set(tableRows.map((row) => row.name));
      if (REQUIRED_TABLES_V1.some((table) => !tables.has(table))
        || (manifest.formatVersion >= 2 && !tables.has('monthly_summaries'))
        || (manifest.formatVersion >= 3 && !tables.has('quarterly_summaries'))
        || (manifest.formatVersion >= 4 && !tables.has('semester_summaries'))
        || (manifest.formatVersion >= 5 && !tables.has('annual_summaries'))
        || (manifest.formatVersion >= 6 && !tables.has('knowledge_sources'))
        || (manifest.formatVersion >= 6 && !tables.has('knowledge_chunks'))
        || (manifest.formatVersion >= 6 && !tables.has('rag_connections'))
        || (manifest.formatVersion >= 7 && !tables.has('project_summaries'))) {
        throw new Error('필수 데이터 표가 없는 백업입니다.');
      }
      const actualCounts: BackupCounts = {
        records: Number((database.prepare('SELECT COUNT(*) AS count FROM records').get() as { count: number }).count),
        weeklySummaries: Number((database.prepare('SELECT COUNT(*) AS count FROM weekly_summaries').get() as { count: number }).count),
        monthlySummaries: tables.has('monthly_summaries')
          ? Number((database.prepare('SELECT COUNT(*) AS count FROM monthly_summaries').get() as { count: number }).count)
          : 0,
        quarterlySummaries: tables.has('quarterly_summaries')
          ? Number((database.prepare('SELECT COUNT(*) AS count FROM quarterly_summaries').get() as { count: number }).count)
          : 0,
        semesterSummaries: tables.has('semester_summaries')
          ? Number((database.prepare('SELECT COUNT(*) AS count FROM semester_summaries').get() as { count: number }).count)
          : 0,
        annualSummaries: tables.has('annual_summaries')
          ? Number((database.prepare('SELECT COUNT(*) AS count FROM annual_summaries').get() as { count: number }).count)
          : 0,
        projectSummaries: tables.has('project_summaries')
          ? Number((database.prepare('SELECT COUNT(*) AS count FROM project_summaries').get() as { count: number }).count)
          : 0,
        knowledgeSources: tables.has('knowledge_sources')
          ? Number((database.prepare('SELECT COUNT(*) AS count FROM knowledge_sources WHERE deleted_at IS NULL').get() as { count: number }).count)
          : 0,
        knowledgeConnections: tables.has('rag_connections')
          ? Number((database.prepare('SELECT COUNT(*) AS count FROM rag_connections').get() as { count: number }).count)
          : 0,
        topics: Number((database.prepare('SELECT COUNT(*) AS count FROM topics').get() as { count: number }).count),
        studentAliases: Number((database.prepare('SELECT COUNT(*) AS count FROM student_aliases').get() as { count: number }).count),
      };
      for (const key of Object.keys(actualCounts) as Array<keyof BackupCounts>) {
        if (actualCounts[key] !== manifest.counts[key]) {
          warnings.push(`설명 파일과 데이터베이스의 ${key} 개수가 다릅니다.`);
        }
      }
    } finally {
      database.close();
    }

    for (const file of manifest.files) {
      try {
        const sourcePath = path.resolve(resolvedBundlePath, localPath(file.backupPath));
        if (!sourcePath.startsWith(`${resolvedBundlePath}${path.sep}`)) {
          throw new Error('unsafe path');
        }
        const info = await stat(sourcePath);
        if (!info.isFile()) {
          throw new Error('not a file');
        }
        if (info.size !== file.size) {
          warnings.push(`${file.relativePath} 파일 크기가 백업 설명과 다릅니다.`);
        }
      } catch {
        warnings.push(`${file.relativePath} Markdown 파일을 찾지 못했습니다.`);
      }
    }
    if (manifest.missingFiles.length > 0) {
      warnings.push(`백업 당시 원본 Markdown ${manifest.missingFiles.length}개를 찾지 못했습니다.`);
    }
    if (manifest.deviceBoundStudentAliases) {
      warnings.push('학생 실명 대응표는 백업을 만든 Windows 계정과 기기에서만 해독될 수 있습니다.');
    }
    return { path: resolvedBundlePath, valid: true, manifest, warnings };
  } catch (error) {
    return {
      path: resolvedBundlePath,
      valid: false,
      manifest,
      warnings: [error instanceof Error ? error.message : '백업을 검사하지 못했습니다.'],
    };
  }
};

export const listBackupSummaries = async (backupDirectory: string) => {
  try {
    const entries = await readdir(backupDirectory, { withFileTypes: true });
    const inspections = await Promise.all(entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => inspectBackupBundle(path.join(backupDirectory, entry.name))));
    return inspections
      .filter((inspection): inspection is BackupInspection & { manifest: BackupManifest } =>
        inspection.valid && inspection.manifest !== null)
      .map((inspection): BackupSummary => ({
        path: inspection.path,
        createdAt: inspection.manifest.createdAt,
        kind: inspection.manifest.kind,
        counts: inspection.manifest.counts,
      }))
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return [];
    }
    throw error;
  }
};

export const pruneBackupBundles = async (backupDirectory: string, keep: number) => {
  const root = path.resolve(backupDirectory);
  const summaries = await listBackupSummaries(root);
  for (const summary of summaries.slice(Math.max(0, keep))) {
    const target = path.resolve(summary.path);
    if (target.startsWith(`${root}${path.sep}`)) {
      await rm(target, { recursive: true, force: true });
    }
  }
};

export const copyBackupMarkdownFiles = async (
  inspection: BackupInspection,
  targetRoot: string,
) => {
  if (!inspection.valid || !inspection.manifest) {
    throw new Error('검사를 통과한 잇다 백업만 복원할 수 있습니다.');
  }
  const resolvedTargetRoot = path.resolve(targetRoot);
  await mkdir(resolvedTargetRoot, { recursive: true });
  const restored: Array<BackupFileEntry & { destinationPath: string }> = [];
  for (const file of inspection.manifest.files) {
    const sourcePath = path.resolve(inspection.path, localPath(file.backupPath));
    const destinationPath = path.resolve(resolvedTargetRoot, localPath(file.relativePath));
    if (!sourcePath.startsWith(`${path.resolve(inspection.path)}${path.sep}`)
      || !destinationPath.startsWith(`${resolvedTargetRoot}${path.sep}`)) {
      throw new Error('백업 안에 안전하지 않은 파일 경로가 있습니다.');
    }
    try {
      const info = await stat(sourcePath);
      if (!info.isFile()) {
        continue;
      }
      await mkdir(path.dirname(destinationPath), { recursive: true });
      await copyFile(sourcePath, destinationPath);
      restored.push({ ...file, destinationPath });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }
  }
  return restored;
};

export const createRestoreStorageRoot = async (currentStorageRoot: string) => {
  const current = path.resolve(currentStorageRoot);
  const parent = path.dirname(current);
  const timestamp = new Date().toISOString().replace(/[-:]/g, '').replace('T', '_').slice(0, 15);
  return uniqueDirectory(parent, `${path.basename(current)}_복원_${timestamp}`);
};

export const getBackupDatabasePath = (bundlePath: string) =>
  path.join(path.resolve(bundlePath), DATABASE_FILE);
