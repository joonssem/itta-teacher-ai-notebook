import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';

import type {
  AiOrganizationDraft,
  AiReviewStatus,
  AiSettingsState,
  ImportRecordsResult,
  MarkdownDocumentKind,
  MarkdownDocumentTarget,
  PrivacyDecision,
  PrivacyFinding,
  SaveRecordResult,
  SemanticSearchResponse,
  StorageState,
  StudentAliasState,
  TeacherRecord,
} from './shared/contracts';
import { applyPrivacyDecisions } from './shared/privacy';
import AiConnectionPanel from './components/AiConnectionPanel';
import AiWorkflowDialog from './components/AiWorkflowDialog';
import DashboardCards from './components/DashboardCards';
import TopicManager from './components/TopicManager';
import WeeklyManager from './components/WeeklyManager';
import MonthlyManager from './components/MonthlyManager';
import QuarterlyManager from './components/QuarterlyManager';
import SemesterManager from './components/SemesterManager';
import AnnualManager from './components/AnnualManager';
import ProjectManager from './components/ProjectManager';
import KnowledgeManager from './components/KnowledgeManager';
import BackupManager from './components/BackupManager';
import NewsCards from './components/NewsCards';
import MarkdownDocumentEditor from './components/MarkdownDocumentEditor';
import RecordCalendar from './components/RecordCalendar';
import RecordDetail from './components/RecordDetail';
import DataUseBadge, { DataUseLegend } from './components/DataUseBadge';

type ViewMode = 'home' | 'records' | 'record-detail' | 'trash' | 'privacy' | 'ai' | 'topics' | 'weekly' | 'monthly' | 'quarterly' | 'semester' | 'annual' | 'project' | 'knowledge' | 'backup' | 'document';

interface PendingPrivacyReview {
  originalContent: string;
  academicYear: number;
  findings: PrivacyFinding[];
}

const today = () => {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
};

const formatToday = () =>
  new Intl.DateTimeFormat('ko-KR', {
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  }).format(new Date());

const formatRecordDate = (value: string) =>
  new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date(`${value}T00:00:00`));

const errorMessage = (error: unknown) => {
  if (error instanceof Error) {
    return error.message.replace(/^Error invoking remote method '[^']+': Error: /, '');
  }
  return '요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.';
};

const preview = (content: string) =>
  content.length > 120 ? `${content.slice(0, 120)}…` : content;

export default function App() {
  const [storage, setStorage] = useState<StorageState | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [content, setContent] = useState('');
  const [categoryInput, setCategoryInput] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState<SaveRecordResult | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [records, setRecords] = useState<TeacherRecord[]>([]);
  const [view, setView] = useState<ViewMode>('home');
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
  const [pendingPrivacy, setPendingPrivacy] = useState<PendingPrivacyReview | null>(null);
  const [privacyDecisions, setPrivacyDecisions] = useState<Record<string, PrivacyDecision>>({});
  const [aliasState, setAliasState] = useState<StudentAliasState | null>(null);
  const [aliasInput, setAliasInput] = useState('');
  const [isRegisteringAliases, setIsRegisteringAliases] = useState(false);
  const [aiState, setAiState] = useState<AiSettingsState | null>(null);
  const [pendingAiContent, setPendingAiContent] = useState<string | null>(null);
  const [semanticSearch, setSemanticSearch] = useState<SemanticSearchResponse | null>(null);
  const [semanticSearchError, setSemanticSearchError] = useState<string | null>(null);
  const [isSemanticSearching, setIsSemanticSearching] = useState(false);
  const [selectedSemanticRecordIds, setSelectedSemanticRecordIds] = useState<string[]>([]);
  const [semanticTopicName, setSemanticTopicName] = useState('');
  const [isCreatingSemanticTopic, setIsCreatingSemanticTopic] = useState(false);
  const [topicToOpenId, setTopicToOpenId] = useState<string | null>(null);
  const [isImportingRecords, setIsImportingRecords] = useState(false);
  const [recordImportResult, setRecordImportResult] = useState<ImportRecordsResult | null>(null);
  const [recordImportError, setRecordImportError] = useState<string | null>(null);
  const [documentTarget, setDocumentTarget] = useState<MarkdownDocumentTarget | null>(null);
  const [documentReturnView, setDocumentReturnView] = useState<ViewMode>('home');
  const [documentDirty, setDocumentDirty] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(today().slice(0, 7));
  const [recordDetailId, setRecordDetailId] = useState<string | null>(null);
  const [recordReturnView, setRecordReturnView] = useState<ViewMode>('records');

  const loadRecords = useCallback(async (nextQuery = query, nextView = view) => {
    if (nextView === 'privacy' || nextView === 'ai' || nextView === 'topics' || nextView === 'weekly' || nextView === 'monthly' || nextView === 'quarterly' || nextView === 'semester' || nextView === 'annual' || nextView === 'project' || nextView === 'knowledge' || nextView === 'backup' || nextView === 'document' || nextView === 'record-detail') {
      return;
    }
    try {
      const loaded = await window.itta.listRecords({
        query: nextQuery,
        includeDeleted: nextView === 'trash',
        limit: nextView === 'home' ? 5 : 100,
      });
      setRecords(loaded);
    } catch (error) {
      setNotice(errorMessage(error));
    }
  }, [query, view]);

  const loadCalendarRecords = useCallback(async (monthKey: string) => {
    const [year, month] = monthKey.split('-').map(Number);
    const lastDay = new Date(year, month, 0).getDate();
    try {
      const loaded = await window.itta.listRecords({
        dateStart: `${monthKey}-01`,
        dateEnd: `${monthKey}-${String(lastDay).padStart(2, '0')}`,
        limit: 500,
      });
      setRecords(loaded);
    } catch (error) {
      setNotice(errorMessage(error));
    }
  }, []);

  const loadAliases = useCallback(async () => {
    try {
      setAliasState(await window.itta.listStudentAliases());
    } catch (error) {
      setNotice(errorMessage(error));
    }
  }, []);

  useEffect(() => {
    window.itta
      .getStorageState()
      .then((state) => {
        setStorage(state);
        setIsReady(state.isConfigured);
      })
      .catch((error) => setNotice(errorMessage(error)));
  }, []);

  useEffect(() => {
    let active = true;
    const refreshAiState = () => {
      window.itta.getAiState()
        .then((state) => {
          if (active) {
            setAiState(state);
          }
        })
        .catch((error) => {
          if (active) {
            setNotice(errorMessage(error));
          }
        });
    };
    refreshAiState();
    const timer = window.setInterval(refreshAiState, 60_000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    if (!isReady) return;
    if (view === 'records' && !query.trim()) {
      void loadCalendarRecords(calendarMonth);
    } else if (view !== 'privacy' && view !== 'ai' && view !== 'topics' && view !== 'weekly' && view !== 'monthly' && view !== 'quarterly' && view !== 'semester' && view !== 'annual' && view !== 'knowledge' && view !== 'backup' && view !== 'document' && view !== 'record-detail') {
      void loadRecords();
    }
  }, [calendarMonth, isReady, loadCalendarRecords, loadRecords, query, view]);

  const characterCount = useMemo(() => content.trim().length, [content]);

  const startWithDefault = async () => {
    try {
      const state = await window.itta.useDefaultStorage();
      setStorage(state);
      setIsReady(state.isConfigured);
      setNotice(null);
    } catch (error) {
      setNotice(errorMessage(error));
    }
  };

  const chooseDirectory = async () => {
    try {
      const state = await window.itta.chooseStorageDirectory();
      setStorage(state);
      setIsReady(state.isConfigured);
      setNotice(null);
    } catch (error) {
      setNotice(errorMessage(error));
    }
  };

  const clearComposer = () => {
    setContent('');
    setCategoryInput('');
    setEditingRecordId(null);
    setSaved(null);
    setNotice(null);
    setPendingPrivacy(null);
    setPendingAiContent(null);
  };

  const persistReviewedRecord = async (
    reviewedContent: string,
    aiReview: AiOrganizationDraft | null = null,
    aiStatus: AiReviewStatus = 'none',
  ) => {
    const teacherCategories = categoryInput
      .split(',')
      .map((category) => category.trim())
      .filter(Boolean)
      .slice(0, 10);
    const categories = aiReview?.result.categories.length
      ? aiReview.result.categories
      : teacherCategories.length > 0 ? teacherCategories : ['교실기록'];
    if (editingRecordId) {
      const record = await window.itta.updateRecord({
        id: editingRecordId,
        content: reviewedContent,
        categories,
        privacyReviewed: true,
        aiReview,
        aiStatus,
      });
      setNotice(aiStatus === 'adopted'
        ? '검토·채택한 AI 정리 결과와 Markdown 기록을 수정했습니다.'
        : aiStatus === 'rejected'
          ? 'AI 초안은 제외하고 비식별 원문만 수정했습니다.'
          : '개인정보 확인을 마친 기록과 Markdown 파일을 수정했습니다.');
      setContent(record.content);
      setCategoryInput(record.categories.join(', '));
    } else {
      const result = await window.itta.saveMarkdown({
        content: reviewedContent,
        recordDate: today(),
        categories,
        privacyReviewed: true,
        aiReview,
        aiStatus,
      });
      setSaved(result);
      setEditingRecordId(result.record.id);
      setNotice(aiStatus === 'adopted'
        ? '검토·채택한 AI 정리 결과를 포함한 Markdown 기록을 저장했습니다.'
        : aiStatus === 'rejected'
          ? 'AI 초안은 제외하고 비식별 원문만 저장했습니다.'
          : '개인정보 확인을 마친 Markdown 기록을 개인 기기에 저장했습니다.');
      setContent(result.record.content);
      setCategoryInput(result.record.categories.join(', '));
    }
    setPendingAiContent(null);
    await loadRecords('', 'home');
  };

  const continueAfterPrivacy = async (reviewedContent: string) => {
    setContent(reviewedContent);
    if (aiState?.session.connected) {
      setPendingAiContent(reviewedContent);
      return;
    }
    await persistReviewedRecord(reviewedContent);
  };

  const saveRecord = async () => {
    if (!content.trim()) {
      setNotice('오늘의 기록을 먼저 입력해 주세요.');
      return;
    }

    setIsSaving(true);
    setNotice(null);
    try {
      const inspection = await window.itta.inspectPrivacy(content);
      if (inspection.findings.length > 0) {
        setPendingPrivacy({
          originalContent: content,
          academicYear: inspection.academicYear,
          findings: inspection.findings,
        });
        setPrivacyDecisions(Object.fromEntries(inspection.findings.map((finding) => [
          finding.id,
          {
            findingId: finding.id,
            replace: true,
            replacement: finding.replacement,
          },
        ])));
        return;
      }
      await continueAfterPrivacy(content.trim().normalize('NFC'));
    } catch (error) {
      setNotice(errorMessage(error));
    } finally {
      setIsSaving(false);
    }
  };

  const confirmPrivacyReview = async () => {
    if (!pendingPrivacy) {
      return;
    }
    setIsSaving(true);
    setNotice(null);
    try {
      const decisions = pendingPrivacy.findings.map((finding) =>
        privacyDecisions[finding.id] ?? {
          findingId: finding.id,
          replace: false,
          replacement: finding.replacement,
        },
      );
      const reviewedContent = applyPrivacyDecisions(
        pendingPrivacy.originalContent,
        pendingPrivacy.findings,
        decisions,
      ).trim().normalize('NFC');
      setContent(reviewedContent);
      setPendingPrivacy(null);
      await continueAfterPrivacy(reviewedContent);
    } catch (error) {
      setNotice(errorMessage(error));
    } finally {
      setIsSaving(false);
    }
  };

  const registerStudentNames = async () => {
    const names = aliasInput
      .split(/[\n,;]/)
      .map((name) => name.trim())
      .filter(Boolean);
    if (names.length === 0) {
      setNotice('등록할 학생 이름을 한 줄에 한 명씩 입력해 주세요.');
      return;
    }

    setIsRegisteringAliases(true);
    setNotice(null);
    try {
      const state = await window.itta.registerStudentNames({ names });
      setAliasState(state);
      setAliasInput('');
      setNotice(`${state.academicYear}학년도 학생 별칭 대응표를 안전하게 갱신했습니다.`);
    } catch (error) {
      setNotice(errorMessage(error));
    } finally {
      setIsRegisteringAliases(false);
    }
  };

  const importRecordFolder = async () => {
    setIsImportingRecords(true);
    setRecordImportError(null);
    try {
      const result = await window.itta.importRecordFolder();
      if (result.canceled) return;
      setRecordImportResult(result);
      setQuery('');
      await loadRecords('', 'records');
    } catch (error) {
      setRecordImportResult(null);
      setRecordImportError(errorMessage(error));
    } finally {
      setIsImportingRecords(false);
    }
  };

  const openRecord = (record: TeacherRecord) => {
    setContent(record.content);
    setCategoryInput(record.categories.join(', '));
    setEditingRecordId(record.id);
    setSaved(null);
    setNotice(`${formatRecordDate(record.recordDate)} 기록을 불러왔습니다.`);
    setView('home');
    setMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const moveToTrash = async (record: TeacherRecord) => {
    if (!window.confirm('이 기록을 휴지통으로 옮길까요? Markdown 파일은 삭제되지 않습니다.')) {
      return;
    }
    try {
      await window.itta.trashRecord(record.id);
      if (editingRecordId === record.id) {
        clearComposer();
      }
      setNotice('기록을 휴지통으로 옮겼습니다. Markdown 파일은 그대로 남아 있습니다.');
      await loadRecords(query, view);
    } catch (error) {
      setNotice(errorMessage(error));
    }
  };

  const restoreFromTrash = async (record: TeacherRecord) => {
    try {
      await window.itta.restoreRecord(record.id);
      setNotice('기록을 복원했습니다.');
      await loadRecords(query, 'trash');
    } catch (error) {
      setNotice(errorMessage(error));
    }
  };

  const changeView = async (nextView: ViewMode) => {
    if (view === 'document' && documentDirty && nextView !== 'document'
      && !window.confirm('저장하지 않은 문서 수정 내용이 있습니다. 이 화면을 나갈까요?')) {
      return;
    }
    setDocumentDirty(false);
    setView(nextView);
    setMenuOpen(false);
    setQuery('');
    setSemanticSearch(null);
    setSemanticSearchError(null);
    setSelectedSemanticRecordIds([]);
    setSemanticTopicName('');
    if (nextView !== 'topics') setTopicToOpenId(null);
    setNotice(null);
    if (nextView === 'privacy') {
      await loadAliases();
    } else if (nextView === 'records') {
      await loadCalendarRecords(calendarMonth);
    } else if (nextView !== 'ai' && nextView !== 'topics' && nextView !== 'weekly' && nextView !== 'monthly' && nextView !== 'quarterly' && nextView !== 'semester' && nextView !== 'annual' && nextView !== 'knowledge' && nextView !== 'backup' && nextView !== 'document' && nextView !== 'record-detail') {
      await loadRecords('', nextView);
    }
  };

  const openMarkdownDocument = (kind: MarkdownDocumentKind, id: string) => {
    setDocumentReturnView(view === 'document' ? documentReturnView : view);
    setDocumentTarget({ kind, id });
    setDocumentDirty(false);
    setMenuOpen(false);
    setView('document');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const openRecordDetail = (recordId: string) => {
    if (view === 'document' && documentDirty
      && !window.confirm('저장하지 않은 문서 수정 내용이 있습니다. 원본 기록으로 이동할까요?')) {
      return;
    }
    setDocumentDirty(false);
    setRecordReturnView(view);
    setRecordDetailId(recordId);
    setMenuOpen(false);
    setView('record-detail');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const submitSearch = async (event: FormEvent) => {
    event.preventDefault();
    setSemanticSearch(null);
    setSemanticSearchError(null);
    setSelectedSemanticRecordIds([]);
    setSemanticTopicName('');
    setView('records');
    await loadRecords(query, 'records');
  };

  const runSemanticSearch = async () => {
    const searchQuery = query.trim();
    if (searchQuery.length < 2) {
      setSemanticSearchError('AI 의미 검색어를 2자 이상 입력해 주세요.');
      return;
    }
    const currentAiState = aiState;
    if (!currentAiState?.session.connected) {
      setSemanticSearchError('AI를 먼저 연결해 주세요.');
      return;
    }
    const providerName = currentAiState.providers
      .find((provider) => provider.id === currentAiState.session.provider)?.name ?? '연결된 AI';
    if (!window.confirm(
      `${providerName}에 검색어와 비식별 기록 발췌를 전송합니다. `
      + '최대 100개 기록, 기록당 최대 800자이며 개인정보 후보가 있으면 전송하지 않습니다. 계속할까요?',
    )) {
      return;
    }

    setIsSemanticSearching(true);
    setSemanticSearch(null);
    setSemanticSearchError(null);
    try {
      const result = await window.itta.searchSemantically({ query: searchQuery });
      setSemanticSearch(result);
      setSelectedSemanticRecordIds([]);
      setSemanticTopicName(result.query.slice(0, 50));
    } catch (error) {
      setSemanticSearchError(errorMessage(error));
    } finally {
      setIsSemanticSearching(false);
    }
  };

  const toggleSemanticRecord = (recordId: string) => {
    setSelectedSemanticRecordIds((current) => current.includes(recordId)
      ? current.filter((id) => id !== recordId)
      : [...current, recordId]);
  };

  const toggleAllSemanticRecords = () => {
    if (!semanticSearch) return;
    const allIds = semanticSearch.matches.map((match) => match.record.id);
    setSelectedSemanticRecordIds((current) =>
      current.length === allIds.length ? [] : allIds);
  };

  const createTopicFromSemanticResults = async () => {
    const name = semanticTopicName.trim();
    if (!name) {
      setSemanticSearchError('새 주제 이름을 입력해 주세요.');
      return;
    }
    if (selectedSemanticRecordIds.length === 0) {
      setSemanticSearchError('새 주제로 묶을 기록을 한 개 이상 선택해 주세요.');
      return;
    }
    setIsCreatingSemanticTopic(true);
    setSemanticSearchError(null);
    try {
      const created = await window.itta.createTopic({
        name,
        recordIds: selectedSemanticRecordIds,
      });
      setTopicToOpenId(created.topicId);
      await changeView('topics');
    } catch (error) {
      setSemanticSearchError(errorMessage(error));
    } finally {
      setIsCreatingSemanticTopic(false);
    }
  };

  if (!isReady) {
    return (
      <main className="setup-shell">
        <section className="setup-card" aria-labelledby="setup-title">
          <div className="brand-mark" aria-hidden="true">잇</div>
          <p className="eyebrow">개인 AI 교무수첩</p>
          <h1 id="setup-title">잇다를 시작합니다</h1>
          <p className="setup-lead">
            오늘의 교실 기록을 내 컴퓨터에 Markdown으로 차곡차곡 보관합니다.
          </p>

          <div className="storage-option recommended">
            <div>
              <span className="option-label">권장 설정</span>
              <strong>문서 폴더에 자동 정리</strong>
              <p>{storage?.path ?? '저장 위치를 확인하고 있습니다…'}</p>
            </div>
            <button className="primary-button" type="button" onClick={startWithDefault}>
              권장 설정으로 시작
            </button>
          </div>

          <div className="storage-option">
            <div>
              <span className="option-label">사용자 지정</span>
              <strong>원하는 폴더 직접 선택</strong>
              <p>기존 Obsidian 보관함이나 개인 폴더를 사용할 수 있습니다.</p>
            </div>
            <button className="secondary-button" type="button" onClick={chooseDirectory}>
              폴더 선택
            </button>
          </div>

          {notice && <p className="notice error" role="alert">{notice}</p>}
          <p className="privacy-note">이 단계에서는 AI와 인터넷을 사용하지 않습니다.</p>
        </section>
      </main>
    );
  }

  if (!aiState) {
    return (
      <main className="setup-shell">
        <section className="setup-card loading-card">
          <div className="brand-mark" aria-hidden="true">잇</div>
          <p>AI 연결 설정을 불러오고 있습니다…</p>
        </section>
      </main>
    );
  }

  if (!aiState.setupCompleted) {
    return (
      <main className="setup-shell ai-setup-shell">
        <AiConnectionPanel state={aiState} initialSetup onStateChange={setAiState} />
      </main>
    );
  }

  const listTitle = view === 'trash'
    ? '휴지통'
    : query
      ? `“${query}” 단어 검색 결과`
      : view === 'records'
        ? '기록 캘린더'
        : '최근 기록';

  const replacementCount = Object.values(privacyDecisions)
    .filter((decision) => decision.replace).length;

  return (
    <div className="app-shell">
      <header className="topbar">
        <button className="wordmark" type="button" onClick={() => changeView('home')}>
          잇다
        </button>
        <nav className="top-actions" aria-label="주요 메뉴">
          <button
            className={`ai-status-pill ${aiState.session.connected ? 'connected' : ''}`}
            type="button"
            onClick={() => { void changeView('ai'); }}
          >
            {aiState.session.connected ? 'AI 연결됨' : 'AI 미연결'}
          </button>
          {searchOpen && (
            <form className="search-form" onSubmit={submitSearch}>
              <input
                value={query}
                autoFocus
                placeholder="기록 검색"
                aria-label="기록 검색어"
                onChange={(event) => {
                  setQuery(event.target.value);
                  setSemanticSearch(null);
                  setSemanticSearchError(null);
                }}
              />
            </form>
          )}
          <button
            className="icon-button search-button"
            type="button"
            onClick={() => setSearchOpen((open) => !open)}
          >
            <span aria-hidden="true">⌕</span>
            <span>검색</span>
          </button>
          <button
            className="icon-button"
            type="button"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
          >
            <span aria-hidden="true">☰</span>
            <span>메뉴</span>
          </button>
        </nav>
      </header>

      {menuOpen && (
        <aside className="menu-panel" aria-label="잇다 메뉴">
          <div className="menu-heading">
            <strong>잇다 메뉴</strong>
            <button type="button" onClick={() => setMenuOpen(false)} aria-label="메뉴 닫기">×</button>
          </div>
          <div className="menu-section">
            <span>기록</span>
            <button type="button" onClick={() => { clearComposer(); void changeView('home'); }}>＋ 새 기록</button>
            <button type="button" onClick={() => changeView('records')}>기록 캘린더</button>
            <button type="button" onClick={() => changeView('topics')}>주제별 정리 <small>기록 연결</small></button>
          </div>
          <div className="menu-section">
            <span>기간·프로젝트 정리</span>
            <button type="button" onClick={() => changeView('weekly')}>주간 정리 <small>{view === 'weekly' ? '열림' : '주간 기록'}</small></button>
            <button type="button" onClick={() => changeView('monthly')}>월간 정리 <small>{view === 'monthly' ? '열림' : '월간 기록'}</small></button>
            <button type="button" onClick={() => changeView('quarterly')}>분기 정리 <small>{view === 'quarterly' ? '열림' : '분기 기록'}</small></button>
            <button type="button" onClick={() => changeView('semester')}>학기 정리 <small>{view === 'semester' ? '열림' : '학기 기록'}</small></button>
            <button type="button" onClick={() => changeView('annual')}>연간 정리 <small>{view === 'annual' ? '열림' : '연간 기록'}</small></button>
            <button type="button" onClick={() => changeView('project')}>프로젝트 정리 <small>{view === 'project' ? '열림' : '배움 연결'}</small></button>
          </div>
          <div className="menu-section">
            <span>교육자료</span>
            <button type="button" onClick={() => changeView('knowledge')}>교육자료와 연결 <small>{view === 'knowledge' ? '열림' : '근거 찾기'}</small></button>
          </div>
          <div className="menu-section">
            <span>설정·안전</span>
            <button type="button" onClick={() => changeView('ai')}>AI 연결 <small>{aiState.session.connected ? '연결됨' : '설정'}</small></button>
            <button type="button" onClick={() => changeView('privacy')}>개인정보·학생 별칭</button>
            <button type="button" onClick={() => changeView('backup')}>백업·복원 <small>안전 보관</small></button>
            <button type="button" onClick={() => changeView('trash')}>휴지통</button>
          </div>
          <DataUseLegend />
          <div className="menu-storage">
            <span>현재 저장 위치</span>
            <p>{storage?.path}</p>
          </div>
        </aside>
      )}

      <main className="record-page">
        {view === 'home' && (
          <>
            <div className="home-primary-grid">
              <section className="record-composer" aria-labelledby="record-title">
            <div className="composer-heading">
              <div>
                <p className="today">{formatToday()}</p>
                <h1 id="record-title">
                  {editingRecordId ? '교실 기록을 다듬어 주세요' : '오늘의 교실을 기록해 주세요'}
                </h1>
              </div>
              {editingRecordId && (
                <button className="text-button" type="button" onClick={clearComposer}>새 기록</button>
              )}
            </div>
            <p className="record-prompt">
              수업, 생활지도, 학생과의 대화, 떠오른 생각을 자유롭게 적어보세요.
            </p>
            <div className="data-use-context">
              <DataUseBadge scope="local" detail="작성 내용과 개인정보 검사는 저장 전까지 이 컴퓨터 안에서만 처리됩니다." />
            </div>

            <label className="record-box">
              <span className="sr-only">오늘의 교실 기록</span>
              <textarea
                value={content}
                maxLength={100_000}
                autoFocus
                placeholder="오늘 있었던 일을 있는 그대로 기록하세요…"
                onChange={(event) => {
                  setContent(event.target.value);
                  setSaved(null);
                }}
              />
              <span className="character-count">{characterCount.toLocaleString()}자</span>
            </label>

            <label className="composer-categories">
              <span>카테고리 <small>선택 입력 · 쉼표로 구분</small></span>
              <input
                value={categoryInput}
                maxLength={300}
                placeholder="예: 프로젝트수업, 생활지도, 학급운영"
                onChange={(event) => setCategoryInput(event.target.value)}
              />
            </label>

            <div className="composer-footer">
              <p>
                저장 전에 학생 이름과 연락처 등 개인정보 후보를 기기 안에서 확인합니다.
                확인 후에는 AI에 보낼 비식별 내용을 다시 보여주며, AI 초안은 교사가 채택해야 기록에 반영됩니다.
              </p>
              {aiState.session.connected && (
                <DataUseBadge scope="ai" detail="개인정보 확인 뒤 교사가 승인한 비식별 기록만 AI API로 전송됩니다." />
              )}
              <button
                className="primary-button save-button"
                type="button"
                disabled={isSaving || characterCount === 0}
                onClick={saveRecord}
              >
                {isSaving
                  ? '확인하는 중…'
                  : editingRecordId
                    ? aiState.session.connected ? '개인정보 확인 후 AI 정리' : '개인정보 확인 후 수정'
                    : aiState.session.connected ? '개인정보 확인 후 AI 정리' : '개인정보 확인 후 저장'}
              </button>
            </div>

            {notice && (
              <div className={`notice ${saved ? 'success' : ''}`} role="status">
                <span>{notice}</span>
                {editingRecordId && (
                  <button type="button" onClick={() => window.itta.showRecordFile(editingRecordId)}>
                    저장된 파일 보기
                  </button>
                )}
              </div>
            )}
              </section>
              <DashboardCards
                refreshKey={records.map((record) => `${record.id}:${record.updatedAt}`).join('|')}
                onOpenTopics={() => { void changeView('topics'); }}
                onOpenRecords={(nextQuery) => {
                  setQuery(nextQuery);
                  setView('records');
                  setMenuOpen(false);
                  if (nextQuery.trim()) void loadRecords(nextQuery, 'records');
                  else void loadCalendarRecords(calendarMonth);
                }}
                onOpenRecord={openRecord}
                onOpenWeekly={() => { void changeView('weekly'); }}
              />
            </div>
          </>
        )}

        {view === 'privacy' && (
          <section className="privacy-manager" aria-labelledby="privacy-title">
            <p className="eyebrow">내 기기에서만 관리</p>
            <h1 id="privacy-title">학생 별칭 대응표</h1>
            <p className="privacy-lead">
              학생 이름을 등록하면 {aliasState?.academicYear ?? '현재'}학년도 동안 같은 학생을 같은 별칭으로 바꿉니다.
              실제 이름은 Windows의 기기 암호화로 보호하며 Markdown과 AI 요청에는 넣지 않습니다.
            </p>
            <div className="data-use-context"><DataUseBadge scope="local" /></div>

            {aliasState && !aliasState.encryptionAvailable && (
              <div className="notice error" role="alert">
                이 기기에서는 이름 대응표를 암호화할 수 없습니다. Windows 로그인 상태를 확인해 주세요.
              </div>
            )}

            <div className="alias-register-card">
              <label htmlFor="student-names">학생 이름 등록</label>
              <p>한 줄에 한 명씩 입력하세요. 이미 등록된 이름은 중복으로 추가하지 않습니다.</p>
              <textarea
                id="student-names"
                value={aliasInput}
                placeholder={'김민수\n이서연\n박하준'}
                onChange={(event) => setAliasInput(event.target.value)}
              />
              <div className="alias-register-actions">
                <span>등록 순간 이름만 암호화하여 별도 표에 저장합니다.</span>
                <button
                  className="primary-button"
                  type="button"
                  disabled={isRegisteringAliases || aliasState?.encryptionAvailable === false}
                  onClick={registerStudentNames}
                >
                  {isRegisteringAliases ? '등록하는 중…' : '고정 별칭 만들기'}
                </button>
              </div>
            </div>

            {notice && <div className="notice" role="status">{notice}</div>}

            <div className="alias-list-card">
              <div className="alias-list-heading">
                <strong>{aliasState?.academicYear ?? '현재'}학년도 대응표</strong>
                <span>{aliasState?.aliases.length ?? 0}명</span>
              </div>
              {aliasState?.aliases.length ? (
                <div className="alias-list">
                  {aliasState.aliases.map((student) => (
                    <div className="alias-row" key={student.id}>
                      <span>{student.realName}</span>
                      <span aria-hidden="true">→</span>
                      <strong>{student.alias}</strong>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-records">
                  <strong>아직 등록된 학생 이름이 없습니다.</strong>
                  <p>학생 이름을 등록하면 기록 저장 전에 자동으로 찾아 별칭을 제안합니다.</p>
                </div>
              )}
              <p className="alias-caution">
                개인정보 탐지는 완전한 판정이 아니라 확인을 돕는 안전장치입니다. 저장 전 결과를 반드시 살펴보세요.
              </p>
            </div>
          </section>
        )}

        {view === 'ai' && (
          <AiConnectionPanel state={aiState} onStateChange={setAiState} />
        )}

        {view === 'topics' && (
          <TopicManager initialTopicId={topicToOpenId} onOpenRecord={openRecord} />
        )}

        {view === 'weekly' && (
          <WeeklyManager
            aiState={aiState}
            onOpenAiSettings={() => { void changeView('ai'); }}
            onOpenRecord={openRecord}
            onOpenDocument={(id) => openMarkdownDocument('weekly-summary', id)}
          />
        )}

        {view === 'monthly' && (
          <MonthlyManager
            aiState={aiState}
            onOpenAiSettings={() => { void changeView('ai'); }}
            onOpenRecord={openRecord}
            onOpenDocument={(id) => openMarkdownDocument('monthly-summary', id)}
          />
        )}

        {view === 'quarterly' && (
          <QuarterlyManager
            aiState={aiState}
            onOpenAiSettings={() => { void changeView('ai'); }}
            onOpenRecord={openRecord}
            onOpenDocument={(id) => openMarkdownDocument('quarterly-summary', id)}
          />
        )}

        {view === 'semester' && (
          <SemesterManager
            aiState={aiState}
            onOpenAiSettings={() => { void changeView('ai'); }}
            onOpenRecord={openRecord}
            onOpenDocument={(id) => openMarkdownDocument('semester-summary', id)}
          />
        )}

        {view === 'annual' && (
          <AnnualManager
            aiState={aiState}
            onOpenAiSettings={() => { void changeView('ai'); }}
            onOpenRecord={openRecord}
            onOpenDocument={(id) => openMarkdownDocument('annual-summary', id)}
          />
        )}

        {view === 'project' && (
          <ProjectManager
            aiState={aiState}
            onOpenAiSettings={() => { void changeView('ai'); }}
            onOpenRecord={openRecord}
            onOpenKnowledge={() => { void changeView('knowledge'); }}
            onOpenDocument={(id) => openMarkdownDocument('project-summary', id)}
          />
        )}

        {view === 'knowledge' && (
          <KnowledgeManager
            aiState={aiState}
            onOpenAiSettings={() => { void changeView('ai'); }}
            onOpenRecord={openRecord}
            onOpenDocument={(id) => openMarkdownDocument('rag-connection', id)}
          />
        )}

        {view === 'backup' && <BackupManager />}

        {view === 'document' && documentTarget && (
          <MarkdownDocumentEditor
            target={documentTarget}
            onBack={() => { void changeView(documentReturnView); }}
            onDirtyChange={setDocumentDirty}
            onOpenRecord={openRecordDetail}
          />
        )}

        {view === 'record-detail' && recordDetailId && (
          <RecordDetail
            recordId={recordDetailId}
            onBack={() => { void changeView(recordReturnView); }}
            onEdit={openRecord}
            onOpenDocument={(target) => openMarkdownDocument(target.kind, target.id)}
          />
        )}

        {view !== 'privacy' && view !== 'ai' && view !== 'topics' && view !== 'weekly' && view !== 'monthly' && view !== 'quarterly' && view !== 'semester' && view !== 'annual' && view !== 'project' && view !== 'knowledge' && view !== 'backup' && view !== 'document' && view !== 'record-detail' && (
          <section className={`record-list-section ${view !== 'home' ? 'standalone-list' : ''}`} aria-labelledby="list-title">
            <div className="list-heading">
              <div>
                <p className="eyebrow">나의 교무수첩</p>
                <h2 id="list-title">{listTitle}</h2>
              </div>
              <div className="list-heading-actions">
                {view === 'records' && (
                  <details className="list-more-actions">
                    <summary aria-label="기록 목록 더보기">···</summary>
                    <button
                      type="button"
                      disabled={isImportingRecords}
                      onClick={importRecordFolder}
                    >
                      {isImportingRecords ? '가져오는 중…' : 'Markdown 폴더 가져오기'}
                    </button>
                  </details>
                )}
                <DataUseBadge scope="local" detail="단어·날짜·카테고리 검색은 이 컴퓨터 안에서 실행됩니다." />
                {view === 'home' && records.length > 0 && (
                  <button className="text-button" type="button" onClick={() => changeView('records')}>전체 보기</button>
                )}
              </div>
            </div>

            {view === 'records' && recordImportError && (
              <div className="notice error" role="alert">{recordImportError}</div>
            )}

            {view === 'records' && recordImportResult && (
              <div
                className={`record-import-result ${recordImportResult.privacyBlockedCount > 0 || recordImportResult.invalidCount > 0 ? 'warning' : 'success'}`}
                role="status"
              >
                <div>
                  <strong>
                    {recordImportResult.totalFiles === 0
                      ? '선택한 폴더에 Markdown 기록이 없습니다.'
                      : `${recordImportResult.importedCount}개 기록을 가져왔습니다.`}
                  </strong>
                  <p>
                    전체 {recordImportResult.totalFiles}개 · 중복 {recordImportResult.duplicateCount}개 · 개인정보 확인 필요 {recordImportResult.privacyBlockedCount}개 · 형식 오류 {recordImportResult.invalidCount}개
                  </p>
                  <small>원본 파일은 바꾸지 않았으며, 가져온 기록은 기록 날짜에 맞는 연·월 폴더에 새 Markdown으로 저장했습니다.</small>
                </div>
                {recordImportResult.issues.length > 0 && (
                  <details>
                    <summary>가져오지 않은 파일 확인</summary>
                    <ul>
                      {recordImportResult.issues.slice(0, 20).map((issue) => (
                        <li key={`${issue.fileName}:${issue.reason}`}>
                          <strong>{issue.fileName}</strong> — {issue.reason}
                          {issue.privacyFindingCount ? ` (${issue.privacyFindingCount}개 후보)` : ''}
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </div>
            )}

            {view === 'records' && query.trim() && (
              <div className="semantic-search-panel" aria-labelledby="semantic-search-title">
                <div className="semantic-search-heading">
                  <div>
                    <span className="semantic-badge">선택 실행</span><DataUseBadge scope="ai" detail="버튼을 누른 뒤 확인한 검색어와 비식별 기록 발췌만 AI API로 전송됩니다." />
                    <h3 id="semantic-search-title">AI로 의미가 비슷한 기록 찾기</h3>
                    <p>같은 단어가 없어도 활동·고민·변화의 맥락이 이어지는 기록을 찾습니다.</p>
                  </div>
                  {aiState.session.connected ? (
                    <button
                      className="secondary-button"
                      type="button"
                      disabled={isSemanticSearching}
                      onClick={runSemanticSearch}
                    >
                      {isSemanticSearching ? '의미를 살피는 중…' : 'AI 의미 검색'}
                    </button>
                  ) : (
                    <button className="secondary-button" type="button" onClick={() => changeView('ai')}>
                      AI 연결 설정
                    </button>
                  )}
                </div>
                <p className="semantic-search-safety">
                  버튼을 눌러 확인한 경우에만 검색어와 비식별 기록 발췌를 연결된 AI에 보냅니다.
                </p>

                {semanticSearchError && (
                  <div className="notice error" role="alert">{semanticSearchError}</div>
                )}

                {semanticSearch && (
                  <div className="semantic-results" aria-live="polite">
                    <div className="semantic-results-summary">
                      <div>
                        <strong>{semanticSearch.interpretation || `“${semanticSearch.query}”의 맥락으로 살펴봤습니다.`}</strong>
                        <span>
                          {semanticSearch.searchedRecordCount}개 기록 검토 · {semanticSearch.matches.length}개 제안
                        </span>
                      </div>
                      <small>{semanticSearch.provider} · {semanticSearch.model} · AI 제안은 교사가 확인하세요.</small>
                    </div>
                    {semanticSearch.matches.length === 0 ? (
                      <div className="semantic-empty">
                        <strong>충분히 관련된 기록을 찾지 못했습니다.</strong>
                        <p>검색 의도를 조금 더 구체적으로 적어 다시 시도해 보세요.</p>
                      </div>
                    ) : (
                      <div className="semantic-result-list">
                        {semanticSearch.matches.map((match) => (
                          <article className="semantic-result-card" key={match.record.id}>
                            <div className="semantic-result-topline">
                              <label className="semantic-result-check">
                                <input
                                  type="checkbox"
                                  checked={selectedSemanticRecordIds.includes(match.record.id)}
                                  onChange={() => toggleSemanticRecord(match.record.id)}
                                />
                                <span>주제로 묶기</span>
                              </label>
                              <time dateTime={match.record.recordDate}>{formatRecordDate(match.record.recordDate)}</time>
                              <span>관련도 {match.score}</span>
                            </div>
                            <p className="semantic-reason">{match.reason}</p>
                            <p className="semantic-preview">{preview(match.record.content)}</p>
                            <div className="semantic-result-footer">
                              <div className="semantic-concepts">
                                {match.matchedConcepts.map((concept) => <span key={concept}>{concept}</span>)}
                              </div>
                              <button type="button" onClick={() => openRecord(match.record)}>기록 열기</button>
                            </div>
                          </article>
                        ))}
                        <section className="semantic-followup" aria-labelledby="semantic-followup-title">
                          <div className="semantic-followup-heading">
                            <div>
                              <strong id="semantic-followup-title">선택한 기록을 진화하는 주제로 묶기</strong>
                              <p>선택한 기록의 원문은 그대로 두고 주제 연결만 추가합니다.</p>
                            </div>
                            <button type="button" onClick={toggleAllSemanticRecords}>
                              {selectedSemanticRecordIds.length === semanticSearch.matches.length
                                ? '전체 선택 해제'
                                : '결과 전체 선택'}
                            </button>
                          </div>
                          <div className="semantic-followup-actions">
                            <label>
                              <span>주제 이름</span>
                              <input
                                value={semanticTopicName}
                                maxLength={50}
                                placeholder="예: 우리 교실 생활문제 프로젝트"
                                onChange={(event) => setSemanticTopicName(event.target.value)}
                              />
                            </label>
                            <button
                              className="primary-button"
                              type="button"
                              disabled={isCreatingSemanticTopic || selectedSemanticRecordIds.length === 0 || !semanticTopicName.trim()}
                              onClick={createTopicFromSemanticResults}
                            >
                              {isCreatingSemanticTopic
                                ? '주제로 묶는 중…'
                                : `${selectedSemanticRecordIds.length}개 기록으로 주제 만들기`}
                            </button>
                          </div>
                        </section>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {view === 'records' && !query.trim() ? (
              <RecordCalendar
                monthKey={calendarMonth}
                records={records}
                onMonthChange={setCalendarMonth}
                onOpenRecord={openRecordDetail}
              />
            ) : records.length === 0 ? (
              <div className="empty-records">
                <strong>{view === 'trash' ? '휴지통이 비어 있습니다.' : '아직 표시할 기록이 없습니다.'}</strong>
                <p>{query ? '다른 검색어로 찾아보세요.' : '교실의 하루를 기록하면 이곳에 차곡차곡 쌓입니다.'}</p>
              </div>
            ) : (
              <div className="record-list">
                {records.map((record) => (
                  <article className="record-card" key={record.id}>
                    <div className="record-card-main">
                      <time dateTime={record.recordDate}>{formatRecordDate(record.recordDate)}</time>
                      <p>{preview(record.content)}</p>
                      <div className="category-row">
                        {record.aiStatus === 'adopted' && <span className="ai-adopted-badge">AI 정리 채택</span>}
                        {record.aiStatus === 'rejected' && <span className="ai-rejected-badge">AI 초안 제외</span>}
                        {record.categories.map((category) => <span key={category}>{category}</span>)}
                      </div>
                    </div>
                    <div className="record-actions">
                      {view === 'trash' ? (
                        <button type="button" onClick={() => restoreFromTrash(record)}>복원</button>
                      ) : (
                        <>
                          <button type="button" onClick={() => openRecord(record)}>열기</button>
                          <details className="record-more-actions">
                            <summary aria-label="기록 더보기">···</summary>
                            <div>
                              <button type="button" onClick={() => window.itta.showRecordFile(record.id)}>탐색기에서 보기</button>
                              <button className="danger-text" type="button" onClick={() => moveToTrash(record)}>휴지통으로 이동</button>
                            </div>
                          </details>
                        </>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        )}

        {view === 'home' && <NewsCards />}
      </main>

      {pendingPrivacy && (
        <div className="modal-backdrop" role="presentation">
          <section className="privacy-dialog" role="dialog" aria-modal="true" aria-labelledby="review-title">
            <div className="review-heading">
              <div>
                <p className="eyebrow">{pendingPrivacy.academicYear}학년도 · 기기 안에서 확인</p>
                <h2 id="review-title">개인정보 후보를 확인해 주세요</h2>
              </div>
              <button type="button" onClick={() => setPendingPrivacy(null)} aria-label="확인 창 닫기">×</button>
            </div>
            <p className="review-lead">
              {pendingPrivacy.findings.length}개 후보를 찾았습니다. 바꿀 항목을 선택하고 표현을 직접 고칠 수 있습니다.
            </p>

            <div className="finding-list">
              {pendingPrivacy.findings.map((finding) => {
                const decision = privacyDecisions[finding.id];
                return (
                  <div className="finding-row" key={finding.id}>
                    <label className="finding-check">
                      <input
                        type="checkbox"
                        checked={decision?.replace ?? false}
                        onChange={(event) => setPrivacyDecisions((current) => ({
                          ...current,
                          [finding.id]: {
                            findingId: finding.id,
                            replace: event.target.checked,
                            replacement: current[finding.id]?.replacement ?? finding.replacement,
                          },
                        }))}
                      />
                      <span>
                        <small>{finding.label}</small>
                        <strong>{finding.value}</strong>
                      </span>
                    </label>
                    <span className="finding-arrow" aria-hidden="true">→</span>
                    <input
                      className="replacement-input"
                      aria-label={`${finding.value}의 대체 표현`}
                      value={decision?.replacement ?? finding.replacement}
                      disabled={!decision?.replace}
                      onChange={(event) => setPrivacyDecisions((current) => ({
                        ...current,
                        [finding.id]: {
                          findingId: finding.id,
                          replace: current[finding.id]?.replace ?? true,
                          replacement: event.target.value,
                        },
                      }))}
                    />
                  </div>
                );
              })}
            </div>

            <p className={`review-warning ${replacementCount < pendingPrivacy.findings.length ? 'danger' : ''}`}>
              {replacementCount < pendingPrivacy.findings.length
                ? '선택 해제한 후보는 원문 그대로 로컬 기록에 남습니다. 외부 AI 연결 단계에서는 다시 확인합니다.'
                : '선택된 모든 후보를 바꾼 뒤 비식별 기록만 저장합니다.'}
            </p>

            <div className="review-actions">
              <button className="secondary-button" type="button" onClick={() => setPendingPrivacy(null)}>
                돌아가서 직접 수정
              </button>
              <button className="primary-button" type="button" disabled={isSaving} onClick={confirmPrivacyReview}>
                {isSaving ? '저장하는 중…' : `${replacementCount}개 바꾸고 저장`}
              </button>
            </div>
          </section>
        </div>
      )}

      {pendingAiContent && (
        <AiWorkflowDialog
          content={pendingAiContent}
          aiState={aiState}
          onClose={() => setPendingAiContent(null)}
          onAdopt={(draft) => persistReviewedRecord(pendingAiContent, draft, 'adopted')}
          onSaveWithoutAi={(status) => persistReviewedRecord(pendingAiContent, null, status)}
          onOpenAiSettings={() => {
            setPendingAiContent(null);
            setView('ai');
          }}
        />
      )}
    </div>
  );
}
