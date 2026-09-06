import { createHash } from 'node:crypto';

import type { NewsItem } from '../shared/contracts';

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

const NEWS_HOST = 'news.google.com';
const MAX_FEED_ITEMS = 30;

const decodeCodePoint = (value: string, radix: number) => {
  const codePoint = Number.parseInt(value, radix);
  return Number.isInteger(codePoint) && codePoint >= 0 && codePoint <= 0x10FFFF
    ? String.fromCodePoint(codePoint)
    : '';
};

const removeControlCharacters = (value: string) => [...value]
  .filter((character) => {
    const code = character.charCodeAt(0);
    return code >= 32 && code !== 127;
  })
  .join('');

const decodeXml = (value: string) => value
  .replace(/^<!\[CDATA\[([\s\S]*)\]\]>$/i, '$1')
  .replace(/&#x([0-9a-f]+);/gi, (_match, code: string) => decodeCodePoint(code, 16))
  .replace(/&#([0-9]+);/g, (_match, code: string) => decodeCodePoint(code, 10))
  .replace(/&quot;/gi, '"')
  .replace(/&apos;/gi, "'")
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')
  .replace(/&amp;/gi, '&')
  .replace(/<[^>]*>/g, '')
  .replace(/\s+/g, ' ')
  .trim();

const tagValue = (xml: string, tag: string) => {
  const match = xml.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, 'i'));
  return match ? decodeXml(match[1]) : '';
};

const safeNewsUrl = (value: string) => {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname === NEWS_HOST ? url.toString() : '';
  } catch {
    return '';
  }
};

const safePublishedAt = (value: string) => {
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? '' : new Date(timestamp).toISOString();
};

export const normalizeNewsTopics = (value: unknown) => {
  if (!Array.isArray(value)) return [];
  const normalized = value
    .map((topic) => typeof topic === 'string'
      ? removeControlCharacters(topic.normalize('NFC')).replace(/\s+/g, ' ').trim().slice(0, 40)
      : '')
    .filter((topic) => topic.length >= 2);
  const seen = new Set<string>();
  return normalized.filter((topic) => {
    const key = topic.toLocaleLowerCase('ko-KR');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 2);
};

export const buildGoogleNewsUrl = (topic: string) => {
  const query = encodeURIComponent(`${topic} 교육`);
  return `https://${NEWS_HOST}/rss/search?q=${query}&hl=ko&gl=KR&ceid=KR:ko`;
};

export const parseGoogleNewsRss = (xml: string, topic: string): NewsItem[] => {
  const items = xml.match(/<item(?:\s[^>]*)?>[\s\S]*?<\/item>/gi) ?? [];
  return items.slice(0, MAX_FEED_ITEMS).flatMap((itemXml) => {
    const title = tagValue(itemXml, 'title').slice(0, 300);
    const url = safeNewsUrl(tagValue(itemXml, 'link'));
    const source = tagValue(itemXml, 'source').slice(0, 100) || 'Google News';
    const publishedAt = safePublishedAt(tagValue(itemXml, 'pubDate'));
    if (!title || !url || !publishedAt) return [];
    return [{
      id: createHash('sha256').update(url).digest('hex').slice(0, 20),
      topic,
      title,
      url,
      source,
      publishedAt,
    }];
  });
};

export const selectNewsItems = (items: NewsItem[], topics: string[], limit = 3) => {
  const unique = [...new Map(items.map((item) => [item.url, item])).values()]
    .sort((left, right) => Date.parse(right.publishedAt) - Date.parse(left.publishedAt));
  const selected: NewsItem[] = [];
  for (const topic of topics) {
    const item = unique.find((candidate) => candidate.topic === topic && !selected.includes(candidate));
    if (item) selected.push(item);
  }
  for (const item of unique) {
    if (selected.length >= limit) break;
    if (!selected.includes(item)) selected.push(item);
  }
  return selected.slice(0, Math.min(Math.max(Math.trunc(limit), 1), 3));
};

export const fetchNewsForTopics = async (
  topics: string[],
  fetcher: FetchLike = fetch,
): Promise<NewsItem[]> => {
  const safeTopics = normalizeNewsTopics(topics);
  if (safeTopics.length !== 2) {
    throw new Error('뉴스 관심 주제 두 개를 먼저 설정해 주세요.');
  }
  const results = await Promise.allSettled(safeTopics.map(async (topic) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    try {
      const response = await fetcher(buildGoogleNewsUrl(topic), {
        method: 'GET',
        headers: {
          Accept: 'application/rss+xml, application/xml;q=0.9, text/xml;q=0.8',
          'User-Agent': 'Itta/0.16',
        },
        cache: 'no-store',
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`뉴스 응답 오류: ${response.status}`);
      return parseGoogleNewsRss(await response.text(), topic);
    } finally {
      clearTimeout(timeout);
    }
  }));
  const successful = results.flatMap((result) => result.status === 'fulfilled' ? result.value : []);
  if (results.every((result) => result.status === 'rejected')) {
    throw new Error('새 소식을 불러오지 못했습니다. 기록 기능은 그대로 사용할 수 있습니다.');
  }
  return selectNewsItems(successful, safeTopics, 3);
};

export const sanitizeStoredNewsItems = (value: unknown, topics: string[]): NewsItem[] => {
  if (!Array.isArray(value)) return [];
  const allowedTopics = new Set(topics);
  return value.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const row = item as Record<string, unknown>;
    const topic = typeof row.topic === 'string' && allowedTopics.has(row.topic) ? row.topic : '';
    const title = typeof row.title === 'string' ? row.title.normalize('NFC').trim().slice(0, 300) : '';
    const url = typeof row.url === 'string' ? safeNewsUrl(row.url) : '';
    const source = typeof row.source === 'string' ? row.source.normalize('NFC').trim().slice(0, 100) : '';
    const publishedAt = typeof row.publishedAt === 'string' ? safePublishedAt(row.publishedAt) : '';
    if (!topic || !title || !url || !publishedAt) return [];
    return [{
      id: createHash('sha256').update(url).digest('hex').slice(0, 20),
      topic,
      title,
      url,
      source: source || 'Google News',
      publishedAt,
    }];
  }).slice(0, 3);
};
