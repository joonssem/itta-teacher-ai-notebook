import type { KnowledgeChunk, ProjectSummaryDraft, TeacherRecord } from '../shared/contracts';

interface ProjectMarkdownInput {
  id: string;
  draft: ProjectSummaryDraft;
  records: TeacherRecord[];
  knowledgeChunks: KnowledgeChunk[];
  createdAt: string;
  appVersion: string;
}

const yamlList = (values: string[]) =>
  `[${values.map((value) => JSON.stringify(value.normalize('NFC'))).join(', ')}]`;

const listSection = (title: string, values: string[]) =>
  values.length > 0 ? `## ${title}\n\n${values.map((value) => `- ${value}`).join('\n')}` : '';

export const buildProjectMarkdown = ({
  id,
  draft,
  records,
  knowledgeChunks,
  createdAt,
  appVersion,
}: ProjectMarkdownInput) => {
  const chunksById = new Map(knowledgeChunks.map((chunk) => [chunk.id, chunk]));
  const evidenceConnections = draft.result.educationEvidenceConnections.length > 0
    ? `## 교육자료 근거 연결\n\n${draft.result.educationEvidenceConnections.map((connection) => {
      const citations = connection.chunkIds.flatMap((chunkId) => {
        const chunk = chunksById.get(chunkId);
        return chunk ? `\`${chunk.id}\` ${chunk.sourceTitle} · 조각 ${chunk.chunkIndex + 1}` : [];
      });
      return `- ${connection.statement}${citations.length > 0 ? `\n  - 근거: ${citations.join('; ')}` : ''}`;
    }).join('\n')}`
    : '';
  const sections = [
    draft.result.overview ? `## 프로젝트 한눈에 보기\n\n${draft.result.overview}` : '',
    listSection('이어진 질문', draft.result.guidingQuestions),
    listSection('수업·활동의 흐름', draft.result.learningJourney),
    listSection('학생 산출물', draft.result.studentArtifacts),
    listSection('학생 배움의 증거', draft.result.studentLearningEvidence),
    listSection('교사 성찰', draft.result.teacherReflection),
    listSection('교육과정 연결', draft.result.curriculumConnections),
    evidenceConnections,
    listSection('다음 확장', draft.result.nextExtensions),
  ].filter(Boolean).join('\n\n');
  const evidence = records.map((record) =>
    `- ${record.recordDate} · ${record.id} · ${record.categories.join(', ') || '교실기록'}`,
  ).join('\n');

  const frontmatter = [
    '---',
    `project_summary_id: ${id}`,
    `title: ${JSON.stringify(draft.title)}`,
    `seed_question: ${JSON.stringify(draft.seedQuestion)}`,
    `period_start: ${draft.periodStart}`,
    `period_end: ${draft.periodEnd}`,
    `source_record_ids: ${yamlList(draft.recordIds)}`,
    `knowledge_chunk_ids: ${yamlList(draft.knowledgeChunkIds)}`,
    `provider: ${JSON.stringify(draft.provider)}`,
    `model: ${JSON.stringify(draft.model)}`,
    `reflection_level: ${draft.reflectionLevel}`,
    `ai_generated_at: ${draft.generatedAt}`,
    `created_at: ${createdAt}`,
    `app_version: ${appVersion}`,
    'teacher_reviewed: true',
    '---',
  ].join('\n');

  const seedQuestion = draft.seedQuestion
    ? `\n\n> 출발 질문: ${draft.seedQuestion}`
    : '';
  const sources = knowledgeChunks.length > 0
    ? `\n\n## 사용한 교육자료 근거\n\n${knowledgeChunks.map((chunk) =>
      `- \`${chunk.id}\` ${chunk.sourceTitle} · 조각 ${chunk.chunkIndex + 1}`,
    ).join('\n')}`
    : '';
  return `${frontmatter}\n\n# ${draft.title}${seedQuestion}\n\n${sections}\n\n## 관련 기록과 날짜\n\n${evidence}${sources}\n`;
};
