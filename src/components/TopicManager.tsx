import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';

import type { TeacherRecord, TopicState } from '../shared/contracts';
import DataUseBadge from './DataUseBadge';

interface TopicManagerProps {
  onOpenRecord: (record: TeacherRecord) => void;
  initialTopicId?: string | null;
}

const errorMessage = (error: unknown) => {
  if (error instanceof Error) {
    return error.message.replace(/^Error invoking remote method '[^']+': Error: /, '');
  }
  return '주제 정보를 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.';
};

const formatRecordDate = (value: string) => new Intl.DateTimeFormat('ko-KR', {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
}).format(new Date(`${value}T00:00:00`));

const preview = (content: string) =>
  content.length > 140 ? `${content.slice(0, 140)}…` : content;

export default function TopicManager({ onOpenRecord, initialTopicId = null }: TopicManagerProps) {
  const [state, setState] = useState<TopicState>({ topics: [], suggestions: [] });
  const [selectedId, setSelectedId] = useState<string | null>(initialTopicId);
  const [records, setRecords] = useState<TeacherRecord[]>([]);
  const [allRecords, setAllRecords] = useState<TeacherRecord[]>([]);
  const [recordToLinkId, setRecordToLinkId] = useState('');
  const [newTopicName, setNewTopicName] = useState('');
  const [editName, setEditName] = useState('');
  const [mergeTargetId, setMergeTargetId] = useState('');
  const [suggestionNames, setSuggestionNames] = useState<Record<string, string>>({});
  const [isWorking, setIsWorking] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const selectedTopic = useMemo(
    () => state.topics.find((topic) => topic.id === selectedId) ?? null,
    [selectedId, state.topics],
  );
  const availableRecords = useMemo(() => {
    const linkedIds = new Set(records.map((record) => record.id));
    return allRecords.filter((record) => !linkedIds.has(record.id));
  }, [allRecords, records]);

  const loadTopics = useCallback(async () => {
    try {
      const nextState = await window.itta.listTopics();
      setState(nextState);
      setSuggestionNames((current) => Object.fromEntries(
        nextState.suggestions.map((suggestion) => [
          suggestion.normalizedName,
          current[suggestion.normalizedName] ?? suggestion.name,
        ]),
      ));
      setSelectedId((current) =>
        current && nextState.topics.some((topic) => topic.id === current) ? current : null);
    } catch (error) {
      setNotice(errorMessage(error));
    }
  }, []);

  useEffect(() => {
    void loadTopics();
  }, [loadTopics]);

  useEffect(() => {
    if (!selectedTopic) {
      setRecords([]);
      setAllRecords([]);
      setRecordToLinkId('');
      setEditName('');
      setMergeTargetId('');
      return;
    }
    setEditName(selectedTopic.name);
    const firstTarget = state.topics.find((topic) => topic.id !== selectedTopic.id)?.id ?? '';
    setMergeTargetId(firstTarget);
    Promise.all([
      window.itta.listRecords({ topicId: selectedTopic.id, limit: 100 }),
      window.itta.listRecords({ limit: 100 }),
    ])
      .then(([topicRecords, everyRecord]) => {
        setRecords(topicRecords);
        setAllRecords(everyRecord);
        const linkedIds = new Set(topicRecords.map((record) => record.id));
        setRecordToLinkId(everyRecord.find((record) => !linkedIds.has(record.id))?.id ?? '');
      })
      .catch((error) => setNotice(errorMessage(error)));
  }, [selectedTopic, state.topics]);

  const createNewTopic = async (event: FormEvent) => {
    event.preventDefault();
    setIsWorking(true);
    setNotice(null);
    try {
      const created = await window.itta.createTopic({ name: newTopicName });
      setState(created.state);
      setSelectedId(created.topicId);
      setNewTopicName('');
      setNotice('새 주제를 만들었습니다. 관련 기록은 AI 후보를 채택하거나 기록 연결 기능에서 추가할 수 있습니다.');
    } catch (error) {
      setNotice(errorMessage(error));
    } finally {
      setIsWorking(false);
    }
  };

  const adoptSuggestion = async (normalizedName: string) => {
    setIsWorking(true);
    setNotice(null);
    try {
      const nextState = await window.itta.adoptTopicSuggestion({
        normalizedName,
        name: suggestionNames[normalizedName] ?? normalizedName,
      });
      setState(nextState);
      setNotice('주제를 채택하고 제안의 근거 기록을 연결했습니다.');
    } catch (error) {
      setNotice(errorMessage(error));
    } finally {
      setIsWorking(false);
    }
  };

  const dismissSuggestion = async (normalizedName: string) => {
    setIsWorking(true);
    setNotice(null);
    try {
      setState(await window.itta.dismissTopicSuggestion(normalizedName));
      setNotice('이 주제 후보를 숨겼습니다.');
    } catch (error) {
      setNotice(errorMessage(error));
    } finally {
      setIsWorking(false);
    }
  };

  const updateSelectedTopic = async (changes: {
    name?: string;
    pinned?: boolean;
    hidden?: boolean;
  }) => {
    if (!selectedTopic) {
      return;
    }
    setIsWorking(true);
    setNotice(null);
    try {
      setState(await window.itta.updateTopic({ id: selectedTopic.id, ...changes }));
      setNotice('주제 설정을 반영했습니다.');
    } catch (error) {
      setNotice(errorMessage(error));
    } finally {
      setIsWorking(false);
    }
  };

  const mergeSelectedTopic = async () => {
    if (!selectedTopic || !mergeTargetId) {
      return;
    }
    const target = state.topics.find((topic) => topic.id === mergeTargetId);
    if (!target || !window.confirm(`‘${selectedTopic.name}’ 주제를 ‘${target.name}’에 합칠까요? 연결된 기록은 유지됩니다.`)) {
      return;
    }
    setIsWorking(true);
    setNotice(null);
    try {
      setState(await window.itta.mergeTopics({
        sourceId: selectedTopic.id,
        targetId: target.id,
      }));
      setSelectedId(target.id);
      setNotice('두 주제를 합치고 관련 기록을 한곳에 모았습니다.');
    } catch (error) {
      setNotice(errorMessage(error));
    } finally {
      setIsWorking(false);
    }
  };

  const deleteSelectedTopic = async () => {
    if (!selectedTopic || !window.confirm(`‘${selectedTopic.name}’ 주제를 삭제할까요? 원본 기록과 Markdown 파일은 삭제되지 않습니다.`)) {
      return;
    }
    setIsWorking(true);
    setNotice(null);
    try {
      setState(await window.itta.deleteTopic(selectedTopic.id));
      setSelectedId(null);
      setNotice('주제 연결만 삭제했습니다. 원본 기록은 그대로 남아 있습니다.');
    } catch (error) {
      setNotice(errorMessage(error));
    } finally {
      setIsWorking(false);
    }
  };

  const linkRecord = async () => {
    if (!selectedTopic || !recordToLinkId) {
      return;
    }
    setIsWorking(true);
    setNotice(null);
    try {
      setState(await window.itta.linkTopicRecord({
        topicId: selectedTopic.id,
        recordId: recordToLinkId,
      }));
      setNotice('기록을 이 주제에 연결하고 Markdown을 갱신했습니다.');
    } catch (error) {
      setNotice(errorMessage(error));
    } finally {
      setIsWorking(false);
    }
  };

  const unlinkRecord = async (recordId: string) => {
    if (!selectedTopic) {
      return;
    }
    setIsWorking(true);
    setNotice(null);
    try {
      setState(await window.itta.unlinkTopicRecord({
        topicId: selectedTopic.id,
        recordId,
      }));
      setNotice('주제 연결만 해제했습니다. 원본 기록은 그대로 남아 있습니다.');
    } catch (error) {
      setNotice(errorMessage(error));
    } finally {
      setIsWorking(false);
    }
  };

  return (
    <section className="topic-manager" aria-labelledby="topic-title">
      <div className="topic-page-heading">
        <div>
          <p className="eyebrow">기록이 쌓이며 진화하는 분류</p>
          <h1 id="topic-title">주제별 정리</h1>
          <p>AI의 제안은 후보로만 모입니다. 교사가 채택한 뒤에만 확정 주제와 관련 기록으로 연결됩니다.</p>
          <div className="data-use-context"><DataUseBadge scope="local" detail="주제 채택·수정·병합과 기록 연결은 이 컴퓨터 안에서 처리됩니다." /></div>
        </div>
        <form className="topic-create-form" onSubmit={createNewTopic}>
          <label htmlFor="new-topic">직접 주제 만들기</label>
          <div>
            <input
              id="new-topic"
              value={newTopicName}
              maxLength={50}
              placeholder="예: 우리 동네 프로젝트"
              onChange={(event) => setNewTopicName(event.target.value)}
            />
            <button className="primary-button" type="submit" disabled={isWorking || !newTopicName.trim()}>
              추가
            </button>
          </div>
        </form>
      </div>

      {notice && <div className="notice" role="status">{notice}</div>}

      <div className="topic-workspace">
        <div className="topic-column">
          <div className="topic-section-heading">
            <div>
              <h2>AI가 찾은 주제 후보</h2>
              <p>이름을 고친 뒤 채택할 수도 있습니다.</p>
            </div>
            <span>{state.suggestions.length}개</span>
          </div>
          {state.suggestions.length === 0 ? (
            <div className="topic-empty">
              <strong>아직 주제 후보가 없습니다.</strong>
              <p>AI 정리 결과를 채택하면 이어질 주제 후보가 이곳에 쌓입니다.</p>
            </div>
          ) : (
            <div className="suggestion-list">
              {state.suggestions.map((suggestion) => (
                <article className="suggestion-card" key={suggestion.normalizedName}>
                  <div className="suggestion-meta">
                    <span className={suggestion.recordCount >= 3 ? 'emerging' : ''}>
                      {suggestion.recordCount >= 3 ? '새 주제 발견' : 'AI 후보'}
                    </span>
                    <small>근거 기록 {suggestion.recordCount}개</small>
                  </div>
                  <input
                    aria-label={`${suggestion.name} 후보 이름`}
                    value={suggestionNames[suggestion.normalizedName] ?? suggestion.name}
                    maxLength={50}
                    onChange={(event) => setSuggestionNames((current) => ({
                      ...current,
                      [suggestion.normalizedName]: event.target.value,
                    }))}
                  />
                  <div className="suggestion-actions">
                    <button type="button" disabled={isWorking} onClick={() => dismissSuggestion(suggestion.normalizedName)}>
                      관심 없음
                    </button>
                    <button className="primary-button" type="button" disabled={isWorking} onClick={() => adoptSuggestion(suggestion.normalizedName)}>
                      채택하고 연결
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>

        <div className="topic-column confirmed-topic-column">
          <div className="topic-section-heading">
            <div>
              <h2>내가 채택한 주제</h2>
              <p>주제를 선택하면 관련 기록과 관리 기능을 볼 수 있습니다.</p>
            </div>
            <span>{state.topics.length}개</span>
          </div>
          {state.topics.length === 0 ? (
            <div className="topic-empty">
              <strong>아직 확정한 주제가 없습니다.</strong>
              <p>직접 만들거나 AI 후보를 채택해 시작하세요.</p>
            </div>
          ) : (
            <div className="confirmed-topic-list">
              {state.topics.map((topic) => (
                <button
                  className={`${selectedId === topic.id ? 'selected' : ''} ${topic.hidden ? 'hidden-topic' : ''}`}
                  type="button"
                  key={topic.id}
                  onClick={() => setSelectedId(topic.id)}
                >
                  <span>
                    <strong>{topic.pinned && '★ '}{topic.name}</strong>
                    <small>{topic.source === 'ai' ? 'AI 제안에서 채택' : '교사가 직접 생성'}</small>
                  </span>
                  <em>{topic.hidden ? '숨김' : `${topic.recordCount}개 기록`}</em>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {selectedTopic && (
        <section className="topic-detail" aria-labelledby="selected-topic-title">
          <div className="topic-detail-heading">
            <div>
              <p className="eyebrow">선택한 주제</p>
              <h2 id="selected-topic-title">{selectedTopic.name}</h2>
            </div>
            <div className="topic-detail-flags">
              <button type="button" disabled={isWorking} onClick={() => updateSelectedTopic({ pinned: !selectedTopic.pinned })}>
                {selectedTopic.pinned ? '고정 해제' : '★ 위에 고정'}
              </button>
              <button type="button" disabled={isWorking} onClick={() => updateSelectedTopic({ hidden: !selectedTopic.hidden })}>
                {selectedTopic.hidden ? '다시 표시' : '목록에서 숨김'}
              </button>
            </div>
          </div>

          <div className="topic-edit-grid">
            <label>
              <span>주제 이름</span>
              <div>
                <input value={editName} maxLength={50} onChange={(event) => setEditName(event.target.value)} />
                <button type="button" disabled={isWorking || !editName.trim()} onClick={() => updateSelectedTopic({ name: editName })}>
                  이름 저장
                </button>
              </div>
            </label>
            <label>
              <span>다른 주제에 병합</span>
              <div>
                <select value={mergeTargetId} onChange={(event) => setMergeTargetId(event.target.value)}>
                  <option value="">대상 선택</option>
                  {state.topics.filter((topic) => topic.id !== selectedTopic.id).map((topic) => (
                    <option value={topic.id} key={topic.id}>{topic.name}</option>
                  ))}
                </select>
                <button type="button" disabled={isWorking || !mergeTargetId} onClick={mergeSelectedTopic}>병합</button>
              </div>
            </label>
          </div>

          <div className="topic-record-heading">
            <div>
              <h3>관련 기록</h3>
              <p>주제를 채택할 때 근거가 된 기록입니다.</p>
            </div>
            <button className="danger-text" type="button" disabled={isWorking} onClick={deleteSelectedTopic}>
              주제 삭제
            </button>
          </div>
          <div className="topic-link-record">
            <label htmlFor="topic-record-select">기존 기록 직접 연결</label>
            <div>
              <select
                id="topic-record-select"
                value={recordToLinkId}
                disabled={availableRecords.length === 0}
                onChange={(event) => setRecordToLinkId(event.target.value)}
              >
                {availableRecords.length === 0 ? (
                  <option value="">연결할 수 있는 다른 기록이 없습니다</option>
                ) : availableRecords.map((record) => (
                  <option value={record.id} key={record.id}>
                    {record.recordDate} · {preview(record.content).slice(0, 45)}
                  </option>
                ))}
              </select>
              <button type="button" disabled={isWorking || !recordToLinkId} onClick={linkRecord}>기록 연결</button>
            </div>
          </div>
          {records.length === 0 ? (
            <div className="topic-empty compact">
              <strong>연결된 기록이 없습니다.</strong>
              <p>주제는 유지되며 이후 연결 기능에서 기록을 추가할 수 있습니다.</p>
            </div>
          ) : (
            <div className="topic-record-list">
              {records.map((record) => (
                <article key={record.id}>
                  <button className="topic-record-open" type="button" onClick={() => onOpenRecord(record)}>
                    <time dateTime={record.recordDate}>{formatRecordDate(record.recordDate)}</time>
                    <strong>{preview(record.content)}</strong>
                    <span>기록 열기 →</span>
                  </button>
                  <button className="topic-unlink-button" type="button" disabled={isWorking} onClick={() => unlinkRecord(record.id)}>
                    연결 해제
                  </button>
                </article>
              ))}
            </div>
          )}
        </section>
      )}
    </section>
  );
}
