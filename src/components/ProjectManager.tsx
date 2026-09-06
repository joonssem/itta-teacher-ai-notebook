import { useCallback, useEffect, useMemo, useState } from 'react';

import { getDefaultProjectRange, PROJECT_SECTION_OPTIONS } from '../shared/project';
import { KNOWLEDGE_KIND_LABELS } from '../shared/knowledge';
import type {
  AiSettingsState,
  KnowledgeSearchHit,
  ProjectSummaryDraft,
  ProjectSummaryResult,
  ProjectWorkspace,
  TeacherRecord,
} from '../shared/contracts';
import DataUseBadge from './DataUseBadge';

interface ProjectManagerProps {
  aiState: AiSettingsState;
  onOpenAiSettings: () => void;
  onOpenRecord: (record: TeacherRecord) => void;
  onOpenKnowledge: () => void;
  onOpenDocument: (id: string) => void;
}

const formatDate = (value: string) => new Intl.DateTimeFormat('ko-KR', {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
}).format(new Date(`${value}T12:00:00`));

const errorMessage = (error: unknown) => error instanceof Error
  ? error.message.replace(/^Error invoking remote method '[^']+': Error: /, '')
  : '프로젝트 정리를 처리하지 못했습니다. 원본 기록은 그대로 유지됩니다.';

const listToText = (items: string[]) => items.join('\n');
const textToList = (value: string) => value
  .split('\n')
  .map((item) => item.replace(/^[-•]\s*/, '').trim())
  .filter(Boolean);
const preview = (content: string) => content.length > 180 ? `${content.slice(0, 180)}…` : content;

export default function ProjectManager({
  aiState,
  onOpenAiSettings,
  onOpenRecord,
  onOpenKnowledge,
  onOpenDocument,
}: ProjectManagerProps) {
  const initialRange = useMemo(() => getDefaultProjectRange(), []);
  const [title, setTitle] = useState('');
  const [seedQuestion, setSeedQuestion] = useState('');
  const [periodStart, setPeriodStart] = useState(initialRange.periodStart);
  const [periodEnd, setPeriodEnd] = useState(initialRange.periodEnd);
  const [workspace, setWorkspace] = useState<ProjectWorkspace | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [recordFilter, setRecordFilter] = useState('');
  const [knowledgeHits, setKnowledgeHits] = useState<KnowledgeSearchHit[]>([]);
  const [selectedChunkIds, setSelectedChunkIds] = useState<string[]>([]);
  const [isSearchingKnowledge, setIsSearchingKnowledge] = useState(false);
  const [reflectionLevel, setReflectionLevel] = useState(50);
  const [draft, setDraft] = useState<ProjectSummaryDraft | null>(null);
  const [isWorking, setIsWorking] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const loadWorkspace = useCallback(async (
    nextStart: string,
    nextEnd: string,
    keepNotice = false,
  ) => {
    try {
      const next = await window.itta.getProjectWorkspace({
        periodStart: nextStart,
        periodEnd: nextEnd,
      });
      setWorkspace(next);
      setSelectedIds(next.records.slice(0, 200).map((record) => record.id));
      setKnowledgeHits([]);
      setSelectedChunkIds([]);
      setDraft(null);
      if (!keepNotice) setNotice(null);
    } catch (error) {
      setNotice(errorMessage(error));
    }
  }, []);

  useEffect(() => {
    void loadWorkspace(initialRange.periodStart, initialRange.periodEnd);
  }, [initialRange, loadWorkspace]);

  const applyPeriod = () => {
    if (periodStart > periodEnd) {
      setNotice('시작일은 종료일보다 늦을 수 없습니다.');
      return;
    }
    void loadWorkspace(periodStart, periodEnd);
  };

  const visibleRecords = useMemo(() => {
    const query = recordFilter.trim().normalize('NFC').toLocaleLowerCase('ko-KR');
    if (!query) return workspace?.records ?? [];
    return (workspace?.records ?? []).filter((record) =>
      `${record.content} ${record.categories.join(' ')}`
        .normalize('NFC')
        .toLocaleLowerCase('ko-KR')
        .includes(query));
  }, [recordFilter, workspace]);

  const selectedRecords = useMemo(() => {
    const selected = new Set(selectedIds);
    return (workspace?.records ?? []).filter((record) => selected.has(record.id));
  }, [selectedIds, workspace]);
  const selectedCharacters = useMemo(
    () => selectedRecords.reduce((sum, record) => sum + record.content.length, 0),
    [selectedRecords],
  );
  const selectedKnowledgeHits = useMemo(() => {
    const selected = new Set(selectedChunkIds);
    return knowledgeHits.filter((hit) => selected.has(hit.id));
  }, [knowledgeHits, selectedChunkIds]);
  const selectedKnowledgeCharacters = useMemo(
    () => selectedKnowledgeHits.reduce((sum, hit) => sum + hit.content.length, 0),
    [selectedKnowledgeHits],
  );

  const toggleRecord = (recordId: string) => setSelectedIds((current) => {
    if (current.includes(recordId)) return current.filter((id) => id !== recordId);
    if (current.length >= 200) {
      setNotice('프로젝트 정리에는 기록을 최대 200개까지 선택할 수 있습니다.');
      return current;
    }
    return [...current, recordId];
  });

  const searchKnowledge = async () => {
    const recordContext = selectedRecords.slice(0, 8)
      .map((record) => `${record.categories.join(' ')} ${record.content.slice(0, 220)}`)
      .join(' ');
    const searchText = `${title} ${seedQuestion} ${recordContext}`.trim().slice(0, 500);
    if (!searchText) {
      setNotice('프로젝트 이름이나 출발 질문을 먼저 입력해 주세요.');
      return;
    }
    setIsSearchingKnowledge(true);
    setNotice(null);
    try {
      const response = await window.itta.searchKnowledge({ query: searchText });
      setKnowledgeHits(response.hits);
      setSelectedChunkIds(response.hits.slice(0, 5).map((hit) => hit.id));
      if (response.hits.length === 0) {
        setNotice('관련 교육자료 근거를 찾지 못했습니다. 교육자료를 추가하거나 프로젝트 표현을 바꿔 보세요.');
      }
    } catch (error) {
      setNotice(errorMessage(error));
    } finally {
      setIsSearchingKnowledge(false);
    }
  };

  const toggleKnowledge = (chunkId: string) => setSelectedChunkIds((current) => {
    if (current.includes(chunkId)) return current.filter((id) => id !== chunkId);
    if (current.length >= 5) {
      setNotice('교육자료 근거는 최대 5개까지 선택할 수 있습니다.');
      return current;
    }
    return [...current, chunkId];
  });

  const generate = async () => {
    if (!workspace || selectedIds.length === 0) {
      setNotice('프로젝트 정리에 사용할 기록을 한 개 이상 선택해 주세요.');
      return;
    }
    if (!title.trim()) {
      setNotice('프로젝트 이름을 입력해 주세요.');
      return;
    }
    if (!aiState.session.connected) {
      setNotice('프로젝트 정리를 만들려면 메뉴에서 AI를 다시 연결해 주세요.');
      return;
    }
    setIsWorking(true);
    setNotice(null);
    try {
      setDraft(await window.itta.generateProjectSummary({
        title,
        seedQuestion,
        periodStart: workspace.periodStart,
        periodEnd: workspace.periodEnd,
        recordIds: selectedIds,
        knowledgeChunkIds: selectedChunkIds,
        reflectionLevel,
      }));
    } catch (error) {
      setNotice(errorMessage(error));
    } finally {
      setIsWorking(false);
    }
  };

  const updateResult = <Key extends keyof ProjectSummaryResult>(
    key: Key,
    value: ProjectSummaryResult[Key],
  ) => setDraft((current) => current
    ? { ...current, result: { ...current.result, [key]: value } }
    : current);

  const updateEvidenceStatement = (index: number, statement: string) => setDraft((current) => {
    if (!current) return current;
    const educationEvidenceConnections = current.result.educationEvidenceConnections
      .map((connection, connectionIndex) => connectionIndex === index
        ? { ...connection, statement }
        : connection);
    return {
      ...current,
      result: { ...current.result, educationEvidenceConnections },
    };
  });

  const removeEvidenceConnection = (index: number) => setDraft((current) => current
    ? {
      ...current,
      result: {
        ...current.result,
        educationEvidenceConnections: current.result.educationEvidenceConnections
          .filter((_, connectionIndex) => connectionIndex !== index),
      },
    }
    : current);

  const saveDraft = async () => {
    if (!draft) return;
    setIsWorking(true);
    setNotice(null);
    try {
      await window.itta.saveProjectSummary({ draft });
      setNotice('검토·채택한 프로젝트 수업 정리를 Markdown으로 저장했습니다.');
      await loadWorkspace(draft.periodStart, draft.periodEnd, true);
    } catch (error) {
      setNotice(errorMessage(error));
    } finally {
      setIsWorking(false);
    }
  };

  if (!workspace) {
    return <section className="weekly-manager weekly-loading"><p>프로젝트 기록을 불러오고 있습니다…</p></section>;
  }

  const visibleSelectableIds = visibleRecords.slice(0, 200).map((record) => record.id);
  const visibleSelected = visibleSelectableIds.length > 0
    && visibleSelectableIds.every((recordId) => selectedIds.includes(recordId));

  return (
    <section className="weekly-manager project-manager" aria-labelledby="project-title">
      <div className="weekly-heading">
        <div>
          <p className="eyebrow">흩어진 기록을 하나의 배움으로 연결하는</p>
          <h1 id="project-title">프로젝트 수업 정리</h1>
          <p>질문·활동·학생 산출물·교사 성찰을 실제 교실 기록에 근거해 연결합니다.</p>
          <div className="data-use-context"><DataUseBadge scope="ai" detail="교사가 선택하고 확인한 비식별 기록, 프로젝트 이름·출발 질문, 선택한 교육자료 근거만 AI API로 전송됩니다." /></div>
        </div>
      </div>

      {notice && (
        <div className={`notice ${notice.includes('저장했습니다') ? 'success' : ''}`} role="status">
          <span>{notice}</span>
          {!aiState.session.connected && <button type="button" onClick={onOpenAiSettings}>AI 연결</button>}
        </div>
      )}

      {!draft ? (
        <>
          <section className="project-definition-card">
            <div className="project-definition-grid">
              <label>
                <span>프로젝트 이름 <small>필수</small></span>
                <input value={title} maxLength={100} placeholder="예: 우리 마을을 바꾸는 작은 제안" onChange={(event) => setTitle(event.target.value)} />
              </label>
              <label>
                <span>출발 질문 <small>선택</small></span>
                <input value={seedQuestion} maxLength={500} placeholder="예: 우리가 발견한 마을 문제를 어떻게 바꿀 수 있을까?" onChange={(event) => setSeedQuestion(event.target.value)} />
              </label>
            </div>
            <div className="project-period-controls">
              <label><span>시작일</span><input type="date" value={periodStart} onChange={(event) => setPeriodStart(event.target.value)} /></label>
              <label><span>종료일</span><input type="date" value={periodEnd} onChange={(event) => setPeriodEnd(event.target.value)} /></label>
              <button type="button" onClick={applyPeriod}>이 기간 기록 불러오기</button>
            </div>
          </section>

          <div className="weekly-selection-card">
            <div className="weekly-selection-heading">
              <div>
                <h2>프로젝트 근거 기록 선택</h2>
                <p>{formatDate(workspace.periodStart)}부터 {formatDate(workspace.periodEnd)}까지 · 선택한 비식별 기록만 AI에 전송됩니다.</p>
              </div>
              <label>
                <input type="checkbox" checked={visibleSelected} onChange={(event) => {
                  if (!event.target.checked) {
                    const visible = new Set(visibleSelectableIds);
                    setSelectedIds((current) => current.filter((id) => !visible.has(id)));
                    return;
                  }
                  setSelectedIds((current) => [...new Set([...current, ...visibleSelectableIds])].slice(0, 200));
                }} />
                보이는 기록 전체 선택
              </label>
            </div>

            <label className="project-record-filter">
              <span>기록 안에서 찾기</span>
              <input value={recordFilter} placeholder="단어 또는 카테고리" onChange={(event) => setRecordFilter(event.target.value)} />
            </label>

            {visibleRecords.length === 0 ? (
              <div className="weekly-empty"><strong>이 조건에 맞는 기록이 없습니다.</strong><p>기간이나 검색어를 바꾸거나 먼저 교실 기록을 작성해 주세요.</p></div>
            ) : (
              <div className="weekly-record-picker">
                {visibleRecords.map((record) => (
                  <label key={record.id}>
                    <input type="checkbox" checked={selectedIds.includes(record.id)} onChange={() => toggleRecord(record.id)} />
                    <span>
                      <time dateTime={record.recordDate}>{formatDate(record.recordDate)}</time>
                      <strong>{preview(record.content)}</strong>
                      <small>{record.categories.join(' · ') || '교실기록'}</small>
                    </span>
                  </label>
                ))}
              </div>
            )}

            <section className="project-knowledge-card" aria-labelledby="project-knowledge-title">
              <div className="project-knowledge-heading">
                <div>
                  <h3 id="project-knowledge-title">교육자료 근거 선택 <small>선택</small></h3>
                  <p>프로젝트 정보와 선택 기록으로 기기 안의 교육과정·교육 이론을 먼저 찾습니다.</p>
                  <div className="data-use-context"><DataUseBadge scope="local" detail="교육자료 검색과 관련도 계산은 AI 호출 없이 이 컴퓨터 안에서 처리됩니다." /></div>
                </div>
                <div>
                  <button type="button" onClick={onOpenKnowledge}>교육자료 관리</button>
                  <button type="button" disabled={isSearchingKnowledge} onClick={searchKnowledge}>{isSearchingKnowledge ? '근거 찾는 중…' : '관련 근거 찾기'}</button>
                </div>
              </div>

              {knowledgeHits.length > 0 ? (
                <div className="project-knowledge-hits">
                  {knowledgeHits.map((hit) => (
                    <label key={hit.id}>
                      <input type="checkbox" checked={selectedChunkIds.includes(hit.id)} onChange={() => toggleKnowledge(hit.id)} />
                      <span>
                        <strong>{hit.sourceTitle} · 조각 {hit.chunkIndex + 1}</strong>
                        <small>{KNOWLEDGE_KIND_LABELS[hit.sourceKind]} · 관련도 {hit.score}</small>
                        <p>{preview(hit.content)}</p>
                      </span>
                    </label>
                  ))}
                </div>
              ) : (
                <p className="project-knowledge-empty">근거 검색은 선택 사항입니다. 교육자료 없이도 프로젝트 정리를 만들 수 있습니다.</p>
              )}
              <p className="project-knowledge-selection">선택 근거 {selectedChunkIds.length}/5개 · {selectedKnowledgeCharacters.toLocaleString()}자</p>
            </section>

            <label className="weekly-reflection-slider">
              <span><strong>응원 중심</strong><strong>비판적 성찰</strong></span>
              <input type="range" min="0" max="100" value={reflectionLevel} onChange={(event) => setReflectionLevel(Number(event.target.value))} />
              <small>현재 강도 {reflectionLevel}</small>
            </label>

            <details className="weekly-send-preview">
              <summary>AI에 보낼 내용 미리보기 · {selectedIds.length}개, {selectedCharacters.toLocaleString()}자</summary>
              <div>
                <article><strong>프로젝트 이름과 출발 질문</strong><pre>{title || '(이름 미입력)'}{seedQuestion ? `\n${seedQuestion}` : ''}</pre></article>
                {selectedRecords.map((record) => <article key={record.id}><strong>{record.recordDate} · {record.categories.join(', ') || '교실기록'}</strong><pre>{record.content}</pre></article>)}
                {selectedKnowledgeHits.map((hit) => <article key={hit.id}><strong>{hit.sourceTitle} · 교육자료 조각 {hit.chunkIndex + 1}</strong><pre>{hit.content}</pre></article>)}
              </div>
              <p>API 키, 학생 실명 대응표, 선택하지 않은 기록·교육자료는 전송하지 않습니다.</p>
            </details>

            <div className="weekly-generate-actions">
              <span className="data-use-action-label"><DataUseBadge scope="ai" detail="확인한 비식별 기록과 선택한 교육자료 근거 최대 5개만 AI API로 전송됩니다." />{aiState.session.connected ? `${aiState.session.provider} · ${aiState.session.model}` : 'AI 미연결'} · 기록 {selectedIds.length}개 · 근거 {selectedChunkIds.length}개</span>
              <button className="primary-button" type="button" disabled={isWorking || !title.trim() || selectedIds.length === 0 || selectedCharacters > 50_000} onClick={generate}>
                {isWorking ? '프로젝트 흐름을 연결하는 중…' : '선택 기록으로 AI 프로젝트 정리'}
              </button>
            </div>
          </div>

          {workspace.summaries.length > 0 && (
            <section className="saved-weekly-list">
              <div><h2>저장한 프로젝트 수업 정리</h2><span>{workspace.summaries.length}개</span></div>
              {workspace.summaries.map((summary) => (
                <article key={summary.id}>
                  <span><strong>{summary.title}</strong><small>{summary.periodStart}~{summary.periodEnd} · 기록 {summary.recordIds.length}개 · 교육자료 근거 {summary.knowledgeChunkIds.length}개</small></span>
                  <button type="button" onClick={() => onOpenDocument(summary.id)}>문서 보기</button>
                </article>
              ))}
            </section>
          )}
        </>
      ) : (
        <section className="weekly-draft-review">
          <div className="weekly-draft-heading">
            <div><p className="eyebrow">AI 초안 · 교사가 최종 결정</p><h2>{draft.title}</h2></div>
            <span>{draft.provider} · {draft.model}</span>
          </div>
          <p>기록에 없는 산출물은 사실처럼 채택하지 말고 ‘확인 필요’로 남기거나 삭제해 주세요.</p>

          <div className="weekly-result-fields">
            <label><span>프로젝트 한눈에 보기</span><textarea value={draft.result.overview} onChange={(event) => updateResult('overview', event.target.value)} /></label>
            {PROJECT_SECTION_OPTIONS.filter((section) => section.id !== 'overview').map((section) => {
              const key = section.id as Exclude<keyof ProjectSummaryResult, 'overview' | 'educationEvidenceConnections'>;
              return <label key={section.id}><span>{section.label} <small>한 줄에 하나씩</small></span><textarea value={listToText(draft.result[key])} onChange={(event) => updateResult(key, textToList(event.target.value))} /></label>;
            })}
          </div>

          <section className="project-evidence-review">
            <div>
              <h3>교육자료 근거 연결</h3>
              <span>{draft.result.educationEvidenceConnections.length}개</span>
            </div>
            {draft.result.educationEvidenceConnections.length > 0 ? draft.result.educationEvidenceConnections.map((connection, index) => (
              <article key={`${connection.chunkIds.join('-')}-${index}`}>
                <textarea value={connection.statement} onChange={(event) => updateEvidenceStatement(index, event.target.value)} />
                <div>
                  <span>{connection.chunkIds.map((chunkId) => {
                    const hit = knowledgeHits.find((item) => item.id === chunkId);
                    return hit ? `${hit.sourceTitle} · 조각 ${hit.chunkIndex + 1}` : chunkId;
                  }).join(' · ')}</span>
                  <button type="button" onClick={() => removeEvidenceConnection(index)}>연결 삭제</button>
                </div>
              </article>
            )) : <p>선택한 교육자료가 없거나 AI가 충분한 근거 연결을 찾지 못했습니다.</p>}
          </section>

          <details className="weekly-evidence-review">
            <summary>근거 기록 {selectedRecords.length}개 확인</summary>
            <div>{selectedRecords.map((record) => <button type="button" key={record.id} onClick={() => onOpenRecord(record)}><time dateTime={record.recordDate}>{record.recordDate}</time><span>{preview(record.content)}</span></button>)}</div>
          </details>

          <div className="weekly-review-actions">
            <button className="secondary-button" type="button" disabled={isWorking} onClick={() => setDraft(null)}>초안 버리고 다시 선택</button>
            <button className="primary-button" type="button" disabled={isWorking} onClick={saveDraft}>{isWorking ? '저장하는 중…' : '수정 결과 채택·Markdown 저장'}</button>
          </div>
        </section>
      )}
    </section>
  );
}
