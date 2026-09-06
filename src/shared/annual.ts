import type { AnnualSummaryResult } from './contracts';

export const ANNUAL_SECTION_OPTIONS: Array<{
  id: keyof AnnualSummaryResult;
  label: string;
  description: string;
}> = [
  { id: 'overview', label: '올해의 교육과정', description: '한 학년을 관통한 핵심 맥락과 변화' },
  { id: 'semesterProgression', label: '학기별 흐름과 전환', description: '1·2학기 사이에 이어지고 달라진 점' },
  { id: 'teachingAndCurriculumJourney', label: '수업·교육과정의 여정', description: '수업과 교육과정이 연결되고 발전한 과정' },
  { id: 'classroomCultureAndGuidance', label: '학급 문화와 생활지도의 변화', description: '관계와 학급생활에서 누적된 변화' },
  { id: 'strengthsAndGrowth', label: '교사의 강점과 성장 증거', description: '한 해 동안 반복해서 확인된 실천과 성장' },
  { id: 'recurringConcerns', label: '이어갈 고민과 질문', description: '다음 학년도에도 살펴볼 장기 질문' },
  { id: 'projectOutcomesAndLegacy', label: '프로젝트 결과와 남은 자산', description: '다시 활용하거나 확장할 결과와 연결' },
  { id: 'reminders', label: '환기할 관점', description: '놓치지 않고 다시 확인할 관점' },
  { id: 'nextAcademicYearPriorities', label: '다음 학년도 우선순위', description: '새 학년에 이어갈 1~3가지 실천' },
];

const cleanText = (value: unknown, maxLength = 6_000) =>
  typeof value === 'string' ? value.trim().normalize('NFC').slice(0, maxLength) : '';

const cleanList = (value: unknown) => Array.isArray(value)
  ? value.map((item) => cleanText(item, 900)).filter(Boolean).slice(0, 12)
  : [];

export const sanitizeAnnualSummaryResult = (value: unknown): AnnualSummaryResult => {
  const result = value && typeof value === 'object'
    ? value as Record<string, unknown>
    : {};
  return {
    overview: cleanText(result.overview),
    semesterProgression: cleanList(result.semesterProgression),
    teachingAndCurriculumJourney: cleanList(result.teachingAndCurriculumJourney),
    classroomCultureAndGuidance: cleanList(result.classroomCultureAndGuidance),
    strengthsAndGrowth: cleanList(result.strengthsAndGrowth),
    recurringConcerns: cleanList(result.recurringConcerns),
    projectOutcomesAndLegacy: cleanList(result.projectOutcomesAndLegacy),
    reminders: cleanList(result.reminders),
    nextAcademicYearPriorities: cleanList(result.nextAcademicYearPriorities).slice(0, 3),
  };
};

export const hasAnnualSummaryContent = (result: AnnualSummaryResult) =>
  Boolean(result.overview)
  || ANNUAL_SECTION_OPTIONS.some((section) => {
    const value = result[section.id];
    return Array.isArray(value) && value.length > 0;
  });

export const isAcademicYear = (value: string) => /^\d{4}$/.test(value);

export const getAcademicYearRange = (academicYear?: string) => {
  const now = new Date();
  const fallbackYear = now.getMonth() + 1 < 3 ? now.getFullYear() - 1 : now.getFullYear();
  const safeAcademicYear = academicYear && isAcademicYear(academicYear)
    ? academicYear
    : String(fallbackYear);
  const year = Number(safeAcademicYear);
  const endYear = year + 1;
  const lastFebruaryDay = new Date(endYear, 2, 0).getDate();
  return {
    academicYear: safeAcademicYear,
    yearStart: `${year}-03-01`,
    yearEnd: `${endYear}-02-${String(lastFebruaryDay).padStart(2, '0')}`,
  };
};
