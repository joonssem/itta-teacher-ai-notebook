import type {
  AiOrganizationResult,
  AiOrganizeOptions,
  AiPresetId,
  AiSectionId,
} from './contracts';

export const AI_SECTION_OPTIONS: Array<{
  id: AiSectionId;
  label: string;
  description: string;
}> = [
  { id: 'summary', label: '기록 요약', description: '핵심 활동과 맥락을 짧게 정리' },
  { id: 'strengths', label: '발견한 강점', description: '기록에 근거한 교사의 강점 발견' },
  { id: 'reminders', label: '환기할 관점', description: '놓쳤을 수 있는 관점과 확인 사항' },
  { id: 'curriculumConnections', label: '교육 연결', description: '수업·생활지도 원리와 일반적 연결' },
  { id: 'nextActions', label: '다음 실천', description: '작고 구체적인 후속 행동 제안' },
  { id: 'reflectionQuestions', label: '성찰 질문', description: '교사가 스스로 생각해 볼 질문' },
  { id: 'alternativePerspectives', label: '대안적 관점', description: '같은 상황을 다르게 보는 가능성' },
];

export const AI_PRESETS: Array<{
  id: AiPresetId;
  label: string;
  description: string;
  sections: AiSectionId[];
}> = [
  {
    id: 'concise',
    label: '간결하게',
    description: '빠르게 핵심만 확인',
    sections: ['summary', 'reminders', 'nextActions'],
  },
  {
    id: 'balanced',
    label: '균형 있게',
    description: '응원과 성찰을 함께',
    sections: ['summary', 'strengths', 'reminders', 'curriculumConnections', 'nextActions'],
  },
  {
    id: 'deep',
    label: '깊이 있게',
    description: '여러 관점과 질문까지',
    sections: AI_SECTION_OPTIONS.map((section) => section.id),
  },
  {
    id: 'custom',
    label: '직접 구성',
    description: '필요한 항목만 선택',
    sections: [],
  },
];

const cleanText = (value: unknown, maxLength = 2_000) =>
  typeof value === 'string' ? value.trim().normalize('NFC').slice(0, maxLength) : '';

const cleanList = (value: unknown, maxItems = 6, maxLength = 500) =>
  Array.isArray(value)
    ? value.map((item) => cleanText(item, maxLength)).filter(Boolean).slice(0, maxItems)
    : [];

export const sanitizeAiOptions = (value: AiOrganizeOptions): AiOrganizeOptions => {
  const validSections = new Set(AI_SECTION_OPTIONS.map((section) => section.id));
  const sections = [...new Set(
    Array.isArray(value?.sections)
      ? value.sections.filter((section): section is AiSectionId => validSections.has(section))
      : [],
  )];
  if (sections.length === 0) {
    throw new Error('AI가 정리할 항목을 한 개 이상 선택해 주세요.');
  }
  const preset = AI_PRESETS.some((item) => item.id === value?.preset) ? value.preset : 'custom';
  const reflectionLevel = Number.isFinite(value?.reflectionLevel)
    ? Math.min(Math.max(Math.round(value.reflectionLevel), 0), 100)
    : 50;
  return { preset, sections, reflectionLevel };
};

export const sanitizeAiResult = (value: unknown): AiOrganizationResult => {
  const result = value && typeof value === 'object'
    ? value as Record<string, unknown>
    : {};
  return {
    summary: cleanText(result.summary),
    strengths: cleanList(result.strengths),
    reminders: cleanList(result.reminders),
    curriculumConnections: cleanList(result.curriculumConnections),
    nextActions: cleanList(result.nextActions),
    reflectionQuestions: cleanList(result.reflectionQuestions),
    alternativePerspectives: cleanList(result.alternativePerspectives),
    categories: cleanList(result.categories, 5, 30),
    topics: cleanList(result.topics, 5, 50),
  };
};

export const hasSelectedAiContent = (
  result: AiOrganizationResult,
  sections: AiSectionId[],
) => sections.some((section) => {
  const value = result[section];
  return Array.isArray(value) ? value.length > 0 : Boolean(value);
});
