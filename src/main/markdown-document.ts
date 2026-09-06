import { createHash, randomUUID } from 'node:crypto';
import { copyFile, mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

export interface MarkdownDocumentParts {
  protectedMetadata: string;
  body: string;
  metadataProtected: boolean;
}

const normalizeNewlines = (value: string) => value.replace(/\r\n?/g, '\n');

export const splitMarkdownDocument = (markdown: string): MarkdownDocumentParts => {
  const normalized = normalizeNewlines(markdown).replace(/^\uFEFF/, '');
  const match = normalized.match(/^---\n[\s\S]*?\n---(?:\n|$)/);
  if (!match) {
    return {
      protectedMetadata: '',
      body: normalized.trim(),
      metadataProtected: false,
    };
  }
  return {
    protectedMetadata: match[0].trimEnd(),
    body: normalized.slice(match[0].length).replace(/^\n+/, '').trimEnd(),
    metadataProtected: true,
  };
};

export const getMarkdownTitle = (body: string, fallback: string) => {
  const heading = normalizeNewlines(body).match(/^#\s+(.+)$/m)?.[1]?.trim();
  return heading || fallback.replace(/\.md$/i, '');
};

export const combineMarkdownDocument = (protectedMetadata: string, body: string) => {
  const normalizedBody = normalizeNewlines(body).trim();
  if (!protectedMetadata.trim()) {
    throw new Error('문서의 보호된 시스템 정보를 찾지 못해 저장을 중단했습니다.');
  }
  if (!normalizedBody) {
    throw new Error('문서 본문을 비워 둘 수 없습니다.');
  }
  if (normalizedBody.length > 500_000) {
    throw new Error('문서 본문은 50만 자 이하로 작성해 주세요.');
  }
  if (normalizedBody.includes('\0')) {
    throw new Error('문서에 저장할 수 없는 문자가 포함되어 있습니다.');
  }
  return `${normalizeNewlines(protectedMetadata).trim()}\n\n${normalizedBody.normalize('NFC')}\n`;
};

const revisionFor = (markdown: string) =>
  createHash('sha256').update(markdown, 'utf8').digest('hex');

export interface MarkdownFileSnapshot {
  fileName: string;
  title: string;
  body: string;
  revision: string;
  modifiedAt: string;
  metadataProtected: boolean;
}

export const readMarkdownDocumentFile = async (filePath: string): Promise<MarkdownFileSnapshot> => {
  const [markdown, details] = await Promise.all([
    readFile(filePath, 'utf8'),
    stat(filePath),
  ]);
  const parts = splitMarkdownDocument(markdown);
  const fileName = path.basename(filePath);
  return {
    fileName,
    title: getMarkdownTitle(parts.body, fileName),
    body: parts.body,
    revision: revisionFor(markdown),
    modifiedAt: details.mtime.toISOString(),
    metadataProtected: parts.metadataProtected,
  };
};

export const saveMarkdownDocumentFile = async (
  filePath: string,
  body: string,
  expectedRevision: string,
): Promise<MarkdownFileSnapshot> => {
  const current = await readFile(filePath, 'utf8');
  if (revisionFor(current) !== expectedRevision) {
    throw new Error('이 문서가 앱 밖에서 변경되었습니다. 다시 불러온 뒤 수정해 주세요.');
  }
  const parts = splitMarkdownDocument(current);
  const nextMarkdown = combineMarkdownDocument(parts.protectedMetadata, body);
  const historyDirectory = path.join(path.dirname(filePath), '수정이력');
  await mkdir(historyDirectory, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const historyPath = path.join(
    historyDirectory,
    `${path.basename(filePath, path.extname(filePath))}_${stamp}_${randomUUID().slice(0, 8)}.md`,
  );
  await copyFile(filePath, historyPath);
  await writeFile(filePath, nextMarkdown, { encoding: 'utf8' });
  return readMarkdownDocumentFile(filePath);
};
