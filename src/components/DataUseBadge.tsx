export type DataUseScope = 'local' | 'internet' | 'ai';

const scopeLabels: Record<DataUseScope, string> = {
  local: '기기 안에서 처리',
  internet: '인터넷 사용',
  ai: 'AI API 사용',
};

const scopeDescriptions: Record<DataUseScope, string> = {
  local: '기록·자료가 외부로 전송되지 않고 이 컴퓨터 안에서 처리됩니다.',
  internet: '표시된 검색어나 관심 주제만 공개 인터넷 서비스로 전송됩니다.',
  ai: '교사가 확인한 내용만 연결한 AI 제공자의 API로 전송됩니다.',
};

export default function DataUseBadge({
  scope,
  detail,
}: {
  scope: DataUseScope;
  detail?: string;
}) {
  return (
    <span className={`data-use-badge data-use-${scope}`} title={detail || scopeDescriptions[scope]}>
      <i aria-hidden="true" />
      {scopeLabels[scope]}
    </span>
  );
}

export function DataUseLegend() {
  return (
    <details className="data-use-legend">
      <summary>데이터 처리 구분</summary>
      <div>
        {(['local', 'internet', 'ai'] as const).map((scope) => (
          <div key={scope}>
            <DataUseBadge scope={scope} />
            <p>{scopeDescriptions[scope]}</p>
          </div>
        ))}
      </div>
    </details>
  );
}
