import type { SemanticSearchAiMatch, SemanticSearchAiResult } from './contracts';

const cleanText = (value: unknown, maxLength: number) =>
  typeof value === 'string'
    ? value.trim().normalize('NFC').slice(0, maxLength)
    : '';

export const sanitizeSemanticSearchResult = (
  value: unknown,
  allowedRecordIds: ReadonlySet<string>,
): SemanticSearchAiResult => {
  const source = value && typeof value === 'object'
    ? value as Record<string, unknown>
    : {};
  const rawResults = Array.isArray(source.results) ? source.results : [];
  const seen = new Set<string>();
  const results: SemanticSearchAiMatch[] = [];

  for (const raw of rawResults) {
    if (!raw || typeof raw !== 'object') {
      continue;
    }
    const item = raw as Record<string, unknown>;
    const recordId = cleanText(item.recordId, 100);
    const reason = cleanText(item.reason, 300);
    const score = typeof item.score === 'number' && Number.isFinite(item.score)
      ? Math.round(Math.min(100, Math.max(0, item.score)))
      : Number.NaN;
    if (!allowedRecordIds.has(recordId) || seen.has(recordId) || !reason || Number.isNaN(score)) {
      continue;
    }
    const matchedConcepts = Array.isArray(item.matchedConcepts)
      ? [...new Set(item.matchedConcepts
        .map((concept) => cleanText(concept, 40))
        .filter(Boolean))].slice(0, 5)
      : [];
    results.push({ recordId, score, reason, matchedConcepts });
    seen.add(recordId);
  }

  return {
    interpretation: cleanText(source.interpretation, 300),
    results: results.sort((a, b) => b.score - a.score).slice(0, 10),
  };
};
