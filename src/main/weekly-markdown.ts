import type { TeacherRecord, WeeklySummaryDraft } from '../shared/contracts';

interface WeeklyMarkdownInput {
  id: string;
  draft: WeeklySummaryDraft;
  records: TeacherRecord[];
  createdAt: string;
  appVersion: string;
}

const yamlList = (values: string[]) =>
  `[${values.map((value) => JSON.stringify(value.normalize('NFC'))).join(', ')}]`;

const listSection = (title: string, values: string[]) =>
  values.length > 0 ? `## ${title}\n\n${values.map((value) => `- ${value}`).join('\n')}` : '';

export const buildWeeklyMarkdown = ({
  id,
  draft,
  records,
  createdAt,
  appVersion,
}: WeeklyMarkdownInput) => {
  const sections = [
    draft.result.overview ? `## 이번 주 주요 흐름\n\n${draft.result.overview}` : '',
    listSection('수업 활동', draft.result.teachingActivities),
    listSection('생활지도', draft.result.classroomGuidance),
    listSection('발견한 강점', draft.result.strengths),
    listSection('변화·반복되는 고민', draft.result.changesAndConcerns),
    listSection('환기할 관점', draft.result.reminders),
    listSection('다음 주의 작은 실천', draft.result.nextWeekActions),
  ].filter(Boolean).join('\n\n');
  const evidence = records.map((record) =>
    `- ${record.recordDate} · ${record.id} · ${record.categories.join(', ') || '교실기록'}`,
  ).join('\n');

  const frontmatter = [
    '---',
    `weekly_summary_id: ${id}`,
    `week_start: ${draft.weekStart}`,
    `week_end: ${draft.weekEnd}`,
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

  return `${frontmatter}\n\n# ${draft.weekStart} ~ ${draft.weekEnd} 주간 교무수첩\n\n${sections}\n\n## 관련 기록과 날짜\n\n${evidence}\n`;
};
