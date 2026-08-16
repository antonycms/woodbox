import React from 'react';
import type { IAIQueryApproval } from '@renderer/contexts/Store';
import { normalizeSqlForComparison } from '../../utils/queryApprovals';
import styles from '../../styles.module.css';
import {
  QueryApprovalCard,
  QueryApprovalCards,
  type IQueryApprovalApproveOptions,
} from '../QueryApprovalCards';

interface IMessageContentProps {
  content: string;
  queryApprovals?: IAIQueryApproval[];
  onApprove?(approval: IAIQueryApproval, options?: IQueryApprovalApproveOptions): void;
  onCopy?(approval: IAIQueryApproval): void;
  onReject?(approval: IAIQueryApproval): void;
}

interface IRenderMarkdownOptions {
  queryApprovals?: IAIQueryApproval[];
  usedQueryApprovalIds: Set<string>;
  onApprove?: (approval: IAIQueryApproval, options?: IQueryApprovalApproveOptions) => void;
  onCopy?: (approval: IAIQueryApproval) => void;
  onReject?: (approval: IAIQueryApproval) => void;
}

const renderInlineText = (text: string, keyPrefix: string) => {
  const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*)/g).filter(Boolean);

  return parts.map((part, index) => {
    const key = `${keyPrefix}_${index}`;

    if (part.startsWith('`') && part.endsWith('`')) {
      return <code key={key}>{part.slice(1, -1)}</code>;
    }

    if (part.startsWith('**') && part.endsWith('**')) {
      return <b key={key}>{part.slice(2, -2)}</b>;
    }

    return <React.Fragment key={key}>{part}</React.Fragment>;
  });
};

const renderParagraph = (text: string, key: string) => (
  <p key={key}>
    {text.split('\n').map((line, index, lines) => (
      <React.Fragment key={`${key}_${index}`}>
        {renderInlineText(line, `${key}_${index}`)}
        {index < lines.length - 1 && <br />}
      </React.Fragment>
    ))}
  </p>
);

const renderMessageBlock = (block: string, key: string) => {
  const lines = block.split('\n');
  const heading = /^(#{1,4})\s+(.+)$/.exec(lines[0]);

  if (heading && lines.length === 1) {
    return <h4 key={key}>{renderInlineText(heading[2], key)}</h4>;
  }

  if (lines.every((line) => /^\s*[-*]\s+/.test(line))) {
    return (
      <ul key={key}>
        {lines.map((line, index) => (
          <li key={`${key}_${index}`}>
            {renderInlineText(line.replace(/^\s*[-*]\s+/, ''), `${key}_${index}`)}
          </li>
        ))}
      </ul>
    );
  }

  if (lines.every((line) => /^\s*\d+\.\s+/.test(line))) {
    return (
      <ol key={key}>
        {lines.map((line, index) => (
          <li key={`${key}_${index}`}>
            {renderInlineText(line.replace(/^\s*\d+\.\s+/, ''), `${key}_${index}`)}
          </li>
        ))}
      </ol>
    );
  }

  return renderParagraph(block, key);
};

const findQueryApprovalForCode = (
  code: string,
  options: IRenderMarkdownOptions,
): IAIQueryApproval | undefined => {
  const normalizedCode = normalizeSqlForComparison(code);

  return options.queryApprovals?.find(
    (approval) =>
      !options.usedQueryApprovalIds.has(approval.id) &&
      normalizeSqlForComparison(approval.sql) === normalizedCode,
  );
};

const renderMarkdownBlocks = (
  content: string,
  keyPrefix: string,
  options: IRenderMarkdownOptions,
) => {
  if (!content.trim()) return [];

  const blocks = content.split(/(```[\s\S]*?```)/g).filter(Boolean);

  return blocks.map((block, index) => {
    if (block.startsWith('```') && block.endsWith('```')) {
      const language = /^```([a-zA-Z0-9_-]*)/.exec(block)?.[1]?.toLowerCase();
      const code = block.replace(/^```[a-zA-Z0-9_-]*\n?/, '').replace(/```$/, '');
      const approval =
        (!language || language === 'sql') && options.onApprove && options.onReject
          ? findQueryApprovalForCode(code, options)
          : undefined;

      if (approval) {
        options.usedQueryApprovalIds.add(approval.id);

        return (
          <QueryApprovalCard
            key={`${keyPrefix}_approval_${index}`}
            approval={approval}
            onApprove={options.onApprove}
            onCopy={options.onCopy}
            onReject={options.onReject}
          />
        );
      }

      return (
        <pre key={`${keyPrefix}_code_${index}`}>
          <code>{code.trim()}</code>
        </pre>
      );
    }

    return block
      .split(/\n{2,}/)
      .map((item) => item.trim())
      .filter(Boolean)
      .map((item, blockIndex) =>
        renderMessageBlock(item, `${keyPrefix}_block_${index}_${blockIndex}`),
      );
  });
};

export const MessageContent = React.memo(({
  content,
  queryApprovals,
  onApprove,
  onCopy,
  onReject,
}: IMessageContentProps) => {
  const [activeContextKey, setActiveContextKey] = React.useState<string>();

  if (!content.trim()) {
    if (queryApprovals?.length && onApprove && onReject) {
      return (
        <div className={styles.messageContent}>
          <QueryApprovalCards
            approvals={queryApprovals}
            onApprove={onApprove}
            onCopy={onCopy}
            onReject={onReject}
          />
        </div>
      );
    }

    return null;
  }

  const contextPattern =
    /(Contexto do editor|Editor context):\n\n```([a-zA-Z0-9_-]*)\n?([\s\S]*?)```/g;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let contextIndex = 0;
  const usedQueryApprovalIds = new Set<string>();
  const renderOptions: IRenderMarkdownOptions = {
    queryApprovals,
    usedQueryApprovalIds,
    onApprove,
    onCopy,
    onReject,
  };

  for (const match of content.matchAll(contextPattern)) {
    const index = match.index ?? 0;
    const [fullMatch, title, language, contextContent] = match;
    const key = `context_${contextIndex}`;

    if (index > lastIndex) {
      parts.push(
        ...renderMarkdownBlocks(content.slice(lastIndex, index), `text_${contextIndex}`, renderOptions),
      );
    }

    parts.push(
      <div key={key} className={styles.messageContextWrap}>
        <button
          type="button"
          className={styles.messageContextChip}
          onClick={() => setActiveContextKey((currentKey) => (currentKey === key ? undefined : key))}
        >
          <span>{title}</span>
        </button>

        {activeContextKey === key && (
          <div className={styles.messageContextBubble}>
            <header>
              <strong>{title}</strong>
              {!!language && <span>{language.toUpperCase()}</span>}
            </header>
            <pre>{contextContent.trim()}</pre>
          </div>
        )}
      </div>,
    );

    contextIndex += 1;
    lastIndex = index + fullMatch.length;
  }

  if (lastIndex < content.length) {
    parts.push(...renderMarkdownBlocks(content.slice(lastIndex), `text_${contextIndex}`, renderOptions));
  }

  const pendingQueryApprovals = queryApprovals?.filter(
    (approval) => !usedQueryApprovalIds.has(approval.id),
  );

  if (pendingQueryApprovals?.length && onApprove && onReject) {
    parts.push(
      <QueryApprovalCards
        key="query_approvals"
        approvals={pendingQueryApprovals}
        onApprove={onApprove}
        onCopy={onCopy}
        onReject={onReject}
      />,
    );
  }

  return (
    <div className={styles.messageContent}>
      {parts.length ? parts : renderMarkdownBlocks(content, 'content', renderOptions)}
    </div>
  );
});

MessageContent.displayName = 'MessageContent';
