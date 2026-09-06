import { useMemo, useState } from 'react';

import type {
  AiProviderId,
  AiSettingsState,
} from '../shared/contracts';
import DataUseBadge from './DataUseBadge';

interface AiConnectionPanelProps {
  state: AiSettingsState;
  initialSetup?: boolean;
  onStateChange: (state: AiSettingsState) => void;
}

const errorMessage = (error: unknown) => {
  if (error instanceof Error) {
    return error.message.replace(/^Error invoking remote method '[^']+': Error: /, '');
  }
  return 'AI 연결을 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.';
};

const formatExpiry = (value: string | null) => {
  if (!value) {
    return '';
  }
  return new Intl.DateTimeFormat('ko-KR', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));
};

export default function AiConnectionPanel({
  state,
  initialSetup = false,
  onStateChange,
}: AiConnectionPanelProps) {
  const [provider, setProvider] = useState<AiProviderId>(state.preferredProvider);
  const [model, setModel] = useState(state.preferredModel);
  const [apiKey, setApiKey] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const selectedProvider = useMemo(
    () => state.providers.find((item) => item.id === provider) ?? state.providers[0],
    [provider, state.providers],
  );

  const changeProvider = (nextProvider: AiProviderId) => {
    const option = state.providers.find((item) => item.id === nextProvider);
    setProvider(nextProvider);
    setModel(option?.models[0]?.id ?? '');
    setNotice(null);
  };

  const connect = async () => {
    if (!apiKey.trim()) {
      setNotice('API 키를 입력해 주세요.');
      return;
    }
    setIsConnecting(true);
    setNotice(null);
    try {
      const nextState = await window.itta.connectAi({ provider, model, apiKey });
      setApiKey('');
      onStateChange(nextState);
      setNotice('AI 연결을 확인했습니다. 키는 현재 앱 실행 중에만 유지됩니다.');
    } catch (error) {
      setNotice(errorMessage(error));
    } finally {
      setIsConnecting(false);
    }
  };

  const disconnect = async () => {
    try {
      const nextState = await window.itta.disconnectAi();
      setApiKey('');
      onStateChange(nextState);
      setProvider(nextState.preferredProvider);
      setModel(nextState.preferredModel);
      setNotice('API 키를 메모리에서 제거했습니다. 로컬 기록 기능은 계속 사용할 수 있습니다.');
    } catch (error) {
      setNotice(errorMessage(error));
    }
  };

  const skip = async () => {
    try {
      onStateChange(await window.itta.skipAiSetup(provider, model));
    } catch (error) {
      setNotice(errorMessage(error));
    }
  };

  return (
    <section className={`ai-connection-panel ${initialSetup ? 'initial' : ''}`} aria-labelledby="ai-connection-title">
      <p className="eyebrow">선택 사항 · 언제든 메뉴에서 변경</p>
      <h1 id="ai-connection-title">
        {state.session.connected ? 'AI가 연결되어 있습니다' : '사용할 AI를 연결해 주세요'}
      </h1>
      <p className="ai-connection-lead">
        API 키는 앱 실행 중 메모리에만 머물며 파일, 데이터베이스, Markdown에 저장하지 않습니다.
        앱을 닫거나 30분 동안 사용하지 않으면 자동으로 제거됩니다.
      </p>
      <div className="data-use-context"><DataUseBadge scope="ai" detail="연결 확인과 교사가 승인한 정리 요청에만 선택한 AI 제공자의 API를 사용합니다." /></div>

      {state.session.connected ? (
        <div className="connected-ai-card">
          <div className="connection-status-line">
            <span className="status-dot" aria-hidden="true" />
            <strong>연결됨</strong>
          </div>
          <dl>
            <div>
              <dt>제공자</dt>
              <dd>{state.providers.find((item) => item.id === state.session.provider)?.name}</dd>
            </div>
            <div>
              <dt>모델</dt>
              <dd>{state.session.model}</dd>
            </div>
            <div>
              <dt>키</dt>
              <dd>{state.session.keyHint}</dd>
            </div>
            <div>
              <dt>자동 제거 예정</dt>
              <dd>{formatExpiry(state.session.expiresAt)}</dd>
            </div>
          </dl>
          <button className="secondary-button" type="button" onClick={disconnect}>연결 해제</button>
        </div>
      ) : (
        <>
          <div className="provider-grid" role="radiogroup" aria-label="AI 제공자">
            {state.providers.map((option) => (
              <label className={`provider-card ${provider === option.id ? 'selected' : ''}`} key={option.id}>
                <input
                  type="radio"
                  name="ai-provider"
                  value={option.id}
                  checked={provider === option.id}
                  onChange={() => changeProvider(option.id)}
                />
                <span>
                  <strong>{option.name}</strong>
                  <small>{option.description}</small>
                </span>
              </label>
            ))}
          </div>

          <div className="ai-field-grid">
            <label>
              <span>모델</span>
              <select value={model} onChange={(event) => setModel(event.target.value)}>
                {selectedProvider?.models.map((item) => (
                  <option value={item.id} key={item.id}>{item.name}</option>
                ))}
              </select>
            </label>
            <label>
              <span>API 키</span>
              <input
                type="password"
                value={apiKey}
                autoComplete="off"
                spellCheck={false}
                placeholder={provider === 'upstage' ? 'up_…' : 'Google AI Studio API 키'}
                onChange={(event) => setApiKey(event.target.value)}
              />
            </label>
          </div>

          <div className="connection-explainer">
            <strong>연결 확인 시 전송되는 내용</strong>
            <p>{selectedProvider?.connectionNote}</p>
            {provider === 'google' && (
              <p>
                학교 Google Workspace의 Gemini 앱 사용 권한과 개발용 Gemini API 사용 권한은 다를 수 있습니다.
                관리자 정책으로 Google AI Studio 키 발급이 제한될 수 있습니다.
              </p>
            )}
          </div>

          {notice && <div className="notice" role="status">{notice}</div>}

          <div className="ai-connection-actions">
            {initialSetup && (
              <button className="secondary-button" type="button" onClick={skip}>
                API 없이 기록만 시작
              </button>
            )}
            <button
              className="primary-button"
              type="button"
              disabled={isConnecting || !model}
              onClick={connect}
            >
              {isConnecting ? '연결 확인 중…' : '연결 확인'}
            </button>
          </div>
        </>
      )}

      {state.session.connected && notice && <div className="notice success" role="status">{notice}</div>}
    </section>
  );
}
