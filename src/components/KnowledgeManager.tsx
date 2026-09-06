import { useCallback, useEffect, useMemo, useState } from 'react';

import { KNOWLEDGE_KIND_LABELS } from '../shared/knowledge';
import type {
  AiSettingsState,
  KnowledgeSearchHit,
  KnowledgeSourceKind,
  KnowledgeState,
  RagDraft,
  RagResult,
  SavedRagConnection,
  TeacherRecord,
} from '../shared/contracts';
import DataUseBadge from './DataUseBadge';

interface KnowledgeManagerProps {
  aiState: AiSettingsState;
  onOpenAiSettings: () => void;
  onOpenRecord: (record: TeacherRecord) => void;
  onOpenDocument: (id: string) => void;
}

const errorMessage = (error: unknown) => error instanceof Error
  ? error.message.replace(/^Error invoking remote method '[^']+': Error: /, '')
  : '교육자료 요청을 처리하지 못했습니다. 원본 기록과 자료는 그대로 유지됩니다.';

const preview = (value: string, length = 180) =>
  value.length > length ? `${value.slice(0, length)}…` : value;
const listToText = (values: string[]) => values.join('\n');
const textToList = (value: string) => value
  .split('\n')
  .map((item) => item.replace(/^[-•]\s*/, '').trim())
  .filter(Boolean);

export default function KnowledgeManager({
  aiState,
  onOpenAiSettings,
  onOpenRecord,
  onOpenDocument,
}: KnowledgeManagerProps) {
  const [state, setState] = useState<KnowledgeState | null>(null);
  const [records, setRecords] = useState<TeacherRecord[]>([]);
  const [savedConnections, setSavedConnections] = useState<SavedRagConnection[]>([]);
  const [kind, setKind] = useState<KnowledgeSourceKind>('curriculum');
  const [recordId, setRecordId] = useState('');
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<KnowledgeSearchHit[]>([]);
  const [selectedChunkIds, setSelectedChunkIds] = useState<string[]>([]);
  const [draft, setDraft] = useState<RagDraft | null>(null);
  const [isWorking, setIsWorking] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const selectedRecord = useMemo(
    () => records.find((record) => record.id === recordId) ?? null,
    [recordId, records],
  );
  const selectedHits = useMemo(() => {
    const selected = new Set(selectedChunkIds);
    return hits.filter((hit) => selected.has(hit.id));
  }, [hits, selectedChunkIds]);

  const load = useCallback(async () => {
    try {
      const [nextState, nextRecords, nextConnections] = await Promise.all([
        window.itta.getKnowledgeState(),
        window.itta.listRecords({ limit: 100 }),
        window.itta.listRagConnections(),
      ]);
      setState(nextState);
      setRecords(nextRecords);
      setSavedConnections(nextConnections);
      setRecordId((current) => current || nextRecords[0]?.id || '');
    } catch (error) {
      setNotice(errorMessage(error));
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const importFiles = async () => {
    setIsWorking(true);
    setNotice(null);
    try {
      const before = state?.sources.length ?? 0;
      const next = await window.itta.importKnowledgeFiles({ kind });
      setState(next);
      const imported = Math.max(0, next.sources.length - before);
      setNotice(imported > 0
        ? `교육자료 ${imported}개를 기기에 복사하고 검색 조각으로 나눴습니다.`
        : '새로 추가된 자료가 없습니다. 같은 내용의 자료는 중복 등록하지 않습니다.');
    } catch (error) {
      setNotice(errorMessage(error));
    } finally {
      setIsWorking(false);
    }
  };

  const removeSource = async (sourceId: string) => {
    if (!window.confirm('이 자료를 검색 목록에서 제외할까요? 기기에 복사한 원본 파일은 지우지 않습니다.')) return;
    setIsWorking(true);
    try {
      setState(await window.itta.removeKnowledgeSource(sourceId));
      setHits((current) => current.filter((hit) => hit.sourceId !== sourceId));
      setSelectedChunkIds((current) => current.filter((chunkId) =>
        !hits.some((hit) => hit.id === chunkId && hit.sourceId === sourceId)));
      setNotice('교육자료를 검색 목록에서 제외했습니다. 복사한 원본 파일은 그대로 보관합니다.');
    } catch (error) {
      setNotice(errorMessage(error));
    } finally {
      setIsWorking(false);
    }
  };

  const search = async () => {
    setIsWorking(true);
    setNotice(null);
    setDraft(null);
    try {
      const response = await window.itta.searchKnowledge({ query, recordId: recordId || undefined });
      setHits(response.hits);
      setSelectedChunkIds(response.hits.slice(0, 5).map((hit) => hit.id));
      setNotice(response.hits.length > 0
        ? `기기 안에서 관련 근거 ${response.hits.length}개를 찾았습니다.`
        : '관련 근거를 찾지 못했습니다. 검색어를 바꾸거나 자료를 더 추가해 주세요.');
    } catch (error) {
      setNotice(errorMessage(error));
    } finally {
      setIsWorking(false);
    }
  };

  const toggleChunk = (chunkId: string) => setSelectedChunkIds((current) => {
    if (current.includes(chunkId)) return current.filter((id) => id !== chunkId);
    if (current.length >= 5) {
      setNotice('AI에 보낼 교육자료 근거는 최대 5개까지 선택할 수 있습니다.');
      return current;
    }
    return [...current, chunkId];
  });

  const generate = async () => {
    if (!recordId || selectedChunkIds.length === 0) {
      setNotice('교실 기록과 교육자료 근거를 선택해 주세요.');
      return;
    }
    if (!aiState.session.connected) {
      setNotice('교육자료와 연결하려면 메뉴에서 AI를 다시 연결해 주세요.');
      return;
    }
    setIsWorking(true);
    setNotice(null);
    try {
      setDraft(await window.itta.generateRagConnection({ recordId, query, chunkIds: selectedChunkIds }));
    } catch (error) {
      setNotice(errorMessage(error));
    } finally {
      setIsWorking(false);
    }
  };

  const updateResult = <Key extends keyof RagResult>(key: Key, value: RagResult[Key]) =>
    setDraft((current) => current
      ? { ...current, result: { ...current.result, [key]: value } }
      : current);

  const saveDraft = async () => {
    if (!draft) return;
    setIsWorking(true);
    setNotice(null);
    try {
      await window.itta.saveRagConnection({ draft });
      setNotice('검토·채택한 교육자료 연결을 Markdown으로 저장했습니다.');
      setDraft(null);
      setSavedConnections(await window.itta.listRagConnections());
    } catch (error) {
      setNotice(errorMessage(error));
    } finally {
      setIsWorking(false);
    }
  };

  if (!state) {
    return <section className="weekly-manager weekly-loading"><p>교육자료 목록을 불러오고 있습니다…</p></section>;
  }

  return (
    <section className="weekly-manager knowledge-manager" aria-labelledby="knowledge-title">
      <div className="weekly-heading">
        <div>
          <p className="eyebrow">교사가 직접 채우는 로컬 근거 보관함</p>
          <h1 id="knowledge-title">교육자료 연결</h1>
          <p>자료 검색은 기기 안에서 수행하며, 교사가 선택한 근거 조각만 AI에 전송합니다.</p>
          <div className="data-use-context"><DataUseBadge scope="local" detail="자료 가져오기·조각 분리·관련 근거 검색은 이 컴퓨터 안에서 처리됩니다." /></div>
        </div>
        <div className="knowledge-stats"><strong>{state.sources.length}</strong><span>자료</span><strong>{state.totalChunks}</strong><span>검색 조각</span></div>
      </div>

      {notice && <div className={`notice ${notice.includes('저장했습니다') || notice.includes('추가') ? 'success' : ''}`} role="status"><span>{notice}</span>{!aiState.session.connected && <button type="button" onClick={onOpenAiSettings}>AI 연결</button>}</div>}

      {!draft ? (
        <>
          <section className="knowledge-source-card">
            <div>
              <h2>내 교육자료 추가</h2>
              <p>PDF·DOCX·HWPX·Markdown·텍스트, 파일당 25MB 이하 · 스캔 PDF 제외</p>
              <p><small>표·머리글·각주는 읽고 이미지·첨부물·숨은 편집 정보는 제외합니다. 구형 HWP는 HWPX, PDF 또는 DOCX로 다시 저장해 주세요.</small></p>
            </div>
            <div className="knowledge-import-actions">
              <label><span>자료 종류</span><select value={kind} onChange={(event) => setKind(event.target.value as KnowledgeSourceKind)}>{Object.entries(KNOWLEDGE_KIND_LABELS).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>
              <button className="primary-button" type="button" disabled={isWorking} onClick={importFiles}>{isWorking ? '처리하는 중…' : '파일 선택·추가'}</button>
            </div>
            {state.sources.length > 0 && <div className="knowledge-source-list">{state.sources.map((source) => <article key={source.id}><span><strong>{source.title}</strong><small>{KNOWLEDGE_KIND_LABELS[source.kind]} · {source.fileType.toUpperCase()} · {source.characterCount.toLocaleString()}자 · {source.chunkCount}조각</small></span><div><button type="button" onClick={() => window.itta.showKnowledgeSourceFile(source.id)}>원본 보기</button><button type="button" onClick={() => removeSource(source.id)}>목록 제외</button></div></article>)}</div>}
          </section>

          <section className="knowledge-connect-card">
            <div><h2>교실 기록과 근거 찾기</h2><p>AI를 호출하기 전에 관련 조각을 기기 안에서 먼저 찾고 직접 선택합니다.</p></div>
            <label><span>연결할 교실 기록</span><select value={recordId} onChange={(event) => { setRecordId(event.target.value); setHits([]); setSelectedChunkIds([]); }}>{records.length === 0 && <option value="">저장된 기록 없음</option>}{records.map((record) => <option key={record.id} value={record.id}>{record.recordDate} · {preview(record.content, 60)}</option>)}</select></label>
            {selectedRecord && <button className="knowledge-record-preview" type="button" onClick={() => onOpenRecord(selectedRecord)}><strong>{selectedRecord.recordDate}</strong><span>{preview(selectedRecord.content)}</span></button>}
            <label><span>찾고 싶은 관점 <small>선택 입력</small></span><input value={query} maxLength={500} placeholder="예: 학생 선택권, 프로젝트 학습, 형성평가" onChange={(event) => setQuery(event.target.value)} /></label>
            <div className="knowledge-search-actions"><span>검색어와 선택 기록은 이 단계에서 외부로 전송되지 않습니다.</span><button className="secondary-button" type="button" disabled={isWorking || state.sources.length === 0 || (!recordId && !query.trim())} onClick={search}>기기 안에서 근거 찾기</button></div>
          </section>

          {hits.length > 0 && <section className="knowledge-results-card"><div><h2>관련 교육자료 근거</h2><span>{selectedChunkIds.length}/5개 선택</span></div><div className="knowledge-hit-list">{hits.map((hit) => <label key={hit.id}><input type="checkbox" checked={selectedChunkIds.includes(hit.id)} onChange={() => toggleChunk(hit.id)} /><span><strong>{hit.sourceTitle} · 조각 {hit.chunkIndex + 1}</strong><small>{KNOWLEDGE_KIND_LABELS[hit.sourceKind]} · 관련도 {hit.score}</small><p>{preview(hit.content, 360)}</p></span></label>)}</div><div className="weekly-generate-actions"><span className="data-use-action-label"><DataUseBadge scope="ai" detail="선택한 교실 기록과 교육자료 근거 최대 5개만 AI API로 전송됩니다." />{aiState.session.connected ? `${aiState.session.provider} · ${aiState.session.model}` : 'AI 미연결'} · 선택 근거 {selectedHits.reduce((sum, hit) => sum + hit.content.length, 0).toLocaleString()}자</span><button className="primary-button" type="button" disabled={isWorking || selectedChunkIds.length === 0 || !recordId} onClick={generate}>{isWorking ? '근거와 기록을 연결하는 중…' : '선택 근거로 AI 연결 초안'}</button></div></section>}

          {savedConnections.length > 0 && <section className="saved-weekly-list"><div><h2>저장한 교육자료 연결</h2><span>{savedConnections.length}개</span></div>{savedConnections.map((connection) => <article key={connection.id}><span><strong>{connection.result.overview || '교육자료 연결'}</strong><small>{connection.provider} · 근거 {connection.chunkIds.length}개</small></span><button type="button" onClick={() => onOpenDocument(connection.id)}>문서 보기</button></article>)}</section>}
        </>
      ) : (
        <section className="weekly-draft-review">
          <div className="weekly-draft-heading"><div><p className="eyebrow">근거 기반 AI 초안 · 교사가 최종 결정</p><h2>교육자료 연결을 검토하고 고쳐 주세요</h2></div><span>{draft.provider} · {draft.model}</span></div>
          <p>AI가 만든 내용은 아직 저장되지 않았습니다. 각 연결에는 실제로 전송한 자료 조각 ID만 남습니다.</p>
          <div className="weekly-result-fields">
            <label><span>연결 요약</span><textarea value={draft.result.overview} onChange={(event) => updateResult('overview', event.target.value)} /></label>
            {draft.result.connections.map((connection, index) => <label key={`${connection.chunkIds.join('-')}-${index}`}><span>근거 연결 {index + 1} <small>{connection.chunkIds.join(', ')}</small></span><textarea value={connection.statement} onChange={(event) => updateResult('connections', draft.result.connections.map((item, itemIndex) => itemIndex === index ? { ...item, statement: event.target.value } : item))} /></label>)}
            {(['encouragements', 'reminders', 'reflectionQuestions', 'nextActions'] as const).map((key) => <label key={key}><span>{{ encouragements: '근거와 함께 발견한 강점', reminders: '환기할 관점', reflectionQuestions: '성찰 질문', nextActions: '다음 실천' }[key]} <small>한 줄에 하나씩</small></span><textarea value={listToText(draft.result[key])} onChange={(event) => updateResult(key, textToList(event.target.value))} /></label>)}
          </div>
          <details className="weekly-evidence-review"><summary>사용한 교육자료 근거 {selectedHits.length}개 확인</summary><div>{selectedHits.map((hit) => <button type="button" key={hit.id} onClick={() => window.itta.showKnowledgeSourceFile(hit.sourceId)}><time>{hit.sourceTitle}</time><span>{preview(hit.content)}</span></button>)}</div></details>
          <div className="weekly-review-actions"><button className="secondary-button" type="button" disabled={isWorking} onClick={() => setDraft(null)}>초안 버리고 근거 다시 선택</button><button className="primary-button" type="button" disabled={isWorking} onClick={saveDraft}>{isWorking ? '저장하는 중…' : '수정 결과 채택·Markdown 저장'}</button></div>
        </section>
      )}
    </section>
  );
}
