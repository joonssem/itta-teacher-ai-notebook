import { useMemo, useState } from 'react';

import { AI_PRESETS, AI_SECTION_OPTIONS } from '../shared/ai';
import type {
  AiOrganizationDraft,
  AiOrganizationResult,
  AiOrganizeOptions,
  AiPresetId,
  AiReviewStatus,
  AiSectionId,
  AiSettingsState,
} from '../shared/contracts';
import DataUseBadge from './DataUseBadge';

interface AiWorkflowDialogProps {
  content: string;
  aiState: AiSettingsState;
  onClose: () => void;
  onAdopt: (draft: AiOrganizationDraft) => Promise<void>;
  onSaveWithoutAi: (status: AiReviewStatus) => Promise<void>;
  onOpenAiSettings: () => void;
}

const errorMessage = (error: unknown) => {
  if (error instanceof Error) {
    return error.message.replace(/^Error invoking remote method '[^']+': Error: /, '');
  }
  return 'AI 정리를 완료하지 못했습니다. 원문은 그대로 유지됩니다.';
};

const listToText = (items: string[]) => items.join('\n');

const textToList = (value: string) => value
  .split('\n')
  .map((item) => item.replace(/^[-•]\s*/, '').trim())
  .filter(Boolean);

export default function AiWorkflowDialog({
  content,
  aiState,
  onClose,
  onAdopt,
  onSaveWithoutAi,
  onOpenAiSettings,
}: AiWorkflowDialogProps) {
  const balancedPreset = AI_PRESETS.find((preset) => preset.id === 'balanced') ?? AI_PRESETS[0];
  const [options, setOptions] = useState<AiOrganizeOptions>({
    preset: balancedPreset.id,
    sections: [...balancedPreset.sections],
    reflectionLevel: 50,
  });
  const [draft, setDraft] = useState<AiOrganizationDraft | null>(null);
  const [isWorking, setIsWorking] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const providerName = useMemo(() =>
    aiState.providers.find((provider) => provider.id === aiState.session.provider)?.name
      ?? aiState.session.provider,
  [aiState]);

  const choosePreset = (presetId: AiPresetId) => {
    const preset = AI_PRESETS.find((item) => item.id === presetId);
    if (!preset) {
      return;
    }
    setOptions((current) => ({
      ...current,
      preset: preset.id,
      sections: preset.id === 'custom' ? current.sections : [...preset.sections],
    }));
  };

  const toggleSection = (section: AiSectionId) => {
    setOptions((current) => ({
      ...current,
      preset: 'custom',
      sections: current.sections.includes(section)
        ? current.sections.filter((item) => item !== section)
        : [...current.sections, section],
    }));
  };

  const requestOrganization = async () => {
    if (options.sections.length === 0) {
      setNotice('AI가 정리할 항목을 한 개 이상 선택해 주세요.');
      return;
    }
    setIsWorking(true);
    setNotice(null);
    try {
      setDraft(await window.itta.organizeRecord({ content, options }));
    } catch (error) {
      setNotice(errorMessage(error));
    } finally {
      setIsWorking(false);
    }
  };

  const updateResult = <Key extends keyof AiOrganizationResult>(
    key: Key,
    value: AiOrganizationResult[Key],
  ) => {
    setDraft((current) => current
      ? { ...current, result: { ...current.result, [key]: value } }
      : current);
  };

  const adopt = async () => {
    if (!draft) {
      return;
    }
    setIsWorking(true);
    setNotice(null);
    try {
      await onAdopt(draft);
    } catch (error) {
      setNotice(errorMessage(error));
    } finally {
      setIsWorking(false);
    }
  };

  const saveWithoutAi = async (status: AiReviewStatus) => {
    setIsWorking(true);
    try {
      await onSaveWithoutAi(status);
    } catch (error) {
      setNotice(errorMessage(error));
    } finally {
      setIsWorking(false);
    }
  };

  return (
    <div className="modal-backdrop ai-workflow-backdrop" role="presentation">
      <section className="ai-workflow-dialog" role="dialog" aria-modal="true" aria-labelledby="ai-workflow-title">
        <div className="review-heading">
          <div>
            <p className="eyebrow">{providerName} · {aiState.session.model}</p>
            <h2 id="ai-workflow-title">
              {draft ? 'AI 정리 초안을 검토해 주세요' : 'AI 정리 방식을 선택해 주세요'}
            </h2>
            <div className="data-use-context"><DataUseBadge scope="ai" /></div>
          </div>
          <button type="button" onClick={onClose} aria-label="AI 정리 창 닫기">×</button>
        </div>

        {!draft ? (
          <>
            <div className="preset-grid" role="radiogroup" aria-label="AI 정리 방식">
              {AI_PRESETS.map((preset) => (
                <label className={`preset-card ${options.preset === preset.id ? 'selected' : ''}`} key={preset.id}>
                  <input
                    type="radio"
                    name="ai-preset"
                    checked={options.preset === preset.id}
                    onChange={() => choosePreset(preset.id)}
                  />
                  <span><strong>{preset.label}</strong><small>{preset.description}</small></span>
                </label>
              ))}
            </div>

            <fieldset className="section-picker">
              <legend>정리할 항목</legend>
              <div>
                {AI_SECTION_OPTIONS.map((section) => (
                  <label key={section.id}>
                    <input
                      type="checkbox"
                      checked={options.sections.includes(section.id)}
                      onChange={() => toggleSection(section.id)}
                    />
                    <span><strong>{section.label}</strong><small>{section.description}</small></span>
                  </label>
                ))}
              </div>
            </fieldset>

            <label className="reflection-slider">
              <span><strong>응원 중심</strong><strong>비판적 성찰</strong></span>
              <input
                type="range"
                min="0"
                max="100"
                value={options.reflectionLevel}
                onChange={(event) => setOptions((current) => ({
                  ...current,
                  reflectionLevel: Number(event.target.value),
                }))}
              />
              <small>현재 강도 {options.reflectionLevel} · AI의 말투와 관점 비율을 조절합니다.</small>
            </label>

            <details className="ai-send-preview" open>
              <summary>AI에 보낼 비식별 내용 미리보기</summary>
              <pre>{content}</pre>
              <p>이 내용과 선택한 정리 항목만 {providerName}에 전송됩니다. API 키와 학생 실명 대응표는 전송하지 않습니다.</p>
            </details>

            {notice && (
              <div className="notice error ai-error-notice" role="alert">
                <span>{notice}</span>
                <button type="button" onClick={onOpenAiSettings}>AI 연결 확인</button>
              </div>
            )}

            <div className="review-actions ai-workflow-actions">
              <button className="secondary-button" type="button" disabled={isWorking} onClick={() => saveWithoutAi('none')}>
                AI 없이 저장
              </button>
              <button className="primary-button" type="button" disabled={isWorking || options.sections.length === 0} onClick={requestOrganization}>
                {isWorking ? 'AI가 정리하는 중…' : '이 내용으로 AI 정리'}
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="review-lead">
              AI가 만든 초안입니다. 교사의 판단에 맞게 고친 뒤 채택하거나, 거부하고 비식별 원문만 저장할 수 있습니다.
            </p>

            <div className="ai-result-fields">
              {draft.options.sections.includes('summary') && (
                <label>
                  <span>기록 요약</span>
                  <textarea value={draft.result.summary} onChange={(event) => updateResult('summary', event.target.value)} />
                </label>
              )}
              {AI_SECTION_OPTIONS.filter((section) => section.id !== 'summary' && draft.options.sections.includes(section.id)).map((section) => {
                const key = section.id as Exclude<AiSectionId, 'summary'>;
                const value = draft.result[key];
                return (
                  <label key={section.id}>
                    <span>{section.label} <small>한 줄에 하나씩</small></span>
                    <textarea value={listToText(value)} onChange={(event) => updateResult(key, textToList(event.target.value))} />
                  </label>
                );
              })}
              <div className="ai-metadata-fields">
                <label>
                  <span>카테고리 <small>쉼표로 구분</small></span>
                  <input value={draft.result.categories.join(', ')} onChange={(event) => updateResult('categories', event.target.value.split(',').map((item) => item.trim()).filter(Boolean))} />
                </label>
                <label>
                  <span>이어질 주제 <small>쉼표로 구분</small></span>
                  <input value={draft.result.topics.join(', ')} onChange={(event) => updateResult('topics', event.target.value.split(',').map((item) => item.trim()).filter(Boolean))} />
                </label>
              </div>
            </div>

            {notice && <div className="notice error" role="alert">{notice}</div>}

            <div className="review-actions ai-workflow-actions result-actions">
              <button className="secondary-button danger-button" type="button" disabled={isWorking} onClick={() => saveWithoutAi('rejected')}>
                AI 결과 거부·원문 저장
              </button>
              <button className="secondary-button" type="button" disabled={isWorking} onClick={() => { setDraft(null); setNotice(null); }}>
                다시 정리
              </button>
              <button className="primary-button" type="button" disabled={isWorking} onClick={adopt}>
                {isWorking ? '저장하는 중…' : '수정 결과 채택 및 저장'}
              </button>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
