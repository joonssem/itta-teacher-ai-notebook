import type { QuarterlySummaryResult } from './contracts';

export const QUARTERLY_SECTION_OPTIONS: Array<{
  id: keyof QuarterlySummaryResult;
  label: string;
  description: string;
}> = [
  { id: 'overview', label: '이번 분기 주요 흐름', description: '세 달을 관통한 핵심 맥락과 변화' },
  { id: 'monthlyProgression', label: '월별 흐름의 변화', description: '달이 바뀌며 이어지거나 달라진 점' },
  { id: 'teachingProjects', label: '이어진 수업과 프로젝트', description: '여러 주·달에 걸쳐 발전한 수업 활동' },
  { id: 'classroomCultureChanges', label: '학급 문화와 생활지도의 변화', description: '관계와 학급생활에서 나타난 패턴' },
  { id: 'strengthsAndGrowth', label: '강점과 성장의 증거', description: '반복해서 확인된 교사의 실천과 변화' },
  { id: 'recurringConcerns', label: '반복된 고민과 질문', description: '다음 분기에도 살펴볼 장기 질문' },
  { id: 'projectAndCurriculumConnections', label: '프로젝트·교육과정 연결 후보', description: '기록에 근거한 확장 가능성' },
  { id: 'reminders', label: '환기할 관점', description: '놓치지 않고 다시 확인할 관점' },
  { id: 'nextQuarterPriorities', label: '다음 분기 우선순위', description: '부담 없이 이어갈 1~3가지 실천' },
];

const cleanText = (value: unknown, maxLength = 5_000) =>
  typeof value === 'string' ? value.trim().normalize('NFC').slice(0, maxLength) : '';

const cleanList = (value: unknown) => Array.isArray(value)
  ? value.map((item) => cleanText(item, 800)).filter(Boolean).slice(0, 12)
  : [];

export const sanitizeQuarterlySummaryResult = (value: unknown): QuarterlySummaryResult => {
  const result = value && typeof value === 'object'
    ? value as Record<string, unknown>
    : {};
  return {
    overview: cleanText(result.overview),
    monthlyProgression: cleanList(result.monthlyProgression),
    teachingProjects: cleanList(result.teachingProjects),
    classroomCultureChanges: cleanList(result.classroomCultureChanges),
    strengthsAndGrowth: cleanList(result.strengthsAndGrowth),
    recurringConcerns: cleanList(result.recurringConcerns),
    projectAndCurriculumConnections: cleanList(result.projectAndCurriculumConnections),
    reminders: cleanList(result.reminders),
    nextQuarterPriorities: cleanList(result.nextQuarterPriorities).slice(0, 3),
  };
};

export const hasQuarterlySummaryContent = (result: QuarterlySummaryResult) =>
  Boolean(result.overview)
  || QUARTERLY_SECTION_OPTIONS.some((section) => {
    const value = result[section.id];
    return Array.isArray(value) && value.length > 0;
  });

export const isQuarterKey = (value: string) => /^\d{4}-Q[1-4]$/.test(value);

export const getQuarterRange = (quarterKey?: string) => {
  const now = new Date();
  const fallbackQuarter = Math.floor(now.getMonth() / 3) + 1;
  const fallback = `${now.getFullYear()}-Q${fallbackQuarter}`;
  const safeQuarterKey = quarterKey && isQuarterKey(quarterKey) ? quarterKey : fallback;
  const [yearText, quarterText] = safeQuarterKey.split('-Q');
  const year = Number(yearText);
  const quarter = Number(quarterText);
  const startMonth = (quarter - 1) * 3 + 1;
  const endMonth = startMonth + 2;
  const lastDay = new Date(year, endMonth, 0).getDate();
  return {
    quarterKey: safeQuarterKey,
    quarterStart: `${year}-${String(startMonth).padStart(2, '0')}-01`,
    quarterEnd: `${year}-${String(endMonth).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`,
  };
};
