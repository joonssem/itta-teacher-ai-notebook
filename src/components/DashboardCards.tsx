import { useCallback, useEffect, useState } from 'react';

import type {
  DashboardCard,
  DashboardCardStatus,
  DashboardState,
  TeacherRecord,
} from '../shared/contracts';
import DataUseBadge from './DataUseBadge';

interface DashboardCardsProps {
  refreshKey: string;
  onOpenTopics: () => void;
  onOpenRecords: (query: string) => void;
  onOpenRecord: (record: TeacherRecord) => void;
  onOpenWeekly: () => void;
}

const cardLabels: Record<DashboardCard['kind'], string> = {
  'new-topic': '새 주제 발견',
  'connected-records': '이어지는 기록',
  'category-pattern': '반복되는 흐름',
  'weekly-summary': '주간 정리',
  'next-action': '다시 이어 쓰기',
};

const errorMessage = (error: unknown) => {
  if (error instanceof Error) {
    return error.message.replace(/^Error invoking remote method '[^']+': Error: /, '');
  }
  return '첫 화면 제안을 불러오지 못했습니다.';
};

const formatRecordDate = (value: string) => new Intl.DateTimeFormat('ko-KR', {
  month: 'long',
  day: 'numeric',
}).format(new Date(`${value}T00:00:00`));

const preview = (content: string) =>
  content.length > 90 ? `${content.slice(0, 90)}…` : content;

export default function DashboardCards({
  refreshKey,
  onOpenTopics,
  onOpenRecords,
  onOpenRecord,
  onOpenWeekly,
}: DashboardCardsProps) {
  const [state, setState] = useState<DashboardState | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isWorking, setIsWorking] = useState(false);

  const loadCards = useCallback(async () => {
    try {
      setState(await window.itta.getDashboardState());
      setNotice(null);
    } catch (error) {
      setNotice(errorMessage(error));
    }
  }, []);

  useEffect(() => {
    void loadCards();
  }, [loadCards, refreshKey]);

  const updateCard = async (
    card: DashboardCard,
    changes: { pinned?: boolean; status?: DashboardCardStatus },
  ) => {
    setIsWorking(true);
    setNotice(null);
    try {
      setState(await window.itta.updateDashboardCard({ key: card.key, ...changes }));
    } catch (error) {
      setNotice(errorMessage(error));
    } finally {
      setIsWorking(false);
    }
  };

  const openPrimaryAction = (card: DashboardCard) => {
    if (card.action === 'topics') {
      onOpenTopics();
      return;
    }
    if (card.action === 'record' && card.evidenceRecords[0]) {
      onOpenRecord(card.evidenceRecords[0]);
      return;
    }
    if (card.action === 'weekly') {
      onOpenWeekly();
      return;
    }
    onOpenRecords(card.actionQuery ?? '');
  };

  if (!state && !notice) {
    return null;
  }
  if (state && state.cards.length === 0 && state.suppressedCards.length === 0 && !notice) {
    return null;
  }

  return (
    <section className="evolving-dashboard" aria-labelledby="dashboard-title">
      <div className="dashboard-heading">
        <div>
          <p className="eyebrow">기록에 따라 달라지는 첫 화면</p>
          <h2 id="dashboard-title">지금 이어 볼 흐름</h2>
        </div>
        <div className="dashboard-heading-meta">
          <DataUseBadge scope="local" detail="첫 화면 제안은 저장된 기록 조건을 이 컴퓨터 안에서 계산합니다." />
          <span>최대 3개만 보여드려요</span>
        </div>
      </div>

      {notice && <div className="notice error" role="alert">{notice}</div>}

      {state && state.cards.length > 0 && (
        <div className="dashboard-card-grid">
          {state.cards.map((card) => (
            <article className={`dashboard-card card-${card.kind}`} key={card.key}>
              <div className="dashboard-card-topline">
                <span>{cardLabels[card.kind]}</span>
                {card.pinned && <strong>★ 고정됨</strong>}
              </div>
              <h3>{card.title}</h3>
              <p>{card.description}</p>

              <details className="card-evidence">
                <summary>왜 이 카드가 나왔나요?</summary>
                <p>{card.reason}</p>
                {card.evidenceRecords.length > 0 && (
                  <div>
                    {card.evidenceRecords.map((record) => (
                      <button type="button" key={record.id} onClick={() => onOpenRecord(record)}>
                        <time dateTime={record.recordDate}>{formatRecordDate(record.recordDate)}</time>
                        <span>{preview(record.content)}</span>
                      </button>
                    ))}
                  </div>
                )}
              </details>

              <div className="dashboard-card-actions">
                <button className="card-primary-action" type="button" onClick={() => openPrimaryAction(card)}>
                  {card.actionLabel}
                </button>
                <div>
                  <button type="button" disabled={isWorking} onClick={() => updateCard(card, { pinned: !card.pinned })}>
                    {card.pinned ? '고정 해제' : '고정'}
                  </button>
                  <button type="button" disabled={isWorking} onClick={() => updateCard(card, { status: 'hidden' })}>
                    숨김
                  </button>
                  <button type="button" disabled={isWorking} onClick={() => updateCard(card, { status: 'dismissed' })}>
                    관심 없음
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {state && state.suppressedCards.length > 0 && (
        <details className="suppressed-card-manager">
          <summary>숨긴 카드 관리 ({state.suppressedCards.length})</summary>
          <div>
            {state.suppressedCards.map((card) => (
              <div key={card.key}>
                <span>
                  <small>{card.status === 'dismissed' ? '관심 없음' : '숨김'}</small>
                  <strong>{card.title}</strong>
                </span>
                <button type="button" disabled={isWorking} onClick={() => updateCard(card, { status: 'active' })}>
                  다시 표시
                </button>
              </div>
            ))}
          </div>
        </details>
      )}
    </section>
  );
}
