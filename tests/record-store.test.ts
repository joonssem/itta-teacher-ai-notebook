import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { copyFile, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { after, before, test } from 'node:test';

import { strToU8, zipSync } from 'fflate';

import {
  adoptTopicSuggestion,
  createAnnualSummary,
  backupDatabase,
  closeDatabase,
  createMonthlySummary,
  createProjectSummary,
  createKnowledgeSource,
  createQuarterlySummary,
  createRagConnection,
  createSemesterSummary,
  createRecord,
  createStudentAliasRow,
  createTopic,
  createWeeklySummary,
  deleteTopic,
  dismissTopicSuggestion,
  getBackupCounts,
  getDashboardState,
  getKnowledgeChunks,
  getKnowledgeSourceByHash,
  getRecord,
  getSetting,
  getTopicRecordIds,
  initializeDatabase,
  linkRecordToTopic,
  listAllRecordsForBackup,
  listAllAnnualSummariesForBackup,
  listAllMonthlySummariesForBackup,
  listAllProjectSummariesForBackup,
  listAllKnowledgeSourcesForBackup,
  listAllQuarterlySummariesForBackup,
  listAllRagConnectionsForBackup,
  listAllSemesterSummariesForBackup,
  listAllWeeklySummariesForBackup,
  listRecordTopicNames,
  listAnnualSummaries,
  listRecords,
  listMonthlySummaries,
  listProjectSummaries,
  listKnowledgeChunksForSearch,
  listKnowledgeSources,
  listMarkdownDocumentLinksForRecord,
  listQuarterlySummaries,
  listRagConnections,
  listSemesterSummaries,
  listStudentAliasRows,
  listTopicState,
  listWeeklySummaries,
  mergeTopics,
  normalizeTopicName,
  restoreRecord,
  setSetting,
  trashRecord,
  updateRecord,
  updateDashboardCardPreference,
  updateRecordMarkdownPath,
  updateAnnualSummaryMarkdownPath,
  updateMonthlySummaryMarkdownPath,
  updateProjectSummaryMarkdownPath,
  updateKnowledgeSourceStoredPath,
  updateQuarterlySummaryMarkdownPath,
  updateRagConnectionMarkdownPath,
  updateSemesterSummaryMarkdownPath,
  updateTopic,
  updateWeeklySummaryMarkdownPath,
  unlinkRecordFromTopic,
} from '../src/main/database.ts';
import {
  copyBackupMarkdownFiles,
  createBackupBundle,
  inspectBackupBundle,
  isSafeRelativePath,
  listBackupSummaries,
  pruneBackupBundles,
} from '../src/main/backup.ts';
import {
  connectRecordToKnowledgeWithAi,
  organizeAnnualWithAi,
  organizeRecordWithAi,
  organizeMonthlyWithAi,
  organizeProjectWithAi,
  organizeQuarterlyWithAi,
  organizeSemesterWithAi,
  organizeWeeklyWithAi,
  searchRecordsWithAi,
  testAiProviderConnection,
} from '../src/main/ai-providers.ts';
import { buildMarkdown, findAvailableFilePath } from '../src/main/markdown.ts';
import { buildAnnualMarkdown } from '../src/main/annual-markdown.ts';
import { buildWeeklyMarkdown } from '../src/main/weekly-markdown.ts';
import { buildMonthlyMarkdown } from '../src/main/monthly-markdown.ts';
import { buildQuarterlyMarkdown } from '../src/main/quarterly-markdown.ts';
import { buildSemesterMarkdown } from '../src/main/semester-markdown.ts';
import { buildProjectMarkdown } from '../src/main/project-markdown.ts';
import { buildRagMarkdown } from '../src/main/rag-markdown.ts';
import {
  readMarkdownDocumentFile,
  saveMarkdownDocumentFile,
  splitMarkdownDocument,
} from '../src/main/markdown-document.ts';
import { extractKnowledgeFile } from '../src/main/knowledge-files.ts';
import {
  buildGoogleNewsUrl,
  fetchNewsForTopics,
  normalizeNewsTopics,
  parseGoogleNewsRss,
  selectNewsItems,
} from '../src/main/news.ts';
import { sanitizeAiOptions } from '../src/shared/ai.ts';
import type {
  AiOrganizationDraft,
  AiOrganizationResult,
  AnnualSummaryDraft,
  AnnualSummaryResult,
  MonthlySummaryDraft,
  MonthlySummaryResult,
  ProjectSummaryDraft,
  ProjectSummaryResult,
  KnowledgeChunk,
  NewsItem,
  QuarterlySummaryDraft,
  QuarterlySummaryResult,
  RagDraft,
  RagResult,
  SemesterSummaryDraft,
  SemesterSummaryResult,
  TeacherRecord,
  WeeklySummaryDraft,
  WeeklySummaryResult,
} from '../src/shared/contracts.ts';
import {
  applyPrivacyDecisions,
  createStudentAliasLabel,
  getAcademicYear,
  inspectPrivacyContent,
} from '../src/shared/privacy.ts';
import { getMonthRange, sanitizeMonthlySummaryResult } from '../src/shared/monthly.ts';
import { getAcademicYearRange, sanitizeAnnualSummaryResult } from '../src/shared/annual.ts';
import { getQuarterRange, sanitizeQuarterlySummaryResult } from '../src/shared/quarterly.ts';
import { getSemesterRange, sanitizeSemesterSummaryResult } from '../src/shared/semester.ts';
import { sanitizeProjectSummaryResult } from '../src/shared/project.ts';
import {
  chunkKnowledgeText,
  rankKnowledgeChunks,
  sanitizeRagResult,
} from '../src/shared/knowledge.ts';

let testDirectory = '';

const completeAiResult: AiOrganizationResult = {
  summary: '학생들이 마을 문제를 탐구하고 해결책을 발표했다.',
  strengths: ['학생 참여를 이끌어 냈다.'],
  reminders: ['말수가 적은 학생의 참여 경험도 확인해 볼 수 있다.'],
  curriculumConnections: ['공동체 문제를 탐구하는 프로젝트 학습과 연결된다.'],
  nextActions: ['다음 시간에 동료 피드백을 반영하게 한다.'],
  reflectionQuestions: ['모든 학생이 의미 있는 역할을 가졌는가?'],
  alternativePerspectives: ['발표 이외의 방식으로 배움을 표현할 수도 있다.'],
  categories: ['프로젝트수업', '학생참여'],
  topics: ['마을 문제 탐구', '협력적 피드백'],
};

const completeAiDraft: AiOrganizationDraft = {
  provider: 'upstage',
  model: 'solar-pro3',
  generatedAt: '2026-07-25T09:00:00.000Z',
  options: {
    preset: 'balanced',
    sections: ['summary', 'strengths', 'reminders', 'curriculumConnections', 'nextActions'],
    reflectionLevel: 50,
  },
  result: completeAiResult,
};

const completeWeeklyResult: WeeklySummaryResult = {
  overview: '마을 문제 프로젝트와 협력적 피드백이 한 주 동안 이어졌다.',
  teachingActivities: ['마을 문제 조사와 해결책 발표를 진행했다.'],
  classroomGuidance: ['모둠 안에서 역할을 조정했다.'],
  strengths: ['학생의 의견을 다음 활동에 반영했다.'],
  changesAndConcerns: ['발표 참여 방식이 다양해졌다.'],
  reminders: ['말수가 적은 학생의 참여 경험도 확인할 필요가 있다.'],
  nextWeekActions: ['동료 피드백을 반영한 해결책을 다시 공유한다.'],
};

const completeMonthlyResult: MonthlySummaryResult = {
  overview: '마을 문제 프로젝트가 조사에서 피드백을 반영한 재설계로 이어졌다.',
  teachingThreads: ['조사·발표·동료 피드백·재설계의 흐름이 이어졌다.'],
  classroomGuidancePatterns: ['모둠 안에서 학생이 역할을 조정하는 경험을 지원했다.'],
  strengthsAndGrowth: ['학생의 의견을 다음 활동 설계에 반영했다.'],
  recurringConcerns: ['말수가 적은 학생의 참여 방식을 계속 살펴볼 필요가 있다.'],
  projectConnections: ['마을 문제 해결 과정을 장기 프로젝트로 확장할 수 있다.'],
  reminders: ['발표 외의 다양한 표현 방식도 확인할 수 있다.'],
  nextMonthPriorities: ['동료 피드백을 반영한 결과물을 다시 공유한다.'],
};

const completeQuarterlyResult: QuarterlySummaryResult = {
  overview: '마을 문제 프로젝트가 조사에서 피드백과 재설계를 거치며 확장되었다.',
  monthlyProgression: ['첫 달의 조사에서 다음 달 발표와 피드백, 마지막 달 재설계로 이어졌다.'],
  teachingProjects: ['마을 문제 해결 활동이 여러 차시의 프로젝트로 발전했다.'],
  classroomCultureChanges: ['학생이 모둠 역할과 참여 방식을 스스로 조정하는 장면이 늘었다.'],
  strengthsAndGrowth: ['학생 의견을 후속 수업 설계에 반복해서 반영했다.'],
  recurringConcerns: ['말수가 적은 학생의 다양한 참여 방식을 계속 확인할 필요가 있다.'],
  projectAndCurriculumConnections: ['공동체 문제 탐구와 협력적 의사소통을 연결할 수 있다.'],
  reminders: ['발표 이외의 배움 표현 방식도 근거로 남길 수 있다.'],
  nextQuarterPriorities: ['학생 선택의 변화를 짧게라도 꾸준히 기록한다.'],
};

const completeSemesterResult: SemesterSummaryResult = {
  overview: '한 학기 동안 마을 문제 프로젝트가 조사에서 공유와 재설계로 발전했다.',
  periodProgression: ['학기 초 질문 만들기에서 중반 조사, 후반 결과 공유와 재설계로 이어졌다.'],
  teachingAndCurriculumThreads: ['공동체 문제 탐구와 협력적 의사소통이 여러 달의 수업을 연결했다.'],
  classroomCultureChanges: ['학생이 모둠 역할과 참여 방식을 스스로 조정하는 장면이 누적되었다.'],
  strengthsAndGrowth: ['학생 의견을 후속 수업 설계에 반복해서 반영했다.'],
  recurringConcerns: ['말수가 적은 학생의 다양한 참여 방식을 계속 확인할 필요가 있다.'],
  projectOutcomesAndConnections: ['조사 결과와 재설계 자료를 다음 프로젝트의 출발점으로 활용할 수 있다.'],
  reminders: ['발표 이외의 배움 표현 방식도 근거로 남길 수 있다.'],
  nextSemesterPriorities: ['학생 선택의 변화를 짧게라도 꾸준히 기록한다.'],
};

const completeAnnualResult: AnnualSummaryResult = {
  overview: '마을 문제 프로젝트와 협력적 학급 문화가 한 학년도 동안 함께 발전했다.',
  semesterProgression: ['1학기의 질문과 조사 경험이 2학기의 결과 공유와 재설계로 이어졌다.'],
  teachingAndCurriculumJourney: ['공동체 문제 탐구와 협력적 의사소통이 수업을 연결하는 축이 되었다.'],
  classroomCultureAndGuidance: ['학생이 모둠 역할과 참여 방식을 조정하는 문화가 점차 자리 잡았다.'],
  strengthsAndGrowth: ['학생 의견을 수업 설계에 반영하는 실천이 한 해 동안 반복되었다.'],
  recurringConcerns: ['말수가 적은 학생의 다양한 참여 증거를 계속 수집할 필요가 있다.'],
  projectOutcomesAndLegacy: ['조사 자료와 재설계 결과물을 다음 학년도 프로젝트 자산으로 남길 수 있다.'],
  reminders: ['발표 외의 다양한 배움 표현 방식도 기록할 수 있다.'],
  nextAcademicYearPriorities: ['학기 초부터 학생 선택의 변화를 짧게 기록한다.'],
};

const completeProjectResult: ProjectSummaryResult = {
  overview: '마을 문제를 발견하고 조사한 뒤 해결안을 만들고 동료 피드백으로 개선한 프로젝트다.',
  guidingQuestions: ['우리 마을에서 바꾸고 싶은 문제는 무엇인가?'],
  learningJourney: ['문제 발견 → 현장 조사 → 해결안 표현 → 동료 피드백 → 재설계로 이어졌다.'],
  studentArtifacts: ['마을 문제 조사 기록과 개선된 해결안'],
  studentLearningEvidence: ['학생이 동료 의견을 반영해 해결안의 근거와 표현 방식을 바꾸었다.'],
  teacherReflection: ['학생의 의견을 후속 활동 설계에 반영한 점이 강점이다.'],
  curriculumConnections: ['공동체 문제 탐구와 협력적 의사소통의 연결 후보가 보인다.'],
  educationEvidenceConnections: [{
    statement: '학생이 실제 공동체 문제를 탐구하고 해결안을 공유하는 과정은 프로젝트 학습의 핵심 원리와 연결된다.',
    chunkIds: ['project-knowledge-a'],
  }],
  nextExtensions: ['학생 산출물의 변화 전후를 함께 보관한다.'],
};

const projectKnowledgeChunk: KnowledgeChunk = {
  id: 'project-knowledge-a',
  sourceId: 'project-source-a',
  sourceTitle: '프로젝트 학습 원리',
  sourceKind: 'theory',
  chunkIndex: 0,
  content: '프로젝트 학습은 실제 문제를 중심으로 학생이 탐구하고 결과물을 공유하며 성찰하는 과정을 강조한다.',
};

const completeRagResult: RagResult = {
  overview: '교사의 프로젝트 수업 기록은 공동체 문제 탐구와 학생 참여를 강조한 교육자료와 연결된다.',
  connections: [{
    statement: '학생이 실제 공동체 문제를 탐구하고 해결안을 공유한 활동이 자료의 탐구 원리와 맞닿아 있다.',
    chunkIds: ['knowledge-chunk-a'],
  }],
  encouragements: ['학생의 삶과 수업 내용을 연결한 점이 구체적인 강점이다.'],
  reminders: ['발표 외의 다양한 참여 증거도 함께 기록해 볼 수 있다.'],
  reflectionQuestions: ['학생이 문제를 선택하고 조정한 장면은 무엇이었는가?'],
  nextActions: ['다음 차시에 학생 선택이 바뀐 이유를 한 문장으로 기록한다.'],
};

before(async () => {
  testDirectory = await mkdtemp(path.join(tmpdir(), 'itta-record-store-'));
  initializeDatabase(path.join(testDirectory, 'itta.sqlite3'));
});

after(async () => {
  closeDatabase();
  await rm(testDirectory, { recursive: true, force: true });
});

test('설정과 기록의 전체 수명주기를 로컬에 보관한다', async () => {
  const storageRoot = path.join(testDirectory, 'records');
  setSetting('storageRoot', storageRoot);
  assert.equal(getSetting('storageRoot'), storageRoot);

  const id = randomUUID();
  const createdAt = new Date().toISOString();
  const markdownPath = await findAvailableFilePath(testDirectory, '2026-07-25_교실기록_프로젝트수업');
  await writeFile(markdownPath, buildMarkdown({
    id,
    content: '모둠별로 마을 문제를 조사하고 해결책을 발표했다.',
    recordDate: '2026-07-25',
    categories: ['프로젝트수업'],
    createdAt,
    appVersion: '0.8.0',
    privacyReviewed: true,
  }), 'utf8');

  const created = createRecord({
    id,
    recordDate: '2026-07-25',
    content: '모둠별로 마을 문제를 조사하고 해결책을 발표했다.',
    categories: ['프로젝트수업'],
    markdownPath,
    createdAt,
  });
  assert.equal(created?.id, id);
  assert.equal(created?.aiStatus, 'none');
  assert.equal(created?.aiReview, null);
  assert.equal(listRecords({ query: '마을' }).length, 1);
  assert.equal(listRecords({ query: '프로젝트수업' }).length, 1);
  assert.equal(listRecords({ query: '2026-07' }).length, 1);

  const updatedContent = '모둠 발표 뒤 친구의 의견을 반영해 해결책을 다듬었다.';
  const updatedCategories = ['프로젝트수업', '협력'];
  await writeFile(markdownPath, buildMarkdown({
    id,
    content: updatedContent,
    recordDate: '2026-07-25',
    categories: updatedCategories,
    createdAt,
    appVersion: '0.8.0',
    privacyReviewed: true,
  }), 'utf8');
  const updated = updateRecord(id, updatedContent, updatedCategories);
  assert.equal(updated?.categories[1], '협력');
  assert.equal(listRecords({ query: '친구의 의견' })[0]?.id, id);

  assert.equal(trashRecord(id), true);
  assert.equal(listRecords().length, 0);
  assert.equal(listRecords({ includeDeleted: true })[0]?.id, id);

  assert.equal(restoreRecord(id), true);
  assert.equal(listRecords()[0]?.id, id);

  const markdown = await readFile(markdownPath, 'utf8');
  assert.match(markdown, new RegExp(`record_id: ${id}`));
  assert.match(markdown, /프로젝트수업/);
  assert.match(markdown, /친구의 의견/);
  assert.match(markdown, /협력/);
  assert.match(markdown, /privacy_reviewed: true/);
});

test('앱 안에서 Markdown 본문만 수정하고 시스템 정보와 이전 원본을 보존한다', async () => {
  const documentDirectory = path.join(testDirectory, 'editable-document');
  const markdownPath = path.join(documentDirectory, '2026-W30_주간교무수첩.md');
  await mkdir(documentDirectory, { recursive: true });
  await writeFile(markdownPath, [
    '---',
    'weekly_summary_id: protected-summary-id',
    'source_record_ids: ["record-a", "record-b"]',
    'teacher_reviewed: true',
    '---',
    '',
    '# 2026년 30주 주간 교무수첩',
    '',
    '## 이번 주 주요 흐름',
    '',
    'AI가 만든 초안입니다.',
    '',
  ].join('\n'), 'utf8');

  const loaded = await readMarkdownDocumentFile(markdownPath);
  assert.equal(loaded.metadataProtected, true);
  assert.equal(loaded.title, '2026년 30주 주간 교무수첩');
  assert.doesNotMatch(loaded.body, /weekly_summary_id/);

  const editedBody = `${loaded.body.replace('AI가 만든 초안입니다.', '교사가 검토하고 수정한 내용입니다.')}\n\n## 다음 실천\n\n- 학생 질문을 다시 확인한다.`;
  const saved = await saveMarkdownDocumentFile(markdownPath, editedBody, loaded.revision);
  const markdown = await readFile(markdownPath, 'utf8');
  assert.match(markdown, /weekly_summary_id: protected-summary-id/);
  assert.match(markdown, /교사가 검토하고 수정한 내용입니다/);
  assert.equal(saved.body, editedBody);
  assert.equal((await readdir(path.join(documentDirectory, '수정이력'))).length, 1);
  assert.match(
    (await readFile(path.join(
      documentDirectory,
      '수정이력',
      (await readdir(path.join(documentDirectory, '수정이력')))[0],
    ), 'utf8')),
    /AI가 만든 초안입니다/,
  );
  await assert.rejects(
    () => saveMarkdownDocumentFile(markdownPath, editedBody, loaded.revision),
    /앱 밖에서 변경/,
  );
  assert.equal(splitMarkdownDocument(markdown).metadataProtected, true);
});

test('학생 이름 대응표를 기록과 분리하여 학년도별로 보관한다', () => {
  createStudentAliasRow({
    id: randomUUID(),
    academic_year: 2026,
    encrypted_name: Buffer.from('encrypted-student-name'),
    alias: '학생 A',
    created_at: new Date().toISOString(),
  });

  const rows = listStudentAliasRows(2026);
  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.alias, '학생 A');
  assert.deepEqual(Buffer.from(rows[0]?.encrypted_name ?? []), Buffer.from('encrypted-student-name'));
});

test('개인정보 후보를 찾아 선택한 표현만 안전한 별칭으로 바꾼다', () => {
  const original = [
    '김민수는 보호자 전화 010-1234-5678로 연락했다.',
    '이메일 minsu@example.com, 주소: 서울시 종로구 사직로 1',
    '계정: minsu77, 주민번호 형태 900101-1234567도 확인했다.',
  ].join('\n');
  const findings = inspectPrivacyContent(original, [{ realName: '김민수', alias: '학생 A' }]);
  const kinds = new Set(findings.map((finding) => finding.kind));

  assert.deepEqual(
    kinds,
    new Set(['student-name', 'phone', 'email', 'address', 'account', 'resident-number']),
  );

  const reviewed = applyPrivacyDecisions(
    original,
    findings,
    findings.map((finding) => ({
      findingId: finding.id,
      replace: true,
      replacement: finding.replacement,
    })),
  );
  assert.doesNotMatch(reviewed, /김민수|010-1234-5678|minsu@example\.com|900101-1234567/);
  assert.match(reviewed, /학생 A|\[전화번호\]|\[이메일\]|\[주민번호\]/);
  assert.equal(createStudentAliasLabel(0), '학생 A');
  assert.equal(createStudentAliasLabel(26), '학생 AA');
  assert.equal(getAcademicYear(new Date('2026-02-28T12:00:00')), 2025);
  assert.equal(getAcademicYear(new Date('2026-03-01T12:00:00')), 2026);
});

test('Upstage 연결 확인에는 고정 시험 문장만 보내고 키를 헤더로 전달한다', async () => {
  const apiKey = 'up_test_session_key';
  const result = await testAiProviderConnection(
    { provider: 'upstage', model: 'solar-pro3', apiKey },
    async (url, init) => {
      assert.equal(url, 'https://api.upstage.ai/v1/chat/completions');
      assert.equal(new Headers(init?.headers).get('Authorization'), `Bearer ${apiKey}`);
      const body = JSON.parse(String(init?.body)) as { messages: Array<{ content: string }> };
      assert.match(body.messages[0]?.content ?? '', /연결 확인/);
      assert.doesNotMatch(String(init?.body), /교실|학생 이름|전화번호/);
      return new Response('{}', { status: 200 });
    },
  );
  assert.equal(result.model, 'solar-pro3');
});

test('Google 연결 확인은 기록 없이 모델 목록만 조회한다', async () => {
  const apiKey = 'google_test_session_key';
  const result = await testAiProviderConnection(
    { provider: 'google', model: 'gemini-3.5-flash', apiKey },
    async (url, init) => {
      assert.equal(url, 'https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000');
      assert.equal(init?.method, 'GET');
      assert.equal(init?.body, undefined);
      assert.equal(new Headers(init?.headers).get('x-goog-api-key'), apiKey);
      return new Response(JSON.stringify({
        models: [{
          name: 'models/gemini-3.5-flash',
          supportedGenerationMethods: ['generateContent'],
        }],
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    },
  );
  assert.equal(result.model, 'gemini-3.5-flash');
});

test('AI 제공자 오류에는 입력한 API 키를 포함하지 않는다', async () => {
  const apiKey = 'up_secret_that_must_not_leak';
  let message = '';
  try {
    await testAiProviderConnection(
      { provider: 'upstage', model: 'solar-pro3', apiKey },
      async () => new Response('{}', { status: 401 }),
    );
  } catch (error) {
    message = String(error);
  }
  assert.match(message, /API 키/);
  assert.doesNotMatch(message, new RegExp(apiKey));
});

test('Upstage에는 비식별 기록과 선택 항목만 보내고 구조화 결과를 받는다', async () => {
  const apiKey = 'up_organization_session_key';
  const result = await organizeRecordWithAi({
    provider: 'upstage',
    model: 'solar-pro3',
    apiKey,
    content: '[학생 A]가 모둠 발표에 참여했다.',
    options: completeAiDraft.options,
  }, async (url, init) => {
    assert.equal(url, 'https://api.upstage.ai/v1/chat/completions');
    assert.equal(new Headers(init?.headers).get('Authorization'), `Bearer ${apiKey}`);
    const body = JSON.parse(String(init?.body)) as {
      response_format: { type: string };
      messages: Array<{ role: string; content: string }>;
    };
    assert.equal(body.response_format.type, 'json_object');
    assert.match(body.messages[1]?.content ?? '', /\[학생 A\]/);
    assert.match(body.messages[1]?.content ?? '', /strengths/);
    assert.doesNotMatch(String(init?.body), /김민수/);
    return new Response(JSON.stringify({
      choices: [{ message: { content: JSON.stringify(completeAiResult) } }],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  });

  assert.equal(result.summary, completeAiResult.summary);
  assert.deepEqual(result.categories, completeAiResult.categories);
});

test('Google 정리는 JSON 응답 스키마를 요구하고 API 키를 본문에 넣지 않는다', async () => {
  const apiKey = 'google_organization_session_key';
  const result = await organizeRecordWithAi({
    provider: 'google',
    model: 'gemini-3.5-flash',
    apiKey,
    content: '[학생 B]와 수업 규칙을 다시 정했다.',
    options: completeAiDraft.options,
  }, async (url, init) => {
    assert.match(url, /gemini-3\.5-flash:generateContent$/);
    assert.equal(new Headers(init?.headers).get('x-goog-api-key'), apiKey);
    const bodyText = String(init?.body);
    const body = JSON.parse(bodyText) as {
      generationConfig: { responseMimeType: string; responseSchema: { required: string[] } };
    };
    assert.equal(body.generationConfig.responseMimeType, 'application/json');
    assert.ok(body.generationConfig.responseSchema.required.includes('summary'));
    assert.doesNotMatch(bodyText, new RegExp(apiKey));
    return new Response(JSON.stringify({
      candidates: [{ content: { parts: [{ text: JSON.stringify(completeAiResult) }] } }],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  });

  assert.deepEqual(result.topics, completeAiResult.topics);
});

test('AI 의미 검색은 허용된 기록 근거만 관련도 순으로 돌려준다', async () => {
  const records = [{
    id: 'record-a',
    recordDate: '2026-07-20',
    content: '[학생 A]가 모둠 역할을 스스로 다시 정했다.',
    categories: ['협력'],
    topics: ['모둠 참여'],
  }, {
    id: 'record-b',
    recordDate: '2026-07-22',
    content: '[학생 B]가 친구의 의견을 듣고 발표 방식을 바꾸었다.',
    categories: ['학생참여'],
    topics: ['협력적 피드백'],
  }];
  const aiPayload = {
    interpretation: '학생이 협력 과정에서 선택을 조정한 기록을 찾았습니다.',
    results: [
      {
        recordId: 'record-b',
        score: 77,
        reason: '친구의 의견을 반영해 발표 방식을 조정했습니다.',
        matchedConcepts: ['의견 반영', '선택 조정'],
      },
      {
        recordId: 'record-a',
        score: 120,
        reason: '모둠 역할을 주도적으로 다시 정했습니다.',
        matchedConcepts: ['학생 주도성', '학생 주도성'],
      },
      {
        recordId: 'record-outside',
        score: 99,
        reason: '제공되지 않은 기록입니다.',
        matchedConcepts: ['제외'],
      },
      {
        recordId: 'record-a',
        score: 10,
        reason: '중복 결과입니다.',
        matchedConcepts: [],
      },
    ],
  };

  const upstageKey = 'up_semantic_session_key';
  const upstage = await searchRecordsWithAi({
    provider: 'upstage',
    model: 'solar-pro3',
    apiKey: upstageKey,
    query: '학생이 스스로 선택을 바꾼 순간',
    records,
  }, async (url, init) => {
    assert.equal(url, 'https://api.upstage.ai/v1/chat/completions');
    const bodyText = String(init?.body);
    assert.match(bodyText, /학생이 스스로 선택을 바꾼 순간/);
    assert.match(bodyText, /record-a/);
    assert.match(bodyText, /record-b/);
    assert.doesNotMatch(bodyText, new RegExp(upstageKey));
    return new Response(JSON.stringify({
      choices: [{ message: { content: JSON.stringify(aiPayload) } }],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  });
  assert.deepEqual(upstage.results.map((result) => result.recordId), ['record-a', 'record-b']);
  assert.equal(upstage.results[0]?.score, 100);
  assert.deepEqual(upstage.results[0]?.matchedConcepts, ['학생 주도성']);

  const googleKey = 'google_semantic_session_key';
  const google = await searchRecordsWithAi({
    provider: 'google',
    model: 'gemini-3.5-flash',
    apiKey: googleKey,
    query: '의견을 듣고 활동을 바꾼 기록',
    records,
  }, async (url, init) => {
    assert.match(url, /gemini-3\.5-flash:generateContent$/);
    assert.equal(new Headers(init?.headers).get('x-goog-api-key'), googleKey);
    const bodyText = String(init?.body);
    const body = JSON.parse(bodyText) as {
      generationConfig: { responseMimeType: string; responseSchema: { required: string[] } };
    };
    assert.equal(body.generationConfig.responseMimeType, 'application/json');
    assert.ok(body.generationConfig.responseSchema.required.includes('results'));
    assert.doesNotMatch(bodyText, new RegExp(googleKey));
    return new Response(JSON.stringify({
      candidates: [{ content: { parts: [{ text: JSON.stringify(aiPayload) }] } }],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  });
  assert.equal(google.interpretation, aiPayload.interpretation);
  assert.equal(google.results.length, 2);
});

test('정리 설정과 AI 결과는 허용된 범위만 남긴다', () => {
  const options = sanitizeAiOptions({
    preset: 'deep',
    sections: ['summary', 'summary', 'reflectionQuestions'],
    reflectionLevel: 125,
  });
  assert.deepEqual(options.sections, ['summary', 'reflectionQuestions']);
  assert.equal(options.reflectionLevel, 100);
  assert.throws(() => sanitizeAiOptions({
    preset: 'custom',
    sections: [],
    reflectionLevel: 50,
  }), /한 개 이상/);
});

test('교사가 채택한 AI 정리만 Markdown과 로컬 데이터베이스에 남긴다', () => {
  const id = randomUUID();
  const markdown = buildMarkdown({
    id,
    content: '[학생 A]가 모둠 발표에 참여했다.',
    recordDate: '2026-07-25',
    categories: completeAiResult.categories,
    createdAt: '2026-07-25T09:10:00.000Z',
    appVersion: '0.8.0',
    privacyReviewed: true,
    aiReview: completeAiDraft,
  });

  assert.match(markdown, /ai_reviewed: true/);
  assert.match(markdown, /topics: \[\]/);
  assert.match(markdown, /topic_suggestions: \["마을 문제 탐구", "협력적 피드백"\]/);
  assert.match(markdown, /provider: "upstage"/);
  assert.match(markdown, /## 발견한 강점/);
  assert.match(markdown, /## 교육과정·교육이론 연결/);
  assert.doesNotMatch(markdown, /## 성찰 질문/);

  const created = createRecord({
    id,
    recordDate: '2026-07-25',
    content: '[학생 A]가 모둠 발표에 참여했다.',
    categories: completeAiResult.categories,
    markdownPath: path.join(testDirectory, `${id}.md`),
    createdAt: '2026-07-25T09:10:00.000Z',
    aiStatus: 'adopted',
    aiReview: completeAiDraft,
  });
  assert.equal(created?.aiStatus, 'adopted');
  assert.equal(created?.aiReview?.result.summary, completeAiResult.summary);
  assert.equal(created?.aiReview?.provider, 'upstage');
});

test('반복된 AI 주제 후보를 교사가 채택·수정·병합·삭제한다', () => {
  const createdIds: string[] = [];
  for (let index = 0; index < 3; index += 1) {
    const id = randomUUID();
    createdIds.push(id);
    createRecord({
      id,
      recordDate: `2026-07-${String(20 + index).padStart(2, '0')}`,
      content: `[학생 ${index + 1}]와 마을 문제를 탐구했다.`,
      categories: ['프로젝트수업'],
      markdownPath: path.join(testDirectory, `${id}.md`),
      createdAt: new Date(Date.UTC(2026, 6, 20 + index)).toISOString(),
      aiStatus: 'adopted',
      aiReview: completeAiDraft,
    });
  }

  const normalizedSuggestion = normalizeTopicName('마을 문제 탐구');
  const suggestion = listTopicState().suggestions.find(
    (item) => item.normalizedName === normalizedSuggestion,
  );
  assert.ok((suggestion?.recordCount ?? 0) >= 3);

  const adopted = adoptTopicSuggestion(normalizedSuggestion, '지역사회 프로젝트');
  assert.equal(adopted.topic.source, 'ai');
  assert.ok(adopted.recordIds.length >= 3);
  assert.ok(listRecordTopicNames(createdIds[0] ?? '').includes('지역사회 프로젝트'));
  assert.ok(listRecords({ topicId: adopted.topic.id }).length >= 3);

  const renamed = updateTopic(adopted.topic.id, { name: '마을 프로젝트', pinned: true });
  assert.equal(renamed.name, '마을 프로젝트');
  assert.equal(renamed.pinned, true);
  assert.ok(listRecords({ query: '마을 프로젝트' }).length >= 3);

  const target = createTopic('프로젝트 학습');
  linkRecordToTopic(target.id, createdIds[0] ?? '');
  assert.ok(listRecordTopicNames(createdIds[0] ?? '').includes('프로젝트 학습'));
  unlinkRecordFromTopic(target.id, createdIds[0] ?? '');
  assert.equal(listRecordTopicNames(createdIds[0] ?? '').includes('프로젝트 학습'), false);

  const merged = mergeTopics(renamed.id, target.id);
  assert.ok(getTopicRecordIds(merged.topic.id).length >= 3);
  assert.equal(listTopicState().topics.some((topic) => topic.id === renamed.id), false);

  const deleted = deleteTopic(target.id);
  assert.ok(deleted.recordIds.length >= 3);
  assert.equal(listTopicState().topics.some((topic) => topic.id === target.id), false);

  const semanticTopic = createTopic('의미 검색 묶음', 'teacher', createdIds.slice(0, 2));
  assert.deepEqual(
    new Set(getTopicRecordIds(semanticTopic.id)),
    new Set(createdIds.slice(0, 2)),
  );

  dismissTopicSuggestion(normalizeTopicName('협력적 피드백'));
  assert.equal(
    listTopicState().suggestions.some((item) => item.name === '협력적 피드백'),
    false,
  );
});

test('기록 조건에 따라 첫 화면 카드가 바뀌고 최대 3개와 교사 선택을 지킨다', () => {
  const currentWeek = getDashboardState(new Date('2026-07-26T12:00:00+09:00'));
  assert.ok(currentWeek.cards.length <= 3);
  assert.ok(currentWeek.cards.some((card) => card.kind === 'weekly-summary'));
  assert.ok(currentWeek.cards.some((card) => card.kind === 'category-pattern'));
  assert.ok(currentWeek.cards.every((card) => card.reason && card.evidenceRecords.length > 0));

  const weeklyCard = currentWeek.cards.find((card) => card.kind === 'weekly-summary');
  assert.ok(weeklyCard);
  updateDashboardCardPreference(weeklyCard.key, { pinned: true });
  const pinned = getDashboardState(new Date('2026-07-26T12:00:00+09:00'));
  assert.equal(pinned.cards[0]?.key, weeklyCard.key);
  assert.equal(pinned.cards[0]?.pinned, true);

  updateDashboardCardPreference(weeklyCard.key, { status: 'hidden' });
  const hidden = getDashboardState(new Date('2026-07-26T12:00:00+09:00'));
  assert.equal(hidden.cards.some((card) => card.key === weeklyCard.key), false);
  assert.equal(hidden.suppressedCards.some((card) => card.key === weeklyCard.key), true);

  updateDashboardCardPreference(weeklyCard.key, { status: 'active', pinned: false });
  const anotherWeek = getDashboardState(new Date('2026-08-20T12:00:00+09:00'));
  assert.equal(anotherWeek.cards.some((card) => card.kind === 'weekly-summary'), false);
  assert.ok(anotherWeek.cards.some((card) => card.kind === 'category-pattern'));
});

test('Upstage와 Google에 선택한 주간 기록만 보내고 구조화 결과를 받는다', async () => {
  const weeklyRecords = [{
    id: 'record-a',
    recordDate: '2026-07-20',
    content: '[학생 A]와 마을 문제를 조사했다.',
    categories: ['프로젝트수업'],
    topics: ['마을 프로젝트'],
  }, {
    id: 'record-b',
    recordDate: '2026-07-22',
    content: '[학생 B]가 해결책 발표에 참여했다.',
    categories: ['프로젝트수업'],
    topics: ['마을 프로젝트'],
  }];

  const upstageKey = 'up_weekly_session_key';
  const upstage = await organizeWeeklyWithAi({
    provider: 'upstage',
    model: 'solar-pro3',
    apiKey: upstageKey,
    weekStart: '2026-07-20',
    weekEnd: '2026-07-26',
    records: weeklyRecords,
    reflectionLevel: 50,
  }, async (url, init) => {
    assert.equal(url, 'https://api.upstage.ai/v1/chat/completions');
    const bodyText = String(init?.body);
    assert.match(bodyText, /record-a/);
    assert.match(bodyText, /record-b/);
    assert.match(bodyText, /teachingActivities/);
    assert.match(bodyText, /nextWeekActions/);
    assert.equal((JSON.parse(bodyText) as { stream: boolean }).stream, true);
    assert.doesNotMatch(bodyText, new RegExp(upstageKey));
    const resultText = JSON.stringify({ result: completeWeeklyResult });
    const splitAt = Math.floor(resultText.length / 2);
    const eventStream = [
      `data: ${JSON.stringify({ choices: [{ delta: { content: resultText.slice(0, splitAt) } }] })}`,
      `data: ${JSON.stringify({ choices: [{ delta: { content: resultText.slice(splitAt) } }] })}`,
      'data: [DONE]',
      '',
    ].join('\n\n');
    return new Response(eventStream, {
      status: 200,
      headers: { 'Content-Type': 'text/event-stream; charset=utf-8' },
    });
  });
  assert.equal(upstage.overview, completeWeeklyResult.overview);

  const googleKey = 'google_weekly_session_key';
  const google = await organizeWeeklyWithAi({
    provider: 'google',
    model: 'gemini-3.5-flash',
    apiKey: googleKey,
    weekStart: '2026-07-20',
    weekEnd: '2026-07-26',
    records: weeklyRecords,
    reflectionLevel: 75,
  }, async (url, init) => {
    assert.match(url, /gemini-3\.5-flash:generateContent$/);
    assert.equal(new Headers(init?.headers).get('x-goog-api-key'), googleKey);
    const bodyText = String(init?.body);
    const body = JSON.parse(bodyText) as {
      generationConfig: { responseMimeType: string; responseSchema: { required: string[] } };
    };
    assert.equal(body.generationConfig.responseMimeType, 'application/json');
    assert.ok(body.generationConfig.responseSchema.required.includes('nextWeekActions'));
    assert.doesNotMatch(bodyText, new RegExp(googleKey));
    return new Response(JSON.stringify({
      candidates: [{ content: { parts: [{ text: JSON.stringify(completeWeeklyResult) }] } }],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  });
  assert.deepEqual(google.nextWeekActions, completeWeeklyResult.nextWeekActions);
});

test('월 범위를 계산하고 Upstage와 Google에서 구조화된 월간 흐름을 받는다', async () => {
  assert.deepEqual(getMonthRange('2028-02'), {
    monthKey: '2028-02',
    monthStart: '2028-02-01',
    monthEnd: '2028-02-29',
  });
  assert.equal(sanitizeMonthlySummaryResult({
    ...completeMonthlyResult,
    nextMonthPriorities: ['하나', '둘', '셋', '넷'],
  }).nextMonthPriorities.length, 3);

  const monthlyRecords = [{
    id: 'monthly-a',
    recordDate: '2026-07-03',
    content: '[학생 A]와 마을 문제를 조사했다.',
    categories: ['프로젝트수업'],
    topics: ['마을 프로젝트'],
  }, {
    id: 'monthly-b',
    recordDate: '2026-07-24',
    content: '[학생 B]가 동료 의견을 반영해 해결책을 고쳤다.',
    categories: ['학생참여'],
    topics: ['협력적 피드백'],
  }];

  const upstageKey = 'up_monthly_session_key';
  const upstage = await organizeMonthlyWithAi({
    provider: 'upstage',
    model: 'solar-pro3',
    apiKey: upstageKey,
    monthKey: '2026-07',
    monthStart: '2026-07-01',
    monthEnd: '2026-07-31',
    records: monthlyRecords,
    reflectionLevel: 50,
  }, async (url, init) => {
    assert.equal(url, 'https://api.upstage.ai/v1/chat/completions');
    const bodyText = String(init?.body);
    assert.match(bodyText, /monthly-a/);
    assert.match(bodyText, /monthly-b/);
    assert.match(bodyText, /teachingThreads/);
    assert.match(bodyText, /nextMonthPriorities/);
    assert.doesNotMatch(bodyText, new RegExp(upstageKey));
    return new Response(JSON.stringify({
      choices: [{ message: { content: JSON.stringify(completeMonthlyResult) } }],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  });
  assert.equal(upstage.overview, completeMonthlyResult.overview);

  const googleKey = 'google_monthly_session_key';
  const google = await organizeMonthlyWithAi({
    provider: 'google',
    model: 'gemini-3.5-flash',
    apiKey: googleKey,
    monthKey: '2026-07',
    monthStart: '2026-07-01',
    monthEnd: '2026-07-31',
    records: monthlyRecords,
    reflectionLevel: 70,
  }, async (url, init) => {
    assert.match(url, /gemini-3\.5-flash:generateContent$/);
    assert.equal(new Headers(init?.headers).get('x-goog-api-key'), googleKey);
    const bodyText = String(init?.body);
    const body = JSON.parse(bodyText) as {
      generationConfig: { responseMimeType: string; responseSchema: { required: string[] } };
    };
    assert.equal(body.generationConfig.responseMimeType, 'application/json');
    assert.ok(body.generationConfig.responseSchema.required.includes('nextMonthPriorities'));
    assert.doesNotMatch(bodyText, new RegExp(googleKey));
    return new Response(JSON.stringify({
      candidates: [{ content: { parts: [{ text: JSON.stringify(completeMonthlyResult) }] } }],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  });
  assert.deepEqual(google.projectConnections, completeMonthlyResult.projectConnections);
});

test('분기 범위를 계산하고 Upstage와 Google에서 구조화된 분기 흐름을 받는다', async () => {
  assert.deepEqual(getQuarterRange('2026-Q4'), {
    quarterKey: '2026-Q4',
    quarterStart: '2026-10-01',
    quarterEnd: '2026-12-31',
  });
  assert.equal(sanitizeQuarterlySummaryResult({
    ...completeQuarterlyResult,
    nextQuarterPriorities: ['하나', '둘', '셋', '넷'],
  }).nextQuarterPriorities.length, 3);

  const quarterlyRecords = [{
    id: 'quarterly-a',
    recordDate: '2026-07-03',
    content: '[학생 A]와 마을 문제를 조사했다.',
    categories: ['프로젝트수업'],
    topics: ['마을 프로젝트'],
  }, {
    id: 'quarterly-b',
    recordDate: '2026-09-18',
    content: '[학생 B]가 동료 의견을 반영해 해결책을 다시 설계했다.',
    categories: ['학생참여'],
    topics: ['협력적 피드백'],
  }];

  const upstageKey = 'up_quarterly_session_key';
  const upstage = await organizeQuarterlyWithAi({
    provider: 'upstage',
    model: 'solar-pro3',
    apiKey: upstageKey,
    quarterKey: '2026-Q3',
    quarterStart: '2026-07-01',
    quarterEnd: '2026-09-30',
    records: quarterlyRecords,
    reflectionLevel: 50,
  }, async (url, init) => {
    assert.equal(url, 'https://api.upstage.ai/v1/chat/completions');
    const bodyText = String(init?.body);
    assert.match(bodyText, /quarterly-a/);
    assert.match(bodyText, /quarterly-b/);
    assert.match(bodyText, /monthlyProgression/);
    assert.match(bodyText, /nextQuarterPriorities/);
    assert.doesNotMatch(bodyText, new RegExp(upstageKey));
    return new Response(JSON.stringify({
      choices: [{ message: { content: JSON.stringify(completeQuarterlyResult) } }],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  });
  assert.equal(upstage.overview, completeQuarterlyResult.overview);

  const googleKey = 'google_quarterly_session_key';
  const google = await organizeQuarterlyWithAi({
    provider: 'google',
    model: 'gemini-3.5-flash',
    apiKey: googleKey,
    quarterKey: '2026-Q3',
    quarterStart: '2026-07-01',
    quarterEnd: '2026-09-30',
    records: quarterlyRecords,
    reflectionLevel: 70,
  }, async (url, init) => {
    assert.match(url, /gemini-3\.5-flash:generateContent$/);
    assert.equal(new Headers(init?.headers).get('x-goog-api-key'), googleKey);
    const bodyText = String(init?.body);
    const body = JSON.parse(bodyText) as {
      generationConfig: { responseMimeType: string; responseSchema: { required: string[] } };
    };
    assert.equal(body.generationConfig.responseMimeType, 'application/json');
    assert.ok(body.generationConfig.responseSchema.required.includes('nextQuarterPriorities'));
    assert.doesNotMatch(bodyText, new RegExp(googleKey));
    return new Response(JSON.stringify({
      candidates: [{ content: { parts: [{ text: JSON.stringify(completeQuarterlyResult) }] } }],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  });
  assert.deepEqual(google.monthlyProgression, completeQuarterlyResult.monthlyProgression);
});

test('학기 범위를 계산하고 Upstage와 Google에서 구조화된 학기 흐름을 받는다', async () => {
  assert.deepEqual(getSemesterRange('2026-S1'), {
    semesterKey: '2026-S1',
    semesterStart: '2026-03-01',
    semesterEnd: '2026-08-31',
  });
  assert.deepEqual(getSemesterRange('2027-S2'), {
    semesterKey: '2027-S2',
    semesterStart: '2027-09-01',
    semesterEnd: '2028-02-29',
  });
  assert.equal(sanitizeSemesterSummaryResult({
    ...completeSemesterResult,
    nextSemesterPriorities: ['하나', '둘', '셋', '넷'],
  }).nextSemesterPriorities.length, 3);

  const semesterRecords = [{
    id: 'semester-a',
    recordDate: '2026-03-12',
    content: '[학생 A]와 마을 문제에 관한 질문을 만들었다.',
    categories: ['프로젝트수업'],
    topics: ['마을 프로젝트'],
  }, {
    id: 'semester-b',
    recordDate: '2026-07-24',
    content: '[학생 B]가 동료 의견을 반영해 결과물을 다시 설계했다.',
    categories: ['학생참여'],
    topics: ['협력적 피드백'],
  }];

  const upstageKey = 'up_semester_session_key';
  const upstage = await organizeSemesterWithAi({
    provider: 'upstage',
    model: 'solar-pro3',
    apiKey: upstageKey,
    semesterKey: '2026-S1',
    semesterStart: '2026-03-01',
    semesterEnd: '2026-08-31',
    records: semesterRecords,
    reflectionLevel: 50,
  }, async (url, init) => {
    assert.equal(url, 'https://api.upstage.ai/v1/chat/completions');
    const bodyText = String(init?.body);
    assert.match(bodyText, /semester-a/);
    assert.match(bodyText, /semester-b/);
    assert.match(bodyText, /periodProgression/);
    assert.match(bodyText, /nextSemesterPriorities/);
    assert.doesNotMatch(bodyText, new RegExp(upstageKey));
    return new Response(JSON.stringify({
      choices: [{ message: { content: JSON.stringify(completeSemesterResult) } }],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  });
  assert.equal(upstage.overview, completeSemesterResult.overview);

  const googleKey = 'google_semester_session_key';
  const google = await organizeSemesterWithAi({
    provider: 'google',
    model: 'gemini-3.5-flash',
    apiKey: googleKey,
    semesterKey: '2026-S1',
    semesterStart: '2026-03-01',
    semesterEnd: '2026-08-31',
    records: semesterRecords,
    reflectionLevel: 70,
  }, async (url, init) => {
    assert.match(url, /gemini-3\.5-flash:generateContent$/);
    assert.equal(new Headers(init?.headers).get('x-goog-api-key'), googleKey);
    const bodyText = String(init?.body);
    const body = JSON.parse(bodyText) as {
      generationConfig: { responseMimeType: string; responseSchema: { required: string[] } };
    };
    assert.equal(body.generationConfig.responseMimeType, 'application/json');
    assert.ok(body.generationConfig.responseSchema.required.includes('nextSemesterPriorities'));
    assert.doesNotMatch(bodyText, new RegExp(googleKey));
    return new Response(JSON.stringify({
      candidates: [{ content: { parts: [{ text: JSON.stringify(completeSemesterResult) }] } }],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  });
  assert.deepEqual(google.periodProgression, completeSemesterResult.periodProgression);
});

test('학년도 범위를 계산하고 Upstage와 Google에서 구조화된 연간 흐름을 받는다', async () => {
  assert.deepEqual(getAcademicYearRange('2027'), {
    academicYear: '2027',
    yearStart: '2027-03-01',
    yearEnd: '2028-02-29',
  });
  assert.equal(sanitizeAnnualSummaryResult({
    ...completeAnnualResult,
    nextAcademicYearPriorities: ['하나', '둘', '셋', '넷'],
  }).nextAcademicYearPriorities.length, 3);

  const annualRecords = [{
    id: 'annual-a',
    recordDate: '2026-03-12',
    content: '[학생 A]와 마을 문제에 관한 질문을 만들었다.',
    categories: ['프로젝트수업'],
    topics: ['마을 프로젝트'],
  }, {
    id: 'annual-b',
    recordDate: '2027-01-20',
    content: '[학생 B]가 동료 의견을 반영해 결과물을 다시 설계했다.',
    categories: ['학생참여'],
    topics: ['협력적 피드백'],
  }];

  const upstageKey = 'up_annual_session_key';
  const upstage = await organizeAnnualWithAi({
    provider: 'upstage',
    model: 'solar-pro3',
    apiKey: upstageKey,
    academicYear: '2026',
    yearStart: '2026-03-01',
    yearEnd: '2027-02-28',
    records: annualRecords,
    reflectionLevel: 50,
  }, async (url, init) => {
    assert.equal(url, 'https://api.upstage.ai/v1/chat/completions');
    const bodyText = String(init?.body);
    assert.match(bodyText, /annual-a/);
    assert.match(bodyText, /annual-b/);
    assert.match(bodyText, /semesterProgression/);
    assert.match(bodyText, /nextAcademicYearPriorities/);
    assert.doesNotMatch(bodyText, new RegExp(upstageKey));
    return new Response(JSON.stringify({
      choices: [{ message: { content: JSON.stringify(completeAnnualResult) } }],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  });
  assert.equal(upstage.overview, completeAnnualResult.overview);

  const googleKey = 'google_annual_session_key';
  const google = await organizeAnnualWithAi({
    provider: 'google',
    model: 'gemini-3.5-flash',
    apiKey: googleKey,
    academicYear: '2026',
    yearStart: '2026-03-01',
    yearEnd: '2027-02-28',
    records: annualRecords,
    reflectionLevel: 70,
  }, async (url, init) => {
    assert.match(url, /gemini-3\.5-flash:generateContent$/);
    assert.equal(new Headers(init?.headers).get('x-goog-api-key'), googleKey);
    const bodyText = String(init?.body);
    const body = JSON.parse(bodyText) as {
      generationConfig: { responseMimeType: string; responseSchema: { required: string[] } };
    };
    assert.equal(body.generationConfig.responseMimeType, 'application/json');
    assert.ok(body.generationConfig.responseSchema.required.includes('nextAcademicYearPriorities'));
    assert.doesNotMatch(bodyText, new RegExp(googleKey));
    return new Response(JSON.stringify({
      candidates: [{ content: { parts: [{ text: JSON.stringify(completeAnnualResult) }] } }],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  });
  assert.deepEqual(google.semesterProgression, completeAnnualResult.semesterProgression);
});

test('Upstage와 Google에서 기록 기반 프로젝트 흐름을 구조화한다', async () => {
  const sanitized = sanitizeProjectSummaryResult({
    ...completeProjectResult,
    educationEvidenceConnections: [{
      statement: '검증할 연결',
      chunkIds: [projectKnowledgeChunk.id, 'fabricated-project-chunk'],
    }],
    nextExtensions: ['하나', '둘', '셋', '넷', '다섯', '여섯'],
  }, [projectKnowledgeChunk.id]);
  assert.equal(sanitized.nextExtensions.length, 5);
  assert.deepEqual(sanitized.educationEvidenceConnections[0]?.chunkIds, [projectKnowledgeChunk.id]);
  const records = [{
    id: 'project-a',
    recordDate: '2026-07-10',
    content: '학생들이 마을 문제를 조사하고 해결안을 스케치했다.',
    categories: ['프로젝트수업'],
    topics: ['마을 프로젝트'],
  }];

  const upstageKey = 'up_project_session_key';
  const upstage = await organizeProjectWithAi({
    provider: 'upstage',
    model: 'solar-pro3',
    apiKey: upstageKey,
    title: '우리 마을 작은 제안',
    seedQuestion: '우리 마을을 어떻게 바꿀 수 있을까?',
    periodStart: '2026-07-01',
    periodEnd: '2026-07-31',
    records,
    knowledgeChunks: [projectKnowledgeChunk],
    reflectionLevel: 50,
  }, async (url, init) => {
    assert.equal(url, 'https://api.upstage.ai/v1/chat/completions');
    const bodyText = String(init?.body);
    assert.match(bodyText, /project-a/);
    assert.match(bodyText, /우리 마을 작은 제안/);
    assert.doesNotMatch(bodyText, new RegExp(upstageKey));
    return new Response(JSON.stringify({
      choices: [{ message: { content: JSON.stringify(completeProjectResult) } }],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  });
  assert.equal(upstage.overview, completeProjectResult.overview);
  assert.deepEqual(upstage.educationEvidenceConnections, completeProjectResult.educationEvidenceConnections);

  const googleKey = 'google_project_session_key';
  const google = await organizeProjectWithAi({
    provider: 'google',
    model: 'gemini-3.5-flash',
    apiKey: googleKey,
    title: '우리 마을 작은 제안',
    seedQuestion: '',
    periodStart: '2026-07-01',
    periodEnd: '2026-07-31',
    records,
    knowledgeChunks: [projectKnowledgeChunk],
    reflectionLevel: 70,
  }, async (url, init) => {
    assert.match(url, /gemini-3\.5-flash:generateContent$/);
    assert.equal(new Headers(init?.headers).get('x-goog-api-key'), googleKey);
    const bodyText = String(init?.body);
    const body = JSON.parse(bodyText) as {
      generationConfig: { responseSchema: { required: string[] } };
    };
    assert.ok(body.generationConfig.responseSchema.required.includes('studentArtifacts'));
    assert.doesNotMatch(bodyText, new RegExp(googleKey));
    return new Response(JSON.stringify({
      candidates: [{ content: { parts: [{ text: JSON.stringify(completeProjectResult) }] } }],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  });
  assert.deepEqual(google.learningJourney, completeProjectResult.learningJourney);
});

test('교사가 채택한 주간 초안을 별도 Markdown과 목록에 저장한다', () => {
  const sourceId = randomUUID();
  const sourceRecord: TeacherRecord = {
    id: sourceId,
    recordDate: '2026-07-20',
    content: '[학생 A]와 마을 문제를 조사했다.',
    categories: ['프로젝트수업'],
    markdownPath: path.join(testDirectory, `${sourceId}.md`),
    createdAt: '2026-07-20T09:00:00.000Z',
    updatedAt: '2026-07-20T09:00:00.000Z',
    deletedAt: null,
    aiStatus: 'adopted',
    aiReview: completeAiDraft,
  };
  const draft: WeeklySummaryDraft = {
    weekStart: '2026-07-20',
    weekEnd: '2026-07-26',
    recordIds: [sourceId],
    provider: 'upstage',
    model: 'solar-pro3',
    generatedAt: '2026-07-26T10:00:00.000Z',
    reflectionLevel: 50,
    result: completeWeeklyResult,
  };
  const summaryId = randomUUID();
  const markdown = buildWeeklyMarkdown({
    id: summaryId,
    draft,
    records: [sourceRecord],
    createdAt: '2026-07-26T10:10:00.000Z',
    appVersion: '0.8.0',
  });
  assert.match(markdown, /teacher_reviewed: true/);
  assert.match(markdown, /## 이번 주 주요 흐름/);
  assert.match(markdown, /## 다음 주의 작은 실천/);
  assert.match(markdown, new RegExp(sourceId));

  const saved = createWeeklySummary({
    id: summaryId,
    weekStart: draft.weekStart,
    weekEnd: draft.weekEnd,
    recordIds: draft.recordIds,
    provider: draft.provider,
    model: draft.model,
    result: draft.result,
    markdownPath: path.join(testDirectory, `${summaryId}.md`),
    createdAt: '2026-07-26T10:10:00.000Z',
  });
  assert.equal(saved?.result.overview, completeWeeklyResult.overview);
  assert.equal(listWeeklySummaries('2026-07-20', '2026-07-26')[0]?.id, summaryId);
  assert.equal(
    getDashboardState(new Date('2026-07-26T12:00:00+09:00')).cards
      .some((card) => card.kind === 'weekly-summary'),
    false,
  );
});

test('교사가 채택한 월간 초안을 별도 Markdown과 목록에 저장한다', async () => {
  const sourceRecord = listRecords({ query: '친구의 의견을 반영해 해결책을 다듬었다' })[0];
  assert.ok(sourceRecord);
  const draft: MonthlySummaryDraft = {
    monthKey: '2026-07',
    monthStart: '2026-07-01',
    monthEnd: '2026-07-31',
    recordIds: [sourceRecord.id],
    provider: 'upstage',
    model: 'solar-pro3',
    generatedAt: '2026-07-31T10:00:00.000Z',
    reflectionLevel: 50,
    result: completeMonthlyResult,
  };
  const summaryId = randomUUID();
  const markdown = buildMonthlyMarkdown({
    id: summaryId,
    draft,
    records: [sourceRecord],
    createdAt: '2026-07-31T10:10:00.000Z',
    appVersion: '0.11.0',
  });
  assert.match(markdown, /teacher_reviewed: true/);
  assert.match(markdown, /## 이번 달 주요 흐름/);
  assert.match(markdown, /## 다음 달 우선순위/);
  assert.match(markdown, new RegExp(sourceRecord.id));

  const markdownPath = path.join(testDirectory, `${summaryId}_monthly.md`);
  await writeFile(markdownPath, markdown, 'utf8');
  const saved = createMonthlySummary({
    id: summaryId,
    monthKey: draft.monthKey,
    monthStart: draft.monthStart,
    monthEnd: draft.monthEnd,
    recordIds: draft.recordIds,
    provider: draft.provider,
    model: draft.model,
    result: draft.result,
    markdownPath,
    createdAt: '2026-07-31T10:10:00.000Z',
  });
  assert.equal(saved?.result.overview, completeMonthlyResult.overview);
  assert.equal(listMonthlySummaries('2026-07')[0]?.id, summaryId);
});

test('교사가 채택한 분기 초안을 별도 Markdown과 목록에 저장한다', async () => {
  const sourceRecord = listRecords({ query: '친구의 의견을 반영해 해결책을 다듬었다' })[0];
  assert.ok(sourceRecord);
  const draft: QuarterlySummaryDraft = {
    quarterKey: '2026-Q3',
    quarterStart: '2026-07-01',
    quarterEnd: '2026-09-30',
    recordIds: [sourceRecord.id],
    provider: 'upstage',
    model: 'solar-pro3',
    generatedAt: '2026-09-30T10:00:00.000Z',
    reflectionLevel: 50,
    result: completeQuarterlyResult,
  };
  const summaryId = randomUUID();
  const markdown = buildQuarterlyMarkdown({
    id: summaryId,
    draft,
    records: [sourceRecord],
    createdAt: '2026-09-30T10:10:00.000Z',
    appVersion: '0.12.0',
  });
  assert.match(markdown, /teacher_reviewed: true/);
  assert.match(markdown, /## 이번 분기 주요 흐름/);
  assert.match(markdown, /## 다음 분기 우선순위/);
  assert.match(markdown, new RegExp(sourceRecord.id));

  const markdownPath = path.join(testDirectory, `${summaryId}_quarterly.md`);
  await writeFile(markdownPath, markdown, 'utf8');
  const saved = createQuarterlySummary({
    id: summaryId,
    quarterKey: draft.quarterKey,
    quarterStart: draft.quarterStart,
    quarterEnd: draft.quarterEnd,
    recordIds: draft.recordIds,
    provider: draft.provider,
    model: draft.model,
    result: draft.result,
    markdownPath,
    createdAt: '2026-09-30T10:10:00.000Z',
  });
  assert.equal(saved?.result.overview, completeQuarterlyResult.overview);
  assert.equal(listQuarterlySummaries('2026-Q3')[0]?.id, summaryId);
});

test('교사가 채택한 학기 초안을 별도 Markdown과 목록에 저장한다', async () => {
  const sourceRecord = listRecords({ query: '친구의 의견을 반영해 해결책을 다듬었다' })[0];
  assert.ok(sourceRecord);
  const draft: SemesterSummaryDraft = {
    semesterKey: '2026-S1',
    semesterStart: '2026-03-01',
    semesterEnd: '2026-08-31',
    recordIds: [sourceRecord.id],
    provider: 'upstage',
    model: 'solar-pro3',
    generatedAt: '2026-08-31T10:00:00.000Z',
    reflectionLevel: 50,
    result: completeSemesterResult,
  };
  const summaryId = randomUUID();
  const markdown = buildSemesterMarkdown({
    id: summaryId,
    draft,
    records: [sourceRecord],
    createdAt: '2026-08-31T10:10:00.000Z',
    appVersion: '0.13.0',
  });
  assert.match(markdown, /teacher_reviewed: true/);
  assert.match(markdown, /## 이번 학기 주요 흐름/);
  assert.match(markdown, /## 다음 학기 우선순위/);
  assert.match(markdown, new RegExp(sourceRecord.id));

  const markdownPath = path.join(testDirectory, `${summaryId}_semester.md`);
  await writeFile(markdownPath, markdown, 'utf8');
  const saved = createSemesterSummary({
    id: summaryId,
    semesterKey: draft.semesterKey,
    semesterStart: draft.semesterStart,
    semesterEnd: draft.semesterEnd,
    recordIds: draft.recordIds,
    provider: draft.provider,
    model: draft.model,
    result: draft.result,
    markdownPath,
    createdAt: '2026-08-31T10:10:00.000Z',
  });
  assert.equal(saved?.result.overview, completeSemesterResult.overview);
  assert.equal(listSemesterSummaries('2026-S1')[0]?.id, summaryId);
});

test('교사가 채택한 연간 초안을 별도 Markdown과 목록에 저장한다', async () => {
  const sourceRecord = listRecords({ query: '친구의 의견을 반영해 해결책을 다듬었다' })[0];
  assert.ok(sourceRecord);
  const draft: AnnualSummaryDraft = {
    academicYear: '2026',
    yearStart: '2026-03-01',
    yearEnd: '2027-02-28',
    recordIds: [sourceRecord.id],
    provider: 'upstage',
    model: 'solar-pro3',
    generatedAt: '2027-02-28T10:00:00.000Z',
    reflectionLevel: 50,
    result: completeAnnualResult,
  };
  const summaryId = randomUUID();
  const markdown = buildAnnualMarkdown({
    id: summaryId,
    draft,
    records: [sourceRecord],
    createdAt: '2027-02-28T10:10:00.000Z',
    appVersion: '0.14.0',
  });
  assert.match(markdown, /teacher_reviewed: true/);
  assert.match(markdown, /## 올해의 교육과정/);
  assert.match(markdown, /## 다음 학년도 우선순위/);
  assert.match(markdown, new RegExp(sourceRecord.id));

  const markdownPath = path.join(testDirectory, `${summaryId}_annual.md`);
  await writeFile(markdownPath, markdown, 'utf8');
  const saved = createAnnualSummary({
    id: summaryId,
    academicYear: draft.academicYear,
    yearStart: draft.yearStart,
    yearEnd: draft.yearEnd,
    recordIds: draft.recordIds,
    provider: draft.provider,
    model: draft.model,
    result: draft.result,
    markdownPath,
    createdAt: '2027-02-28T10:10:00.000Z',
  });
  assert.equal(saved?.result.overview, completeAnnualResult.overview);
  assert.equal(listAnnualSummaries('2026')[0]?.id, summaryId);
});

test('교사가 채택한 프로젝트 초안을 별도 Markdown과 목록에 저장한다', async () => {
  const sourceRecord = listRecords({ query: '친구의 의견을 반영해 해결책을 다듬었다' })[0];
  assert.ok(sourceRecord);
  const draft: ProjectSummaryDraft = {
    title: '우리 마을 작은 제안',
    seedQuestion: '우리 마을의 문제를 어떻게 바꿀 수 있을까?',
    periodStart: '2026-07-01',
    periodEnd: '2026-07-31',
    recordIds: [sourceRecord.id],
    provider: 'upstage',
    model: 'solar-pro3',
    generatedAt: '2026-07-31T10:00:00.000Z',
    reflectionLevel: 50,
    knowledgeChunkIds: [projectKnowledgeChunk.id],
    result: completeProjectResult,
  };
  const summaryId = randomUUID();
  const markdown = buildProjectMarkdown({
    id: summaryId,
    draft,
    records: [sourceRecord],
    knowledgeChunks: [projectKnowledgeChunk],
    createdAt: '2026-07-31T10:10:00.000Z',
    appVersion: '0.19.0',
  });
  assert.match(markdown, /teacher_reviewed: true/);
  assert.match(markdown, /## 이어진 질문/);
  assert.match(markdown, /## 학생 산출물/);
  assert.match(markdown, /## 교사 성찰/);
  assert.match(markdown, /## 교육자료 근거 연결/);
  assert.match(markdown, /## 사용한 교육자료 근거/);
  assert.match(markdown, new RegExp(projectKnowledgeChunk.id));
  assert.match(markdown, new RegExp(sourceRecord.id));

  const markdownPath = path.join(testDirectory, `${summaryId}_project.md`);
  await writeFile(markdownPath, markdown, 'utf8');
  const saved = createProjectSummary({
    id: summaryId,
    title: draft.title,
    seedQuestion: draft.seedQuestion,
    periodStart: draft.periodStart,
    periodEnd: draft.periodEnd,
    recordIds: draft.recordIds,
    knowledgeChunkIds: draft.knowledgeChunkIds,
    provider: draft.provider,
    model: draft.model,
    result: draft.result,
    markdownPath,
    createdAt: '2026-07-31T10:10:00.000Z',
  });
  assert.equal(saved?.result.overview, completeProjectResult.overview);
  assert.deepEqual(saved?.knowledgeChunkIds, [projectKnowledgeChunk.id]);
  assert.equal(listProjectSummaries('2026-07-01', '2026-07-31')[0]?.id, summaryId);
});

test('관심 주제를 정규화하고 Google News RSS에서 안전한 기사만 읽는다', () => {
  assert.deepEqual(
    normalizeNewsTopics(['  프로젝트   학습 ', '디지털 시민교육', '세 번째']),
    ['프로젝트 학습', '디지털 시민교육'],
  );
  assert.match(buildGoogleNewsUrl('프로젝트 학습'), /^https:\/\/news\.google\.com\/rss\/search\?/);
  assert.match(decodeURIComponent(buildGoogleNewsUrl('프로젝트 학습')), /프로젝트 학습 교육/);
  const xml = `<?xml version="1.0"?><rss><channel>
    <item><title>교실 프로젝트 &amp; 학생 선택 - 교육신문</title><link>https://news.google.com/rss/articles/article-a?oc=5</link><pubDate>Sun, 27 Jul 2026 01:00:00 GMT</pubDate><source url="https://example.com">교육신문</source></item>
    <item><title>안전하지 않은 링크</title><link>https://example.com/article-b</link><pubDate>Sun, 27 Jul 2026 02:00:00 GMT</pubDate><source>다른신문</source></item>
  </channel></rss>`;
  const items = parseGoogleNewsRss(xml, '프로젝트 학습');
  assert.equal(items.length, 1);
  assert.equal(items[0]?.source, '교육신문');
  assert.match(items[0]?.title ?? '', /프로젝트 & 학생 선택/);
  assert.equal(new URL(items[0]?.url ?? '').hostname, 'news.google.com');
});

test('두 관심 주제에서 한 건씩 먼저 고르고 중복 없이 최신 소식 세 건만 남긴다', () => {
  const item = (id: string, topic: string, hour: number): NewsItem => ({
    id,
    topic,
    title: `${topic} 소식 ${id}`,
    url: `https://news.google.com/rss/articles/${id}`,
    source: '교육신문',
    publishedAt: `2026-07-27T0${hour}:00:00.000Z`,
  });
  const first = item('a', '프로젝트 학습', 4);
  const selected = selectNewsItems([
    first,
    item('b', '프로젝트 학습', 3),
    item('c', '디지털 시민교육', 2),
    { ...first, id: 'duplicate' },
    item('d', '프로젝트 학습', 1),
  ], ['프로젝트 학습', '디지털 시민교육'], 3);
  assert.equal(selected.length, 3);
  assert.ok(selected.some((news) => news.topic === '프로젝트 학습'));
  assert.ok(selected.some((news) => news.topic === '디지털 시민교육'));
  assert.equal(new Set(selected.map((news) => news.url)).size, 3);
});

test('한 뉴스 주제가 실패해도 성공한 주제의 결과를 돌려준다', async () => {
  const requestedUrls: string[] = [];
  const items = await fetchNewsForTopics(['프로젝트 학습', '디지털 시민교육'], async (url) => {
    requestedUrls.push(url);
    if (decodeURIComponent(url).includes('디지털 시민교육')) {
      return new Response('', { status: 503 });
    }
    return new Response(`<rss><channel><item><title>프로젝트 수업 새 소식</title><link>https://news.google.com/rss/articles/project</link><pubDate>Sun, 27 Jul 2026 03:00:00 GMT</pubDate><source>교육신문</source></item></channel></rss>`, {
      status: 200,
      headers: { 'Content-Type': 'application/xml' },
    });
  });
  assert.equal(requestedUrls.length, 2);
  assert.equal(items.length, 1);
  assert.equal(items[0]?.topic, '프로젝트 학습');
});

test('교육자료를 로컬에서 읽고 나누어 관련 근거를 검색한다', async () => {
  const sourcePath = path.join(testDirectory, '공동체_교육과정.txt');
  await writeFile(sourcePath, [
    '공동체의 실제 문제를 탐구하고 여러 관점에서 해결 방안을 제안한다.',
    '학생은 친구와 협력하여 조사 결과를 표현하고 피드백을 반영한다.',
    '교사는 학생의 선택과 참여 변화를 관찰하고 다음 수업 설계에 활용한다.',
  ].join('\n\n'), 'utf8');
  const extracted = await extractKnowledgeFile(sourcePath);
  const chunkTexts = chunkKnowledgeText(extracted.text, 90, 15);
  assert.equal(extracted.fileType, 'text');
  assert.ok(chunkTexts.length >= 2);

  const created = createKnowledgeSource({
    id: 'knowledge-source-a',
    title: extracted.title,
    originalName: extracted.originalName,
    kind: 'curriculum',
    fileType: extracted.fileType,
    storedPath: sourcePath,
    contentHash: extracted.contentHash,
    characterCount: extracted.text.length,
    chunks: chunkTexts.map((content, index) => ({ id: `knowledge-chunk-${String.fromCharCode(97 + index)}`, content })),
    createdAt: '2026-07-27T02:00:00.000Z',
  });
  assert.equal(created?.chunkCount, chunkTexts.length);
  assert.equal(getKnowledgeSourceByHash(extracted.contentHash)?.id, created?.id);
  assert.equal(listKnowledgeSources()[0]?.id, created?.id);

  const hits = rankKnowledgeChunks('공동체 문제 탐구와 협력', listKnowledgeChunksForSearch(), 5);
  assert.ok(hits.length > 0);
  assert.equal(hits[0]?.sourceId, created?.id);
  assert.ok(hits.every((hit) => hit.score > 0));
  assert.equal(getKnowledgeChunks(hits.map((hit) => hit.id)).length, hits.length);

  const sanitized = sanitizeRagResult({
    ...completeRagResult,
    connections: [{ statement: '근거 연결', chunkIds: ['knowledge-chunk-a', 'fabricated-chunk'] }],
  }, ['knowledge-chunk-a']);
  assert.deepEqual(sanitized.connections[0]?.chunkIds, ['knowledge-chunk-a']);
});

test('DOCX와 HWPX 교육자료의 본문만 로컬에서 읽는다', async () => {
  const docxPath = path.join(testDirectory, '프로젝트_학습.docx');
  await writeFile(docxPath, zipSync({
    '[Content_Types].xml': strToU8('<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>'),
    'word/document.xml': strToU8([
      '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>',
      '<w:p><w:r><w:t>학생이 실제 문제를 함께 탐구한다.</w:t></w:r></w:p>',
      '<w:tbl><w:tr><w:tc><w:p><w:r><w:t>조사 결과</w:t></w:r></w:p></w:tc>',
      '<w:tc><w:p><w:r><w:t>친구의 피드백을 반영한다.</w:t></w:r></w:p></w:tc></w:tr></w:tbl>',
      '<w:p><w:r><w:instrText>PAGE \\* MERGEFORMAT</w:instrText></w:r>',
      '<w:r><w:delText>삭제된 검토 문장</w:delText></w:r><w:r><w:t>보이는 결론만 남긴다.</w:t></w:r></w:p>',
      '</w:body></w:document>',
    ].join('')),
    'word/header1.xml': strToU8('<w:hdr xmlns:w="urn:word"><w:p><w:r><w:t>프로젝트 학습 자료</w:t></w:r></w:p></w:hdr>'),
    'word/footnotes.xml': strToU8('<w:footnotes xmlns:w="urn:word"><w:footnote w:id="1"><w:p><w:r><w:t>관찰 기록을 다음 설계에 활용한다.</w:t></w:r></w:p></w:footnote></w:footnotes>'),
    'word/media/image1.png': new Uint8Array(2_000_000),
  }));
  const docx = await extractKnowledgeFile(docxPath);
  assert.equal(docx.fileType, 'docx');
  assert.match(docx.text, /실제 문제를 함께 탐구/);
  assert.match(docx.text, /친구의 피드백을 반영/);
  assert.match(docx.text, /프로젝트 학습 자료/);
  assert.match(docx.text, /관찰 기록을 다음 설계에 활용/);
  assert.match(docx.text, /조사 결과\s+친구의 피드백/);
  assert.doesNotMatch(docx.text, /MERGEFORMAT|삭제된 검토 문장/);

  const hwpxPath = path.join(testDirectory, '공동체_교육.hwpx');
  await writeFile(hwpxPath, zipSync({
    mimetype: strToU8('application/hwp+zip'),
    'Contents/section1.xml': strToU8('<hs:sec xmlns:hs="urn:hwp"><hp:p xmlns:hp="urn:hwp"><hp:run><hp:t>두 번째 차시에는 공동 해결안을 발표한다.</hp:t></hp:run></hp:p></hs:sec>'),
    'Contents/section0.xml': strToU8('<hs:sec xmlns:hs="urn:hwp"><hp:p xmlns:hp="urn:hwp"><hp:run><hp:t>첫 번째 차시에는 공동체 문제를 조사한다.<hp:lineBreak/>조사표를 작성한다.</hp:t></hp:run></hp:p><hp:p xmlns:hp="urn:hwp"><hp:run><hp:fieldBegin>숨은 필드 정보</hp:fieldBegin><hp:t>학생 선택<hp:tab/>결과 공유</hp:t></hp:run></hp:p></hs:sec>'),
    'BinData/image1.png': new Uint8Array(2_000_000),
  }));
  const hwpx = await extractKnowledgeFile(hwpxPath);
  assert.equal(hwpx.fileType, 'hwpx');
  assert.match(hwpx.text, /공동체 문제를 조사/);
  assert.match(hwpx.text, /조사표를 작성/);
  assert.match(hwpx.text, /학생 선택\s+결과 공유/);
  assert.match(hwpx.text, /공동 해결안을 발표/);
  assert.doesNotMatch(hwpx.text, /숨은 필드 정보/);
  assert.ok(hwpx.text.indexOf('첫 번째') < hwpx.text.indexOf('두 번째'));
});

test('구형 HWP 교육자료에는 안전한 변환 방법을 안내한다', async () => {
  const hwpPath = path.join(testDirectory, '구형_교육자료.hwp');
  await writeFile(hwpPath, '구형 HWP 시험 파일', 'utf8');
  await assert.rejects(
    extractKnowledgeFile(hwpPath),
    /HWPX, PDF 또는 DOCX로 다시 저장/,
  );
});

test('Upstage와 Google에는 교사가 고른 교육자료 조각만 보내고 허위 인용은 제거한다', async () => {
  const chunks: KnowledgeChunk[] = [{
    id: 'knowledge-chunk-a',
    sourceId: 'knowledge-source-a',
    sourceTitle: '공동체 교육과정',
    sourceKind: 'curriculum',
    chunkIndex: 0,
    content: '공동체의 실제 문제를 탐구하고 여러 관점에서 해결 방안을 제안한다.',
  }];
  const responseResult: RagResult = {
    ...completeRagResult,
    connections: [{
      statement: completeRagResult.connections[0].statement,
      chunkIds: ['knowledge-chunk-a', 'fabricated-chunk'],
    }],
  };
  const baseRequest = {
    query: '이 활동을 공동체 교육과정과 연결해 줘.',
    record: {
      id: 'record-rag-test',
      recordDate: '2026-07-25',
      content: '[학생 A]가 마을 문제 해결안을 발표했다.',
      categories: ['프로젝트수업'],
      topics: ['마을 문제 탐구'],
    },
    chunks,
  };

  const upstage = await connectRecordToKnowledgeWithAi({
    ...baseRequest,
    provider: 'upstage',
    model: 'solar-pro3',
    apiKey: 'up_rag_session_key',
  }, async (_url, init) => {
    const body = JSON.parse(String(init?.body)) as { messages: Array<{ content: string }> };
    assert.match(body.messages[1]?.content ?? '', /knowledge-chunk-a/);
    assert.doesNotMatch(body.messages[1]?.content ?? '', /선택하지 않은 자료/);
    return new Response(JSON.stringify({
      choices: [{ message: { content: JSON.stringify(responseResult) } }],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  });
  assert.deepEqual(upstage.connections[0]?.chunkIds, ['knowledge-chunk-a']);

  const google = await connectRecordToKnowledgeWithAi({
    ...baseRequest,
    provider: 'google',
    model: 'gemini-3.5-flash',
    apiKey: 'google_rag_session_key',
  }, async (_url, init) => {
    const bodyText = String(init?.body);
    const body = JSON.parse(bodyText) as {
      generationConfig: { responseMimeType: string; responseSchema: { required: string[] } };
    };
    assert.equal(body.generationConfig.responseMimeType, 'application/json');
    assert.ok(body.generationConfig.responseSchema.required.includes('connections'));
    assert.doesNotMatch(bodyText, /google_rag_session_key/);
    return new Response(JSON.stringify({
      candidates: [{ content: { parts: [{ text: JSON.stringify(responseResult) }] } }],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  });
  assert.deepEqual(google.connections[0]?.chunkIds, ['knowledge-chunk-a']);
});

test('교사가 채택한 교육자료 연결만 근거와 함께 Markdown과 DB에 저장한다', async () => {
  const sourceRecord = listAllRecordsForBackup().find((record) =>
    record.content.includes('친구의 의견을 반영해 해결책을 다듬었다'));
  assert.ok(sourceRecord);
  const chunks = getKnowledgeChunks(['knowledge-chunk-a']);
  assert.equal(chunks.length, 1);
  const draft: RagDraft = {
    recordId: sourceRecord.id,
    query: '공동체 교육과정과 어떤 연결이 있는가?',
    chunkIds: chunks.map((chunk) => chunk.id),
    provider: 'upstage',
    model: 'solar-pro3',
    generatedAt: '2026-07-27T02:10:00.000Z',
    result: completeRagResult,
  };
  const connectionId = randomUUID();
  const markdown = buildRagMarkdown({
    id: connectionId,
    draft,
    record: sourceRecord,
    chunks,
    createdAt: '2026-07-27T02:20:00.000Z',
    appVersion: '0.15.0',
  });
  assert.match(markdown, /teacher_reviewed: true/);
  assert.match(markdown, /knowledge-chunk-a/);
  assert.match(markdown, /## 사용한 교육자료 근거/);
  const markdownPath = path.join(testDirectory, `${connectionId}_rag.md`);
  await writeFile(markdownPath, markdown, 'utf8');
  const saved = createRagConnection({
    id: connectionId,
    recordId: draft.recordId,
    query: draft.query,
    chunkIds: draft.chunkIds,
    provider: draft.provider,
    model: draft.model,
    result: draft.result,
    markdownPath,
    createdAt: '2026-07-27T02:20:00.000Z',
  });
  assert.equal(saved?.result.overview, completeRagResult.overview);
  assert.equal(listRagConnections()[0]?.id, connectionId);
});

test('캘린더 기간으로 기록을 조회하고 원본 기록에서 정리 문서를 역추적한다', () => {
  const sourceRecord = listAllRecordsForBackup().find((record) =>
    record.content.includes('친구의 의견을 반영해 해결책을 다듬었다'));
  assert.ok(sourceRecord);

  const recordsOnDate = listRecords({
    dateStart: sourceRecord.recordDate,
    dateEnd: sourceRecord.recordDate,
    limit: 500,
  });
  assert.ok(recordsOnDate.some((record) => record.id === sourceRecord.id));
  assert.ok(recordsOnDate.every((record) => record.recordDate === sourceRecord.recordDate));

  const backlinks = listMarkdownDocumentLinksForRecord(sourceRecord.id);
  const kinds = new Set(backlinks.map((link) => link.kind));
  assert.ok(kinds.has('monthly-summary'));
  assert.ok(kinds.has('quarterly-summary'));
  assert.ok(kinds.has('semester-summary'));
  assert.ok(kinds.has('annual-summary'));
  assert.ok(kinds.has('project-summary'));
  assert.ok(kinds.has('rag-connection'));
  assert.ok(backlinks.every((link) => link.title && link.kindLabel && link.createdAt));

  const weeklySourceId = listWeeklySummaries()[0]?.recordIds[0];
  assert.ok(weeklySourceId);
  assert.ok(listMarkdownDocumentLinksForRecord(weeklySourceId)
    .some((link) => link.kind === 'weekly-summary'));
});

test('백업 묶음을 검사하고 새 폴더에 Markdown을 안전하게 복원한다', async () => {
  const backupRoot = path.join(testDirectory, 'backup-bundles');
  const allRecords = listAllRecordsForBackup();
  const allWeeklySummaries = listAllWeeklySummariesForBackup();
  const allMonthlySummaries = listAllMonthlySummariesForBackup();
  const allQuarterlySummaries = listAllQuarterlySummariesForBackup();
  const allSemesterSummaries = listAllSemesterSummariesForBackup();
  const allAnnualSummaries = listAllAnnualSummariesForBackup();
  const allProjectSummaries = listAllProjectSummariesForBackup();
  const sourceRecord = allRecords.find((record) =>
    record.content.includes('친구의 의견을 반영해 해결책을 다듬었다'));
  assert.ok(sourceRecord);

  const createBundle = (baseName: string, records = allRecords) => createBackupBundle({
    parentDirectory: backupRoot,
    baseName,
    kind: 'automatic',
    appVersion: '0.9.0',
    storageRoot: testDirectory,
    counts: getBackupCounts(),
    records,
    weeklySummaries: allWeeklySummaries,
    monthlySummaries: allMonthlySummaries,
    quarterlySummaries: allQuarterlySummaries,
    semesterSummaries: allSemesterSummaries,
    annualSummaries: allAnnualSummaries,
    projectSummaries: allProjectSummaries,
    knowledgeSources: listAllKnowledgeSourcesForBackup(),
    knowledgeConnections: listAllRagConnectionsForBackup(),
    createDatabaseSnapshot: backupDatabase,
  });

  const first = await createBundle('first');
  const inspection = await inspectBackupBundle(first.bundlePath);
  assert.equal(inspection.valid, true);
  assert.equal(
    (inspection.manifest?.files.length ?? 0) + (inspection.manifest?.missingFiles.length ?? 0),
    getBackupCounts().records + getBackupCounts().weeklySummaries
      + getBackupCounts().monthlySummaries + getBackupCounts().quarterlySummaries
      + getBackupCounts().semesterSummaries + getBackupCounts().annualSummaries
      + getBackupCounts().projectSummaries
      + getBackupCounts().knowledgeSources + getBackupCounts().knowledgeConnections,
  );

  const restoreRoot = path.join(testDirectory, 'restored-markdown');
  const restored = await copyBackupMarkdownFiles(inspection, restoreRoot);
  const restoredSource = restored.find((file) => file.entityId === sourceRecord.id);
  assert.ok(restoredSource);
  assert.equal(
    await readFile(restoredSource.destinationPath, 'utf8'),
    await readFile(sourceRecord.markdownPath, 'utf8'),
  );

  const second = await createBundle('second', allRecords.map((record) =>
    record.id === sourceRecord.id
      ? { ...record, markdownPath: path.join(testDirectory, '없음.md') }
      : record));
  const secondInspection = await inspectBackupBundle(second.bundlePath);
  assert.equal(secondInspection.valid, true);
  assert.ok(secondInspection.warnings.some((warning) => warning.includes('원본 Markdown')));
  await createBundle('third');
  assert.equal((await listBackupSummaries(backupRoot)).length, 3);
  await pruneBackupBundles(backupRoot, 2);
  assert.equal((await listBackupSummaries(backupRoot)).length, 2);
  assert.equal(isSafeRelativePath(path.join('2026', '기록.md')), true);
  assert.equal(isSafeRelativePath(path.join('..', '밖.md')), false);
});

test('백업 뒤 생긴 변경을 제외하고 DB와 Markdown 경로를 한 시점으로 되돌린다', async () => {
  const roundTripRoot = path.join(testDirectory, 'round-trip-backups');
  const beforeCounts = getBackupCounts();
  const snapshot = await createBackupBundle({
    parentDirectory: roundTripRoot,
    baseName: 'restore-point',
    kind: 'manual',
    appVersion: '0.9.0',
    storageRoot: testDirectory,
    counts: beforeCounts,
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

  createRecord({
    id: 'created-after-backup',
    recordDate: '2026-07-27',
    content: '백업 뒤에 추가되어 복원 시 제외될 기록',
    categories: ['복원시험'],
    markdownPath: path.join(testDirectory, 'created-after-backup.md'),
    createdAt: '2026-07-27T01:00:00.000Z',
  });
  assert.equal(getBackupCounts().records, beforeCounts.records + 1);

  const restoredDatabasePath = path.join(testDirectory, 'round-trip-restored.sqlite3');
  closeDatabase();
  await copyFile(path.join(snapshot.bundlePath, 'itta.sqlite3'), restoredDatabasePath);
  initializeDatabase(restoredDatabasePath);
  assert.equal(getRecord('created-after-backup'), null);
  assert.deepEqual(getBackupCounts(), beforeCounts);

  const inspection = await inspectBackupBundle(snapshot.bundlePath);
  assert.equal(inspection.valid, true);
  const restoredStorageRoot = path.join(testDirectory, 'round-trip-restored-markdown');
  const restoredFiles = await copyBackupMarkdownFiles(inspection, restoredStorageRoot);
  for (const file of restoredFiles) {
    if (file.entityType === 'record') {
      updateRecordMarkdownPath(file.entityId, file.destinationPath);
    } else if (file.entityType === 'weekly-summary') {
      updateWeeklySummaryMarkdownPath(file.entityId, file.destinationPath);
    } else if (file.entityType === 'monthly-summary') {
      updateMonthlySummaryMarkdownPath(file.entityId, file.destinationPath);
    } else if (file.entityType === 'quarterly-summary') {
      updateQuarterlySummaryMarkdownPath(file.entityId, file.destinationPath);
    } else if (file.entityType === 'semester-summary') {
      updateSemesterSummaryMarkdownPath(file.entityId, file.destinationPath);
    } else if (file.entityType === 'annual-summary') {
      updateAnnualSummaryMarkdownPath(file.entityId, file.destinationPath);
    } else if (file.entityType === 'project-summary') {
      updateProjectSummaryMarkdownPath(file.entityId, file.destinationPath);
    } else if (file.entityType === 'knowledge-source') {
      updateKnowledgeSourceStoredPath(file.entityId, file.destinationPath);
    } else {
      updateRagConnectionMarkdownPath(file.entityId, file.destinationPath);
    }
  }
  setSetting('storageRoot', restoredStorageRoot);
  const linkedRecord = restoredFiles.find((file) => file.entityType === 'record');
  assert.ok(linkedRecord);
  assert.equal(getRecord(linkedRecord.entityId)?.markdownPath, linkedRecord.destinationPath);
  assert.equal(getSetting('storageRoot'), restoredStorageRoot);
});

test('기존 교육자료 DB를 DOCX·HWPX 형식으로 확장해도 자료 연결을 보존한다', () => {
  closeDatabase();
  const legacyPath = path.join(testDirectory, 'legacy-019.sqlite3');
  const legacy = new DatabaseSync(legacyPath);
  legacy.exec(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE knowledge_sources (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      original_name TEXT NOT NULL,
      kind TEXT NOT NULL CHECK (kind IN ('curriculum', 'theory', 'other')),
      file_type TEXT NOT NULL CHECK (file_type IN ('pdf', 'markdown', 'text')),
      stored_path TEXT NOT NULL UNIQUE,
      content_hash TEXT NOT NULL,
      character_count INTEGER NOT NULL CHECK (character_count >= 0),
      chunk_count INTEGER NOT NULL CHECK (chunk_count >= 0),
      created_at TEXT NOT NULL,
      deleted_at TEXT
    ) STRICT;
    CREATE INDEX knowledge_sources_active_index
      ON knowledge_sources(deleted_at, created_at DESC);
    CREATE TABLE knowledge_chunks (
      id TEXT PRIMARY KEY,
      source_id TEXT NOT NULL REFERENCES knowledge_sources(id) ON DELETE CASCADE,
      chunk_index INTEGER NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL,
      UNIQUE (source_id, chunk_index)
    ) STRICT;
    CREATE INDEX knowledge_chunks_source_index
      ON knowledge_chunks(source_id, chunk_index);
    INSERT INTO knowledge_sources VALUES (
      'legacy-source', '기존 교육과정', '기존.pdf', 'curriculum', 'pdf',
      'C:/기존.pdf', 'legacy-hash', 40, 1, '2026-07-27T00:00:00.000Z', NULL
    );
    INSERT INTO knowledge_chunks VALUES (
      'legacy-chunk', 'legacy-source', 0, '기존 교육과정의 검색 가능한 근거 조각입니다.',
      '2026-07-27T00:00:00.000Z'
    );
  `);
  legacy.close();

  initializeDatabase(legacyPath);
  assert.equal(getKnowledgeSourceByHash('legacy-hash')?.fileType, 'pdf');
  assert.equal(getKnowledgeChunks(['legacy-chunk'])[0]?.sourceId, 'legacy-source');
  const created = createKnowledgeSource({
    id: 'new-docx-source',
    title: '새 Word 자료',
    originalName: '새자료.docx',
    kind: 'theory',
    fileType: 'docx',
    storedPath: 'C:/새자료.docx',
    contentHash: 'new-docx-hash',
    characterCount: 40,
    chunks: [{ id: 'new-docx-chunk', content: '새 Word 문서에서 읽은 교육 이론 근거 조각입니다.' }],
    createdAt: '2026-07-28T00:00:00.000Z',
  });
  assert.equal(created?.fileType, 'docx');

  const check = new DatabaseSync(legacyPath, { readOnly: true });
  const table = check.prepare(`
    SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'knowledge_sources'
  `).get() as { sql: string };
  assert.match(table.sql, /'docx'/);
  assert.match(table.sql, /'hwpx'/);
  assert.deepEqual(check.prepare('PRAGMA foreign_key_check').all(), []);
  check.close();
});
