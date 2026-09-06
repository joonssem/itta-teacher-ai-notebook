import type { MonthlySummaryDraft, TeacherRecord } from '../shared/contracts';

interface MonthlyMarkdownInput {
  id: string;
  draft: MonthlySummaryDraft;
  records: TeacherRecord[];
  createdAt: string;
  appVersion: string;
}

const yamlList = (values: string[]) =>
  `[${values.map((value) => JSON.stringify(value.normalize('NFC'))).join(', ')}]`;

const listSection = (title: string, values: string[]) =>
  values.length > 0 ? `## ${title}\n\n${values.map((value) => `- ${value}`).join('\n')}` : '';

export const buildMonthlyMarkdown = ({
  id,
  draft,
  records,
  createdAt,
  appVersion,
}: MonthlyMarkdownInput) => {
  const sections = [
    draft.result.overview ? `## 이번 달 주요 흐름\n\n${draft.result.overview}` : '',
    listSection('이어진 수업 흐름', draft.result.teachingThreads),
    listSection('생활지도와 관계의 흐름', draft.result.classroomGuidancePatterns),
    listSection('강점과 성장의 흔적', draft.result.strengthsAndGrowth),
    listSection('반복된 고민과 질문', draft.result.recurringConcerns),
    listSection('프로젝트로 이어질 연결', draft.result.projectConnections),
    listSection('환기할 관점', draft.result.reminders),
    listSection('다음 달 우선순위', draft.result.nextMonthPriorities),
  ].filter(Boolean).join('\n\n');
  const evidence = records.map((record) =>
    `- ${record.recordDate} · ${record.id} · ${record.categories.join(', ') || '교실기록'}`,
  ).join('\n');

  const frontmatter = [
    '---',
    `monthly_summary_id: ${id}`,
    `month: ${draft.monthKey}`,
    `month_start: ${draft.monthStart}`,
    `month_end: ${draft.monthEnd}`,
    `source_record_ids: ${yamlList(draft.recordIds)}`,
    `provider: ${JSON.stringify(draft.provider)}`,
    `model: ${JSON.stringify(draft.model)}`,
    `reflection_level: ${draft.reflectionLevel}`,
    `ai_generated_at: ${draft.generatedAt}`,
    `created_at: ${createdAt}`,
    `app_version: ${appVersion}`,
    'teacher_reviewed: true',
    '---',
  ].join('\n');

  return `${frontmatter}\n\n# ${draft.monthKey} 월간 교무수첩\n\n${sections}\n\n## 관련 기록과 날짜\n\n${evidence}\n`;
};
