import { useCallback, useEffect, useState } from 'react';

import type { MarkdownDocumentTarget, RecordDetail as RecordDetailData } from '../shared/contracts';
import DataUseBadge from './DataUseBadge';

interface RecordDetailProps {
  recordId: string;
  onBack: () => void;
  onEdit: (record: RecordDetailData['record']) => void;
  onOpenDocument: (target: MarkdownDocumentTarget) => void;
}

const errorMessage = (error: unknown) => error instanceof Error
  ? error.message.replace(/^Error invoking remote method '[^']+': Error: /, '')
  : '기록을 불러오지 못했습니다.';

const formatDate = (value: string) => new Intl.DateTimeFormat('ko-KR', {
  year: 'numeric', month: 'long', day: 'numeric', weekday: 'long',
}).format(new Date(`${value}T12:00:00`));

export default function RecordDetail({ recordId, onBack, onEdit, onOpenDocument }: RecordDetailProps) {
  const [detail, setDetail] = useState<RecordDetailData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setDetail(await window.itta.getRecordDetail(recordId));
    } catch (loadError) {
      setError(errorMessage(loadError));
    }
  }, [recordId]);

  useEffect(() => { void load(); }, [load]);

  if (!detail) {
    return (
      <section className="record-detail-page">
        {error ? <div className="notice error">{error}</div> : <p>기록을 불러오는 중…</p>}
        <button className="secondary-button" type="button" onClick={onBack}>돌아가기</button>
      </section>
    );
  }

  return (
    <section className="record-detail-page" aria-labelledby="record-detail-title">
      <header className="record-detail-heading">
        <div>
          <p className="eyebrow">원본 교실 기록</p>
          <h1 id="record-detail-title">{formatDate(detail.record.recordDate)}</h1>
          <div className="data-use-context"><DataUseBadge scope="local" detail="기록과 연결 문서는 이 컴퓨터 안에서만 조회합니다." /></div>
        </div>
        <div className="record-detail-actions">
          <button className="secondary-button" type="button" onClick={onBack}>← 이전 화면</button>
          <button className="secondary-button" type="button" onClick={() => { void window.itta.showRecordFile(detail.record.id); }}>탐색기에서 보기</button>
          <button className="primary-button" type="button" onClick={() => onEdit(detail.record)}>수정</button>
        </div>
      </header>

      <article className="record-detail-content">
        <p>{detail.record.content}</p>
        <div className="category-row">
          {detail.record.categories.map((category) => <span key={category}>{category}</span>)}
        </div>
      </article>

      <section className="record-backlinks" aria-labelledby="record-backlinks-title">
        <div>
          <p className="eyebrow">백링크</p>
          <h2 id="record-backlinks-title">이 기록을 인용한 정리 문서</h2>
          <span>{detail.backlinks.length}개 문서와 연결됨</span>
        </div>
        {detail.backlinks.length === 0 ? (
          <p className="record-backlinks-empty">아직 이 기록을 사용한 정리 문서가 없습니다.</p>
        ) : (
          <div className="record-backlink-list">
            {detail.backlinks.map((link) => (
              <button type="button" key={`${link.kind}:${link.id}`} onClick={() => onOpenDocument(link)}>
                <span className="record-backlink-kind">{link.kindLabel}</span>
                <strong>{link.title}</strong>
                <small>{link.context} · 문서 열기 →</small>
              </button>
            ))}
          </div>
        )}
      </section>
    </section>
  );
}
