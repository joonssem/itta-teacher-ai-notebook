import { FormEvent, useEffect, useState } from 'react';

import type { NewsState } from '../shared/contracts';
import DataUseBadge from './DataUseBadge';

const errorMessage = (error: unknown) => error instanceof Error
  ? error.message.replace(/^Error invoking remote method '[^']+': Error: /, '')
  : '새 소식을 불러오지 못했습니다. 기록 기능은 그대로 사용할 수 있습니다.';

const formatPublishedAt = (value: string) => new Intl.DateTimeFormat('ko-KR', {
  month: 'short',
  day: 'numeric',
}).format(new Date(value));

const formatFetchedAt = (value: string | null) => value
  ? new Intl.DateTimeFormat('ko-KR', {
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
  : '아직 확인 전';

export default function NewsCards() {
  const [state, setState] = useState<NewsState | null>(null);
  const [topics, setTopics] = useState(['', '']);
  const [isEditing, setIsEditing] = useState(false);
  const [isWorking, setIsWorking] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        let next = await window.itta.getNewsState();
        if (!active) return;
        setState(next);
        setTopics([next.topics[0] ?? '', next.topics[1] ?? '']);
        if (next.needsRefresh) {
          setIsWorking(true);
          next = await window.itta.refreshNews();
          if (!active) return;
          setState(next);
        }
      } catch (error) {
        if (active) setNotice(errorMessage(error));
      } finally {
        if (active) setIsWorking(false);
      }
    };
    void load();
    return () => { active = false; };
  }, []);

  const updateTopic = (index: number, value: string) => setTopics((current) =>
    current.map((topic, topicIndex) => topicIndex === index ? value : topic));

  const saveTopics = async (event: FormEvent) => {
    event.preventDefault();
    setIsWorking(true);
    setNotice(null);
    try {
      const updated = await window.itta.updateNewsTopics({ topics });
      setState(updated);
      setTopics([updated.topics[0] ?? '', updated.topics[1] ?? '']);
      setIsEditing(false);
      const refreshed = await window.itta.refreshNews();
      setState(refreshed);
      setNotice(refreshed.items.length > 0
        ? '관심 주제의 새 소식을 확인했습니다.'
        : refreshed.error || '오늘은 표시할 새 소식을 찾지 못했습니다.');
    } catch (error) {
      setNotice(errorMessage(error));
    } finally {
      setIsWorking(false);
    }
  };

  const openItem = async (itemId: string) => {
    try {
      if (!await window.itta.openNewsItem(itemId)) {
        setNotice('이 소식의 안전한 링크를 찾지 못했습니다.');
      }
    } catch (error) {
      setNotice(errorMessage(error));
    }
  };

  if (!state) return null;
  const configured = state.topics.length === 2;
  const showEditor = !configured || isEditing;
  const normalizedTopics = topics.map((topic) => topic.trim());
  const canSave = normalizedTopics.every((topic) => topic.length >= 2 && topic.length <= 40)
    && normalizedTopics[0].toLocaleLowerCase('ko-KR') !== normalizedTopics[1].toLocaleLowerCase('ko-KR');

  return (
    <section className="news-dashboard" aria-labelledby="news-title">
      <div className="news-heading">
        <div>
          <p className="eyebrow">분위기를 환기하는 짧은 읽을거리</p>
          <h2 id="news-title">오늘의 관심 주제</h2>
          <div className="data-use-context"><DataUseBadge scope="internet" detail="관심 주제 두 개만 Google News RSS로 전송됩니다." /></div>
        </div>
        {configured && !showEditor && (
          <button type="button" onClick={() => setIsEditing(true)}>주제 수정</button>
        )}
      </div>

      {showEditor ? (
        <form className="news-topic-editor" onSubmit={saveTopics}>
          <div>
            <label>
              <span>관심 주제 1</span>
              <input value={topics[0]} maxLength={40} placeholder="예: 프로젝트 학습" onChange={(event) => updateTopic(0, event.target.value)} />
            </label>
            <label>
              <span>관심 주제 2</span>
              <input value={topics[1]} maxLength={40} placeholder="예: 디지털 시민교육" onChange={(event) => updateTopic(1, event.target.value)} />
            </label>
          </div>
          <p>일반적인 교육 주제를 입력하세요. 두 주제 단어만 Google News에 하루 한 번 전송하며 교실 기록·API 키는 보내지 않습니다.</p>
          <div>
            {configured && <button className="secondary-button" type="button" disabled={isWorking} onClick={() => { setIsEditing(false); setTopics([state.topics[0], state.topics[1]]); }}>취소</button>}
            <button className="primary-button" type="submit" disabled={isWorking || !canSave}>{isWorking ? '새 소식 확인 중…' : '두 주제 저장·소식 확인'}</button>
          </div>
        </form>
      ) : (
        <>
          <div className="news-topic-row">
            <div>{state.topics.map((topic) => <span key={topic}># {topic}</span>)}</div>
            <small>{isWorking ? '새 소식 확인 중…' : `최근 확인 ${formatFetchedAt(state.lastFetchedAt)}`}</small>
          </div>
          {state.items.length > 0 ? (
            <div className="news-card-grid">
              {state.items.map((item) => (
                <article key={item.id}>
                  <div><span>{item.topic}</span><time dateTime={item.publishedAt}>{formatPublishedAt(item.publishedAt)}</time></div>
                  <h3>{item.title}</h3>
                  <div><small>{item.source}</small><button type="button" onClick={() => openItem(item.id)}>브라우저에서 읽기</button></div>
                </article>
              ))}
            </div>
          ) : (
            <div className="news-empty"><strong>{isWorking ? '새 소식을 찾고 있습니다…' : '오늘은 표시할 소식이 없습니다.'}</strong><p>뉴스 연결이 되지 않아도 교실 기록과 정리는 그대로 사용할 수 있습니다.</p></div>
          )}
        </>
      )}

      {(notice || (!showEditor && state.error)) && (
        <p className="news-notice" role="status">{notice || state.error}</p>
      )}
    </section>
  );
}
