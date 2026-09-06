import { app, BrowserWindow, dialog, ipcMain, safeStorage, session, shell } from 'electron';
import started from 'electron-squirrel-startup';
import { randomUUID } from 'node:crypto';
import { copyFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import {
  adoptTopicSuggestion,
  backupDatabase,
  closeDatabase,
  createAnnualSummary,
  createProjectSummary,
  createKnowledgeSource,
  createRagConnection,
  createRecord,
  createStudentAliasRow,
  createTopic,
  createMonthlySummary,
  createQuarterlySummary,
  createSemesterSummary,
  createWeeklySummary,
  deleteTopic,
  dismissTopicSuggestion,
  getRecord,
  getRecordByDateAndContent,
  getAnnualSummary,
  getProjectSummary,
  getKnowledgeChunks,
  getKnowledgeSource,
  getKnowledgeSourceByHash,
  getRagConnection,
  getMonthlySummary,
  getQuarterlySummary,
  getSemesterSummary,
  getBackupCounts,
  getSetting,
  getDashboardState,
  getWeeklySummary,
  getTopicRecordIds,
  initializeDatabase,
  linkRecordToTopic,
  listAllRecordsForBackup,
  listAllAnnualSummariesForBackup,
  listAllProjectSummariesForBackup,
  listAllKnowledgeSourcesForBackup,
  listAllRagConnectionsForBackup,
  listAllMonthlySummariesForBackup,
  listAllQuarterlySummariesForBackup,
  listAllSemesterSummariesForBackup,
  listAllWeeklySummariesForBackup,
  listRecordTopicNames,
  listRecords,
  listAnnualSummaries,
  listProjectSummaries,
  listKnowledgeChunksForSearch,
  listKnowledgeSources,
  listMarkdownDocumentLinksForRecord,
  listRagConnections,
  listMonthlySummaries,
  listQuarterlySummaries,
  listSemesterSummaries,
  listStudentAliasRows,
  listTopicState,
  listWeeklySummaries,
  mergeTopics,
  restoreRecord,
  removeKnowledgeSource,
  setSetting,
  trashRecord,
  updateRecord,
  updateDashboardCardPreference,
  updateRecordMarkdownPath,
  updateAnnualSummaryMarkdownPath,
  updateProjectSummaryMarkdownPath,
  updateKnowledgeSourceStoredPath,
  updateRagConnectionMarkdownPath,
  updateMonthlySummaryMarkdownPath,
  updateQuarterlySummaryMarkdownPath,
  updateSemesterSummaryMarkdownPath,
  updateTopic,
  updateWeeklySummaryMarkdownPath,
  unlinkRecordFromTopic,
} from './main/database';
import {
  copyBackupMarkdownFiles,
  createBackupBundle,
  createRestoreStorageRoot,
  getBackupDatabasePath,
  inspectBackupBundle,
  listBackupSummaries,
  pruneBackupBundles,
} from './main/backup';
import {
  AI_PROVIDERS,
  connectRecordToKnowledgeWithAi,
  organizeAnnualWithAi,
  organizeProjectWithAi,
  organizeRecordWithAi,
  organizeMonthlyWithAi,
  organizeQuarterlyWithAi,
  organizeSemesterWithAi,
  organizeWeeklyWithAi,
  searchRecordsWithAi,
  testAiProviderConnection,
} from './main/ai-providers';
import { buildMarkdown, findAvailableFilePath, sanitizeFilePart } from './main/markdown';
import { listRecordMarkdownFiles, readRecordMarkdown } from './main/record-import';
import { buildWeeklyMarkdown } from './main/weekly-markdown';
import { buildMonthlyMarkdown } from './main/monthly-markdown';
import { buildQuarterlyMarkdown } from './main/quarterly-markdown';
import { buildSemesterMarkdown } from './main/semester-markdown';
import { buildAnnualMarkdown } from './main/annual-markdown';
import { buildProjectMarkdown } from './main/project-markdown';
import { copyKnowledgeOriginal, extractKnowledgeFile } from './main/knowledge-files';
import { buildRagMarkdown } from './main/rag-markdown';
import {
  readMarkdownDocumentFile,
  saveMarkdownDocumentFile,
} from './main/markdown-document';
import {
  fetchNewsForTopics,
  normalizeNewsTopics,
  sanitizeStoredNewsItems,
} from './main/news';
import {
  createStudentAliasLabel,
  getAcademicYear,
  inspectPrivacyContent,
  normalizeStudentName,
} from './shared/privacy';
import {
  hasSelectedAiContent,
  sanitizeAiOptions,
  sanitizeAiResult,
} from './shared/ai';
import {
  getWeekRangeForAnchor,
  hasWeeklySummaryContent,
  isDateKey,
  sanitizeReflectionLevel,
  sanitizeWeeklySummaryResult,
} from './shared/weekly';
import {
  getMonthRange,
  hasMonthlySummaryContent,
  sanitizeMonthlySummaryResult,
} from './shared/monthly';
import {
  getQuarterRange,
  hasQuarterlySummaryContent,
  sanitizeQuarterlySummaryResult,
} from './shared/quarterly';
import {
  getSemesterRange,
  hasSemesterSummaryContent,
  sanitizeSemesterSummaryResult,
} from './shared/semester';
import {
  getAcademicYearRange,
  hasAnnualSummaryContent,
  sanitizeAnnualSummaryResult,
} from './shared/annual';
import {
  getDefaultProjectRange,
  hasProjectSummaryContent,
  isDateRange,
  sanitizeProjectSummaryResult,
} from './shared/project';
import {
  chunkKnowledgeText,
  hasRagContent,
  isKnowledgeSourceKind,
  rankKnowledgeChunks,
  sanitizeRagResult,
} from './shared/knowledge';
import type {
  AiConnectRequest,
  AnnualSummaryDraft,
  AdoptTopicSuggestionRequest,
  AiProviderId,
  AiOrganizationDraft,
  AiOrganizeRequest,
  AiReviewStatus,
  AiSettingsState,
  BackupKind,
  BackupState,
  CreateTopicRequest,
  GenerateWeeklySummaryRequest,
  GenerateAnnualSummaryRequest,
  GenerateRagRequest,
  GenerateMonthlySummaryRequest,
  GenerateProjectSummaryRequest,
  GenerateQuarterlySummaryRequest,
  GenerateSemesterSummaryRequest,
  GetWeeklyWorkspaceRequest,
  GetAnnualWorkspaceRequest,
  ImportKnowledgeRequest,
  ImportRecordsResult,
  KnowledgeSearchRequest,
  GetMonthlyWorkspaceRequest,
  GetProjectWorkspaceRequest,
  GetQuarterlyWorkspaceRequest,
  GetSemesterWorkspaceRequest,
  ListRecordsRequest,
  MergeTopicsRequest,
  MarkdownDocumentKind,
  MarkdownDocumentTarget,
  MonthlySummaryDraft,
  ProjectSummaryDraft,
  NewsState,
  QuarterlySummaryDraft,
  SemesterSummaryDraft,
  RestoreBackupRequest,
  RestoreBackupResult,
  SaveRecordRequest,
  SaveAnnualSummaryRequest,
  SaveRagRequest,
  SaveRecordResult,
  SaveWeeklySummaryRequest,
  SaveMonthlySummaryRequest,
  SaveProjectSummaryRequest,
  SaveQuarterlySummaryRequest,
  SaveSemesterSummaryRequest,
  SaveMarkdownDocumentRequest,
  SemanticSearchAiResult,
  SemanticSearchRequest,
  SemanticSearchResponse,
  StudentAlias,
  StudentAliasState,
  StorageState,
  TopicRecordRequest,
  UpdateDashboardCardRequest,
  UpdateNewsTopicsRequest,
  UpdateRecordRequest,
  UpdateTopicRequest,
  WeeklySummaryDraft,
} from './shared/contracts';

if (started) {
  app.quit();
}

// 잇다는 텍스트 중심 앱이므로 GPU 가속보다 다양한 학교 PC에서의 안정성을 우선합니다.
// 일부 Windows 그래픽 환경에서 Chromium 하위 프로세스가 시작되지 않는 문제도 피합니다.
app.disableHardwareAcceleration();

let mainWindow: BrowserWindow | null = null;
let storageRoot: string | null = null;
let databasePath: string | null = null;
let backupInProgress = false;
let restoreInProgress = false;
let lastBackupError: string | null = null;
let scheduledBackup: ReturnType<typeof setTimeout> | null = null;
let newsRefreshPromise: Promise<NewsState> | null = null;

interface AiSession {
  provider: AiProviderId;
  model: string;
  apiKey: string;
  keyHint: string;
  connectedAt: string;
  lastUsedAt: number;
}

const AI_SESSION_IDLE_MS = 30 * 60 * 1_000;
const AUTOMATIC_BACKUP_KEEP = 7;
let aiSession: AiSession | null = null;

const getDefaultStorageRoot = () => path.join(app.getPath('documents'), '잇다');

const getAutomaticBackupDirectory = () => path.join(app.getPath('userData'), 'backups');

const backupTimestamp = () => new Date().toISOString()
  .replace(/[-:]/g, '')
  .replace('T', '_')
  .slice(0, 15);

const createApplicationBackup = async (
  kind: BackupKind,
  parentDirectory = getAutomaticBackupDirectory(),
) => {
  if (backupInProgress) {
    throw new Error('다른 백업이 진행 중입니다. 잠시 후 다시 시도해 주세요.');
  }
  if (!storageRoot) {
    throw new Error('기록 저장 위치를 먼저 설정해 주세요.');
  }
  backupInProgress = true;
  lastBackupError = null;
  try {
    const prefix = kind === 'automatic'
      ? '잇다_자동백업'
      : kind === 'pre-restore'
        ? '잇다_복원전백업'
        : '잇다_전체백업';
    const created = await createBackupBundle({
      parentDirectory,
      baseName: `${prefix}_${backupTimestamp()}`,
      kind,
      appVersion: app.getVersion(),
      storageRoot,
      counts: getBackupCounts(),
      records: listAllRecordsForBackup(),
      weeklySummaries: listAllWeeklySummariesForBackup(),
      monthlySummaries: listAllMonthlySummariesForBackup(),
      quarterlySummaries: listAllQuarterlySummariesForBackup(),
      semesterSummaries: listAllSemesterSummariesForBackup(),
      annualSummaries: listAllAnnualSummariesForBackup(),
      projectSummaries: listAllProjectSummariesForBackup(),
      knowledgeSources: listAllKnowledgeSourcesForBackup(),
      knowledgeConnections: listAllRagConnectionsForBackup(),
      createDatabaseSnapshot: backupDatabase,
    });
    if (kind === 'automatic') {
      setSetting('backupLastAutoAt', created.manifest.createdAt);
      await pruneBackupBundles(getAutomaticBackupDirectory(), AUTOMATIC_BACKUP_KEEP);
    }
    return {
      path: created.bundlePath,
      createdAt: created.manifest.createdAt,
      kind: created.manifest.kind,
      counts: created.manifest.counts,
    };
  } catch (error) {
    lastBackupError = error instanceof Error ? error.message : '백업을 만들지 못했습니다.';
    throw error;
  } finally {
    backupInProgress = false;
  }
};

const scheduleAutomaticBackup = () => {
  if (!storageRoot || scheduledBackup || restoreInProgress) {
    return;
  }
  scheduledBackup = setTimeout(() => {
    scheduledBackup = null;
    void createApplicationBackup('automatic').catch(() => {
      // 자동 백업 실패는 기록 작업을 막지 않고 백업 화면에 표시합니다.
    });
  }, 2 * 60 * 1_000);
};

const maybeCreateDailyBackup = async () => {
  if (!storageRoot) {
    return;
  }
  const last = getSetting('backupLastAutoAt');
  if (last && Date.now() - Date.parse(last) < 24 * 60 * 60 * 1_000) {
    return;
  }
  await createApplicationBackup('automatic');
};

const getBackupState = async (): Promise<BackupState> => ({
  backupDirectory: getAutomaticBackupDirectory(),
  lastAutomaticBackupAt: getSetting('backupLastAutoAt'),
  automaticBackups: await listBackupSummaries(getAutomaticBackupDirectory()),
  inProgress: backupInProgress || restoreInProgress,
  lastError: lastBackupError,
});

const getStorageState = (): StorageState => ({
  path: storageRoot ?? getDefaultStorageRoot(),
  isCustom: storageRoot !== null && storageRoot !== getDefaultStorageRoot(),
  isConfigured: storageRoot !== null,
});

const isTrustedSender = (url: string) => {
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    return url.startsWith(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  }
  return url.startsWith('file://');
};

const assertTrustedSender = (url: string) => {
  if (!isTrustedSender(url)) {
    throw new Error('허용되지 않은 화면에서 요청했습니다.');
  }
};

const MARKDOWN_DOCUMENT_LABELS: Record<MarkdownDocumentKind, string> = {
  'weekly-summary': '주간 정리',
  'monthly-summary': '월간 정리',
  'quarterly-summary': '분기 정리',
  'semester-summary': '학기 정리',
  'annual-summary': '연간 정리',
  'project-summary': '프로젝트 정리',
  'rag-connection': '교육자료 연결',
};

const isMarkdownDocumentKind = (value: unknown): value is MarkdownDocumentKind =>
  typeof value === 'string' && Object.hasOwn(MARKDOWN_DOCUMENT_LABELS, value);

const resolveMarkdownDocument = (target: MarkdownDocumentTarget) => {
  if (!isMarkdownDocumentKind(target?.kind) || typeof target?.id !== 'string' || !target.id.trim()) {
    throw new Error('열 문서 정보를 다시 확인해 주세요.');
  }
  const id = target.id.trim();
  let entity: { markdownPath: string } | null = null;
  let recordIds: string[] = [];
  if (target.kind === 'weekly-summary') {
    const summary = getWeeklySummary(id);
    entity = summary;
    recordIds = summary?.recordIds ?? [];
  } else if (target.kind === 'monthly-summary') {
    const summary = getMonthlySummary(id);
    entity = summary;
    recordIds = summary?.recordIds ?? [];
  } else if (target.kind === 'quarterly-summary') {
    const summary = getQuarterlySummary(id);
    entity = summary;
    recordIds = summary?.recordIds ?? [];
  } else if (target.kind === 'semester-summary') {
    const summary = getSemesterSummary(id);
    entity = summary;
    recordIds = summary?.recordIds ?? [];
  } else if (target.kind === 'annual-summary') {
    const summary = getAnnualSummary(id);
    entity = summary;
    recordIds = summary?.recordIds ?? [];
  } else if (target.kind === 'project-summary') {
    const summary = getProjectSummary(id);
    entity = summary;
    recordIds = summary?.recordIds ?? [];
  } else {
    const connection = getRagConnection(id);
    entity = connection;
    recordIds = connection ? [connection.recordId] : [];
  }
  if (!entity) {
    throw new Error('저장된 문서를 찾지 못했습니다.');
  }
  const filePath = path.resolve(entity.markdownPath);
  const root = path.resolve(storageRoot ?? getDefaultStorageRoot());
  const relative = path.relative(root, filePath);
  if (relative.startsWith('..') || path.isAbsolute(relative) || path.extname(filePath).toLowerCase() !== '.md') {
    throw new Error('잇다 저장 폴더 밖의 문서는 편집할 수 없습니다.');
  }
  return {
    kind: target.kind,
    id,
    kindLabel: MARKDOWN_DOCUMENT_LABELS[target.kind],
    filePath,
    recordIds,
  };
};

const getLinkedRecords = (recordIds: string[]) => recordIds
  .map((recordId) => getRecord(recordId))
  .filter((record): record is NonNullable<typeof record> => Boolean(record && !record.deletedAt))
  .sort((left, right) =>
    left.recordDate.localeCompare(right.recordDate) || left.createdAt.localeCompare(right.createdAt));

const validateRecordContent = (content: string, categories: string[]) => {
  if (typeof content !== 'string' || !content.trim()) {
    throw new Error('기록을 먼저 입력해 주세요.');
  }
  if (content.length > 100_000) {
    throw new Error('한 기록은 10만 자 이하로 작성해 주세요.');
  }
  if (!Array.isArray(categories)) {
    throw new Error('카테고리 형식이 올바르지 않습니다.');
  }
};

const validateSaveRequest = (request: SaveRecordRequest) => {
  validateRecordContent(request?.content, request?.categories);
  if (request?.privacyReviewed !== true) {
    throw new Error('개인정보 후보를 먼저 확인해 주세요.');
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(request.recordDate)) {
    throw new Error('기록 날짜 형식이 올바르지 않습니다.');
  }
};

const cleanCategories = (categories: string[]) =>
  categories.map((category) => category.trim()).filter(Boolean).slice(0, 10);

const sanitizeAiReview = (
  status: AiReviewStatus | undefined,
  review: AiOrganizationDraft | null | undefined,
) => {
  const safeStatus: AiReviewStatus = status === 'adopted' || status === 'rejected'
    ? status
    : 'none';
  if (safeStatus !== 'adopted') {
    return { status: safeStatus, review: null };
  }
  if (!review || !isAiProviderId(review.provider) || typeof review.model !== 'string') {
    throw new Error('채택할 AI 정리 결과의 형식이 올바르지 않습니다.');
  }
  const options = sanitizeAiOptions(review.options);
  const result = sanitizeAiResult(review.result);
  if (!hasSelectedAiContent(result, options.sections)) {
    throw new Error('채택할 AI 정리 내용이 비어 있습니다.');
  }
  return {
    status: safeStatus,
    review: {
      provider: review.provider,
      model: review.model.slice(0, 100),
      generatedAt: Number.isNaN(Date.parse(review.generatedAt))
        ? new Date().toISOString()
        : review.generatedAt,
      options,
      result,
    },
  };
};

const readStudentAliases = (academicYear = getAcademicYear()): StudentAlias[] => {
  if (!safeStorage.isEncryptionAvailable()) {
    return [];
  }
  return listStudentAliasRows(academicYear).map((row) => ({
    id: row.id,
    academicYear: row.academic_year,
    realName: safeStorage.decryptString(Buffer.from(row.encrypted_name)),
    alias: row.alias,
    createdAt: row.created_at,
  }));
};

const getStudentAliasState = (): StudentAliasState => ({
  academicYear: getAcademicYear(),
  encryptionAvailable: safeStorage.isEncryptionAvailable(),
  aliases: readStudentAliases(),
});

const isAiProviderId = (value: string | null): value is AiProviderId =>
  value === 'upstage' || value === 'google';

const getDefaultModel = (provider: AiProviderId) =>
  AI_PROVIDERS.find((item) => item.id === provider)?.models[0]?.id ?? '';

const clearExpiredAiSession = () => {
  if (aiSession && Date.now() - aiSession.lastUsedAt >= AI_SESSION_IDLE_MS) {
    aiSession = null;
  }
};

const getAiSettingsState = (): AiSettingsState => {
  clearExpiredAiSession();
  const storedProvider = getSetting('aiPreferredProvider');
  const preferredProvider = isAiProviderId(storedProvider) ? storedProvider : 'upstage';
  const storedModel = getSetting('aiPreferredModel');
  const preferredModel = storedModel || getDefaultModel(preferredProvider);

  return {
    setupCompleted: getSetting('aiSetupCompleted') === 'true',
    preferredProvider,
    preferredModel,
    providers: AI_PROVIDERS,
    session: aiSession
      ? {
        connected: true,
        provider: aiSession.provider,
        model: aiSession.model,
        keyHint: aiSession.keyHint,
        connectedAt: aiSession.connectedAt,
        expiresAt: new Date(aiSession.lastUsedAt + AI_SESSION_IDLE_MS).toISOString(),
      }
      : {
        connected: false,
        provider: null,
        model: null,
        keyHint: null,
        connectedAt: null,
        expiresAt: null,
      },
  };
};

const validateAiSelection = (provider: AiProviderId, model: string) => {
  const option = AI_PROVIDERS.find((item) => item.id === provider);
  if (!option) {
    throw new Error('지원하지 않는 AI 제공자입니다.');
  }
  if (!option.models.some((item) => item.id === model)) {
    throw new Error('지원하지 않는 AI 모델입니다.');
  }
};

const refreshTopicMarkdown = async (recordIds: string[]) => {
  for (const recordId of [...new Set(recordIds)]) {
    const record = getRecord(recordId);
    if (!record) {
      continue;
    }
    await writeFile(
      record.markdownPath,
      buildMarkdown({
        id: record.id,
        content: record.content,
        recordDate: record.recordDate,
        categories: record.categories,
        createdAt: record.createdAt,
        appVersion: app.getVersion(),
        privacyReviewed: true,
        aiReview: record.aiReview,
        topics: listRecordTopicNames(record.id),
      }),
      { encoding: 'utf8' },
    );
  }
};

const validateWeeklyRange = (weekStart: string, weekEnd: string) => {
  if (!isDateKey(weekStart) || !isDateKey(weekEnd)) {
    throw new Error('주간 정리 날짜를 다시 확인해 주세요.');
  }
  const expected = getWeekRangeForAnchor(weekStart);
  if (expected.weekStart !== weekStart || expected.weekEnd !== weekEnd) {
    throw new Error('주간 정리는 월요일부터 일요일까지 선택해 주세요.');
  }
};

const resolveWeeklyRecords = (weekStart: string, weekEnd: string, recordIds: string[]) => {
  validateWeeklyRange(weekStart, weekEnd);
  const uniqueIds = [...new Set(Array.isArray(recordIds) ? recordIds : [])];
  if (uniqueIds.length === 0) {
    throw new Error('주간 정리에 사용할 기록을 한 개 이상 선택해 주세요.');
  }
  if (uniqueIds.length > 31) {
    throw new Error('한 번에 선택할 수 있는 기록은 31개까지입니다.');
  }
  const records = uniqueIds.map((recordId) => getRecord(recordId));
  if (records.some((record) => !record || record.deletedAt)) {
    throw new Error('선택한 기록 중 찾을 수 없거나 휴지통에 있는 기록이 있습니다.');
  }
  const activeRecords = records.filter((record): record is NonNullable<typeof record> => Boolean(record));
  if (activeRecords.some((record) =>
    record.recordDate < weekStart || record.recordDate > weekEnd)) {
    throw new Error('선택한 주간에 포함되지 않는 기록이 있습니다.');
  }
  return activeRecords.sort((left, right) =>
    left.recordDate.localeCompare(right.recordDate) || left.createdAt.localeCompare(right.createdAt));
};

const sanitizeWeeklyDraft = (draft: WeeklySummaryDraft) => {
  if (!draft || !isAiProviderId(draft.provider) || typeof draft.model !== 'string') {
    throw new Error('저장할 주간 정리의 AI 정보를 확인해 주세요.');
  }
  const records = resolveWeeklyRecords(draft.weekStart, draft.weekEnd, draft.recordIds);
  const result = sanitizeWeeklySummaryResult(draft.result);
  if (!hasWeeklySummaryContent(result)) {
    throw new Error('저장할 주간 정리 내용이 비어 있습니다.');
  }
  return {
    draft: {
      weekStart: draft.weekStart,
      weekEnd: draft.weekEnd,
      recordIds: records.map((record) => record.id),
      provider: draft.provider,
      model: draft.model.slice(0, 100),
      generatedAt: Number.isNaN(Date.parse(draft.generatedAt))
        ? new Date().toISOString()
        : draft.generatedAt,
      reflectionLevel: sanitizeReflectionLevel(draft.reflectionLevel),
      result,
    },
    records,
  };
};

const validateMonthlyRange = (monthKey: string, monthStart: string, monthEnd: string) => {
  const expected = getMonthRange(monthKey);
  if (expected.monthKey !== monthKey
    || expected.monthStart !== monthStart
    || expected.monthEnd !== monthEnd) {
    throw new Error('월간 정리 기간을 다시 확인해 주세요.');
  }
};

const resolveMonthlyRecords = (
  monthKey: string,
  monthStart: string,
  monthEnd: string,
  recordIds: string[],
) => {
  validateMonthlyRange(monthKey, monthStart, monthEnd);
  const uniqueIds = [...new Set(Array.isArray(recordIds) ? recordIds : [])];
  if (uniqueIds.length === 0) {
    throw new Error('월간 정리에 사용할 기록을 한 개 이상 선택해 주세요.');
  }
  if (uniqueIds.length > 100) {
    throw new Error('한 번에 선택할 수 있는 기록은 100개까지입니다.');
  }
  const records = uniqueIds.map((recordId) => getRecord(recordId));
  if (records.some((record) => !record || record.deletedAt)) {
    throw new Error('선택한 기록 중 찾을 수 없거나 휴지통에 있는 기록이 있습니다.');
  }
  const activeRecords = records.filter((record): record is NonNullable<typeof record> => Boolean(record));
  if (activeRecords.some((record) =>
    record.recordDate < monthStart || record.recordDate > monthEnd)) {
    throw new Error('선택한 달에 포함되지 않는 기록이 있습니다.');
  }
  return activeRecords.sort((left, right) =>
    left.recordDate.localeCompare(right.recordDate) || left.createdAt.localeCompare(right.createdAt));
};

const sanitizeMonthlyDraft = (draft: MonthlySummaryDraft) => {
  if (!draft || !isAiProviderId(draft.provider) || typeof draft.model !== 'string') {
    throw new Error('저장할 월간 정리의 AI 정보를 확인해 주세요.');
  }
  const records = resolveMonthlyRecords(
    draft.monthKey,
    draft.monthStart,
    draft.monthEnd,
    draft.recordIds,
  );
  const result = sanitizeMonthlySummaryResult(draft.result);
  if (!hasMonthlySummaryContent(result)) {
    throw new Error('저장할 월간 정리 내용이 비어 있습니다.');
  }
  return {
    draft: {
      monthKey: draft.monthKey,
      monthStart: draft.monthStart,
      monthEnd: draft.monthEnd,
      recordIds: records.map((record) => record.id),
      provider: draft.provider,
      model: draft.model.slice(0, 100),
      generatedAt: Number.isNaN(Date.parse(draft.generatedAt))
        ? new Date().toISOString()
        : draft.generatedAt,
      reflectionLevel: sanitizeReflectionLevel(draft.reflectionLevel),
      result,
    },
    records,
  };
};

const validateQuarterlyRange = (
  quarterKey: string,
  quarterStart: string,
  quarterEnd: string,
) => {
  const expected = getQuarterRange(quarterKey);
  if (expected.quarterKey !== quarterKey
    || expected.quarterStart !== quarterStart
    || expected.quarterEnd !== quarterEnd) {
    throw new Error('분기 정리 기간을 다시 확인해 주세요.');
  }
};

const resolveQuarterlyRecords = (
  quarterKey: string,
  quarterStart: string,
  quarterEnd: string,
  recordIds: string[],
) => {
  validateQuarterlyRange(quarterKey, quarterStart, quarterEnd);
  const uniqueIds = [...new Set(Array.isArray(recordIds) ? recordIds : [])];
  if (uniqueIds.length === 0) {
    throw new Error('분기 정리에 사용할 기록을 한 개 이상 선택해 주세요.');
  }
  if (uniqueIds.length > 200) {
    throw new Error('한 번에 선택할 수 있는 기록은 200개까지입니다.');
  }
  const records = uniqueIds.map((recordId) => getRecord(recordId));
  if (records.some((record) => !record || record.deletedAt)) {
    throw new Error('선택한 기록 중 찾을 수 없거나 휴지통에 있는 기록이 있습니다.');
  }
  const activeRecords = records.filter((record): record is NonNullable<typeof record> => Boolean(record));
  if (activeRecords.some((record) =>
    record.recordDate < quarterStart || record.recordDate > quarterEnd)) {
    throw new Error('선택한 분기에 포함되지 않는 기록이 있습니다.');
  }
  return activeRecords.sort((left, right) =>
    left.recordDate.localeCompare(right.recordDate) || left.createdAt.localeCompare(right.createdAt));
};

const sanitizeQuarterlyDraft = (draft: QuarterlySummaryDraft) => {
  if (!draft || !isAiProviderId(draft.provider) || typeof draft.model !== 'string') {
    throw new Error('저장할 분기 정리의 AI 정보를 확인해 주세요.');
  }
  const records = resolveQuarterlyRecords(
    draft.quarterKey,
    draft.quarterStart,
    draft.quarterEnd,
    draft.recordIds,
  );
  const result = sanitizeQuarterlySummaryResult(draft.result);
  if (!hasQuarterlySummaryContent(result)) {
    throw new Error('저장할 분기 정리 내용이 비어 있습니다.');
  }
  return {
    draft: {
      quarterKey: draft.quarterKey,
      quarterStart: draft.quarterStart,
      quarterEnd: draft.quarterEnd,
      recordIds: records.map((record) => record.id),
      provider: draft.provider,
      model: draft.model.slice(0, 100),
      generatedAt: Number.isNaN(Date.parse(draft.generatedAt))
        ? new Date().toISOString()
        : draft.generatedAt,
      reflectionLevel: sanitizeReflectionLevel(draft.reflectionLevel),
      result,
    },
    records,
  };
};

const validateSemesterRange = (
  semesterKey: string,
  semesterStart: string,
  semesterEnd: string,
) => {
  const expected = getSemesterRange(semesterKey);
  if (expected.semesterKey !== semesterKey
    || expected.semesterStart !== semesterStart
    || expected.semesterEnd !== semesterEnd) {
    throw new Error('학기 정리 기간을 다시 확인해 주세요.');
  }
};

const resolveSemesterRecords = (
  semesterKey: string,
  semesterStart: string,
  semesterEnd: string,
  recordIds: string[],
) => {
  validateSemesterRange(semesterKey, semesterStart, semesterEnd);
  const uniqueIds = [...new Set(Array.isArray(recordIds) ? recordIds : [])];
  if (uniqueIds.length === 0) {
    throw new Error('학기 정리에 사용할 기록을 한 개 이상 선택해 주세요.');
  }
  if (uniqueIds.length > 300) {
    throw new Error('한 번에 선택할 수 있는 기록은 300개까지입니다.');
  }
  const records = uniqueIds.map((recordId) => getRecord(recordId));
  if (records.some((record) => !record || record.deletedAt)) {
    throw new Error('선택한 기록 중 찾을 수 없거나 휴지통에 있는 기록이 있습니다.');
  }
  const activeRecords = records.filter((record): record is NonNullable<typeof record> => Boolean(record));
  if (activeRecords.some((record) =>
    record.recordDate < semesterStart || record.recordDate > semesterEnd)) {
    throw new Error('선택한 학기에 포함되지 않는 기록이 있습니다.');
  }
  return activeRecords.sort((left, right) =>
    left.recordDate.localeCompare(right.recordDate) || left.createdAt.localeCompare(right.createdAt));
};

const sanitizeSemesterDraft = (draft: SemesterSummaryDraft) => {
  if (!draft || !isAiProviderId(draft.provider) || typeof draft.model !== 'string') {
    throw new Error('저장할 학기 정리의 AI 정보를 확인해 주세요.');
  }
  const records = resolveSemesterRecords(
    draft.semesterKey,
    draft.semesterStart,
    draft.semesterEnd,
    draft.recordIds,
  );
  const result = sanitizeSemesterSummaryResult(draft.result);
  if (!hasSemesterSummaryContent(result)) {
    throw new Error('저장할 학기 정리 내용이 비어 있습니다.');
  }
  return {
    draft: {
      semesterKey: draft.semesterKey,
      semesterStart: draft.semesterStart,
      semesterEnd: draft.semesterEnd,
      recordIds: records.map((record) => record.id),
      provider: draft.provider,
      model: draft.model.slice(0, 100),
      generatedAt: Number.isNaN(Date.parse(draft.generatedAt))
        ? new Date().toISOString()
        : draft.generatedAt,
      reflectionLevel: sanitizeReflectionLevel(draft.reflectionLevel),
      result,
    },
    records,
  };
};

const validateAnnualRange = (
  academicYear: string,
  yearStart: string,
  yearEnd: string,
) => {
  const expected = getAcademicYearRange(academicYear);
  if (expected.academicYear !== academicYear
    || expected.yearStart !== yearStart
    || expected.yearEnd !== yearEnd) {
    throw new Error('연간 정리 기간을 다시 확인해 주세요.');
  }
};

const resolveAnnualRecords = (
  academicYear: string,
  yearStart: string,
  yearEnd: string,
  recordIds: string[],
) => {
  validateAnnualRange(academicYear, yearStart, yearEnd);
  const uniqueIds = [...new Set(Array.isArray(recordIds) ? recordIds : [])];
  if (uniqueIds.length === 0) {
    throw new Error('연간 정리에 사용할 기록을 한 개 이상 선택해 주세요.');
  }
  if (uniqueIds.length > 500) {
    throw new Error('한 번에 선택할 수 있는 기록은 500개까지입니다.');
  }
  const records = uniqueIds.map((recordId) => getRecord(recordId));
  if (records.some((record) => !record || record.deletedAt)) {
    throw new Error('선택한 기록 중 찾을 수 없거나 휴지통에 있는 기록이 있습니다.');
  }
  const activeRecords = records.filter((record): record is NonNullable<typeof record> => Boolean(record));
  if (activeRecords.some((record) => record.recordDate < yearStart || record.recordDate > yearEnd)) {
    throw new Error('선택한 학년도에 포함되지 않는 기록이 있습니다.');
  }
  return activeRecords.sort((left, right) =>
    left.recordDate.localeCompare(right.recordDate) || left.createdAt.localeCompare(right.createdAt));
};

const sanitizeAnnualDraft = (draft: AnnualSummaryDraft) => {
  if (!draft || !isAiProviderId(draft.provider) || typeof draft.model !== 'string') {
    throw new Error('저장할 연간 정리의 AI 정보를 확인해 주세요.');
  }
  const records = resolveAnnualRecords(
    draft.academicYear,
    draft.yearStart,
    draft.yearEnd,
    draft.recordIds,
  );
  const result = sanitizeAnnualSummaryResult(draft.result);
  if (!hasAnnualSummaryContent(result)) {
    throw new Error('저장할 연간 정리 내용이 비어 있습니다.');
  }
  return {
    draft: {
      academicYear: draft.academicYear,
      yearStart: draft.yearStart,
      yearEnd: draft.yearEnd,
      recordIds: records.map((record) => record.id),
      provider: draft.provider,
      model: draft.model.slice(0, 100),
      generatedAt: Number.isNaN(Date.parse(draft.generatedAt))
        ? new Date().toISOString()
        : draft.generatedAt,
      reflectionLevel: sanitizeReflectionLevel(draft.reflectionLevel),
      result,
    },
    records,
  };
};

const resolveProjectRecords = (
  periodStart: string,
  periodEnd: string,
  recordIds: string[],
) => {
  if (!isDateRange(periodStart, periodEnd)) {
    throw new Error('프로젝트 정리 기간을 다시 확인해 주세요.');
  }
  const uniqueIds = [...new Set(Array.isArray(recordIds) ? recordIds : [])];
  if (uniqueIds.length === 0) {
    throw new Error('프로젝트 정리에 사용할 기록을 한 개 이상 선택해 주세요.');
  }
  if (uniqueIds.length > 200) {
    throw new Error('프로젝트 정리에는 기록을 최대 200개까지 선택할 수 있습니다.');
  }
  const records = uniqueIds.map((recordId) => getRecord(recordId));
  if (records.some((record) => !record || record.deletedAt)) {
    throw new Error('선택한 기록 중 찾을 수 없거나 휴지통에 있는 기록이 있습니다.');
  }
  const activeRecords = records.filter((record): record is NonNullable<typeof record> => Boolean(record));
  if (activeRecords.some((record) =>
    record.recordDate < periodStart || record.recordDate > periodEnd)) {
    throw new Error('선택한 프로젝트 기간에 포함되지 않는 기록이 있습니다.');
  }
  return activeRecords.sort((left, right) =>
    left.recordDate.localeCompare(right.recordDate) || left.createdAt.localeCompare(right.createdAt));
};

const resolveProjectKnowledge = (chunkIds: string[]) => {
  const uniqueIds = [...new Set(Array.isArray(chunkIds) ? chunkIds : [])];
  if (uniqueIds.length > 5) {
    throw new Error('프로젝트 교육자료 근거는 최대 5개까지 선택할 수 있습니다.');
  }
  const chunks = getKnowledgeChunks(uniqueIds);
  if (chunks.length !== uniqueIds.length) {
    throw new Error('선택한 교육자료 근거 중 찾을 수 없는 항목이 있습니다.');
  }
  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.content.length, 0);
  if (totalLength > 20_000) {
    throw new Error('선택한 교육자료 근거가 너무 깁니다. 2만 자 이하로 줄여 주세요.');
  }
  for (const chunk of chunks) {
    if (inspectPrivacyContent(chunk.content, []).length > 0) {
      throw new Error(`‘${chunk.sourceTitle}’ 자료에 개인정보 후보가 있어 AI 전송을 중단했습니다.`);
    }
  }
  return chunks;
};

const sanitizeProjectDraft = (draft: ProjectSummaryDraft) => {
  if (!draft || !isAiProviderId(draft.provider) || typeof draft.model !== 'string') {
    throw new Error('저장할 프로젝트 정리의 AI 정보를 확인해 주세요.');
  }
  const title = typeof draft.title === 'string'
    ? draft.title.trim().normalize('NFC').slice(0, 100)
    : '';
  if (!title) {
    throw new Error('프로젝트 이름을 입력해 주세요.');
  }
  const seedQuestion = typeof draft.seedQuestion === 'string'
    ? draft.seedQuestion.trim().normalize('NFC').slice(0, 500)
    : '';
  const records = resolveProjectRecords(draft.periodStart, draft.periodEnd, draft.recordIds);
  const knowledgeChunks = resolveProjectKnowledge(draft.knowledgeChunkIds);
  const result = sanitizeProjectSummaryResult(
    draft.result,
    knowledgeChunks.map((chunk) => chunk.id),
  );
  if (!hasProjectSummaryContent(result)) {
    throw new Error('저장할 프로젝트 정리 내용이 비어 있습니다.');
  }
  return {
    draft: {
      title,
      seedQuestion,
      periodStart: draft.periodStart,
      periodEnd: draft.periodEnd,
      recordIds: records.map((record) => record.id),
      knowledgeChunkIds: knowledgeChunks.map((chunk) => chunk.id),
      provider: draft.provider,
      model: draft.model.slice(0, 100),
      generatedAt: Number.isNaN(Date.parse(draft.generatedAt))
        ? new Date().toISOString()
        : draft.generatedAt,
      reflectionLevel: sanitizeReflectionLevel(draft.reflectionLevel),
      result,
    },
    records,
    knowledgeChunks,
  };
};

const getKnowledgeState = () => {
  const sources = listKnowledgeSources();
  return {
    sources,
    totalChunks: sources.reduce((sum, source) => sum + source.chunkCount, 0),
  };
};

const resolveRagEvidence = (recordId: string, chunkIds: string[]) => {
  const record = typeof recordId === 'string' ? getRecord(recordId) : null;
  if (!record || record.deletedAt) {
    throw new Error('연결할 교실 기록을 찾지 못했습니다.');
  }
  if (record.content.length > 20_000) {
    throw new Error('교실 기록이 너무 깁니다. 2만 자 이하로 다듬은 뒤 연결해 주세요.');
  }
  const academicYear = getAcademicYear(new Date(`${record.recordDate}T12:00:00`));
  if (inspectPrivacyContent(record.content, readStudentAliases(academicYear)).length > 0) {
    throw new Error('교실 기록에 개인정보 후보가 남아 있어 AI 전송을 중단했습니다.');
  }
  const uniqueIds = [...new Set(Array.isArray(chunkIds) ? chunkIds : [])];
  if (uniqueIds.length === 0 || uniqueIds.length > 5) {
    throw new Error('교육자료 근거는 1개 이상 5개 이하로 선택해 주세요.');
  }
  const chunks = getKnowledgeChunks(uniqueIds);
  if (chunks.length !== uniqueIds.length) {
    throw new Error('선택한 교육자료 근거 중 찾을 수 없는 항목이 있습니다.');
  }
  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.content.length, 0);
  if (totalLength > 20_000) {
    throw new Error('선택한 교육자료 근거가 너무 깁니다. 2만 자 이하로 줄여 주세요.');
  }
  for (const chunk of chunks) {
    if (inspectPrivacyContent(chunk.content, []).length > 0) {
      throw new Error(`‘${chunk.sourceTitle}’ 자료에 개인정보 후보가 있어 AI 전송을 중단했습니다.`);
    }
  }
  return { record, chunks };
};

const sanitizeRagDraft = (draft: import('./shared/contracts').RagDraft) => {
  if (!draft || !isAiProviderId(draft.provider) || typeof draft.model !== 'string') {
    throw new Error('저장할 교육자료 연결의 AI 정보를 확인해 주세요.');
  }
  const evidence = resolveRagEvidence(draft.recordId, draft.chunkIds);
  const result = sanitizeRagResult(draft.result, evidence.chunks.map((chunk) => chunk.id));
  if (!hasRagContent(result)) {
    throw new Error('저장할 교육자료 연결 내용이 비어 있습니다.');
  }
  return {
    draft: {
      recordId: evidence.record.id,
      query: typeof draft.query === 'string' ? draft.query.trim().normalize('NFC').slice(0, 500) : '',
      chunkIds: evidence.chunks.map((chunk) => chunk.id),
      provider: draft.provider,
      model: draft.model.slice(0, 100),
      generatedAt: Number.isNaN(Date.parse(draft.generatedAt))
        ? new Date().toISOString()
        : draft.generatedAt,
      result,
    },
    ...evidence,
  };
};

const localDateKey = (date = new Date()) => new Intl.DateTimeFormat('en-CA', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
}).format(date);

const parseJsonSetting = (key: string) => {
  const value = getSetting(key);
  if (!value) return null;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
};

const getNewsState = (): NewsState => {
  const topics = normalizeNewsTopics(parseJsonSetting('newsTopics'));
  const items = sanitizeStoredNewsItems(parseJsonSetting('newsItems'), topics);
  const lastAttemptDate = getSetting('newsLastAttemptDate');
  const lastFetchedAtValue = getSetting('newsLastFetchedAt');
  const lastFetchedAt = lastFetchedAtValue && !Number.isNaN(Date.parse(lastFetchedAtValue))
    ? lastFetchedAtValue
    : null;
  return {
    topics,
    items,
    lastFetchedAt,
    lastAttemptDate: lastAttemptDate && /^\d{4}-\d{2}-\d{2}$/.test(lastAttemptDate)
      ? lastAttemptDate
      : null,
    needsRefresh: topics.length === 2 && lastAttemptDate !== localDateKey(),
    error: getSetting('newsLastError') || null,
  };
};

const refreshNewsState = async (): Promise<NewsState> => {
  const current = getNewsState();
  if (!current.needsRefresh || current.topics.length !== 2) return current;
  setSetting('newsLastAttemptDate', localDateKey());
  try {
    const items = await fetchNewsForTopics(current.topics);
    const fetchedAt = new Date().toISOString();
    setSetting('newsItems', JSON.stringify(items));
    setSetting('newsLastFetchedAt', fetchedAt);
    setSetting('newsLastError', items.length > 0 ? '' : '오늘은 표시할 새 소식을 찾지 못했습니다.');
  } catch (error) {
    const message = error instanceof Error
      ? error.message.slice(0, 240)
      : '새 소식을 불러오지 못했습니다. 기록 기능은 그대로 사용할 수 있습니다.';
    setSetting('newsLastError', message);
  }
  return getNewsState();
};

const refreshNewsOnce = () => {
  newsRefreshPromise ??= refreshNewsState().finally(() => {
    newsRefreshPromise = null;
  });
  return newsRefreshPromise;
};

const registerIpcHandlers = () => {
  ipcMain.handle('storage:get-state', (event) => {
    assertTrustedSender(event.senderFrame?.url ?? '');
    return getStorageState();
  });

  ipcMain.handle('storage:use-default', async (event) => {
    assertTrustedSender(event.senderFrame?.url ?? '');
    storageRoot = getDefaultStorageRoot();
    await mkdir(storageRoot, { recursive: true });
    setSetting('storageRoot', storageRoot);
    scheduleAutomaticBackup();
    return getStorageState();
  });

  ipcMain.handle('storage:choose-directory', async (event) => {
    assertTrustedSender(event.senderFrame?.url ?? '');
    if (!mainWindow) {
      throw new Error('잇다 창을 먼저 열어 주세요.');
    }
    const result = await dialog.showOpenDialog(mainWindow, {
      title: '잇다 기록을 저장할 폴더 선택',
      defaultPath: storageRoot ?? getDefaultStorageRoot(),
      buttonLabel: '이 폴더 사용',
      properties: ['openDirectory', 'createDirectory'],
    });

    if (!result.canceled && result.filePaths[0]) {
      storageRoot = path.resolve(result.filePaths[0]);
      await mkdir(storageRoot, { recursive: true });
      setSetting('storageRoot', storageRoot);
      scheduleAutomaticBackup();
    }
    return getStorageState();
  });

  ipcMain.handle('markdown-document:get', async (event, target: MarkdownDocumentTarget) => {
    assertTrustedSender(event.senderFrame?.url ?? '');
    const resolved = resolveMarkdownDocument(target);
    const snapshot = await readMarkdownDocumentFile(resolved.filePath);
    return {
      kind: resolved.kind,
      id: resolved.id,
      kindLabel: resolved.kindLabel,
      linkedRecords: getLinkedRecords(resolved.recordIds),
      ...snapshot,
    };
  });

  ipcMain.handle(
    'markdown-document:save',
    async (event, request: SaveMarkdownDocumentRequest) => {
      assertTrustedSender(event.senderFrame?.url ?? '');
      if (typeof request?.revision !== 'string' || !request.revision) {
        throw new Error('문서를 다시 불러온 뒤 저장해 주세요.');
      }
      if (typeof request?.body !== 'string') {
        throw new Error('저장할 문서 본문을 확인해 주세요.');
      }
      const resolved = resolveMarkdownDocument(request);
      const snapshot = await saveMarkdownDocumentFile(
        resolved.filePath,
        request.body,
        request.revision,
      );
      scheduleAutomaticBackup();
      return {
        kind: resolved.kind,
        id: resolved.id,
        kindLabel: resolved.kindLabel,
        linkedRecords: getLinkedRecords(resolved.recordIds),
        ...snapshot,
      };
    },
  );

  ipcMain.handle('markdown-document:show-file', (event, target: MarkdownDocumentTarget) => {
    assertTrustedSender(event.senderFrame?.url ?? '');
    const resolved = resolveMarkdownDocument(target);
    shell.showItemInFolder(resolved.filePath);
    return true;
  });

  ipcMain.handle('backup:get-state', async (event) => {
    assertTrustedSender(event.senderFrame?.url ?? '');
    return getBackupState();
  });

  ipcMain.handle('backup:create-now', async (event) => {
    assertTrustedSender(event.senderFrame?.url ?? '');
    return createApplicationBackup('automatic');
  });

  ipcMain.handle('backup:export', async (event) => {
    assertTrustedSender(event.senderFrame?.url ?? '');
    if (!mainWindow) {
      throw new Error('잇다 창을 먼저 열어 주세요.');
    }
    const result = await dialog.showOpenDialog(mainWindow, {
      title: '전체 백업을 저장할 상위 폴더 선택',
      defaultPath: app.getPath('documents'),
      buttonLabel: '여기에 백업 만들기',
      properties: ['openDirectory', 'createDirectory'],
    });
    if (result.canceled || !result.filePaths[0]) {
      return null;
    }
    return createApplicationBackup('manual', path.resolve(result.filePaths[0]));
  });

  ipcMain.handle('backup:choose-restore', async (event) => {
    assertTrustedSender(event.senderFrame?.url ?? '');
    if (!mainWindow) {
      throw new Error('잇다 창을 먼저 열어 주세요.');
    }
    const result = await dialog.showOpenDialog(mainWindow, {
      title: '복원할 잇다 백업 폴더 선택',
      defaultPath: getAutomaticBackupDirectory(),
      buttonLabel: '이 백업 검사',
      properties: ['openDirectory'],
    });
    if (result.canceled || !result.filePaths[0]) {
      return null;
    }
    return inspectBackupBundle(result.filePaths[0]);
  });

  ipcMain.handle(
    'backup:restore',
    async (event, request: RestoreBackupRequest): Promise<RestoreBackupResult> => {
      assertTrustedSender(event.senderFrame?.url ?? '');
      if (request?.confirmation !== '복원') {
        throw new Error('복원을 실행하려면 확인란에 “복원”을 입력해 주세요.');
      }
      if (restoreInProgress || backupInProgress) {
        throw new Error('백업 또는 복원이 이미 진행 중입니다.');
      }
      if (!databasePath) {
        throw new Error('현재 기록 데이터베이스 위치를 확인하지 못했습니다.');
      }
      const inspection = await inspectBackupBundle(request.backupPath);
      if (!inspection.valid || !inspection.manifest) {
        throw new Error(inspection.warnings[0] ?? '올바른 잇다 백업이 아닙니다.');
      }

      restoreInProgress = true;
      const previousStorageRoot = storageRoot ?? getDefaultStorageRoot();
      let databaseWasReplaced = false;
      let preRestoreBackupPath = '';
      try {
        const preRestoreDirectory = path.join(getAutomaticBackupDirectory(), 'pre-restore');
        const preRestore = await createApplicationBackup('pre-restore', preRestoreDirectory);
        preRestoreBackupPath = preRestore.path;
        await pruneBackupBundles(preRestoreDirectory, 3);

        const restoredStorageRoot = await createRestoreStorageRoot(previousStorageRoot);
        const restoredFiles = await copyBackupMarkdownFiles(inspection, restoredStorageRoot);
        const restoredByEntity = new Map(
          restoredFiles.map((file) => [`${file.entityType}:${file.entityId}`, file.destinationPath]),
        );

        closeDatabase();
        await copyFile(getBackupDatabasePath(inspection.path), databasePath);
        databaseWasReplaced = true;
        initializeDatabase(databasePath);

        for (const file of inspection.manifest.files) {
          const restoredPath = restoredByEntity.get(`${file.entityType}:${file.entityId}`)
            ?? path.join(restoredStorageRoot, '복원누락', file.entityType, `${file.entityId}.md`);
          if (file.entityType === 'record') {
            updateRecordMarkdownPath(file.entityId, restoredPath);
          } else if (file.entityType === 'weekly-summary') {
            updateWeeklySummaryMarkdownPath(file.entityId, restoredPath);
          } else if (file.entityType === 'monthly-summary') {
            updateMonthlySummaryMarkdownPath(file.entityId, restoredPath);
          } else if (file.entityType === 'quarterly-summary') {
            updateQuarterlySummaryMarkdownPath(file.entityId, restoredPath);
          } else if (file.entityType === 'semester-summary') {
            updateSemesterSummaryMarkdownPath(file.entityId, restoredPath);
          } else if (file.entityType === 'annual-summary') {
            updateAnnualSummaryMarkdownPath(file.entityId, restoredPath);
          } else if (file.entityType === 'project-summary') {
            updateProjectSummaryMarkdownPath(file.entityId, restoredPath);
          } else if (file.entityType === 'knowledge-source') {
            updateKnowledgeSourceStoredPath(file.entityId, restoredPath);
          } else {
            updateRagConnectionMarkdownPath(file.entityId, restoredPath);
          }
        }
        for (const missing of inspection.manifest.missingFiles) {
          const missingPath = path.join(
            restoredStorageRoot,
            '복원누락',
            missing.entityType,
            `${missing.entityId}.md`,
          );
          if (missing.entityType === 'record') {
            updateRecordMarkdownPath(missing.entityId, missingPath);
          } else if (missing.entityType === 'weekly-summary') {
            updateWeeklySummaryMarkdownPath(missing.entityId, missingPath);
          } else if (missing.entityType === 'monthly-summary') {
            updateMonthlySummaryMarkdownPath(missing.entityId, missingPath);
          } else if (missing.entityType === 'quarterly-summary') {
            updateQuarterlySummaryMarkdownPath(missing.entityId, missingPath);
          } else if (missing.entityType === 'semester-summary') {
            updateSemesterSummaryMarkdownPath(missing.entityId, missingPath);
          } else if (missing.entityType === 'annual-summary') {
            updateAnnualSummaryMarkdownPath(missing.entityId, missingPath);
          } else if (missing.entityType === 'project-summary') {
            updateProjectSummaryMarkdownPath(missing.entityId, missingPath);
          } else if (missing.entityType === 'knowledge-source') {
            updateKnowledgeSourceStoredPath(missing.entityId, missingPath);
          } else {
            updateRagConnectionMarkdownPath(missing.entityId, missingPath);
          }
        }

        storageRoot = restoredStorageRoot;
        setSetting('storageRoot', restoredStorageRoot);
        const restoredCounts = getBackupCounts();
        if (restoredCounts.records !== inspection.manifest.counts.records
          || restoredCounts.weeklySummaries !== inspection.manifest.counts.weeklySummaries
          || restoredCounts.monthlySummaries !== inspection.manifest.counts.monthlySummaries
          || restoredCounts.quarterlySummaries !== inspection.manifest.counts.quarterlySummaries
          || restoredCounts.semesterSummaries !== inspection.manifest.counts.semesterSummaries
          || restoredCounts.annualSummaries !== inspection.manifest.counts.annualSummaries
          || restoredCounts.projectSummaries !== inspection.manifest.counts.projectSummaries
          || restoredCounts.knowledgeSources !== inspection.manifest.counts.knowledgeSources
          || restoredCounts.knowledgeConnections !== inspection.manifest.counts.knowledgeConnections
          || restoredCounts.topics !== inspection.manifest.counts.topics
          || restoredCounts.studentAliases !== inspection.manifest.counts.studentAliases) {
          throw new Error('복원 뒤 데이터 개수 확인에 실패했습니다. 기존 상태로 되돌립니다.');
        }
        aiSession = null;
        return {
          storageRoot: restoredStorageRoot,
          preRestoreBackupPath,
          restoredCounts,
          warnings: inspection.warnings,
        };
      } catch (error) {
        if (databaseWasReplaced && preRestoreBackupPath) {
          closeDatabase();
          await copyFile(getBackupDatabasePath(preRestoreBackupPath), databasePath);
          initializeDatabase(databasePath);
          storageRoot = previousStorageRoot;
          setSetting('storageRoot', previousStorageRoot);
        }
        throw error;
      } finally {
        restoreInProgress = false;
      }
    },
  );

  ipcMain.handle('backup:show-folder', async (event) => {
    assertTrustedSender(event.senderFrame?.url ?? '');
    await mkdir(getAutomaticBackupDirectory(), { recursive: true });
    return (await shell.openPath(getAutomaticBackupDirectory())) === '';
  });

  ipcMain.handle(
    'records:save-markdown',
    async (event, request: SaveRecordRequest): Promise<SaveRecordResult> => {
      assertTrustedSender(event.senderFrame?.url ?? '');
      validateSaveRequest(request);

      storageRoot ??= getDefaultStorageRoot();
      await mkdir(storageRoot, { recursive: true });
      const id = randomUUID();
      const createdAt = new Date().toISOString();
      const ai = sanitizeAiReview(request.aiStatus, request.aiReview);
      const suggestedCategories = ai.review?.result.categories ?? [];
      const categories = cleanCategories(
        suggestedCategories.length > 0 ? suggestedCategories : request.categories,
      );
      const [year, month] = request.recordDate.split('-');
      const directory = path.join(storageRoot, year, month, '일일기록');
      await mkdir(directory, { recursive: true });

      const primaryCategory = sanitizeFilePart(categories[0] ?? '교실기록');
      const baseName = `${request.recordDate}_교실기록_${primaryCategory}`;
      const filePath = await findAvailableFilePath(directory, baseName);
      const content = request.content.trim().normalize('NFC');

      await writeFile(
        filePath,
        buildMarkdown({
          id,
          content,
          recordDate: request.recordDate,
          categories,
          createdAt,
          appVersion: app.getVersion(),
          privacyReviewed: request.privacyReviewed,
          aiReview: ai.review,
          topics: [],
        }),
        { encoding: 'utf8' },
      );

      const record = createRecord({
        id,
        recordDate: request.recordDate,
        content,
        categories,
        markdownPath: filePath,
        createdAt,
        aiStatus: ai.status,
        aiReview: ai.review,
      });
      if (!record) {
        throw new Error('기록 파일은 저장했지만 목록에 추가하지 못했습니다.');
      }
      scheduleAutomaticBackup();
      return { filePath, savedAt: createdAt, record };
    },
  );

  ipcMain.handle('records:import-folder', async (event): Promise<ImportRecordsResult> => {
    assertTrustedSender(event.senderFrame?.url ?? '');
    const selection = await dialog.showOpenDialog({
      title: '기존 Markdown 기록 폴더 선택',
      properties: ['openDirectory'],
      buttonLabel: '이 폴더에서 가져오기',
    });
    if (selection.canceled || selection.filePaths.length === 0) {
      return {
        canceled: true,
        sourceDirectory: null,
        totalFiles: 0,
        importedCount: 0,
        duplicateCount: 0,
        privacyBlockedCount: 0,
        invalidCount: 0,
        issues: [],
      };
    }

    const sourceDirectory = path.resolve(selection.filePaths[0]);
    const files = await listRecordMarkdownFiles(sourceDirectory);
    const result: ImportRecordsResult = {
      canceled: false,
      sourceDirectory,
      totalFiles: files.length,
      importedCount: 0,
      duplicateCount: 0,
      privacyBlockedCount: 0,
      invalidCount: 0,
      issues: [],
    };
    storageRoot ??= getDefaultStorageRoot();
    await mkdir(storageRoot, { recursive: true });

    for (const filePath of files) {
      const fileName = path.basename(filePath);
      try {
        const parsed = await readRecordMarkdown(filePath);
        const duplicate = (parsed.recordId ? getRecord(parsed.recordId) : null)
          ?? getRecordByDateAndContent(parsed.recordDate, parsed.content);
        if (duplicate) {
          result.duplicateCount += 1;
          result.issues.push({ fileName, reason: '같은 날짜와 본문의 기록이 이미 있습니다.' });
          continue;
        }

        const academicYear = getAcademicYear(new Date(`${parsed.recordDate}T12:00:00`));
        const findings = inspectPrivacyContent(parsed.content, readStudentAliases(academicYear));
        if (findings.length > 0) {
          result.privacyBlockedCount += 1;
          result.issues.push({
            fileName,
            reason: '개인정보 후보가 있어 가져오지 않았습니다.',
            privacyFindingCount: findings.length,
          });
          continue;
        }

        const categories = cleanCategories(parsed.categories);
        validateRecordContent(parsed.content, categories);
        const id = randomUUID();
        const createdAt = new Date().toISOString();
        const [year, month] = parsed.recordDate.split('-');
        const directory = path.join(storageRoot, year, month, '일일기록');
        await mkdir(directory, { recursive: true });
        const primaryCategory = sanitizeFilePart(categories[0] ?? '가져온-기록');
        const filePathForRecord = await findAvailableFilePath(
          directory,
          `${parsed.recordDate}_교실기록_${primaryCategory}`,
        );
        await writeFile(
          filePathForRecord,
          buildMarkdown({
            id,
            content: parsed.content,
            recordDate: parsed.recordDate,
            categories,
            createdAt,
            appVersion: app.getVersion(),
            privacyReviewed: true,
            topics: [],
          }),
          { encoding: 'utf8' },
        );
        const record = createRecord({
          id,
          recordDate: parsed.recordDate,
          content: parsed.content,
          categories,
          markdownPath: filePathForRecord,
          createdAt,
        });
        if (!record) throw new Error('가져온 기록을 목록에 추가하지 못했습니다.');
        result.importedCount += 1;
      } catch (error) {
        result.invalidCount += 1;
        result.issues.push({
          fileName,
          reason: error instanceof Error ? error.message : '파일을 읽지 못했습니다.',
        });
      }
    }
    if (result.importedCount > 0) scheduleAutomaticBackup();
    return result;
  });

  ipcMain.handle('records:list', (event, request: ListRecordsRequest = {}) => {
    assertTrustedSender(event.senderFrame?.url ?? '');
    return listRecords(request);
  });

  ipcMain.handle('records:get-detail', (event, recordId: string) => {
    assertTrustedSender(event.senderFrame?.url ?? '');
    const record = typeof recordId === 'string' ? getRecord(recordId) : null;
    if (!record || record.deletedAt) {
      throw new Error('연결된 기록을 찾지 못했습니다.');
    }
    return {
      record,
      backlinks: listMarkdownDocumentLinksForRecord(record.id),
    };
  });

  ipcMain.handle('records:update', async (event, request: UpdateRecordRequest) => {
    assertTrustedSender(event.senderFrame?.url ?? '');
    validateRecordContent(request?.content, request?.categories);
    if (request?.privacyReviewed !== true) {
      throw new Error('개인정보 후보를 먼저 확인해 주세요.');
    }
    const existing = getRecord(request.id);
    if (!existing || existing.deletedAt) {
      throw new Error('수정할 기록을 찾지 못했습니다.');
    }

    const content = request.content.trim().normalize('NFC');
    const ai = sanitizeAiReview(request.aiStatus, request.aiReview);
    const suggestedCategories = ai.review?.result.categories ?? [];
    const categories = cleanCategories(
      suggestedCategories.length > 0 ? suggestedCategories : request.categories,
    );
    await writeFile(
      existing.markdownPath,
      buildMarkdown({
        id: existing.id,
        content,
        recordDate: existing.recordDate,
        categories,
        createdAt: existing.createdAt,
        appVersion: app.getVersion(),
        privacyReviewed: request.privacyReviewed,
        aiReview: ai.review,
        topics: listRecordTopicNames(existing.id),
      }),
      { encoding: 'utf8' },
    );

    const record = updateRecord(existing.id, content, categories, ai.status, ai.review);
    if (!record) {
      throw new Error('수정한 기록을 다시 불러오지 못했습니다.');
    }
    scheduleAutomaticBackup();
    return record;
  });

  ipcMain.handle('privacy:inspect', (event, content: string) => {
    assertTrustedSender(event.senderFrame?.url ?? '');
    if (typeof content !== 'string' || content.length > 100_000) {
      throw new Error('개인정보를 확인할 기록의 형식이 올바르지 않습니다.');
    }
    const academicYear = getAcademicYear();
    return {
      academicYear,
      findings: inspectPrivacyContent(content.normalize('NFC'), readStudentAliases(academicYear)),
    };
  });

  ipcMain.handle('privacy:list-student-aliases', (event) => {
    assertTrustedSender(event.senderFrame?.url ?? '');
    scheduleAutomaticBackup();
    return getStudentAliasState();
  });

  ipcMain.handle('privacy:register-student-names', (event, request: { names: string[] }) => {
    assertTrustedSender(event.senderFrame?.url ?? '');
    if (!safeStorage.isEncryptionAvailable()) {
      throw new Error('이 기기에서 이름 대응표를 암호화할 수 없습니다. Windows 로그인을 확인해 주세요.');
    }
    if (!Array.isArray(request?.names)) {
      throw new Error('학생 이름 형식이 올바르지 않습니다.');
    }

    const names = [...new Set(request.names.map(normalizeStudentName).filter(Boolean))];
    if (names.some((name) => name.length < 2 || name.length > 30)) {
      throw new Error('학생 이름은 2자 이상 30자 이하로 입력해 주세요.');
    }
    if (names.length > 100) {
      throw new Error('한 번에 등록할 수 있는 학생은 100명까지입니다.');
    }

    const academicYear = getAcademicYear();
    const existing = readStudentAliases(academicYear);
    const knownNames = new Set(existing.map((item) => normalizeStudentName(item.realName)));
    let nextIndex = existing.length;

    for (const realName of names) {
      if (knownNames.has(realName)) {
        continue;
      }
      const createdAt = new Date().toISOString();
      createStudentAliasRow({
        id: randomUUID(),
        academic_year: academicYear,
        encrypted_name: safeStorage.encryptString(realName),
        alias: createStudentAliasLabel(nextIndex),
        created_at: createdAt,
      });
      knownNames.add(realName);
      nextIndex += 1;
    }

    return getStudentAliasState();
  });

  ipcMain.handle('ai:get-state', (event) => {
    assertTrustedSender(event.senderFrame?.url ?? '');
    return getAiSettingsState();
  });

  ipcMain.handle('ai:connect', async (event, request: AiConnectRequest) => {
    assertTrustedSender(event.senderFrame?.url ?? '');
    const apiKey = typeof request?.apiKey === 'string' ? request.apiKey.trim() : '';
    if (apiKey.length < 8 || apiKey.length > 500) {
      throw new Error('API 키를 다시 확인해 주세요.');
    }
    validateAiSelection(request.provider, request.model);

    const result = await testAiProviderConnection({
      provider: request.provider,
      model: request.model,
      apiKey,
    });
    const connectedAt = new Date().toISOString();
    aiSession = {
      provider: request.provider,
      model: result.model,
      apiKey,
      keyHint: `••••${apiKey.slice(-4)}`,
      connectedAt,
      lastUsedAt: Date.now(),
    };
    setSetting('aiSetupCompleted', 'true');
    setSetting('aiPreferredProvider', request.provider);
    setSetting('aiPreferredModel', result.model);
    scheduleAutomaticBackup();
    return getAiSettingsState();
  });

  ipcMain.handle('ai:disconnect', (event) => {
    assertTrustedSender(event.senderFrame?.url ?? '');
    aiSession = null;
    return getAiSettingsState();
  });

  ipcMain.handle('ai:skip-setup', (event, provider: AiProviderId, model: string) => {
    assertTrustedSender(event.senderFrame?.url ?? '');
    validateAiSelection(provider, model);
    aiSession = null;
    setSetting('aiSetupCompleted', 'true');
    setSetting('aiPreferredProvider', provider);
    setSetting('aiPreferredModel', model);
    scheduleAutomaticBackup();
    return getAiSettingsState();
  });

  ipcMain.handle('ai:organize-record', async (event, request: AiOrganizeRequest) => {
    assertTrustedSender(event.senderFrame?.url ?? '');
    const content = typeof request?.content === 'string'
      ? request.content.trim().normalize('NFC')
      : '';
    if (!content) {
      throw new Error('AI로 정리할 기록이 비어 있습니다.');
    }
    if (content.length > 30_000) {
      throw new Error('AI 정리는 한 번에 3만 자까지 가능합니다. 원문은 그대로 로컬에 저장할 수 있습니다.');
    }

    const privacyFindings = inspectPrivacyContent(content, readStudentAliases());
    if (privacyFindings.length > 0) {
      throw new Error('개인정보 후보가 남아 있어 AI 전송을 중단했습니다. 원문을 다시 확인해 주세요.');
    }
    const options = sanitizeAiOptions(request.options);
    clearExpiredAiSession();
    if (!aiSession) {
      throw new Error('AI 연결이 만료되었거나 연결되지 않았습니다. 메뉴에서 다시 연결해 주세요.');
    }

    const sessionForRequest = aiSession;
    let result;
    try {
      result = await organizeRecordWithAi({
        provider: sessionForRequest.provider,
        model: sessionForRequest.model,
        apiKey: sessionForRequest.apiKey,
        content,
        options,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      if (!message.includes('응답 형식') && !message.includes('정리 항목')) {
        throw error;
      }
      result = await organizeRecordWithAi({
        provider: sessionForRequest.provider,
        model: sessionForRequest.model,
        apiKey: sessionForRequest.apiKey,
        content,
        options,
      });
    }
    sessionForRequest.lastUsedAt = Date.now();
    const draft: AiOrganizationDraft = {
      provider: sessionForRequest.provider,
      model: sessionForRequest.model,
      generatedAt: new Date().toISOString(),
      options,
      result,
    };
    return draft;
  });

  ipcMain.handle('search:semantic', async (event, request: SemanticSearchRequest) => {
    assertTrustedSender(event.senderFrame?.url ?? '');
    const query = typeof request?.query === 'string'
      ? request.query.trim().normalize('NFC')
      : '';
    if (query.length < 2 || query.length > 200) {
      throw new Error('AI 의미 검색어는 2자 이상 200자 이하로 입력해 주세요.');
    }

    const queryPrivacyFindings = inspectPrivacyContent(query, readStudentAliases());
    if (queryPrivacyFindings.length > 0) {
      throw new Error('검색어에 개인정보 후보가 있어 AI 전송을 중단했습니다. 검색어를 비식별 표현으로 바꿔 주세요.');
    }
    clearExpiredAiSession();
    if (!aiSession) {
      throw new Error('AI 연결이 만료되었거나 연결되지 않았습니다. 메뉴에서 다시 연결해 주세요.');
    }

    const activeRecords = listRecords({ limit: 100 });
    const aliasCache = new Map<number, StudentAlias[]>();
    const recordsForAi = [];
    let excerptCharacters = 0;
    for (const record of activeRecords) {
      const recordDate = new Date(`${record.recordDate}T12:00:00`);
      const academicYear = getAcademicYear(recordDate);
      if (!aliasCache.has(academicYear)) {
        aliasCache.set(academicYear, readStudentAliases(academicYear));
      }
      if (inspectPrivacyContent(record.content, aliasCache.get(academicYear) ?? []).length > 0) {
        throw new Error(`${record.recordDate} 기록에 개인정보 후보가 남아 있어 AI 의미 검색을 중단했습니다. 해당 기록을 먼저 비식별화해 주세요.`);
      }
      const excerpt = record.content.trim().slice(0, 800);
      if (!excerpt) {
        continue;
      }
      if (excerptCharacters + excerpt.length > 50_000) {
        break;
      }
      recordsForAi.push({
        id: record.id,
        recordDate: record.recordDate,
        content: excerpt,
        categories: record.categories.slice(0, 10),
        topics: listRecordTopicNames(record.id).slice(0, 10),
      });
      excerptCharacters += excerpt.length;
    }

    const sessionForRequest = aiSession;
    let result: SemanticSearchAiResult = { interpretation: '', results: [] };
    if (recordsForAi.length > 0) {
      try {
        result = await searchRecordsWithAi({
          provider: sessionForRequest.provider,
          model: sessionForRequest.model,
          apiKey: sessionForRequest.apiKey,
          query,
          records: recordsForAi,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : '';
        if (!message.includes('응답 형식')) {
          throw error;
        }
        result = await searchRecordsWithAi({
          provider: sessionForRequest.provider,
          model: sessionForRequest.model,
          apiKey: sessionForRequest.apiKey,
          query,
          records: recordsForAi,
        });
      }
    }
    sessionForRequest.lastUsedAt = Date.now();
    const recordsById = new Map(activeRecords.map((record) => [record.id, record]));
    const response: SemanticSearchResponse = {
      query,
      interpretation: result.interpretation,
      searchedRecordCount: recordsForAi.length,
      provider: sessionForRequest.provider,
      model: sessionForRequest.model,
      generatedAt: new Date().toISOString(),
      matches: result.results.flatMap((match) => {
        const record = recordsById.get(match.recordId);
        return record ? [{
          record,
          score: match.score,
          reason: match.reason,
          matchedConcepts: match.matchedConcepts,
        }] : [];
      }),
    };
    return response;
  });

  ipcMain.handle('topics:list', (event) => {
    assertTrustedSender(event.senderFrame?.url ?? '');
    return listTopicState();
  });

  ipcMain.handle('topics:create', async (event, request: CreateTopicRequest) => {
    assertTrustedSender(event.senderFrame?.url ?? '');
    const recordIds = [...new Set(Array.isArray(request?.recordIds)
      ? request.recordIds.filter((id): id is string => typeof id === 'string')
      : [])];
    if (recordIds.length > 100) {
      throw new Error('한 주제에 한 번에 연결할 수 있는 기록은 100개까지입니다.');
    }
    if (recordIds.some((recordId) => {
      const record = getRecord(recordId);
      return !record || Boolean(record.deletedAt);
    })) {
      throw new Error('주제에 연결할 기록 중 찾을 수 없거나 휴지통에 있는 기록이 있습니다.');
    }
    const topic = createTopic(
      typeof request?.name === 'string' ? request.name : '',
      'teacher',
      recordIds,
    );
    if (recordIds.length > 0) await refreshTopicMarkdown(recordIds);
    scheduleAutomaticBackup();
    return { state: listTopicState(), topicId: topic.id };
  });

  ipcMain.handle(
    'topics:adopt-suggestion',
    async (event, request: AdoptTopicSuggestionRequest) => {
      assertTrustedSender(event.senderFrame?.url ?? '');
      const adopted = adoptTopicSuggestion(
        typeof request?.normalizedName === 'string' ? request.normalizedName : '',
        typeof request?.name === 'string' ? request.name : '',
      );
      await refreshTopicMarkdown(adopted.recordIds);
      scheduleAutomaticBackup();
      return listTopicState();
    },
  );

  ipcMain.handle('topics:dismiss-suggestion', (event, normalizedName: string) => {
    assertTrustedSender(event.senderFrame?.url ?? '');
    dismissTopicSuggestion(typeof normalizedName === 'string' ? normalizedName : '');
    scheduleAutomaticBackup();
    return listTopicState();
  });

  ipcMain.handle('topics:update', async (event, request: UpdateTopicRequest) => {
    assertTrustedSender(event.senderFrame?.url ?? '');
    if (typeof request?.id !== 'string') {
      throw new Error('수정할 주제를 확인해 주세요.');
    }
    const changes: { name?: string; pinned?: boolean; hidden?: boolean } = {};
    if (typeof request.name === 'string') {
      changes.name = request.name;
    }
    if (typeof request.pinned === 'boolean') {
      changes.pinned = request.pinned;
    }
    if (typeof request.hidden === 'boolean') {
      changes.hidden = request.hidden;
    }
    if (Object.keys(changes).length === 0) {
      throw new Error('변경할 주제 내용을 확인해 주세요.');
    }
    const recordIds = getTopicRecordIds(request.id);
    updateTopic(request.id, changes);
    if (changes.name !== undefined) {
      await refreshTopicMarkdown(recordIds);
    }
    scheduleAutomaticBackup();
    return listTopicState();
  });

  ipcMain.handle('topics:merge', async (event, request: MergeTopicsRequest) => {
    assertTrustedSender(event.senderFrame?.url ?? '');
    if (typeof request?.sourceId !== 'string' || typeof request?.targetId !== 'string') {
      throw new Error('병합할 두 주제를 확인해 주세요.');
    }
    const merged = mergeTopics(request.sourceId, request.targetId);
    await refreshTopicMarkdown(merged.recordIds);
    scheduleAutomaticBackup();
    return listTopicState();
  });

  ipcMain.handle('topics:link-record', async (event, request: TopicRecordRequest) => {
    assertTrustedSender(event.senderFrame?.url ?? '');
    if (typeof request?.topicId !== 'string' || typeof request?.recordId !== 'string') {
      throw new Error('연결할 주제와 기록을 확인해 주세요.');
    }
    linkRecordToTopic(request.topicId, request.recordId);
    await refreshTopicMarkdown([request.recordId]);
    scheduleAutomaticBackup();
    return listTopicState();
  });

  ipcMain.handle('topics:unlink-record', async (event, request: TopicRecordRequest) => {
    assertTrustedSender(event.senderFrame?.url ?? '');
    if (typeof request?.topicId !== 'string' || typeof request?.recordId !== 'string') {
      throw new Error('해제할 주제와 기록을 확인해 주세요.');
    }
    unlinkRecordFromTopic(request.topicId, request.recordId);
    await refreshTopicMarkdown([request.recordId]);
    scheduleAutomaticBackup();
    return listTopicState();
  });

  ipcMain.handle('topics:delete', async (event, topicId: string) => {
    assertTrustedSender(event.senderFrame?.url ?? '');
    if (typeof topicId !== 'string') {
      throw new Error('삭제할 주제를 확인해 주세요.');
    }
    const deleted = deleteTopic(topicId);
    await refreshTopicMarkdown(deleted.recordIds);
    scheduleAutomaticBackup();
    return listTopicState();
  });

  ipcMain.handle('dashboard:get-state', (event) => {
    assertTrustedSender(event.senderFrame?.url ?? '');
    return getDashboardState();
  });

  ipcMain.handle(
    'dashboard:update-card',
    (event, request: UpdateDashboardCardRequest) => {
      assertTrustedSender(event.senderFrame?.url ?? '');
      if (typeof request?.key !== 'string' || !request.key || request.key.length > 200) {
        throw new Error('변경할 첫 화면 카드를 확인해 주세요.');
      }
      const changes: {
        pinned?: boolean;
        status?: 'active' | 'hidden' | 'dismissed';
      } = {};
      if (typeof request.pinned === 'boolean') {
        changes.pinned = request.pinned;
      }
      if (
        request.status === 'active'
        || request.status === 'hidden'
        || request.status === 'dismissed'
      ) {
        changes.status = request.status;
      }
      if (Object.keys(changes).length === 0) {
        throw new Error('변경할 카드 설정을 확인해 주세요.');
      }
      updateDashboardCardPreference(request.key, changes);
      scheduleAutomaticBackup();
      return getDashboardState();
    },
  );

  ipcMain.handle('news:get-state', (event) => {
    assertTrustedSender(event.senderFrame?.url ?? '');
    return getNewsState();
  });

  ipcMain.handle('news:update-topics', (event, request: UpdateNewsTopicsRequest) => {
    assertTrustedSender(event.senderFrame?.url ?? '');
    const topics = normalizeNewsTopics(request?.topics);
    if (!Array.isArray(request?.topics) || request.topics.length !== 2 || topics.length !== 2) {
      throw new Error('서로 다른 관심 주제 두 개를 2~40자로 입력해 주세요.');
    }
    for (const topic of topics) {
      if (inspectPrivacyContent(topic, []).length > 0) {
        throw new Error('관심 주제에 개인정보 후보가 있습니다. 개인 이름이나 연락처 대신 일반적인 교육 주제를 입력해 주세요.');
      }
    }
    setSetting('newsTopics', JSON.stringify(topics));
    setSetting('newsItems', '[]');
    setSetting('newsLastFetchedAt', '');
    setSetting('newsLastAttemptDate', '');
    setSetting('newsLastError', '');
    scheduleAutomaticBackup();
    return getNewsState();
  });

  ipcMain.handle('news:refresh', async (event) => {
    assertTrustedSender(event.senderFrame?.url ?? '');
    return refreshNewsOnce();
  });

  ipcMain.handle('news:open-item', async (event, itemId: string) => {
    assertTrustedSender(event.senderFrame?.url ?? '');
    const item = typeof itemId === 'string'
      ? getNewsState().items.find((candidate) => candidate.id === itemId)
      : null;
    if (!item) return false;
    await shell.openExternal(item.url);
    return true;
  });

  ipcMain.handle(
    'weekly:get-workspace',
    (event, request: GetWeeklyWorkspaceRequest = {}) => {
      assertTrustedSender(event.senderFrame?.url ?? '');
      const range = getWeekRangeForAnchor(
        typeof request?.anchorDate === 'string' ? request.anchorDate : undefined,
      );
      const records = listRecords({ limit: 500 }).filter((record) =>
        record.recordDate >= range.weekStart && record.recordDate <= range.weekEnd);
      return {
        ...range,
        records,
        summaries: listWeeklySummaries(range.weekStart, range.weekEnd),
      };
    },
  );

  ipcMain.handle(
    'weekly:generate',
    async (event, request: GenerateWeeklySummaryRequest) => {
      assertTrustedSender(event.senderFrame?.url ?? '');
      const records = resolveWeeklyRecords(
        request?.weekStart,
        request?.weekEnd,
        request?.recordIds,
      );
      const totalLength = records.reduce((sum, record) => sum + record.content.length, 0);
      if (totalLength > 50_000) {
        throw new Error('선택한 기록이 너무 깁니다. 일부 기록을 해제해 5만 자 이하로 줄여 주세요.');
      }
      for (const record of records) {
        const academicYear = getAcademicYear(new Date(`${record.recordDate}T12:00:00`));
        if (inspectPrivacyContent(record.content, readStudentAliases(academicYear)).length > 0) {
          throw new Error(`${record.recordDate} 기록에 개인정보 후보가 남아 있어 AI 전송을 중단했습니다.`);
        }
      }
      clearExpiredAiSession();
      if (!aiSession) {
        throw new Error('AI 연결이 만료되었거나 연결되지 않았습니다. 메뉴에서 다시 연결해 주세요.');
      }
      const sessionForRequest = aiSession;
      const providerRequest = {
        provider: sessionForRequest.provider,
        model: sessionForRequest.model,
        apiKey: sessionForRequest.apiKey,
        weekStart: request.weekStart,
        weekEnd: request.weekEnd,
        reflectionLevel: sanitizeReflectionLevel(request.reflectionLevel),
        records: records.map((record) => ({
          id: record.id,
          recordDate: record.recordDate,
          content: record.content,
          categories: record.categories,
          topics: listRecordTopicNames(record.id),
        })),
      };
      let result;
      try {
        result = await organizeWeeklyWithAi(providerRequest);
      } catch (error) {
        const message = error instanceof Error ? error.message : '';
        if (!message.includes('응답 형식') && !message.includes('내용을 작성')) {
          throw error;
        }
        result = await organizeWeeklyWithAi(providerRequest);
      }
      sessionForRequest.lastUsedAt = Date.now();
      const draft: WeeklySummaryDraft = {
        weekStart: request.weekStart,
        weekEnd: request.weekEnd,
        recordIds: records.map((record) => record.id),
        provider: sessionForRequest.provider,
        model: sessionForRequest.model,
        generatedAt: new Date().toISOString(),
        reflectionLevel: providerRequest.reflectionLevel,
        result,
      };
      return draft;
    },
  );

  ipcMain.handle(
    'weekly:save',
    async (event, request: SaveWeeklySummaryRequest) => {
      assertTrustedSender(event.senderFrame?.url ?? '');
      const safe = sanitizeWeeklyDraft(request?.draft);
      storageRoot ??= getDefaultStorageRoot();
      const [year, month] = safe.draft.weekStart.split('-');
      const directory = path.join(storageRoot, year, month, '주간정리');
      await mkdir(directory, { recursive: true });
      const id = randomUUID();
      const createdAt = new Date().toISOString();
      const filePath = await findAvailableFilePath(
        directory,
        `${safe.draft.weekStart}_${safe.draft.weekEnd}_주간교무수첩`,
      );
      await writeFile(
        filePath,
        buildWeeklyMarkdown({
          id,
          draft: safe.draft,
          records: safe.records,
          createdAt,
          appVersion: app.getVersion(),
        }),
        { encoding: 'utf8' },
      );
      const summary = createWeeklySummary({
        id,
        weekStart: safe.draft.weekStart,
        weekEnd: safe.draft.weekEnd,
        recordIds: safe.draft.recordIds,
        provider: safe.draft.provider,
        model: safe.draft.model,
        result: safe.draft.result,
        markdownPath: filePath,
        createdAt,
      });
      if (!summary) {
        throw new Error('주간 Markdown은 저장했지만 목록에 추가하지 못했습니다.');
      }
      scheduleAutomaticBackup();
      return summary;
    },
  );

  ipcMain.handle('weekly:show-file', (event, summaryId: string) => {
    assertTrustedSender(event.senderFrame?.url ?? '');
    const summary = typeof summaryId === 'string' ? getWeeklySummary(summaryId) : null;
    if (!summary) {
      return false;
    }
    shell.showItemInFolder(summary.markdownPath);
    return true;
  });

  ipcMain.handle(
    'monthly:get-workspace',
    (event, request: GetMonthlyWorkspaceRequest = {}) => {
      assertTrustedSender(event.senderFrame?.url ?? '');
      const range = getMonthRange(
        typeof request?.monthKey === 'string' ? request.monthKey : undefined,
      );
      const records = listRecords({ limit: 500 }).filter((record) =>
        record.recordDate >= range.monthStart && record.recordDate <= range.monthEnd);
      return {
        ...range,
        records,
        summaries: listMonthlySummaries(range.monthKey),
      };
    },
  );

  ipcMain.handle(
    'monthly:generate',
    async (event, request: GenerateMonthlySummaryRequest) => {
      assertTrustedSender(event.senderFrame?.url ?? '');
      const records = resolveMonthlyRecords(
        request?.monthKey,
        request?.monthStart,
        request?.monthEnd,
        request?.recordIds,
      );
      const totalLength = records.reduce((sum, record) => sum + record.content.length, 0);
      if (totalLength > 50_000) {
        throw new Error('선택한 기록이 너무 깁니다. 일부 기록을 해제해 5만 자 이하로 줄여 주세요.');
      }
      for (const record of records) {
        const academicYear = getAcademicYear(new Date(`${record.recordDate}T12:00:00`));
        if (inspectPrivacyContent(record.content, readStudentAliases(academicYear)).length > 0) {
          throw new Error(`${record.recordDate} 기록에 개인정보 후보가 남아 있어 AI 전송을 중단했습니다.`);
        }
      }
      clearExpiredAiSession();
      if (!aiSession) {
        throw new Error('AI 연결이 만료되었거나 연결되지 않았습니다. 메뉴에서 다시 연결해 주세요.');
      }
      const sessionForRequest = aiSession;
      const providerRequest = {
        provider: sessionForRequest.provider,
        model: sessionForRequest.model,
        apiKey: sessionForRequest.apiKey,
        monthKey: request.monthKey,
        monthStart: request.monthStart,
        monthEnd: request.monthEnd,
        reflectionLevel: sanitizeReflectionLevel(request.reflectionLevel),
        records: records.map((record) => ({
          id: record.id,
          recordDate: record.recordDate,
          content: record.content,
          categories: record.categories,
          topics: listRecordTopicNames(record.id),
        })),
      };
      let result;
      try {
        result = await organizeMonthlyWithAi(providerRequest);
      } catch (error) {
        const message = error instanceof Error ? error.message : '';
        if (!message.includes('응답 형식') && !message.includes('내용을 작성')) {
          throw error;
        }
        result = await organizeMonthlyWithAi(providerRequest);
      }
      sessionForRequest.lastUsedAt = Date.now();
      const draft: MonthlySummaryDraft = {
        monthKey: request.monthKey,
        monthStart: request.monthStart,
        monthEnd: request.monthEnd,
        recordIds: records.map((record) => record.id),
        provider: sessionForRequest.provider,
        model: sessionForRequest.model,
        generatedAt: new Date().toISOString(),
        reflectionLevel: providerRequest.reflectionLevel,
        result,
      };
      return draft;
    },
  );

  ipcMain.handle(
    'monthly:save',
    async (event, request: SaveMonthlySummaryRequest) => {
      assertTrustedSender(event.senderFrame?.url ?? '');
      const safe = sanitizeMonthlyDraft(request?.draft);
      storageRoot ??= getDefaultStorageRoot();
      const [year, month] = safe.draft.monthKey.split('-');
      const directory = path.join(storageRoot, year, month, '월간정리');
      await mkdir(directory, { recursive: true });
      const id = randomUUID();
      const createdAt = new Date().toISOString();
      const filePath = await findAvailableFilePath(
        directory,
        `${safe.draft.monthKey}_월간교무수첩`,
      );
      await writeFile(
        filePath,
        buildMonthlyMarkdown({
          id,
          draft: safe.draft,
          records: safe.records,
          createdAt,
          appVersion: app.getVersion(),
        }),
        { encoding: 'utf8' },
      );
      const summary = createMonthlySummary({
        id,
        monthKey: safe.draft.monthKey,
        monthStart: safe.draft.monthStart,
        monthEnd: safe.draft.monthEnd,
        recordIds: safe.draft.recordIds,
        provider: safe.draft.provider,
        model: safe.draft.model,
        result: safe.draft.result,
        markdownPath: filePath,
        createdAt,
      });
      if (!summary) {
        throw new Error('월간 Markdown은 저장했지만 목록에 추가하지 못했습니다.');
      }
      scheduleAutomaticBackup();
      return summary;
    },
  );

  ipcMain.handle('monthly:show-file', (event, summaryId: string) => {
    assertTrustedSender(event.senderFrame?.url ?? '');
    const summary = typeof summaryId === 'string' ? getMonthlySummary(summaryId) : null;
    if (!summary) {
      return false;
    }
    shell.showItemInFolder(summary.markdownPath);
    return true;
  });

  ipcMain.handle(
    'quarterly:get-workspace',
    (event, request: GetQuarterlyWorkspaceRequest = {}) => {
      assertTrustedSender(event.senderFrame?.url ?? '');
      const range = getQuarterRange(
        typeof request?.quarterKey === 'string' ? request.quarterKey : undefined,
      );
      const records = listRecords({ limit: 500 }).filter((record) =>
        record.recordDate >= range.quarterStart && record.recordDate <= range.quarterEnd);
      return {
        ...range,
        records,
        summaries: listQuarterlySummaries(range.quarterKey),
      };
    },
  );

  ipcMain.handle(
    'quarterly:generate',
    async (event, request: GenerateQuarterlySummaryRequest) => {
      assertTrustedSender(event.senderFrame?.url ?? '');
      const records = resolveQuarterlyRecords(
        request?.quarterKey,
        request?.quarterStart,
        request?.quarterEnd,
        request?.recordIds,
      );
      const totalLength = records.reduce((sum, record) => sum + record.content.length, 0);
      if (totalLength > 50_000) {
        throw new Error('선택한 기록이 너무 깁니다. 일부 기록을 해제해 5만 자 이하로 줄여 주세요.');
      }
      for (const record of records) {
        const academicYear = getAcademicYear(new Date(`${record.recordDate}T12:00:00`));
        if (inspectPrivacyContent(record.content, readStudentAliases(academicYear)).length > 0) {
          throw new Error(`${record.recordDate} 기록에 개인정보 후보가 남아 있어 AI 전송을 중단했습니다.`);
        }
      }
      clearExpiredAiSession();
      if (!aiSession) {
        throw new Error('AI 연결이 만료되었거나 연결되지 않았습니다. 메뉴에서 다시 연결해 주세요.');
      }
      const sessionForRequest = aiSession;
      const providerRequest = {
        provider: sessionForRequest.provider,
        model: sessionForRequest.model,
        apiKey: sessionForRequest.apiKey,
        quarterKey: request.quarterKey,
        quarterStart: request.quarterStart,
        quarterEnd: request.quarterEnd,
        reflectionLevel: sanitizeReflectionLevel(request.reflectionLevel),
        records: records.map((record) => ({
          id: record.id,
          recordDate: record.recordDate,
          content: record.content,
          categories: record.categories,
          topics: listRecordTopicNames(record.id),
        })),
      };
      let result;
      try {
        result = await organizeQuarterlyWithAi(providerRequest);
      } catch (error) {
        const message = error instanceof Error ? error.message : '';
        if (!message.includes('응답 형식') && !message.includes('내용을 작성')) {
          throw error;
        }
        result = await organizeQuarterlyWithAi(providerRequest);
      }
      sessionForRequest.lastUsedAt = Date.now();
      const draft: QuarterlySummaryDraft = {
        quarterKey: request.quarterKey,
        quarterStart: request.quarterStart,
        quarterEnd: request.quarterEnd,
        recordIds: records.map((record) => record.id),
        provider: sessionForRequest.provider,
        model: sessionForRequest.model,
        generatedAt: new Date().toISOString(),
        reflectionLevel: providerRequest.reflectionLevel,
        result,
      };
      return draft;
    },
  );

  ipcMain.handle(
    'quarterly:save',
    async (event, request: SaveQuarterlySummaryRequest) => {
      assertTrustedSender(event.senderFrame?.url ?? '');
      const safe = sanitizeQuarterlyDraft(request?.draft);
      storageRoot ??= getDefaultStorageRoot();
      const year = safe.draft.quarterKey.slice(0, 4);
      const directory = path.join(storageRoot, year, '분기정리');
      await mkdir(directory, { recursive: true });
      const id = randomUUID();
      const createdAt = new Date().toISOString();
      const filePath = await findAvailableFilePath(
        directory,
        `${safe.draft.quarterKey}_분기교무수첩`,
      );
      await writeFile(
        filePath,
        buildQuarterlyMarkdown({
          id,
          draft: safe.draft,
          records: safe.records,
          createdAt,
          appVersion: app.getVersion(),
        }),
        { encoding: 'utf8' },
      );
      const summary = createQuarterlySummary({
        id,
        quarterKey: safe.draft.quarterKey,
        quarterStart: safe.draft.quarterStart,
        quarterEnd: safe.draft.quarterEnd,
        recordIds: safe.draft.recordIds,
        provider: safe.draft.provider,
        model: safe.draft.model,
        result: safe.draft.result,
        markdownPath: filePath,
        createdAt,
      });
      if (!summary) {
        throw new Error('분기 Markdown은 저장했지만 목록에 추가하지 못했습니다.');
      }
      scheduleAutomaticBackup();
      return summary;
    },
  );

  ipcMain.handle('quarterly:show-file', (event, summaryId: string) => {
    assertTrustedSender(event.senderFrame?.url ?? '');
    const summary = typeof summaryId === 'string' ? getQuarterlySummary(summaryId) : null;
    if (!summary) {
      return false;
    }
    shell.showItemInFolder(summary.markdownPath);
    return true;
  });

  ipcMain.handle(
    'semester:get-workspace',
    (event, request: GetSemesterWorkspaceRequest = {}) => {
      assertTrustedSender(event.senderFrame?.url ?? '');
      const range = getSemesterRange(
        typeof request?.semesterKey === 'string' ? request.semesterKey : undefined,
      );
      const records = listRecords({ limit: 1_000 }).filter((record) =>
        record.recordDate >= range.semesterStart && record.recordDate <= range.semesterEnd);
      return {
        ...range,
        records,
        summaries: listSemesterSummaries(range.semesterKey),
      };
    },
  );

  ipcMain.handle(
    'semester:generate',
    async (event, request: GenerateSemesterSummaryRequest) => {
      assertTrustedSender(event.senderFrame?.url ?? '');
      const records = resolveSemesterRecords(
        request?.semesterKey,
        request?.semesterStart,
        request?.semesterEnd,
        request?.recordIds,
      );
      const totalLength = records.reduce((sum, record) => sum + record.content.length, 0);
      if (totalLength > 50_000) {
        throw new Error('선택한 기록이 너무 깁니다. 일부 기록을 해제해 5만 자 이하로 줄여 주세요.');
      }
      for (const record of records) {
        const academicYear = getAcademicYear(new Date(`${record.recordDate}T12:00:00`));
        if (inspectPrivacyContent(record.content, readStudentAliases(academicYear)).length > 0) {
          throw new Error(`${record.recordDate} 기록에 개인정보 후보가 남아 있어 AI 전송을 중단했습니다.`);
        }
      }
      clearExpiredAiSession();
      if (!aiSession) {
        throw new Error('AI 연결이 만료되었거나 연결되지 않았습니다. 메뉴에서 다시 연결해 주세요.');
      }
      const sessionForRequest = aiSession;
      const providerRequest = {
        provider: sessionForRequest.provider,
        model: sessionForRequest.model,
        apiKey: sessionForRequest.apiKey,
        semesterKey: request.semesterKey,
        semesterStart: request.semesterStart,
        semesterEnd: request.semesterEnd,
        reflectionLevel: sanitizeReflectionLevel(request.reflectionLevel),
        records: records.map((record) => ({
          id: record.id,
          recordDate: record.recordDate,
          content: record.content,
          categories: record.categories,
          topics: listRecordTopicNames(record.id),
        })),
      };
      let result;
      try {
        result = await organizeSemesterWithAi(providerRequest);
      } catch (error) {
        const message = error instanceof Error ? error.message : '';
        if (!message.includes('응답 형식') && !message.includes('내용을 작성')) {
          throw error;
        }
        result = await organizeSemesterWithAi(providerRequest);
      }
      sessionForRequest.lastUsedAt = Date.now();
      const draft: SemesterSummaryDraft = {
        semesterKey: request.semesterKey,
        semesterStart: request.semesterStart,
        semesterEnd: request.semesterEnd,
        recordIds: records.map((record) => record.id),
        provider: sessionForRequest.provider,
        model: sessionForRequest.model,
        generatedAt: new Date().toISOString(),
        reflectionLevel: providerRequest.reflectionLevel,
        result,
      };
      return draft;
    },
  );

  ipcMain.handle(
    'semester:save',
    async (event, request: SaveSemesterSummaryRequest) => {
      assertTrustedSender(event.senderFrame?.url ?? '');
      const safe = sanitizeSemesterDraft(request?.draft);
      storageRoot ??= getDefaultStorageRoot();
      const academicYear = safe.draft.semesterKey.slice(0, 4);
      const directory = path.join(storageRoot, academicYear, '학기정리');
      await mkdir(directory, { recursive: true });
      const id = randomUUID();
      const createdAt = new Date().toISOString();
      const filePath = await findAvailableFilePath(
        directory,
        `${safe.draft.semesterKey}_학기교무수첩`,
      );
      await writeFile(
        filePath,
        buildSemesterMarkdown({
          id,
          draft: safe.draft,
          records: safe.records,
          createdAt,
          appVersion: app.getVersion(),
        }),
        { encoding: 'utf8' },
      );
      const summary = createSemesterSummary({
        id,
        semesterKey: safe.draft.semesterKey,
        semesterStart: safe.draft.semesterStart,
        semesterEnd: safe.draft.semesterEnd,
        recordIds: safe.draft.recordIds,
        provider: safe.draft.provider,
        model: safe.draft.model,
        result: safe.draft.result,
        markdownPath: filePath,
        createdAt,
      });
      if (!summary) {
        throw new Error('학기 Markdown은 저장했지만 목록에 추가하지 못했습니다.');
      }
      scheduleAutomaticBackup();
      return summary;
    },
  );

  ipcMain.handle('semester:show-file', (event, summaryId: string) => {
    assertTrustedSender(event.senderFrame?.url ?? '');
    const summary = typeof summaryId === 'string' ? getSemesterSummary(summaryId) : null;
    if (!summary) return false;
    shell.showItemInFolder(summary.markdownPath);
    return true;
  });

  ipcMain.handle(
    'annual:get-workspace',
    (event, request: GetAnnualWorkspaceRequest = {}) => {
      assertTrustedSender(event.senderFrame?.url ?? '');
      const range = getAcademicYearRange(
        typeof request?.academicYear === 'string' ? request.academicYear : undefined,
      );
      const records = listRecords({ limit: 500 }).filter((record) =>
        record.recordDate >= range.yearStart && record.recordDate <= range.yearEnd);
      return {
        ...range,
        records,
        summaries: listAnnualSummaries(range.academicYear),
      };
    },
  );

  ipcMain.handle(
    'annual:generate',
    async (event, request: GenerateAnnualSummaryRequest) => {
      assertTrustedSender(event.senderFrame?.url ?? '');
      const records = resolveAnnualRecords(
        request?.academicYear,
        request?.yearStart,
        request?.yearEnd,
        request?.recordIds,
      );
      const totalLength = records.reduce((sum, record) => sum + record.content.length, 0);
      if (totalLength > 50_000) {
        throw new Error('선택한 기록이 너무 깁니다. 일부 기록을 해제해 5만 자 이하로 줄여 주세요.');
      }
      for (const record of records) {
        const academicYear = getAcademicYear(new Date(`${record.recordDate}T12:00:00`));
        if (inspectPrivacyContent(record.content, readStudentAliases(academicYear)).length > 0) {
          throw new Error(`${record.recordDate} 기록에 개인정보 후보가 남아 있어 AI 전송을 중단했습니다.`);
        }
      }
      clearExpiredAiSession();
      if (!aiSession) {
        throw new Error('AI 연결이 만료되었거나 연결되지 않았습니다. 메뉴에서 다시 연결해 주세요.');
      }
      const sessionForRequest = aiSession;
      const providerRequest = {
        provider: sessionForRequest.provider,
        model: sessionForRequest.model,
        apiKey: sessionForRequest.apiKey,
        academicYear: request.academicYear,
        yearStart: request.yearStart,
        yearEnd: request.yearEnd,
        reflectionLevel: sanitizeReflectionLevel(request.reflectionLevel),
        records: records.map((record) => ({
          id: record.id,
          recordDate: record.recordDate,
          content: record.content,
          categories: record.categories,
          topics: listRecordTopicNames(record.id),
        })),
      };
      let result;
      try {
        result = await organizeAnnualWithAi(providerRequest);
      } catch (error) {
        const message = error instanceof Error ? error.message : '';
        if (!message.includes('응답 형식') && !message.includes('내용을 작성')) {
          throw error;
        }
        result = await organizeAnnualWithAi(providerRequest);
      }
      sessionForRequest.lastUsedAt = Date.now();
      const draft: AnnualSummaryDraft = {
        academicYear: request.academicYear,
        yearStart: request.yearStart,
        yearEnd: request.yearEnd,
        recordIds: records.map((record) => record.id),
        provider: sessionForRequest.provider,
        model: sessionForRequest.model,
        generatedAt: new Date().toISOString(),
        reflectionLevel: providerRequest.reflectionLevel,
        result,
      };
      return draft;
    },
  );

  ipcMain.handle(
    'annual:save',
    async (event, request: SaveAnnualSummaryRequest) => {
      assertTrustedSender(event.senderFrame?.url ?? '');
      const safe = sanitizeAnnualDraft(request?.draft);
      storageRoot ??= getDefaultStorageRoot();
      const directory = path.join(storageRoot, safe.draft.academicYear, '연간정리');
      await mkdir(directory, { recursive: true });
      const id = randomUUID();
      const createdAt = new Date().toISOString();
      const filePath = await findAvailableFilePath(
        directory,
        `${safe.draft.academicYear}학년도_연간교무수첩`,
      );
      await writeFile(
        filePath,
        buildAnnualMarkdown({
          id,
          draft: safe.draft,
          records: safe.records,
          createdAt,
          appVersion: app.getVersion(),
        }),
        { encoding: 'utf8' },
      );
      const summary = createAnnualSummary({
        id,
        academicYear: safe.draft.academicYear,
        yearStart: safe.draft.yearStart,
        yearEnd: safe.draft.yearEnd,
        recordIds: safe.draft.recordIds,
        provider: safe.draft.provider,
        model: safe.draft.model,
        result: safe.draft.result,
        markdownPath: filePath,
        createdAt,
      });
      if (!summary) {
        throw new Error('연간 Markdown은 저장했지만 목록에 추가하지 못했습니다.');
      }
      scheduleAutomaticBackup();
      return summary;
    },
  );

  ipcMain.handle('annual:show-file', (event, summaryId: string) => {
    assertTrustedSender(event.senderFrame?.url ?? '');
    const summary = typeof summaryId === 'string' ? getAnnualSummary(summaryId) : null;
    if (!summary) return false;
    shell.showItemInFolder(summary.markdownPath);
    return true;
  });

  ipcMain.handle(
    'project:get-workspace',
    (event, request: GetProjectWorkspaceRequest = {}) => {
      assertTrustedSender(event.senderFrame?.url ?? '');
      const fallback = getDefaultProjectRange();
      const periodStart = typeof request?.periodStart === 'string'
        ? request.periodStart
        : fallback.periodStart;
      const periodEnd = typeof request?.periodEnd === 'string'
        ? request.periodEnd
        : fallback.periodEnd;
      if (!isDateRange(periodStart, periodEnd)) {
        throw new Error('프로젝트 정리 기간을 다시 확인해 주세요.');
      }
      const records = listRecords({ limit: 500 }).filter((record) =>
        record.recordDate >= periodStart && record.recordDate <= periodEnd);
      return {
        periodStart,
        periodEnd,
        records,
        summaries: listProjectSummaries(periodStart, periodEnd),
      };
    },
  );

  ipcMain.handle(
    'project:generate',
    async (event, request: GenerateProjectSummaryRequest) => {
      assertTrustedSender(event.senderFrame?.url ?? '');
      const title = typeof request?.title === 'string'
        ? request.title.trim().normalize('NFC').slice(0, 100)
        : '';
      if (!title) {
        throw new Error('프로젝트 이름을 입력해 주세요.');
      }
      const seedQuestion = typeof request?.seedQuestion === 'string'
        ? request.seedQuestion.trim().normalize('NFC').slice(0, 500)
        : '';
      const records = resolveProjectRecords(
        request?.periodStart,
        request?.periodEnd,
        request?.recordIds,
      );
      const knowledgeChunks = resolveProjectKnowledge(request?.knowledgeChunkIds);
      const totalLength = records.reduce((sum, record) => sum + record.content.length, 0);
      if (totalLength > 50_000) {
        throw new Error('선택한 기록이 너무 깁니다. 일부 기록을 해제해 5만 자 이하로 줄여 주세요.');
      }
      for (const record of records) {
        const academicYear = getAcademicYear(new Date(`${record.recordDate}T12:00:00`));
        if (inspectPrivacyContent(record.content, readStudentAliases(academicYear)).length > 0) {
          throw new Error(`${record.recordDate} 기록에 개인정보 후보가 남아 있어 AI 전송을 중단했습니다.`);
        }
      }
      clearExpiredAiSession();
      if (!aiSession) {
        throw new Error('AI 연결이 만료되었거나 연결되지 않았습니다. 메뉴에서 다시 연결해 주세요.');
      }
      const sessionForRequest = aiSession;
      const providerRequest = {
        provider: sessionForRequest.provider,
        model: sessionForRequest.model,
        apiKey: sessionForRequest.apiKey,
        title,
        seedQuestion,
        periodStart: request.periodStart,
        periodEnd: request.periodEnd,
        reflectionLevel: sanitizeReflectionLevel(request.reflectionLevel),
        records: records.map((record) => ({
          id: record.id,
          recordDate: record.recordDate,
          content: record.content,
          categories: record.categories,
          topics: listRecordTopicNames(record.id),
        })),
        knowledgeChunks,
      };
      let result;
      try {
        result = await organizeProjectWithAi(providerRequest);
      } catch (error) {
        const message = error instanceof Error ? error.message : '';
        if (!message.includes('응답 형식') && !message.includes('내용을 작성')) {
          throw error;
        }
        result = await organizeProjectWithAi(providerRequest);
      }
      sessionForRequest.lastUsedAt = Date.now();
      const draft: ProjectSummaryDraft = {
        title,
        seedQuestion,
        periodStart: request.periodStart,
        periodEnd: request.periodEnd,
        recordIds: records.map((record) => record.id),
        knowledgeChunkIds: knowledgeChunks.map((chunk) => chunk.id),
        provider: sessionForRequest.provider,
        model: sessionForRequest.model,
        generatedAt: new Date().toISOString(),
        reflectionLevel: providerRequest.reflectionLevel,
        result,
      };
      return draft;
    },
  );

  ipcMain.handle(
    'project:save',
    async (event, request: SaveProjectSummaryRequest) => {
      assertTrustedSender(event.senderFrame?.url ?? '');
      const safe = sanitizeProjectDraft(request?.draft);
      storageRoot ??= getDefaultStorageRoot();
      const directory = path.join(storageRoot, safe.draft.periodStart.slice(0, 4), '프로젝트정리');
      await mkdir(directory, { recursive: true });
      const id = randomUUID();
      const createdAt = new Date().toISOString();
      const filePath = await findAvailableFilePath(
        directory,
        `${safe.draft.periodStart}_${sanitizeFilePart(safe.draft.title)}`,
      );
      await writeFile(
        filePath,
        buildProjectMarkdown({
          id,
          draft: safe.draft,
          records: safe.records,
          knowledgeChunks: safe.knowledgeChunks,
          createdAt,
          appVersion: app.getVersion(),
        }),
        { encoding: 'utf8' },
      );
      const summary = createProjectSummary({
        id,
        title: safe.draft.title,
        seedQuestion: safe.draft.seedQuestion,
        periodStart: safe.draft.periodStart,
        periodEnd: safe.draft.periodEnd,
        recordIds: safe.draft.recordIds,
        knowledgeChunkIds: safe.draft.knowledgeChunkIds,
        provider: safe.draft.provider,
        model: safe.draft.model,
        result: safe.draft.result,
        markdownPath: filePath,
        createdAt,
      });
      if (!summary) {
        throw new Error('프로젝트 Markdown은 저장했지만 목록에 추가하지 못했습니다.');
      }
      scheduleAutomaticBackup();
      return summary;
    },
  );

  ipcMain.handle('project:show-file', (event, summaryId: string) => {
    assertTrustedSender(event.senderFrame?.url ?? '');
    const summary = typeof summaryId === 'string' ? getProjectSummary(summaryId) : null;
    if (!summary) return false;
    shell.showItemInFolder(summary.markdownPath);
    return true;
  });

  ipcMain.handle('knowledge:get-state', (event) => {
    assertTrustedSender(event.senderFrame?.url ?? '');
    return getKnowledgeState();
  });

  ipcMain.handle('knowledge:import', async (event, request: ImportKnowledgeRequest) => {
    assertTrustedSender(event.senderFrame?.url ?? '');
    if (!isKnowledgeSourceKind(request?.kind)) {
      throw new Error('교육자료 종류를 다시 선택해 주세요.');
    }
    const selection = await dialog.showOpenDialog({
      title: '잇다에 추가할 교육자료 선택',
      properties: ['openFile', 'multiSelections'],
      filters: [
        { name: '교육자료', extensions: ['pdf', 'docx', 'hwpx', 'hwp', 'md', 'markdown', 'txt'] },
        { name: 'PDF', extensions: ['pdf'] },
        { name: 'Word·한글', extensions: ['docx', 'hwpx', 'hwp'] },
        { name: 'Markdown·텍스트', extensions: ['md', 'markdown', 'txt'] },
      ],
    });
    if (selection.canceled || selection.filePaths.length === 0) return getKnowledgeState();
    if (selection.filePaths.length > 10) {
      throw new Error('교육자료는 한 번에 10개까지 추가할 수 있습니다.');
    }
    storageRoot ??= getDefaultStorageRoot();
    const originalDirectory = path.join(storageRoot, '교육자료', '원본');
    let importedCount = 0;
    for (const filePath of selection.filePaths) {
      const extracted = await extractKnowledgeFile(filePath);
      if (getKnowledgeSourceByHash(extracted.contentHash)) continue;
      const chunks = chunkKnowledgeText(extracted.text);
      if (chunks.length === 0) {
        throw new Error(`‘${extracted.originalName}’에서 검색 가능한 본문을 만들지 못했습니다.`);
      }
      const storedPath = await copyKnowledgeOriginal(extracted.sourcePath, originalDirectory);
      const createdAt = new Date().toISOString();
      const created = createKnowledgeSource({
        id: randomUUID(),
        title: extracted.title,
        originalName: extracted.originalName,
        kind: request.kind,
        fileType: extracted.fileType,
        storedPath,
        contentHash: extracted.contentHash,
        characterCount: extracted.text.length,
        chunks: chunks.map((content) => ({ id: randomUUID(), content })),
        createdAt,
      });
      if (!created) throw new Error('교육자료를 로컬 목록에 추가하지 못했습니다.');
      importedCount += 1;
    }
    if (importedCount > 0) scheduleAutomaticBackup();
    return getKnowledgeState();
  });

  ipcMain.handle('knowledge:remove-source', (event, sourceId: string) => {
    assertTrustedSender(event.senderFrame?.url ?? '');
    if (typeof sourceId === 'string' && removeKnowledgeSource(sourceId)) {
      scheduleAutomaticBackup();
    }
    return getKnowledgeState();
  });

  ipcMain.handle('knowledge:search', (event, request: KnowledgeSearchRequest) => {
    assertTrustedSender(event.senderFrame?.url ?? '');
    const query = typeof request?.query === 'string'
      ? request.query.trim().normalize('NFC').slice(0, 500)
      : '';
    const record = typeof request?.recordId === 'string' ? getRecord(request.recordId) : null;
    if (request?.recordId && (!record || record.deletedAt)) {
      throw new Error('검색에 사용할 교실 기록을 찾지 못했습니다.');
    }
    const searchText = [
      query,
      record?.categories.join(' ') ?? '',
      record ? record.content.slice(0, 4_000) : '',
    ].filter(Boolean).join('\n');
    if (!searchText.trim()) {
      throw new Error('찾고 싶은 교육과정·교육 이론의 관점을 입력하거나 기록을 선택해 주세요.');
    }
    return {
      query,
      recordId: record?.id ?? null,
      hits: rankKnowledgeChunks(searchText, listKnowledgeChunksForSearch(), 10),
    };
  });

  ipcMain.handle('knowledge:generate-rag', async (event, request: GenerateRagRequest) => {
    assertTrustedSender(event.senderFrame?.url ?? '');
    const evidence = resolveRagEvidence(request?.recordId, request?.chunkIds);
    const query = typeof request?.query === 'string'
      ? request.query.trim().normalize('NFC').slice(0, 500)
      : '';
    const academicYear = getAcademicYear(new Date(`${evidence.record.recordDate}T12:00:00`));
    if (query && inspectPrivacyContent(query, readStudentAliases(academicYear)).length > 0) {
      throw new Error('교사의 질문에 개인정보 후보가 있어 AI 전송을 중단했습니다. 표현을 바꾼 뒤 다시 시도해 주세요.');
    }
    clearExpiredAiSession();
    if (!aiSession) {
      throw new Error('AI 연결이 만료되었거나 연결되지 않았습니다. 메뉴에서 다시 연결해 주세요.');
    }
    const sessionForRequest = aiSession;
    const providerRequest = {
      provider: sessionForRequest.provider,
      model: sessionForRequest.model,
      apiKey: sessionForRequest.apiKey,
      query,
      record: {
        id: evidence.record.id,
        recordDate: evidence.record.recordDate,
        content: evidence.record.content,
        categories: evidence.record.categories,
        topics: listRecordTopicNames(evidence.record.id),
      },
      chunks: evidence.chunks,
    };
    let result;
    try {
      result = await connectRecordToKnowledgeWithAi(providerRequest);
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      if (!message.includes('응답 형식') && !message.includes('내용을 작성')) throw error;
      result = await connectRecordToKnowledgeWithAi(providerRequest);
    }
    sessionForRequest.lastUsedAt = Date.now();
    return {
      recordId: evidence.record.id,
      query,
      chunkIds: evidence.chunks.map((chunk) => chunk.id),
      provider: sessionForRequest.provider,
      model: sessionForRequest.model,
      generatedAt: new Date().toISOString(),
      result,
    };
  });

  ipcMain.handle('knowledge:save-rag', async (event, request: SaveRagRequest) => {
    assertTrustedSender(event.senderFrame?.url ?? '');
    const safe = sanitizeRagDraft(request?.draft);
    storageRoot ??= getDefaultStorageRoot();
    const academicYear = String(getAcademicYear(new Date(`${safe.record.recordDate}T12:00:00`)));
    const directory = path.join(storageRoot, academicYear, '교육자료연결');
    await mkdir(directory, { recursive: true });
    const id = randomUUID();
    const createdAt = new Date().toISOString();
    const filePath = await findAvailableFilePath(
      directory,
      `${safe.record.recordDate}_교육자료연결`,
    );
    await writeFile(filePath, buildRagMarkdown({
      id,
      draft: safe.draft,
      record: safe.record,
      chunks: safe.chunks,
      createdAt,
      appVersion: app.getVersion(),
    }), { encoding: 'utf8' });
    const connection = createRagConnection({
      id,
      recordId: safe.draft.recordId,
      query: safe.draft.query,
      chunkIds: safe.draft.chunkIds,
      provider: safe.draft.provider,
      model: safe.draft.model,
      result: safe.draft.result,
      markdownPath: filePath,
      createdAt,
    });
    if (!connection) throw new Error('교육자료 연결 Markdown은 저장했지만 목록에 추가하지 못했습니다.');
    scheduleAutomaticBackup();
    return connection;
  });

  ipcMain.handle('knowledge:list-rag', (event) => {
    assertTrustedSender(event.senderFrame?.url ?? '');
    return listRagConnections();
  });

  ipcMain.handle('knowledge:show-source', (event, sourceId: string) => {
    assertTrustedSender(event.senderFrame?.url ?? '');
    const source = typeof sourceId === 'string' ? getKnowledgeSource(sourceId) : null;
    if (!source) return false;
    shell.showItemInFolder(source.storedPath);
    return true;
  });

  ipcMain.handle('knowledge:show-rag', (event, connectionId: string) => {
    assertTrustedSender(event.senderFrame?.url ?? '');
    const connection = typeof connectionId === 'string' ? getRagConnection(connectionId) : null;
    if (!connection) return false;
    shell.showItemInFolder(connection.markdownPath);
    return true;
  });

  ipcMain.handle('records:trash', (event, recordId: string) => {
    assertTrustedSender(event.senderFrame?.url ?? '');
    const changed = trashRecord(recordId);
    if (changed) {
      scheduleAutomaticBackup();
    }
    return changed;
  });

  ipcMain.handle('records:restore', (event, recordId: string) => {
    assertTrustedSender(event.senderFrame?.url ?? '');
    const changed = restoreRecord(recordId);
    if (changed) {
      scheduleAutomaticBackup();
    }
    return changed;
  });

  ipcMain.handle('records:show-file', (event, recordId: string) => {
    assertTrustedSender(event.senderFrame?.url ?? '');
    const record = getRecord(recordId);
    if (!record) {
      return false;
    }
    shell.showItemInFolder(record.markdownPath);
    return true;
  });
};

const createWindow = () => {
  mainWindow = new BrowserWindow({
    width: 1180,
    height: 780,
    minWidth: 860,
    minHeight: 640,
    show: false,
    title: '잇다',
    backgroundColor: '#f7f6f2',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.removeMenu();
  mainWindow.once('ready-to-show', () => mainWindow?.show());
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!isTrustedSender(url)) {
      event.preventDefault();
    }
  });

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    void mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    void mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
    );
  }
};

app.whenReady().then(() => {
  databasePath = path.join(app.getPath('userData'), 'itta.sqlite3');
  initializeDatabase(databasePath);
  storageRoot = getSetting('storageRoot');
  registerIpcHandlers();
  session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => {
    callback(false);
  });
  createWindow();
  void maybeCreateDailyBackup().catch(() => {
    // 앱 시작 시 자동 백업 실패는 사용을 막지 않고 백업 화면에서 알립니다.
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('before-quit', () => {
  if (scheduledBackup) {
    clearTimeout(scheduledBackup);
    scheduledBackup = null;
  }
  aiSession = null;
  closeDatabase();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
