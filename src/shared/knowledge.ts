import type {
  KnowledgeChunk,
  KnowledgeSearchHit,
  KnowledgeSourceKind,
  RagResult,
} from './contracts';

export const KNOWLEDGE_KIND_LABELS: Record<KnowledgeSourceKind, string> = {
  curriculum: '교육과정',
  theory: '교육 이론',
  other: '기타 교육자료',
};

export const isKnowledgeSourceKind = (value: unknown): value is KnowledgeSourceKind =>
  value === 'curriculum' || value === 'theory' || value === 'other';

export const normalizeKnowledgeText = (value: string) => value
  .normalize('NFC')
  .replace(/\r\n?/g, '\n')
  // 문서 파서가 남긴 표시 불가능한 제어 문자만 제거한다.
  // eslint-disable-next-line no-control-regex
  .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
  .replace(/[ \t]+\n/g, '\n')
  .replace(/\n{4,}/g, '\n\n\n')
  .trim();

export const chunkKnowledgeText = (
  value: string,
  targetLength = 1_200,
  overlapLength = 180,
) => {
  const text = normalizeKnowledgeText(value);
  if (!text) return [];
  const paragraphs = text.split(/\n{2,}/).map((item) => item.trim()).filter(Boolean);
  const chunks: string[] = [];
  let current = '';

  const pushCurrent = () => {
    const clean = current.trim();
    if (clean) chunks.push(clean);
    current = '';
  };

  for (const paragraph of paragraphs) {
    if (paragraph.length > targetLength * 1.5) {
      pushCurrent();
      for (let start = 0; start < paragraph.length; start += targetLength - overlapLength) {
        const slice = paragraph.slice(start, start + targetLength).trim();
        if (slice) chunks.push(slice);
      }
      continue;
    }
    const candidate = current ? `${current}\n\n${paragraph}` : paragraph;
    if (candidate.length <= targetLength) {
      current = candidate;
      continue;
    }
    const overlap = current.slice(Math.max(0, current.length - overlapLength)).trim();
    pushCurrent();
    current = overlap ? `${overlap}\n\n${paragraph}` : paragraph;
  }
  pushCurrent();
  return chunks.filter((chunk) => chunk.length >= 20).slice(0, 5_000);
};

const tokenize = (value: string) => [...new Set(value
  .normalize('NFC')
  .toLocaleLowerCase('ko-KR')
  .split(/[^0-9a-z가-힣]+/i)
  .map((token) => token.trim())
  .filter((token) => token.length >= 2)
  .slice(0, 120))];

export const rankKnowledgeChunks = (
  query: string,
  chunks: KnowledgeChunk[],
  limit = 8,
): KnowledgeSearchHit[] => {
  const cleanQuery = normalizeKnowledgeText(query).slice(0, 5_000);
  const tokens = tokenize(cleanQuery);
  if (!cleanQuery || tokens.length === 0) return [];
  const phrase = cleanQuery.toLocaleLowerCase('ko-KR').slice(0, 120);
  return chunks
    .map((chunk) => {
      const content = chunk.content.toLocaleLowerCase('ko-KR');
      const title = chunk.sourceTitle.toLocaleLowerCase('ko-KR');
      let score = phrase.length >= 4 && content.includes(phrase) ? 12 : 0;
      for (const token of tokens) {
        if (title.includes(token)) score += 4;
        const occurrences = content.split(token).length - 1;
        score += Math.min(occurrences, 4) * (token.length >= 4 ? 2 : 1);
      }
      return { ...chunk, score };
    })
    .filter((chunk) => chunk.score > 0)
    .sort((left, right) => right.score - left.score || left.chunkIndex - right.chunkIndex)
    .slice(0, Math.min(Math.max(Math.trunc(limit), 1), 20));
};

const cleanText = (value: unknown, maxLength: number) =>
  typeof value === 'string' ? normalizeKnowledgeText(value).slice(0, maxLength) : '';

const cleanList = (value: unknown, maxItems = 10) => Array.isArray(value)
  ? value.map((item) => cleanText(item, 800)).filter(Boolean).slice(0, maxItems)
  : [];

export const sanitizeRagResult = (value: unknown, allowedChunkIds: string[]): RagResult => {
  const result = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const allowed = new Set(allowedChunkIds);
  const rawConnections = Array.isArray(result.connections) ? result.connections : [];
  const connections = rawConnections.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const row = item as Record<string, unknown>;
    const statement = cleanText(row.statement, 1_000);
    const chunkIds = Array.isArray(row.chunkIds)
      ? [...new Set(row.chunkIds.filter((id): id is string => typeof id === 'string' && allowed.has(id)))].slice(0, 3)
      : [];
    return statement && chunkIds.length > 0 ? [{ statement, chunkIds }] : [];
  }).slice(0, 8);
  return {
    overview: cleanText(result.overview, 4_000),
    connections,
    encouragements: cleanList(result.encouragements, 8),
    reminders: cleanList(result.reminders, 8),
    reflectionQuestions: cleanList(result.reflectionQuestions, 8),
    nextActions: cleanList(result.nextActions, 5),
  };
};

export const hasRagContent = (result: RagResult) => Boolean(
  result.overview
  || result.connections.length
  || result.encouragements.length
  || result.reminders.length
  || result.reflectionQuestions.length
  || result.nextActions.length,
);
