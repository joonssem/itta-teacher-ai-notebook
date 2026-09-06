import { useCallback, useEffect, useMemo, useState } from 'react';

import { ANNUAL_SECTION_OPTIONS, getAcademicYearRange } from '../shared/annual';
import type {
  AiSettingsState,
  AnnualSummaryDraft,
  AnnualSummaryResult,
  AnnualWorkspace,
  TeacherRecord,
} from '../shared/contracts';
import DataUseBadge from './DataUseBadge';
import PeriodRecordFilters, { filterPeriodRecords } from './PeriodRecordFilters';

interface AnnualManagerProps {
  aiState: AiSettingsState;
  onOpenAiSettings: () => void;
  onOpenRecord: (record: TeacherRecord) => void;
  onOpenDocument: (id: string) => void;
}

const formatDate = (value: string) => new Intl.DateTimeFormat('ko-KR', {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
}).format(new Date(`${value}T12:00:00`));

const errorMessage = (error: unknown) => error instanceof Error
  ? error.message.replace(/^Error invoking remote method '[^']+': Error: /, '')
  : '연간 정리를 처리하지 못했습니다. 원본 기록은 그대로 유지됩니다.';

const listToText = (items: string[]) => items.join('\n');
const textToList = (value: string) => value
  .split('\n')
  .map((item) => item.replace(/^[-•]\s*/, '').trim())
  .filter(Boolean);
const preview = (content: string) => content.length > 160 ? `${content.slice(0, 160)}…` : content;

export default function AnnualManager({
  aiState,
  onOpenAiSettings,
  onOpenRecord,
  onOpenDocument,
}: AnnualManagerProps) {
  const [academicYear, setAcademicYear] = useState(() => getAcademicYearRange().academicYear);
  const [workspace, setWorkspace] = useState<AnnualWorkspace | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [reflectionLevel, setReflectionLevel] = useState(50);
  const [draft, setDraft] = useState<AnnualSummaryDraft | null>(null);
  const [activeTab, setActiveTab] = useState<'saved' | 'new'>('saved');
  const [recordQuery, setRecordQuery] = useState('');
  const [recordCategory, setRecordCategory] = useState('');
  const [isWorking, setIsWorking] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const selectedRecords = useMemo(() => {
    const selected = new Set(selectedIds);
    return (workspace?.records ?? []).filter((record) => selected.has(record.id));
  }, [selectedIds, workspace]);
  const selectedCharacters = useMemo(
    () => selectedRecords.reduce((sum, record) => sum + record.content.length, 0),
    [selectedRecords],
  );
  const visibleRecords = useMemo(() => filterPeriodRecords(workspace?.records ?? [], recordQuery, recordCategory), [recordCategory, recordQuery, workspace]);

  const loadWorkspace = useCallback(async (nextYear: string, keepNotice = false) => {
    try {
      const next = await window.itta.getAnnualWorkspace({ academicYear: nextYear });
      setWorkspace(next);
      setSelectedIds(next.records.slice(0, 500).map((record) => record.id));
      setDraft(null);
      if (!keepNotice) setNotice(null);
    } catch (error) {
      setNotice(errorMessage(error));
    }
  }, []);

  useEffect(() => { void loadWorkspace(academicYear); }, [academicYear, loadWorkspace]);

  const toggleRecord = (recordId: string) => setSelectedIds((current) => {
    if (current.includes(recordId)) return current.filter((id) => id !== recordId);
    if (current.length >= 500) {
      setNotice('연간 정리에는 기록을 최대 500개까지 선택할 수 있습니다.');
      return current;
    }
    return [...current, recordId];
  });

  const generate = async () => {
    if (!workspace || selectedIds.length === 0) {
      setNotice('연간 정리에 사용할 기록을 한 개 이상 선택해 주세요.');
      return;
    }
    if (!aiState.session.connected) {
      setNotice('연간 정리를 만들려면 메뉴에서 AI를 다시 연결해 주세요.');
      return;
    }
    setIsWorking(true);
    setNotice(null);
    try {
      setDraft(await window.itta.generateAnnualSummary({
        academicYear: workspace.academicYear,
        yearStart: workspace.yearStart,
        yearEnd: workspace.yearEnd,
        recordIds: selectedIds,
        reflectionLevel,
      }));
    } catch (error) {
      setNotice(errorMessage(error));
    } finally {
      setIsWorking(false);
    }
  };

  const updateResult = <Key extends keyof AnnualSummaryResult>(
    key: Key,
    value: AnnualSummaryResult[Key],
  ) => setDraft((current) => current
    ? { ...current, result: { ...current.result, [key]: value } }
    : current);

  const saveDraft = async () => {
    if (!draft) return;
    setIsWorking(true);
    setNotice(null);
    try {
      await window.itta.saveAnnualSummary({ draft });
      setNotice('검토·채택한 연간 교무수첩을 Markdown으로 저장했습니다.');
      await loadWorkspace(draft.academicYear, true);
      setActiveTab('saved');
    } catch (error) {
      setNotice(errorMessage(error));
    } finally {
      setIsWorking(false);
    }
  };

  if (!workspace) {
    return <section className="weekly-manager weekly-loading"><p>연간 기록을 불러오고 있습니다…</p></section>;
  }

  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 21 }, (_, index) => currentYear - 10 + index);
  const allSelectableIds = visibleRecords.slice(0, 500).map((record) => record.id);
  const allSelected = allSelectableIds.length > 0
    && allSelectableIds.every((recordId) => selectedIds.includes(recordId));

  return (
    <section className="weekly-manager" aria-labelledby="annual-title">
      <div className="weekly-heading">
        <div>
          <p className="eyebrow">쌓인 기록이 한 해의 교육과정이 되는</p>
          <h1 id="annual-title">연간 교무수첩</h1>
          <p>{workspace.academicYear}학년도 · {formatDate(workspace.yearStart)}부터 {formatDate(workspace.yearEnd)}까지</p>
          <div className="data-use-context"><DataUseBadge scope="ai" detail="교사가 선택하고 확인한 연간 비식별 기록만 AI API로 전송됩니다." /></div>
        </div>
        <div className="week-navigation">
          <button type="button" onClick={() => setAcademicYear((current) => String(Number(current) - 1))}>← 이전 학년도</button>
          <label>
            <span className="sr-only">학년도 선택</span>
            <select value={academicYear} onChange={(event) => setAcademicYear(event.target.value)}>
              {yearOptions.map((year) => <option key={year} value={year}>{year}학년도</option>)}
            </select>
          </label>
          <button type="button" onClick={() => setAcademicYear((current) => String(Number(current) + 1))}>다음 학년도 →</button>
        </div>
      </div>

      {notice && (
        <div className={`notice ${notice.includes('저장했습니다') ? 'success' : ''}`} role="status">
          <span>{notice}</span>
          {!aiState.session.connected && <button type="button" onClick={onOpenAiSettings}>AI 연결</button>}
        </div>
      )}

      {!draft && (
        <div className="period-tabs" role="tablist" aria-label="연간 교무수첩 보기 선택">
          <button type="button" role="tab" aria-selected={activeTab === 'saved'} className={activeTab === 'saved' ? 'active' : ''} onClick={() => setActiveTab('saved')}>저장된 요약 <small>{workspace.summaries.length}</small></button>
          <button type="button" role="tab" aria-selected={activeTab === 'new'} className={activeTab === 'new' ? 'active' : ''} onClick={() => setActiveTab('new')}>새 요약 만들기</button>
        </div>
      )}

      {!draft && activeTab === 'saved' && (
        workspace.summaries.length > 0 ? (
          <section className="saved-weekly-list">
            <div><h2>저장한 연간 교무수첩</h2><span>{workspace.summaries.length}개</span></div>
            {workspace.summaries.map((summary) => (
              <article key={summary.id}><span><strong>{summary.result.overview || '연간 교무수첩'}</strong><small>{summary.provider} · 근거 기록 {summary.recordIds.length}개</small></span><button type="button" onClick={() => onOpenDocument(summary.id)}>문서 보기</button></article>
            ))}
          </section>
        ) : (
          <div className="period-empty-state"><strong>아직 저장한 연간 요약이 없습니다.</strong><p>한 해의 기록으로 첫 교무수첩을 만들어 보세요.</p><button className="primary-button" type="button" onClick={() => setActiveTab('new')}>새 요약 만들기</button></div>
        )
      )}

      {!draft && activeTab === 'new' && (
        <>
          <div className="weekly-selection-card">
            <div className="weekly-selection-heading">
              <div>
                <h2>이번 학년도 근거 기록 선택</h2>
                <p>선택한 비식별 기록만 AI에 전송됩니다. 최대 500개까지 선택할 수 있습니다.</p>
              </div>
              <label>
                <input type="checkbox" checked={allSelected} onChange={(event) => setSelectedIds(event.target.checked ? allSelectableIds : [])} />
                최대 500개 전체 선택
              </label>
            </div>

            <PeriodRecordFilters records={workspace.records} query={recordQuery} category={recordCategory} onQueryChange={setRecordQuery} onCategoryChange={setRecordCategory} />

            {visibleRecords.length === 0 ? (
              <div className="weekly-empty"><strong>이 학년도에는 저장된 기록이 없습니다.</strong><p>다른 학년도를 선택하거나 먼저 교실 기록을 작성해 주세요.</p></div>
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

            <label className="weekly-reflection-slider">
              <span><strong>응원 중심</strong><strong>비판적 성찰</strong></span>
              <input type="range" min="0" max="100" value={reflectionLevel} onChange={(event) => setReflectionLevel(Number(event.target.value))} />
              <small>현재 강도 {reflectionLevel}</small>
            </label>

            <details className="weekly-send-preview">
              <summary>AI에 보낼 내용 미리보기 · {selectedIds.length}개, {selectedCharacters.toLocaleString()}자</summary>
              <div>{selectedRecords.map((record) => <article key={record.id}><strong>{record.recordDate} · {record.categories.join(', ') || '교실기록'}</strong><pre>{record.content}</pre></article>)}</div>
              <p>API 키, 학생 실명 대응표, 선택하지 않은 기록은 전송하지 않습니다.</p>
            </details>

            <div className="weekly-generate-actions">
              <span>{selectedIds.length}개 · {selectedCharacters.toLocaleString()}자 · {aiState.session.connected ? aiState.session.provider : 'AI 미연결'}</span>
              <button className="primary-button" type="button" disabled={isWorking || selectedIds.length === 0 || selectedCharacters > 50_000} onClick={generate}>
                {isWorking ? '한 해의 흐름을 정리하는 중…' : '선택 기록으로 AI 연간 정리'}
              </button>
            </div>
          </div>

        </>
      )}

      {draft && (
        <section className="weekly-draft-review">
          <div className="weekly-draft-heading">
            <div><p className="eyebrow">AI 초안 · 교사가 최종 결정</p><h2>연간 정리를 검토하고 고쳐 주세요</h2></div>
            <span>{draft.provider} · {draft.model}</span>
          </div>
          <p>AI가 만든 내용은 아직 저장되지 않았습니다. 교사의 판단에 맞게 수정한 뒤 채택하세요.</p>

          <div className="weekly-result-fields">
            <label><span>올해의 교육과정</span><textarea value={draft.result.overview} onChange={(event) => updateResult('overview', event.target.value)} /></label>
            {ANNUAL_SECTION_OPTIONS.filter((section) => section.id !== 'overview').map((section) => {
              const key = section.id as Exclude<keyof AnnualSummaryResult, 'overview'>;
              return <label key={section.id}><span>{section.label} <small>한 줄에 하나씩</small></span><textarea value={listToText(draft.result[key])} onChange={(event) => updateResult(key, textToList(event.target.value))} /></label>;
            })}
          </div>

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
