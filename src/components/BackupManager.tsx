import { useCallback, useEffect, useState } from 'react';

import type {
  BackupInspection,
  BackupState,
  RestoreBackupResult,
} from '../shared/contracts';
import DataUseBadge from './DataUseBadge';

const errorMessage = (error: unknown) => {
  if (error instanceof Error) {
    return error.message.replace(/^Error invoking remote method '[^']+': Error: /, '');
  }
  return '백업 요청을 처리하지 못했습니다.';
};

const formatDateTime = (value: string | null) => {
  if (!value) {
    return '아직 없음';
  }
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
};

const CountSummary = ({ inspection }: { inspection: BackupInspection }) => {
  const counts = inspection.manifest?.counts;
  if (!counts) {
    return null;
  }
  return (
    <dl className="backup-counts">
      <div><dt>일일 기록</dt><dd>{counts.records.toLocaleString()}개</dd></div>
      <div><dt>주간 정리</dt><dd>{counts.weeklySummaries.toLocaleString()}개</dd></div>
      <div><dt>월간 정리</dt><dd>{counts.monthlySummaries.toLocaleString()}개</dd></div>
      <div><dt>분기 정리</dt><dd>{counts.quarterlySummaries.toLocaleString()}개</dd></div>
      <div><dt>학기 정리</dt><dd>{counts.semesterSummaries.toLocaleString()}개</dd></div>
      <div><dt>연간 정리</dt><dd>{counts.annualSummaries.toLocaleString()}개</dd></div>
      <div><dt>프로젝트 정리</dt><dd>{counts.projectSummaries.toLocaleString()}개</dd></div>
      <div><dt>교육자료</dt><dd>{counts.knowledgeSources.toLocaleString()}개</dd></div>
      <div><dt>자료 연결</dt><dd>{counts.knowledgeConnections.toLocaleString()}개</dd></div>
      <div><dt>확정 주제</dt><dd>{counts.topics.toLocaleString()}개</dd></div>
      <div><dt>학생 별칭</dt><dd>{counts.studentAliases.toLocaleString()}개</dd></div>
    </dl>
  );
};

export default function BackupManager() {
  const [state, setState] = useState<BackupState | null>(null);
  const [inspection, setInspection] = useState<BackupInspection | null>(null);
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [restoreResult, setRestoreResult] = useState<RestoreBackupResult | null>(null);

  const loadState = useCallback(async () => {
    try {
      setState(await window.itta.getBackupState());
    } catch (nextError) {
      setError(errorMessage(nextError));
    }
  }, []);

  useEffect(() => {
    void loadState();
  }, [loadState]);

  const run = async (work: () => Promise<void>) => {
    setBusy(true);
    setNotice(null);
    setError(null);
    try {
      await work();
    } catch (nextError) {
      setError(errorMessage(nextError));
    } finally {
      setBusy(false);
    }
  };

  const createNow = () => run(async () => {
    const created = await window.itta.createBackupNow();
    setNotice(`안전 백업을 만들었습니다: ${created.path}`);
    await loadState();
  });

  const exportAll = () => run(async () => {
    const created = await window.itta.exportBackup();
    if (created) {
      setNotice(`선택한 폴더에 전체 백업을 만들었습니다: ${created.path}`);
    }
  });

  const chooseRestore = () => run(async () => {
    const selected = await window.itta.chooseBackupForRestore();
    if (selected) {
      setInspection(selected);
      setConfirmation('');
      setRestoreResult(null);
      if (!selected.valid) {
        setError(selected.warnings.join(' '));
      }
    }
  });

  const restore = () => {
    if (!inspection?.valid || !inspection.manifest || confirmation !== '복원') {
      return;
    }
    if (!window.confirm(
      '현재 상태를 먼저 별도 백업한 뒤 선택한 시점으로 복원합니다. 기존 기록 폴더는 덮어쓰지 않습니다. 계속할까요?',
    )) {
      return;
    }
    void run(async () => {
      const result = await window.itta.restoreBackup({
        backupPath: inspection.path,
        confirmation,
      });
      setRestoreResult(result);
      setNotice('복원을 마쳤습니다. 잠시 뒤 복원된 기록을 다시 불러옵니다.');
      window.setTimeout(() => window.location.reload(), 1_800);
    });
  };

  return (
    <section className="backup-manager" aria-labelledby="backup-title">
      <div className="backup-heading">
        <div>
          <p className="eyebrow">내 컴퓨터에 안전하게</p>
          <h1 id="backup-title">백업과 복원</h1>
          <p>
            데이터베이스와 잇다가 만든 Markdown만 함께 보관합니다. API 키는 백업하지 않습니다.
          </p>
          <div className="data-use-context"><DataUseBadge scope="local" detail="백업 생성·검사·복원은 선택한 기기 폴더 안에서 처리됩니다." /></div>
        </div>
        <button className="secondary-button" type="button" onClick={() => window.itta.showBackupFolder()}>
          백업 폴더 열기
        </button>
      </div>

      <div className="backup-grid">
        <article className="backup-card">
          <span className="backup-card-label">자동 보호</span>
          <h2>최근 7개 백업 유지</h2>
          <p>앱을 시작하거나 기록이 바뀐 뒤 하루에 한 번 자동으로 백업합니다.</p>
          <dl className="backup-status-list">
            <div><dt>마지막 자동 백업</dt><dd>{formatDateTime(state?.lastAutomaticBackupAt ?? null)}</dd></div>
            <div><dt>보관 위치</dt><dd>{state?.backupDirectory ?? '확인 중…'}</dd></div>
          </dl>
          <button className="primary-button" type="button" disabled={busy} onClick={createNow}>
            {busy ? '처리 중…' : '지금 안전 백업'}
          </button>
        </article>

        <article className="backup-card">
          <span className="backup-card-label">옮겨 보관하기</span>
          <h2>전체 백업 내보내기</h2>
          <p>외장 저장장치나 원하는 폴더에 독립된 백업 묶음을 만듭니다.</p>
          <p className="backup-caution">사용자 지정 Obsidian 보관함의 다른 파일은 포함하지 않습니다.</p>
          <button className="secondary-button" type="button" disabled={busy} onClick={exportAll}>
            저장할 폴더 선택
          </button>
        </article>
      </div>

      {state?.lastError && (
        <div className="notice error" role="alert">최근 자동 백업 오류: {state.lastError}</div>
      )}
      {notice && <div className="notice success" role="status">{notice}</div>}
      {error && <div className="notice error" role="alert">{error}</div>}

      <section className="backup-history" aria-labelledby="backup-history-title">
        <div className="backup-section-heading">
          <div>
            <span className="backup-card-label">이 컴퓨터</span>
            <h2 id="backup-history-title">최근 자동 백업</h2>
          </div>
          <span>{state?.automaticBackups.length ?? 0}개</span>
        </div>
        {state?.automaticBackups.length ? (
          <div className="backup-history-list">
            {state.automaticBackups.map((backup) => (
              <div key={backup.path}>
                <strong>{formatDateTime(backup.createdAt)}</strong>
                <span>기록 {backup.counts.records}개 · 주간 {backup.counts.weeklySummaries}개 · 월간 {backup.counts.monthlySummaries}개 · 분기 {backup.counts.quarterlySummaries}개 · 학기 {backup.counts.semesterSummaries}개 · 연간 {backup.counts.annualSummaries}개 · 프로젝트 {backup.counts.projectSummaries}개 · 교육자료 {backup.counts.knowledgeSources}개 · 자료 연결 {backup.counts.knowledgeConnections}개 · 주제 {backup.counts.topics}개</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="backup-empty">아직 자동 백업이 없습니다. ‘지금 안전 백업’으로 바로 만들 수 있습니다.</p>
        )}
      </section>

      <section className="restore-card" aria-labelledby="restore-title">
        <div className="backup-section-heading">
          <div>
            <span className="backup-card-label">확인 후 실행</span>
            <h2 id="restore-title">백업에서 복원</h2>
          </div>
          <button className="secondary-button" type="button" disabled={busy} onClick={chooseRestore}>
            백업 폴더 선택·검사
          </button>
        </div>
        <p>
          복원 직전 현재 상태를 먼저 백업합니다. 복원한 Markdown은 새 폴더에 두므로 현재 기록 폴더를 덮어쓰지 않습니다.
        </p>

        {inspection && (
          <div className={`restore-inspection ${inspection.valid ? 'valid' : 'invalid'}`}>
            <strong>{inspection.valid ? '복원 가능한 잇다 백업입니다.' : '이 백업은 복원할 수 없습니다.'}</strong>
            <span className="backup-path">{inspection.path}</span>
            {inspection.manifest && (
              <>
                <p>{formatDateTime(inspection.manifest.createdAt)} · 잇다 {inspection.manifest.appVersion}</p>
                <CountSummary inspection={inspection} />
              </>
            )}
            {inspection.warnings.length > 0 && (
              <ul className="backup-warning-list">
                {inspection.warnings.map((warning) => <li key={warning}>{warning}</li>)}
              </ul>
            )}
          </div>
        )}

        {inspection?.valid && (
          <div className="restore-confirmation">
            <label htmlFor="restore-confirmation">
              <span>복원하려면 아래 칸에 <strong>복원</strong>이라고 입력하세요.</span>
              <input
                id="restore-confirmation"
                value={confirmation}
                autoComplete="off"
                onChange={(event) => setConfirmation(event.target.value)}
              />
            </label>
            <button
              className="danger-button"
              type="button"
              disabled={busy || confirmation !== '복원'}
              onClick={restore}
            >
              {busy ? '안전하게 복원 중…' : '검사한 백업으로 복원'}
            </button>
          </div>
        )}

        {restoreResult && (
          <div className="notice success" role="status">
            새 기록 위치: {restoreResult.storageRoot}<br />
            복원 전 백업: {restoreResult.preRestoreBackupPath}
          </div>
        )}
      </section>
    </section>
  );
}
