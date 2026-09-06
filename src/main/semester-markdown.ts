import type { SemesterSummaryDraft, TeacherRecord } from '../shared/contracts';

interface SemesterMarkdownInput {
  id: string;
  draft: SemesterSummaryDraft;
  records: TeacherRecord[];
  createdAt: string;
  appVersion: string;
}

const yamlList = (values: string[]) =>
  `[${values.map((value) => JSON.stringify(value.normalize('NFC'))).join(', ')}]`;

const listSection = (title: string, values: string[]) =>
  values.length > 0 ? `## ${title}\n\n${values.map((value) => `- ${value}`).join('\n')}` : '';

export const buildSemesterMarkdown = ({
  id,
  draft,
  records,
  createdAt,
  appVersion,
}: SemesterMarkdownInput) => {
  const sections = [
    draft.result.overview ? `## 이번 학기 주요 흐름\n\n${draft.result.overview}` : '',
    listSection('시기별 흐름의 변화', draft.result.periodProgression),
    listSection('수업·교육과정의 연결', draft.result.teachingAndCurriculumThreads),
    listSection('학급 문화와 생활지도의 변화', draft.result.classroomCultureChanges),
    listSection('강점과 성장의 증거', draft.result.strengthsAndGrowth),
    listSection('반복된 고민과 질문', draft.result.recurringConcerns),
    listSection('프로젝트 결과와 연결 후보', draft.result.projectOutcomesAndConnections),
    listSection('환기할 관점', draft.result.reminders),
    listSection('다음 학기 우선순위', draft.result.nextSemesterPriorities),
  ].filter(Boolean).join('\n\n');
  const evidence = records.map((record) =>
    `- ${record.recordDate} · ${record.id} · ${record.categories.join(', ') || '교실기록'}`,
  ).join('\n');
  const [year, semester] = draft.semesterKey.split('-S');

  const frontmatter = [
    '---',
    `semester_summary_id: ${id}`,
    `semester: ${draft.semesterKey}`,
    `semester_start: ${draft.semesterStart}`,
    `semester_end: ${draft.semesterEnd}`,
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

  return `${frontmatter}\n\n# ${year}학년도 ${semester}학기 교무수첩\n\n${sections}\n\n## 관련 기록과 날짜\n\n${evidence}\n`;
};
