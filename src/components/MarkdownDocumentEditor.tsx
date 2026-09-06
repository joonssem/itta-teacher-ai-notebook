import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import type {
  EditableMarkdownDocument,
  MarkdownDocumentTarget,
} from '../shared/contracts';
import DataUseBadge from './DataUseBadge';

interface MarkdownDocumentEditorProps {
  target: MarkdownDocumentTarget;
  onBack: () => void;
  onDirtyChange: (dirty: boolean) => void;
  onOpenRecord: (recordId: string) => void;
}

const errorMessage = (error: unknown) => error instanceof Error
  ? error.message.replace(/^Error invoking remote method '[^']+': Error: /, '')
  : '문서를 불러오지 못했습니다.';

const renderInline = (text: string) => {
  const tokens = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).filter(Boolean);
  return tokens.map((token, index) => {
    if (token.startsWith('**') && token.endsWith('**')) {
      return <strong key={`${index}-${token}`}>{token.slice(2, -2)}</strong>;
    }
    if (token.startsWith('`') && token.endsWith('`')) {
      return <code key={`${index}-${token}`}>{token.slice(1, -1)}</code>;
    }
    return <Fragment key={`${index}-${token}`}>{token}</Fragment>;
  });
};

const hideGeneratedRecordIndex = (body: string) => body.replace(
  /(^|\n)##\s+관련 기록과 날짜\s*\n[\s\S]*?(?=\n##\s|$)/g,
  '\n',
);

const MarkdownPreview = ({ body }: { body: string }) => {
  const blocks = useMemo(() => {
    const rendered: ReactNode[] = [];
    const lines = hideGeneratedRecordIndex(body).replace(/\r\n?/g, '\n').split('\n');
    let paragraph: string[] = [];
    let listItems: string[] = [];
    let ordered = false;
    let quote: string[] = [];
    let code: string[] = [];
    let inCode = false;
    let key = 0;

    const flushParagraph = () => {
      if (paragraph.length > 0) {
        const text = paragraph.join(' ').trim();
        if (text) rendered.push(<p key={`p-${key += 1}`}>{renderInline(text)}</p>);
        paragraph = [];
      }
    };
    const flushList = () => {
      if (listItems.length > 0) {
        const children = listItems.map((item, index) =>
          <li key={`${index}-${item}`}>{renderInline(item)}</li>,
        );
        rendered.push(ordered
          ? <ol key={`ol-${key += 1}`}>{children}</ol>
          : <ul key={`ul-${key += 1}`}>{children}</ul>);
        listItems = [];
      }
    };
    const flushQuote = () => {
      if (quote.length > 0) {
        rendered.push(
          <blockquote key={`quote-${key += 1}`}>{renderInline(quote.join(' '))}</blockquote>,
        );
        quote = [];
      }
    };
    const flushTextBlocks = () => {
      flushParagraph();
      flushList();
      flushQuote();
    };

    for (const line of lines) {
      if (line.trimStart().startsWith('```')) {
        flushTextBlocks();
        if (inCode) {
          rendered.push(<pre key={`code-${key += 1}`}><code>{code.join('\n')}</code></pre>);
          code = [];
        }
        inCode = !inCode;
        continue;
      }
      if (inCode) {
        code.push(line);
        continue;
      }
      const heading = line.match(/^(#{1,4})\s+(.+)$/);
      if (heading) {
        flushTextBlocks();
        const level = heading[1].length;
        const content = renderInline(heading[2].trim());
        if (level === 1) rendered.push(<h1 key={`h-${key += 1}`}>{content}</h1>);
        else if (level === 2) rendered.push(<h2 key={`h-${key += 1}`}>{content}</h2>);
        else if (level === 3) rendered.push(<h3 key={`h-${key += 1}`}>{content}</h3>);
        else rendered.push(<h4 key={`h-${key += 1}`}>{content}</h4>);
        continue;
      }
      const unorderedItem = line.match(/^\s*[-*+]\s+(.+)$/);
      const orderedItem = line.match(/^\s*\d+[.)]\s+(.+)$/);
      if (unorderedItem || orderedItem) {
        flushParagraph();
        flushQuote();
        const nextOrdered = Boolean(orderedItem);
        if (listItems.length > 0 && ordered !== nextOrdered) flushList();
        ordered = nextOrdered;
        listItems.push((orderedItem?.[1] ?? unorderedItem?.[1] ?? '').trim());
        continue;
      }
      const quoteLine = line.match(/^\s*>\s?(.*)$/);
      if (quoteLine) {
        flushParagraph();
        flushList();
        quote.push(quoteLine[1]);
        continue;
      }
      if (/^\s*(?:---+|___+|\*\*\*+)\s*$/.test(line)) {
        flushTextBlocks();
        rendered.push(<hr key={`hr-${key += 1}`} />);
        continue;
      }
      if (!line.trim()) {
        flushTextBlocks();
        continue;
      }
      flushList();
      flushQuote();
      paragraph.push(line.trim());
    }
    flushTextBlocks();
    if (code.length > 0) {
      rendered.push(<pre key={`code-${key += 1}`}><code>{code.join('\n')}</code></pre>);
    }
    return rendered;
  }, [body]);

  return <article className="markdown-preview">{blocks}</article>;
};

export default function MarkdownDocumentEditor({
  target,
  onBack,
  onDirtyChange,
  onOpenRecord,
}: MarkdownDocumentEditorProps) {
  const [document, setDocument] = useState<EditableMarkdownDocument | null>(null);
  const [draftBody, setDraftBody] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadDocument = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setNotice(null);
    try {
      const loaded = await window.itta.getMarkdownDocument(target);
      setDocument(loaded);
      setDraftBody(loaded.body);
      setIsEditing(false);
    } catch (loadError) {
      setError(errorMessage(loadError));
    } finally {
      setIsLoading(false);
    }
  }, [target]);

  useEffect(() => {
    void loadDocument();
  }, [loadDocument]);

  const dirty = Boolean(document && draftBody !== document.body);
  useEffect(() => {
    onDirtyChange(dirty);
    return () => onDirtyChange(false);
  }, [dirty, onDirtyChange]);

  const save = async () => {
    if (!document || !draftBody.trim()) return;
    setIsSaving(true);
    setError(null);
    setNotice(null);
    try {
      const saved = await window.itta.saveMarkdownDocument({
        kind: document.kind,
        id: document.id,
        body: draftBody,
        revision: document.revision,
      });
      setDocument(saved);
      setDraftBody(saved.body);
      setIsEditing(false);
      setNotice('수정한 문서를 저장했습니다. 저장 전 원본은 수정이력 폴더에 보관했습니다.');
    } catch (saveError) {
      setError(errorMessage(saveError));
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <section className="markdown-document-page"><p>문서를 불러오는 중…</p></section>;
  }

  if (!document) {
    return (
      <section className="markdown-document-page">
        <div className="notice error" role="alert">{error ?? '문서를 찾지 못했습니다.'}</div>
        <div className="markdown-document-actions">
          <button className="secondary-button" type="button" onClick={onBack}>목록으로 돌아가기</button>
          <button className="primary-button" type="button" onClick={() => { void loadDocument(); }}>다시 불러오기</button>
        </div>
      </section>
    );
  }

  return (
    <section className="markdown-document-page" aria-labelledby="markdown-document-title">
      <header className="markdown-document-heading">
        <div>
          <p className="eyebrow">{document.kindLabel} · 교사가 최종 편집</p>
          <h1 id="markdown-document-title">{document.title}</h1>
          <p>{document.fileName} · {new Intl.DateTimeFormat('ko-KR', {
            year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit',
          }).format(new Date(document.modifiedAt))}</p>
          <div className="data-use-context">
            <DataUseBadge scope="local" detail="열기와 수정은 이 컴퓨터 안에서만 처리되며 AI API로 전송되지 않습니다." />
          </div>
        </div>
        <div className="markdown-document-top-actions">
          <button className="secondary-button" type="button" onClick={onBack}>목록으로</button>
          {!isEditing && (
            <button
              className="primary-button"
              type="button"
              disabled={!document.metadataProtected}
              onClick={() => { setIsEditing(true); setNotice(null); setError(null); }}
            >수정</button>
          )}
          <details className="document-more-actions">
            <summary aria-label="문서 더보기">···</summary>
            <button
              type="button"
              onClick={() => { void window.itta.showMarkdownDocumentFile(target); }}
            >탐색기에서 보기</button>
          </details>
        </div>
      </header>

      {!document.metadataProtected && (
        <div className="notice error" role="alert">
          보호할 시스템 메타데이터를 찾지 못해 읽기 전용으로 열었습니다.
        </div>
      )}
      {notice && <div className="notice success" role="status">{notice}</div>}
      {error && <div className="notice error" role="alert">{error}</div>}

      {isEditing ? (
        <>
          <div className="markdown-editor-note">
            제목과 본문만 수정됩니다. 문서 ID, 기간, 연결 기록과 같은 시스템 정보는 보호됩니다.
          </div>
          <div className="markdown-edit-layout">
            <label className="markdown-source-editor">
              <span>Markdown 편집</span>
              <textarea
                value={draftBody}
                maxLength={500_000}
                spellCheck
                onChange={(event) => setDraftBody(event.target.value)}
              />
              <small>{draftBody.length.toLocaleString()}자</small>
            </label>
            <div className="markdown-live-preview">
              <strong>미리보기</strong>
              <MarkdownPreview body={draftBody} />
            </div>
          </div>
          <div className="markdown-document-actions">
            <button
              className="secondary-button"
              type="button"
              disabled={isSaving}
              onClick={() => {
                setDraftBody(document.body);
                setIsEditing(false);
                setError(null);
              }}
            >수정 취소</button>
            <button
              className="secondary-button"
              type="button"
              disabled={isSaving || !dirty}
              onClick={() => setDraftBody(document.body)}
            >저장 전 내용으로 되돌리기</button>
            <button
              className="primary-button"
              type="button"
              disabled={isSaving || !dirty || !draftBody.trim()}
              onClick={() => { void save(); }}
            >{isSaving ? '저장하는 중…' : '수정 내용 저장'}</button>
          </div>
        </>
      ) : (
        <MarkdownPreview body={document.body} />
      )}

      {document.linkedRecords.length > 0 && (
        <details className="document-source-records">
          <summary>
            근거 기록 {document.linkedRecords.length}개 펼쳐보기
            <small>날짜를 선택하면 원문으로 이동합니다.</small>
          </summary>
          <div className="document-source-list">
            {document.linkedRecords.map((record) => (
              <button type="button" key={record.id} onClick={() => onOpenRecord(record.id)}>
                <time dateTime={record.recordDate}>{record.recordDate}</time>
                <span>{record.content.replace(/\s+/g, ' ').trim().slice(0, 110)}{record.content.length > 110 ? '…' : ''}</span>
                <small>{record.categories.join(' · ') || '교실기록'} · 원문 보기 →</small>
              </button>
            ))}
          </div>
        </details>
      )}
    </section>
  );
}
