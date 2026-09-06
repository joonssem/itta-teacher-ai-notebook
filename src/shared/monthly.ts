import type { MonthlySummaryResult } from './contracts';

export const MONTHLY_SECTION_OPTIONS: Array<{
  id: keyof MonthlySummaryResult;
  label: string;
  description: string;
}> = [
  { id: 'overview', label: '이번 달 주요 흐름', description: '한 달의 핵심 맥락과 변화' },
  { id: 'teachingThreads', label: '이어진 수업 흐름', description: '여러 날에 걸쳐 이어진 활동과 배움' },
  { id: 'classroomGuidancePatterns', label: '생활지도와 관계의 흐름', description: '반복되거나 달라진 생활지도 맥락' },
  { id: 'strengthsAndGrowth', label: '강점과 성장의 흔적', description: '기록에 근거한 교사의 실천과 변화' },
  { id: 'recurringConcerns', label: '반복된 고민과 질문', description: '계속 살펴볼 필요가 있는 패턴' },
  { id: 'projectConnections', label: '프로젝트로 이어질 연결', description: '수업·주제·활동 사이의 연결 가능성' },
  { id: 'reminders', label: '환기할 관점', description: '놓치지 않고 다시 확인할 관점' },
  { id: 'nextMonthPriorities', label: '다음 달 우선순위', description: '부담 없이 이어갈 1~3가지 실천' },
];

const cleanText = (value: unknown, maxLength = 4_000) =>
  typeof value === 'string' ? value.trim().normalize('NFC').slice(0, maxLength) : '';

const cleanList = (value: unknown) => Array.isArray(value)
  ? value.map((item) => cleanText(item, 700)).filter(Boolean).slice(0, 12)
  : [];

export const sanitizeMonthlySummaryResult = (value: unknown): MonthlySummaryResult => {
  const result = value && typeof value === 'object'
    ? value as Record<string, unknown>
    : {};
  return {
    overview: cleanText(result.overview),
    teachingThreads: cleanList(result.teachingThreads),
    classroomGuidancePatterns: cleanList(result.classroomGuidancePatterns),
    strengthsAndGrowth: cleanList(result.strengthsAndGrowth),
    recurringConcerns: cleanList(result.recurringConcerns),
    projectConnections: cleanList(result.projectConnections),
    reminders: cleanList(result.reminders),
    nextMonthPriorities: cleanList(result.nextMonthPriorities).slice(0, 3),
  };
};

export const hasMonthlySummaryContent = (result: MonthlySummaryResult) =>
  Boolean(result.overview)
  || MONTHLY_SECTION_OPTIONS.some((section) => {
    const value = result[section.id];
    return Array.isArray(value) && value.length > 0;
  });

export const isMonthKey = (value: string) => /^\d{4}-(?:0[1-9]|1[0-2])$/.test(value);

export const getMonthRange = (monthKey?: string) => {
  const now = new Date();
  const fallback = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const safeMonthKey = monthKey && isMonthKey(monthKey) ? monthKey : fallback;
  const [year, month] = safeMonthKey.split('-').map(Number);
  const monthStart = `${safeMonthKey}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const monthEnd = `${safeMonthKey}-${String(lastDay).padStart(2, '0')}`;
  return { monthKey: safeMonthKey, monthStart, monthEnd };
};
