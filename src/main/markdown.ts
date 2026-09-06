import { stat } from 'node:fs/promises';
import path from 'node:path';

import { AI_SECTION_OPTIONS } from '../shared/ai.ts';
import type { AiOrganizationDraft, AiSectionId } from '../shared/contracts';

interface MarkdownRecord {
  id: string;
  content: string;
  recordDate: string;
  categories: string[];
  createdAt: string;
  appVersion: string;
  privacyReviewed: boolean;
  aiReview?: AiOrganizationDraft | null;
  topics?: string[];
}

export const sanitizeFilePart = (value: string) => {
  const withoutControlCharacters = [...value]
    .filter((character) => character.charCodeAt(0) >= 32)
    .join('');

  return withoutControlCharacters
    .normalize('NFC')
    .replace(/[<>:"/\\|?*]/g, '')
    .replace(/\s+/g, '-')
    .slice(0, 40) || '기록';
};

const yamlList = (values: string[]) =>
  `[${values.map((value) => JSON.stringify(value.normalize('NFC'))).join(', ')}]`;

export const buildMarkdown = (record: MarkdownRecord) => {
  const cleanContent = record.content.trim().normalize('NFC');
  const categories = record.categories
    .map((category) => category.trim())
    .filter(Boolean)
    .slice(0, 10);

  const aiReview = record.aiReview;
  const topics = (record.topics ?? [])
    .map((topic) => topic.trim())
    .filter(Boolean)
    .slice(0, 10);
  const feedbackLabels = aiReview
    ? aiReview.options.sections.map((section) =>
      AI_SECTION_OPTIONS.find((item) => item.id === section)?.label ?? section,
    )
    : [];
  const frontmatter = [
    '---',
    `record_id: ${record.id}`,
    `date: ${record.recordDate}`,
    `categories: ${yamlList(categories)}`,
    `topics: ${yamlList(topics)}`,
    ...(aiReview ? [
      `topic_suggestions: ${yamlList(aiReview.result.topics)}`,
      `feedback: ${yamlList(feedbackLabels)}`,
      `provider: ${JSON.stringify(aiReview.provider)}`,
      `model: ${JSON.stringify(aiReview.model)}`,
      `ai_generated_at: ${aiReview.generatedAt}`,
      'ai_reviewed: true',
    ] : []),
    `created_at: ${record.createdAt}`,
    `app_version: ${record.appVersion}`,
    `privacy_reviewed: ${record.privacyReviewed}`,
    '---',
  ].join('\n');

  const headingBySection: Record<AiSectionId, string> = {
    summary: '기록 요약',
    strengths: '발견한 강점',
    reminders: '환기할 관점',
    curriculumConnections: '교육과정·교육이론 연결',
    nextActions: '다음 실천',
    reflectionQuestions: '성찰 질문',
    alternativePerspectives: '대안적 관점',
  };
  const aiSections = aiReview?.options.sections.flatMap((section) => {
    const value = aiReview.result[section];
    const body = Array.isArray(value)
      ? value.map((item) => `- ${item}`).join('\n')
      : value;
    return body ? [`## ${headingBySection[section]}\n\n${body}`] : [];
  }).join('\n\n');

  return `${frontmatter}\n\n# 오늘의 교실 기록\n\n## 비식별 원문\n\n${cleanContent}\n${aiSections ? `\n${aiSections}\n` : ''}`;
};

export const findAvailableFilePath = async (directory: string, baseName: string) => {
  for (let version = 1; version <= 999; version += 1) {
    const suffix = version === 1 ? '' : `_v${version}`;
    const candidate = path.join(directory, `${baseName}${suffix}.md`);

    try {
      await stat(candidate);
    } catch {
      return candidate;
    }
  }

  throw new Error('같은 날짜의 기록 파일이 너무 많습니다. 파일명을 확인해 주세요.');
};
