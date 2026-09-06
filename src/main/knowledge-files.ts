import { createHash } from 'node:crypto';
import { copyFile, mkdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';

import { unzipSync } from 'fflate';

import { sanitizeFilePart } from './markdown.ts';
import { normalizeKnowledgeText } from '../shared/knowledge.ts';
import type { KnowledgeFileType } from '../shared/contracts';

const MAX_SOURCE_BYTES = 25 * 1024 * 1024;
const MAX_EXTRACTED_CHARACTERS = 2_000_000;
const MAX_ARCHIVE_XML_BYTES = 12 * 1024 * 1024;

const fileTypeForExtension = (extension: string): KnowledgeFileType | null => {
  if (extension === '.pdf') return 'pdf';
  if (extension === '.md' || extension === '.markdown') return 'markdown';
  if (extension === '.txt') return 'text';
  if (extension === '.docx') return 'docx';
  if (extension === '.hwpx') return 'hwpx';
  return null;
};

const normalizedArchivePath = (value: string) => value.replace(/\\/g, '/').toLocaleLowerCase('en-US');

const decodeXmlEntities = (value: string) => value
  .replace(/&#x([0-9a-f]+);/gi, (entity, digits: string) => {
    const codePoint = Number.parseInt(digits, 16);
    return Number.isSafeInteger(codePoint) && codePoint <= 0x10FFFF
      ? String.fromCodePoint(codePoint)
      : entity;
  })
  .replace(/&#(\d+);/g, (entity, digits: string) => {
    const codePoint = Number.parseInt(digits, 10);
    return Number.isSafeInteger(codePoint) && codePoint <= 0x10FFFF
      ? String.fromCodePoint(codePoint)
      : entity;
  })
  .replace(/&(amp|lt|gt|quot|apos);/g, (entity) => ({
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&apos;': "'",
  })[entity] ?? entity);

const inlineXmlToText = (value: string) => decodeXmlEntities(value
  .replace(/<!\[CDATA\[([\s\S]*?)]]>/g, '$1')
  .replace(/<(?:[A-Za-z_][\w.-]*:)?tab\b[^>]*\/?\s*>/gi, '\t')
  .replace(/<(?:[A-Za-z_][\w.-]*:)?(?:br|cr|lineBreak)\b[^>]*\/?\s*>/gi, '\n')
  .replace(/<[^>]+>/g, ''));

const xmlDocumentToText = (xml: string) => {
  const visibleXml = xml.replace(/<!--[\s\S]*?-->/g, '');
  const tokens = visibleXml.matchAll(
    /<(?:[A-Za-z_][\w.-]*:)?t\b[^>]*>([\s\S]*?)<\/(?:[A-Za-z_][\w.-]*:)?t\s*>|<(?:[A-Za-z_][\w.-]*:)?tab\b[^>]*\/?\s*>|<(?:[A-Za-z_][\w.-]*:)?(?:br|cr|lineBreak)\b[^>]*\/?\s*>|<\/(?:[A-Za-z_][\w.-]*:)?(?:tc|cell|p|tr)\s*>/gi,
  );
  let text = '';
  for (const token of tokens) {
    if (token[1] !== undefined) {
      text += inlineXmlToText(token[1]);
    } else if (/<\/(?:[A-Za-z_][\w.-]*:)?(?:tc|cell)\s*>/i.test(token[0])) {
      text += '\t';
    } else if (/<\/(?:[A-Za-z_][\w.-]*:)?(?:p|tr)\s*>/i.test(token[0])) {
      text += '\n\n';
    } else if (/(?:^|:)tab\b/i.test(token[0])) {
      text += '\t';
    } else {
      text += '\n';
    }
  }
  return text;
};

const decodeArchiveXml = (data: Uint8Array, fileType: 'docx' | 'hwpx') => {
  const isSelectedEntry = (name: string) => {
    const normalizedName = normalizedArchivePath(name);
    if (fileType === 'docx') {
      return normalizedName === 'word/document.xml'
        || /^word\/(?:header|footer)\d+\.xml$/.test(normalizedName)
        || /^word\/(?:footnotes|endnotes|comments)\.xml$/.test(normalizedName);
    }
    return /^contents\/section\d+\.xml$/.test(normalizedName);
  };

  let selectedBytes = 0;
  let archive: Record<string, Uint8Array>;
  try {
    archive = unzipSync(data, {
      filter: (entry) => {
        if (!isSelectedEntry(entry.name)) return false;
        if (entry.originalSize <= 0 || entry.originalSize > MAX_ARCHIVE_XML_BYTES) {
          throw new Error('문서 내부 본문이 허용된 크기를 넘습니다. 더 작은 문서를 선택해 주세요.');
        }
        selectedBytes += entry.originalSize;
        if (selectedBytes > MAX_ARCHIVE_XML_BYTES) {
          throw new Error('문서 내부 본문의 합계가 허용된 크기를 넘습니다. 더 작은 문서를 선택해 주세요.');
        }
        return true;
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes('허용된 크기')) throw error;
    throw new Error(`${fileType.toUpperCase()} 문서 구조를 읽지 못했습니다. 손상되지 않은 파일인지 확인해 주세요.`);
  }

  const entries = Object.entries(archive).filter(([name]) => isSelectedEntry(name));
  if (entries.length === 0) {
    throw new Error(`${fileType.toUpperCase()} 문서에서 본문 파일을 찾지 못했습니다.`);
  }
  entries.sort(([left], [right]) => {
    const leftName = normalizedArchivePath(left);
    const rightName = normalizedArchivePath(right);
    if (fileType === 'docx') {
      if (leftName === 'word/document.xml') return -1;
      if (rightName === 'word/document.xml') return 1;
    }
    const leftSection = Number(leftName.match(/section(\d+)\.xml$/)?.[1] ?? Number.MAX_SAFE_INTEGER);
    const rightSection = Number(rightName.match(/section(\d+)\.xml$/)?.[1] ?? Number.MAX_SAFE_INTEGER);
    return leftSection - rightSection || leftName.localeCompare(rightName);
  });

  const decoder = new TextDecoder('utf-8', { fatal: true });
  try {
    return entries
      .map(([, xml]) => xmlDocumentToText(decoder.decode(xml)))
      .filter((text) => text.trim())
      .join('\n\n');
  } catch {
    throw new Error(`${fileType.toUpperCase()} 문서의 본문 문자 형식을 읽지 못했습니다.`);
  }
};

const extractPdfText = async (data: Uint8Array) => {
  const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const loadingTask = getDocument({
    data,
    useSystemFonts: true,
  });
  try {
    const document = await loadingTask.promise;
    const pages: string[] = [];
    let totalCharacters = 0;
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const content = await page.getTextContent();
      const pageText = content.items
        .map((item) => ('str' in item ? item.str : ''))
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
      if (pageText) {
        const section = `페이지 ${pageNumber}\n\n${pageText}`;
        totalCharacters += section.length;
        if (totalCharacters > MAX_EXTRACTED_CHARACTERS) {
          throw new Error('교육자료 본문이 너무 깁니다. 200만 자 이하의 자료를 선택해 주세요.');
        }
        pages.push(section);
      }
    }
    return pages.join('\n\n');
  } finally {
    await loadingTask.destroy();
  }
};

export const extractKnowledgeFile = async (filePath: string) => {
  const resolvedPath = path.resolve(filePath);
  const info = await stat(resolvedPath);
  if (!info.isFile() || info.size <= 0 || info.size > MAX_SOURCE_BYTES) {
    throw new Error('교육자료는 25MB 이하의 파일이어야 합니다.');
  }
  const extension = path.extname(resolvedPath).toLocaleLowerCase('en-US');
  if (extension === '.hwp') {
    throw new Error('구형 HWP(.hwp)는 직접 읽을 수 없습니다. 한글에서 HWPX, PDF 또는 DOCX로 다시 저장해 추가해 주세요.');
  }
  const fileType = fileTypeForExtension(extension);
  if (!fileType) {
    throw new Error('PDF, DOCX, HWPX, Markdown 또는 텍스트 파일만 추가할 수 있습니다.');
  }
  const buffer = await readFile(resolvedPath);
  const contentHash = createHash('sha256').update(buffer).digest('hex');
  let text: string;
  if (fileType === 'pdf') {
    text = await extractPdfText(new Uint8Array(buffer));
  } else if (fileType === 'docx' || fileType === 'hwpx') {
    text = decodeArchiveXml(new Uint8Array(buffer), fileType);
  } else {
    try {
      text = new TextDecoder('utf-8', { fatal: true }).decode(buffer);
    } catch {
      throw new Error('UTF-8로 저장된 Markdown 또는 텍스트 파일만 읽을 수 있습니다.');
    }
  }
  const normalized = normalizeKnowledgeText(text);
  if (normalized.length < 20) {
    if (fileType === 'pdf') {
      throw new Error('PDF에서 읽을 수 있는 본문이 없습니다. 스캔 이미지 PDF는 아직 지원하지 않습니다.');
    }
    if (fileType === 'docx' || fileType === 'hwpx') {
      throw new Error(`${fileType.toUpperCase()} 문서에서 읽을 수 있는 본문이 없습니다.`);
    }
    throw new Error('교육자료 본문이 너무 짧거나 비어 있습니다.');
  }
  if (normalized.length > MAX_EXTRACTED_CHARACTERS) {
    throw new Error('교육자료 본문이 너무 깁니다. 200만 자 이하의 자료를 선택해 주세요.');
  }
  return {
    originalName: path.basename(resolvedPath).normalize('NFC').slice(0, 240),
    title: path.parse(resolvedPath).name.normalize('NFC').slice(0, 120),
    fileType,
    contentHash,
    text: normalized,
    sourcePath: resolvedPath,
  };
};

export const copyKnowledgeOriginal = async (
  sourcePath: string,
  directory: string,
) => {
  await mkdir(directory, { recursive: true });
  const extension = path.extname(sourcePath).toLocaleLowerCase('en-US');
  const baseName = sanitizeFilePart(path.parse(sourcePath).name);
  for (let version = 1; version <= 999; version += 1) {
    const suffix = version === 1 ? '' : `_v${version}`;
    const destinationPath = path.join(directory, `${baseName}${suffix}${extension}`);
    try {
      await stat(destinationPath);
    } catch {
      await copyFile(sourcePath, destinationPath);
      return destinationPath;
    }
  }
  throw new Error('같은 이름의 교육자료가 너무 많습니다. 파일명을 바꿔 다시 추가해 주세요.');
};
