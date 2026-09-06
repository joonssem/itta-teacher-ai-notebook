import type { KnowledgeChunk, RagDraft, TeacherRecord } from '../shared/contracts';

interface RagMarkdownInput {
  id: string;
  draft: RagDraft;
  record: TeacherRecord;
  chunks: KnowledgeChunk[];
  createdAt: string;
  appVersion: string;
}

const yamlList = (values: string[]) =>
  `[${values.map((value) => JSON.stringify(value.normalize('NFC'))).join(', ')}]`;

const listSection = (title: string, values: string[]) =>
  values.length > 0 ? `## ${title}\n\n${values.map((value) => `- ${value}`).join('\n')}` : '';

export const buildRagMarkdown = ({
  id,
  draft,
  record,
  chunks,
  createdAt,
  appVersion,
}: RagMarkdownInput) => {
  const chunkMap = new Map(chunks.map((chunk) => [chunk.id, chunk]));
  const connections = draft.result.connections.map((connection) => {
    const citations = connection.chunkIds.flatMap((chunkId) => {
      const chunk = chunkMap.get(chunkId);
      return chunk ? [`${chunk.sourceTitle} · 조각 ${chunk.chunkIndex + 1} · ${chunk.id}`] : [];
    });
    return `- ${connection.statement}\n  - 근거: ${citations.join(' / ')}`;
  }).join('\n');
  const evidence = chunks.map((chunk) =>
    `### ${chunk.sourceTitle} · 조각 ${chunk.chunkIndex + 1}\n\n- chunk_id: ${chunk.id}\n- 자료 종류: ${chunk.sourceKind}\n\n> ${chunk.content.replace(/\n/g, '\n> ')}`,
  ).join('\n\n');
  const sections = [
    draft.result.overview ? `## 연결 요약\n\n${draft.result.overview}` : '',
    connections ? `## 기록과 교육자료의 연결\n\n${connections}` : '',
    listSection('근거와 함께 발견한 강점', draft.result.encouragements),
    listSection('환기할 관점', draft.result.reminders),
    listSection('성찰 질문', draft.result.reflectionQuestions),
    listSection('다음 실천', draft.result.nextActions),
  ].filter(Boolean).join('\n\n');
  const frontmatter = [
    '---',
    `rag_connection_id: ${id}`,
    `record_id: ${record.id}`,
    `record_date: ${record.recordDate}`,
    `source_chunk_ids: ${yamlList(draft.chunkIds)}`,
    `provider: ${JSON.stringify(draft.provider)}`,
    `model: ${JSON.stringify(draft.model)}`,
    `ai_generated_at: ${draft.generatedAt}`,
    `created_at: ${createdAt}`,
    `app_version: ${appVersion}`,
    'teacher_reviewed: true',
    '---',
  ].join('\n');

  return `${frontmatter}\n\n# 교육자료 연결 기록\n\n## 교사의 질문\n\n${draft.query || '이 기록과 교육자료의 연결을 살펴봅니다.'}\n\n## 연결할 교실 기록\n\n${record.recordDate} · ${record.id}\n\n${record.content}\n\n${sections}\n\n## 사용한 교육자료 근거\n\n${evidence}\n`;
};
