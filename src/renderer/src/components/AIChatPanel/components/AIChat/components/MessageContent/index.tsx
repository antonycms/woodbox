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

export const MessageContent = React.memo(({ content }: IMessageContentProps) => {
  if (!content.trim()) return null;

  const blocks = content.split(/(```[\s\S]*?```)/g).filter(Boolean);

  return (
    <div className={styles.messageContent}>
      {blocks.map((block, index) => {
        if (block.startsWith('```') && block.endsWith('```')) {
          const code = block.replace(/^```[a-zA-Z0-9_-]*\n?/, '').replace(/```$/, '');

          return (
            <pre key={`code_${index}`}>
              <code>{code.trim()}</code>
            </pre>
          );
        }

        return block
          .split(/\n{2,}/)
          .map((item, blockIndex) =>
            renderMessageBlock(item.trim(), `block_${index}_${blockIndex}`),
          );
      })}
    </div>
  );
});

MessageContent.displayName = 'MessageContent';
