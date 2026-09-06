import type { SemesterSummaryResult } from './contracts';

export const SEMESTER_SECTION_OPTIONS: Array<{
  id: keyof SemesterSummaryResult;
  label: string;
  description: string;
}> = [
  { id: 'overview', label: '이번 학기 주요 흐름', description: '한 학기를 관통한 핵심 맥락과 변화' },
  { id: 'periodProgression', label: '시기별 흐름의 변화', description: '학기 초·중·후반에 이어지거나 달라진 점' },
  { id: 'teachingAndCurriculumThreads', label: '수업·교육과정의 연결', description: '여러 달에 걸쳐 발전한 수업과 교육과정의 흐름' },
  { id: 'classroomCultureChanges', label: '학급 문화와 생활지도의 변화', description: '관계와 학급생활에서 누적된 변화' },
  { id: 'strengthsAndGrowth', label: '강점과 성장의 증거', description: '반복해서 확인된 교사의 실천과 성장' },
  { id: 'recurringConcerns', label: '반복된 고민과 질문', description: '다음 학기에도 살펴볼 장기 질문' },
  { id: 'projectOutcomesAndConnections', label: '프로젝트 결과와 연결 후보', description: '학기 동안 만들어진 결과와 확장 가능성' },
  { id: 'reminders', label: '환기할 관점', description: '놓치지 않고 다시 확인할 관점' },
  { id: 'nextSemesterPriorities', label: '다음 학기 우선순위', description: '부담 없이 이어갈 1~3가지 실천' },
];

const cleanText = (value: unknown, maxLength = 5_000) =>
  typeof value === 'string' ? value.trim().normalize('NFC').slice(0, maxLength) : '';

const cleanList = (value: unknown) => Array.isArray(value)
  ? value.map((item) => cleanText(item, 800)).filter(Boolean).slice(0, 12)
  : [];

export const sanitizeSemesterSummaryResult = (value: unknown): SemesterSummaryResult => {
  const result = value && typeof value === 'object'
    ? value as Record<string, unknown>
    : {};
  return {
    overview: cleanText(result.overview),
    periodProgression: cleanList(result.periodProgression),
    teachingAndCurriculumThreads: cleanList(result.teachingAndCurriculumThreads),
    classroomCultureChanges: cleanList(result.classroomCultureChanges),
    strengthsAndGrowth: cleanList(result.strengthsAndGrowth),
    recurringConcerns: cleanList(result.recurringConcerns),
    projectOutcomesAndConnections: cleanList(result.projectOutcomesAndConnections),
    reminders: cleanList(result.reminders),
    nextSemesterPriorities: cleanList(result.nextSemesterPriorities).slice(0, 3),
  };
};

export const hasSemesterSummaryContent = (result: SemesterSummaryResult) =>
  Boolean(result.overview)
  || SEMESTER_SECTION_OPTIONS.some((section) => {
    const value = result[section.id];
    return Array.isArray(value) && value.length > 0;
  });

export const isSemesterKey = (value: string) => /^\d{4}-S[12]$/.test(value);

export const getSemesterRange = (semesterKey?: string) => {
  const now = new Date();
  const month = now.getMonth() + 1;
  const fallbackAcademicYear = month < 3 ? now.getFullYear() - 1 : now.getFullYear();
  const fallbackSemester = month >= 3 && month <= 8 ? 1 : 2;
  const fallback = `${fallbackAcademicYear}-S${fallbackSemester}`;
  const safeSemesterKey = semesterKey && isSemesterKey(semesterKey) ? semesterKey : fallback;
  const [yearText, semesterText] = safeSemesterKey.split('-S');
  const academicYear = Number(yearText);
  const semester = Number(semesterText);
  if (semester === 1) {
    return {
      semesterKey: safeSemesterKey,
      semesterStart: `${academicYear}-03-01`,
      semesterEnd: `${academicYear}-08-31`,
    };
  }
  const endYear = academicYear + 1;
  const lastFebruaryDay = new Date(endYear, 2, 0).getDate();
  return {
    semesterKey: safeSemesterKey,
    semesterStart: `${academicYear}-09-01`,
    semesterEnd: `${endYear}-02-${String(lastFebruaryDay).padStart(2, '0')}`,
  };
};
