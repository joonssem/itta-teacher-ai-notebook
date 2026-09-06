import type { WeeklySummaryResult } from './contracts';

export const WEEKLY_SECTION_OPTIONS: Array<{
  id: keyof WeeklySummaryResult;
  label: string;
  description: string;
}> = [
  { id: 'overview', label: '이번 주 주요 흐름', description: '한 주의 핵심 맥락과 변화' },
  { id: 'teachingActivities', label: '수업 활동', description: '수업에서 이어진 활동과 배움' },
  { id: 'classroomGuidance', label: '생활지도', description: '관계와 학급생활에서 살펴본 점' },
  { id: 'strengths', label: '발견한 강점', description: '기록에 근거한 교사의 실천 강점' },
  { id: 'changesAndConcerns', label: '변화·반복되는 고민', description: '한 주 동안 드러난 변화와 질문' },
  { id: 'reminders', label: '환기할 관점', description: '놓치지 않고 다시 확인할 관점' },
  { id: 'nextWeekActions', label: '다음 주의 작은 실천', description: '부담 없이 이어갈 구체적 행동' },
];

const cleanText = (value: unknown, maxLength = 3_000) =>
  typeof value === 'string' ? value.trim().normalize('NFC').slice(0, maxLength) : '';

const cleanList = (value: unknown) => Array.isArray(value)
  ? value.map((item) => cleanText(item, 700)).filter(Boolean).slice(0, 10)
  : [];

export const sanitizeWeeklySummaryResult = (value: unknown): WeeklySummaryResult => {
  const result = value && typeof value === 'object'
    ? value as Record<string, unknown>
    : {};
  return {
    overview: cleanText(result.overview),
    teachingActivities: cleanList(result.teachingActivities),
    classroomGuidance: cleanList(result.classroomGuidance),
    strengths: cleanList(result.strengths),
    changesAndConcerns: cleanList(result.changesAndConcerns),
    reminders: cleanList(result.reminders),
    nextWeekActions: cleanList(result.nextWeekActions),
  };
};

export const hasWeeklySummaryContent = (result: WeeklySummaryResult) =>
  Boolean(result.overview)
  || WEEKLY_SECTION_OPTIONS.some((section) => {
    const value = result[section.id];
    return Array.isArray(value) && value.length > 0;
  });

export const sanitizeReflectionLevel = (value: number) => Number.isFinite(value)
  ? Math.min(Math.max(Math.round(value), 0), 100)
  : 50;

export const isDateKey = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value);

const localDateKey = (date: Date) => [
  date.getFullYear(),
  String(date.getMonth() + 1).padStart(2, '0'),
  String(date.getDate()).padStart(2, '0'),
].join('-');

export const getWeekRangeForAnchor = (anchorDate?: string) => {
  const anchor = anchorDate && isDateKey(anchorDate)
    ? new Date(`${anchorDate}T12:00:00`)
    : new Date();
  if (Number.isNaN(anchor.getTime())) {
    throw new Error('주간 정리 날짜를 다시 확인해 주세요.');
  }
  const start = new Date(anchor);
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  return { weekStart: localDateKey(start), weekEnd: localDateKey(end) };
};
