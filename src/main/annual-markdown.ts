import type { AnnualSummaryDraft, TeacherRecord } from '../shared/contracts';

interface AnnualMarkdownInput {
  id: string;
  draft: AnnualSummaryDraft;
  records: TeacherRecord[];
  createdAt: string;
  appVersion: string;
}

const yamlList = (values: string[]) =>
  `[${values.map((value) => JSON.stringify(value.normalize('NFC'))).join(', ')}]`;

const listSection = (title: string, values: string[]) =>
  values.length > 0 ? `## ${title}\n\n${values.map((value) => `- ${value}`).join('\n')}` : '';

export const buildAnnualMarkdown = ({
  id,
  draft,
  records,
  createdAt,
  appVersion,
}: AnnualMarkdownInput) => {
  const sections = [
    draft.result.overview ? `## 올해의 교육과정\n\n${draft.result.overview}` : '',
    listSection('학기별 흐름과 전환', draft.result.semesterProgression),
    listSection('수업·교육과정의 여정', draft.result.teachingAndCurriculumJourney),
    listSection('학급 문화와 생활지도의 변화', draft.result.classroomCultureAndGuidance),
    listSection('교사의 강점과 성장 증거', draft.result.strengthsAndGrowth),
    listSection('이어갈 고민과 질문', draft.result.recurringConcerns),
    listSection('프로젝트 결과와 남은 자산', draft.result.projectOutcomesAndLegacy),
    listSection('환기할 관점', draft.result.reminders),
    listSection('다음 학년도 우선순위', draft.result.nextAcademicYearPriorities),
  ].filter(Boolean).join('\n\n');
  const evidence = records.map((record) =>
    `- ${record.recordDate} · ${record.id} · ${record.categories.join(', ') || '교실기록'}`,
  ).join('\n');

  const frontmatter = [
    '---',
    `annual_summary_id: ${id}`,
    `academic_year: ${draft.academicYear}`,
    `year_start: ${draft.yearStart}`,
    `year_end: ${draft.yearEnd}`,
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

  return `${frontmatter}\n\n# ${draft.academicYear}학년도 연간 교무수첩\n\n${sections}\n\n## 관련 기록과 날짜\n\n${evidence}\n`;
};
