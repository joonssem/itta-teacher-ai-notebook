import type { ProjectSummaryResult } from './contracts';

export const PROJECT_SECTION_OPTIONS: Array<{
  id: Exclude<keyof ProjectSummaryResult, 'educationEvidenceConnections'>;
  label: string;
  description: string;
}> = [
  { id: 'overview', label: '프로젝트 한눈에 보기', description: '기록에서 확인되는 프로젝트의 맥락과 핵심 흐름' },
  { id: 'guidingQuestions', label: '이어진 질문', description: '교사와 학생의 탐구를 이끈 질문' },
  { id: 'learningJourney', label: '수업·활동의 흐름', description: '질문에서 탐구와 표현으로 이어진 활동 과정' },
  { id: 'studentArtifacts', label: '학생 산출물', description: '기록에서 확인되거나 보완해서 남길 결과물' },
  { id: 'studentLearningEvidence', label: '학생 배움의 증거', description: '학생의 변화·선택·협력에서 확인되는 배움' },
  { id: 'teacherReflection', label: '교사 성찰', description: '교사의 판단·강점·고민과 다음에 바꿀 점' },
  { id: 'curriculumConnections', label: '교육과정 연결', description: '과목·역량·교육과정과 연결해 볼 지점' },
  { id: 'nextExtensions', label: '다음 확장', description: '후속 수업이나 다음 프로젝트로 이어갈 실천' },
];

const cleanText = (value: unknown, maxLength = 6_000) =>
  typeof value === 'string' ? value.trim().normalize('NFC').slice(0, maxLength) : '';

const cleanList = (value: unknown) => Array.isArray(value)
  ? value.map((item) => cleanText(item, 900)).filter(Boolean).slice(0, 16)
  : [];

export const sanitizeProjectSummaryResult = (
  value: unknown,
  allowedChunkIds: string[] = [],
): ProjectSummaryResult => {
  const result = value && typeof value === 'object'
    ? value as Record<string, unknown>
    : {};
  const allowed = new Set(allowedChunkIds);
  const rawConnections = Array.isArray(result.educationEvidenceConnections)
    ? result.educationEvidenceConnections
    : [];
  const educationEvidenceConnections = rawConnections.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const row = item as Record<string, unknown>;
    const statement = cleanText(row.statement, 1_000);
    const chunkIds = Array.isArray(row.chunkIds)
      ? [...new Set(row.chunkIds.filter((id): id is string =>
        typeof id === 'string' && allowed.has(id)))].slice(0, 3)
      : [];
    return statement && chunkIds.length > 0 ? [{ statement, chunkIds }] : [];
  }).slice(0, 8);
  return {
    overview: cleanText(result.overview),
    guidingQuestions: cleanList(result.guidingQuestions),
    learningJourney: cleanList(result.learningJourney),
    studentArtifacts: cleanList(result.studentArtifacts),
    studentLearningEvidence: cleanList(result.studentLearningEvidence),
    teacherReflection: cleanList(result.teacherReflection),
    curriculumConnections: cleanList(result.curriculumConnections),
    educationEvidenceConnections,
    nextExtensions: cleanList(result.nextExtensions).slice(0, 5),
  };
};

export const hasProjectSummaryContent = (result: ProjectSummaryResult) =>
  Boolean(result.overview)
  || result.educationEvidenceConnections.length > 0
  || PROJECT_SECTION_OPTIONS.some((section) => {
    const value = result[section.id];
    return Array.isArray(value) && value.length > 0;
  });

export const isDateRange = (periodStart: string, periodEnd: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(periodStart)
  && /^\d{4}-\d{2}-\d{2}$/.test(periodEnd)
  && periodStart <= periodEnd;

export const getDefaultProjectRange = () => {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60_000;
  const periodEnd = new Date(now.getTime() - offset).toISOString().slice(0, 10);
  const start = new Date(`${periodEnd}T12:00:00`);
  start.setDate(start.getDate() - 89);
  const periodStart = new Date(start.getTime() - start.getTimezoneOffset() * 60_000)
    .toISOString().slice(0, 10);
  return { periodStart, periodEnd };
};
