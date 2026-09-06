import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';

const MAX_IMPORT_FILE_BYTES = 1024 * 1024;
const MAX_IMPORT_CONTENT_CHARACTERS = 100_000;
export const MAX_IMPORT_FILES = 500;

export interface ParsedRecordMarkdown {
  recordId: string | null;
  recordDate: string;
  categories: string[];
  content: string;
}

const isValidDateKey = (value: string) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day;
};

const cleanScalar = (value: string) => {
  const trimmed = value.trim();
  if (trimmed.length >= 2) {
    const first = trimmed[0];
    const last = trimmed[trimmed.length - 1];
    if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
      return trimmed.slice(1, -1).trim();
    }
  }
  return trimmed;
};

const parseCategoryList = (value: string | undefined) => {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    if (Array.isArray(parsed)) {
      return parsed
        .filter((item): item is string => typeof item === 'string')
        .map((item) => item.trim().normalize('NFC'))
        .filter(Boolean)
        .slice(0, 10);
    }
  } catch {
    // JSON 형식이 아니면 단순 YAML 목록 또는 쉼표 목록으로 이어서 해석한다.
  }
  return value
    .replace(/^\[|]$/g, '')
    .split(/[,;]/)
    .map(cleanScalar)
    .map((item) => item.normalize('NFC'))
    .filter(Boolean)
    .slice(0, 10);
};

const splitFrontmatter = (source: string) => {
  const match = /^---\n([\s\S]*?)\n---(?:\n|$)/.exec(source);
  if (!match) return { metadata: new Map<string, string>(), body: source };
  const metadata = new Map<string, string>();
  for (const line of match[1].split('\n')) {
    const field = /^([A-Za-z][A-Za-z0-9_-]*):\s*(.*)$/.exec(line);
    if (field) metadata.set(field[1].toLocaleLowerCase('en-US'), field[2].trim());
  }
  return { metadata, body: source.slice(match[0].length) };
};

const originalRecordBody = (body: string) => {
  const originalHeading = /(?:^|\n)##\s*(?:비식별 원문|원문)\s*\n/i.exec(body);
  if (originalHeading?.index !== undefined) {
    const start = originalHeading.index + originalHeading[0].length;
    const rest = body.slice(start);
    const nextSection = /\n##\s+/.exec(rest);
    return (nextSection ? rest.slice(0, nextSection.index) : rest).trim();
  }
  return body.replace(/^#\s+[^\n]+\n+/, '').trim();
};

export const parseRecordMarkdown = (raw: string, fileName = ''): ParsedRecordMarkdown => {
  const source = raw.replace(/^\uFEFF/, '').normalize('NFC').replace(/\r\n?/g, '\n');
  const { metadata, body } = splitFrontmatter(source);
  const fileDate = /(?:^|[^0-9])(\d{4}-\d{2}-\d{2})(?:[^0-9]|$)/.exec(fileName)?.[1] ?? '';
  const recordDate = cleanScalar(
    metadata.get('record_date') ?? metadata.get('date') ?? fileDate,
  );
  if (!isValidDateKey(recordDate)) {
    throw new Error('record_date 또는 date에 YYYY-MM-DD 형식의 실제 날짜가 필요합니다.');
  }

  const content = originalRecordBody(body);
  if (!content) throw new Error('가져올 기록 본문이 비어 있습니다.');
  if (content.length > MAX_IMPORT_CONTENT_CHARACTERS) {
    throw new Error('한 기록의 본문은 10만 자 이하여야 합니다.');
  }

  const categories = parseCategoryList(metadata.get('categories'));
  const recordId = cleanScalar(metadata.get('record_id') ?? '').slice(0, 200) || null;
  return {
    recordId,
    recordDate,
    categories: categories.length > 0 ? categories : ['가져온 기록'],
    content,
  };
};

export const listRecordMarkdownFiles = async (directory: string) => {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = entries
    .filter((entry) => entry.isFile() && ['.md', '.markdown'].includes(
      path.extname(entry.name).toLocaleLowerCase('en-US'),
    ))
    .map((entry) => path.join(directory, entry.name))
    .sort((left, right) => left.localeCompare(right, 'ko-KR'));
  if (files.length > MAX_IMPORT_FILES) {
    throw new Error(`한 번에 가져올 수 있는 Markdown 기록은 ${MAX_IMPORT_FILES}개까지입니다.`);
  }
  return files;
};

export const readRecordMarkdown = async (filePath: string) => {
  const info = await stat(filePath);
  if (!info.isFile() || info.size <= 0 || info.size > MAX_IMPORT_FILE_BYTES) {
    throw new Error('1MB 이하의 비어 있지 않은 Markdown 파일만 가져올 수 있습니다.');
  }
  const buffer = await readFile(filePath);
  let source: string;
  try {
    source = new TextDecoder('utf-8', { fatal: true }).decode(buffer);
  } catch {
    throw new Error('UTF-8로 저장된 Markdown 파일만 가져올 수 있습니다.');
  }
  return parseRecordMarkdown(source, path.basename(filePath));
};
