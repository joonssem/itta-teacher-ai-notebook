import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  listRecordMarkdownFiles,
  parseRecordMarkdown,
  readRecordMarkdown,
} from '../src/main/record-import.ts';

test('시험용 frontmatter에서 날짜·카테고리·본문을 읽는다', () => {
  const parsed = parseRecordMarkdown(`---
dummy: true
record_date: 2026-03-10
categories: ["프로젝트수업", "학생선택"]
---

교실에서 바꾸고 싶은 점을 기록했다.

다음 시간에는 질문으로 바꾸어 볼 예정이다.
`, '01_프로젝트_문제발견.md');
  assert.equal(parsed.recordDate, '2026-03-10');
  assert.deepEqual(parsed.categories, ['프로젝트수업', '학생선택']);
  assert.match(parsed.content, /교실에서 바꾸고 싶은 점/);
});

test('잇다가 만든 Markdown은 비식별 원문만 다시 가져온다', () => {
  const parsed = parseRecordMarkdown(`---
record_id: existing-record
date: 2026-04-02
categories: ["발표", "교사지원"]
privacy_reviewed: true
---

# 오늘의 교실 기록

## 비식별 원문

[학생 D]가 발표 연습 방법을 선택했다.

## 기록 요약

AI가 만든 요약은 다시 원문으로 가져오지 않는다.
`, '2026-04-02_교실기록_발표.md');
  assert.equal(parsed.recordId, 'existing-record');
  assert.equal(parsed.content, '[학생 D]가 발표 연습 방법을 선택했다.');
  assert.doesNotMatch(parsed.content, /AI가 만든 요약/);
});

test('frontmatter가 없으면 파일명의 날짜와 기본 카테고리를 사용한다', () => {
  const parsed = parseRecordMarkdown('기존 교실 기록 본문입니다.', '2026-05-01_기록.md');
  assert.equal(parsed.recordDate, '2026-05-01');
  assert.deepEqual(parsed.categories, ['가져온 기록']);
});

test('실제 존재하지 않는 날짜나 빈 본문은 거부한다', () => {
  assert.throws(
    () => parseRecordMarkdown('---\nrecord_date: 2026-02-30\n---\n본문', '기록.md'),
    /실제 날짜/,
  );
  assert.throws(
    () => parseRecordMarkdown('---\nrecord_date: 2026-02-20\n---\n', '기록.md'),
    /본문이 비어/,
  );
});

test('선택한 폴더의 UTF-8 Markdown 파일만 이름순으로 읽는다', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'itta-import-'));
  try {
    await writeFile(path.join(directory, '02.md'), '---\nrecord_date: 2026-03-02\n---\n둘째 기록', 'utf8');
    await writeFile(path.join(directory, '01.markdown'), '---\nrecord_date: 2026-03-01\n---\n첫째 기록', 'utf8');
    await writeFile(path.join(directory, '무시.txt'), '텍스트', 'utf8');
    await mkdir(path.join(directory, '하위폴더'));
    await writeFile(path.join(directory, '하위폴더', '03.md'), '하위 기록', 'utf8');

    const files = await listRecordMarkdownFiles(directory);
    assert.deepEqual(files.map((file) => path.basename(file)), ['01.markdown', '02.md']);
    const first = await readRecordMarkdown(files[0]);
    assert.equal(first.recordDate, '2026-03-01');
    assert.equal(first.content, '첫째 기록');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
