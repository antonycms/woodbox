import React from 'react';
import styles from '../../styles.module.css';

interface IMessageContentProps {
  content: string;
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

const renderMarkdownBlocks = (content: string, keyPrefix: string) => {
  if (!content.trim()) return [];

  const blocks = content.split(/(```[\s\S]*?```)/g).filter(Boolean);

  return blocks.map((block, index) => {
    if (block.startsWith('```') && block.endsWith('```')) {
      const code = block.replace(/^```[a-zA-Z0-9_-]*\n?/, '').replace(/```$/, '');

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

export const MessageContent = React.memo(({ content }: IMessageContentProps) => {
  const [activeContextKey, setActiveContextKey] = React.useState<string>();

  if (!content.trim()) return null;

  const contextPattern =
    /(Contexto do editor|Editor context):\n\n```([a-zA-Z0-9_-]*)\n?([\s\S]*?)```/g;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let contextIndex = 0;

  for (const match of content.matchAll(contextPattern)) {
    const index = match.index ?? 0;
    const [fullMatch, title, language, contextContent] = match;
    const key = `context_${contextIndex}`;

    if (index > lastIndex) {
      parts.push(...renderMarkdownBlocks(content.slice(lastIndex, index), `text_${contextIndex}`));
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
    parts.push(...renderMarkdownBlocks(content.slice(lastIndex), `text_${contextIndex}`));
  }

  return (
    <div className={styles.messageContent}>
      {parts.length ? parts : renderMarkdownBlocks(content, 'content')}
    </div>
  );
});

MessageContent.displayName = 'MessageContent';
