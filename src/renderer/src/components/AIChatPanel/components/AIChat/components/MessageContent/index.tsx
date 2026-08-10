import React from 'react';
import type { IConnection } from '@renderer/contexts/Store';
import styles from '../../styles.module.css';
import { getConnectionMention, getConnectionMentionAliases } from '../../utils/mentions';

interface IMessageContentProps {
  content: string;
  connections: IConnection[];
}

const findMentionConnection = (mention: string, connections: IConnection[]) => {
  const normalizedMention = mention.toLowerCase();

  return connections.find((connection) =>
    getConnectionMentionAliases(connection).some((alias) => alias === normalizedMention),
  );
};

const renderTextWithMentions = (text: string, keyPrefix: string, connections: IConnection[]) => {
  const parts = text.split(/(@[a-zA-Z0-9_.-]+)/g).filter(Boolean);

  return parts.map((part, index) => {
    const key = `${keyPrefix}_mention_${index}`;
    const connection = part.startsWith('@') ? findMentionConnection(part, connections) : undefined;

    if (!connection) return <React.Fragment key={key}>{part}</React.Fragment>;

    return (
      <span key={key} className={styles.inlineMentionChip}>
        {getConnectionMention(connection)}
      </span>
    );
  });
};

const renderInlineText = (text: string, keyPrefix: string, connections: IConnection[]) => {
  const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*)/g).filter(Boolean);

  return parts.map((part, index) => {
    const key = `${keyPrefix}_${index}`;

    if (part.startsWith('`') && part.endsWith('`')) {
      return <code key={key}>{part.slice(1, -1)}</code>;
    }

    if (part.startsWith('**') && part.endsWith('**')) {
      return <b key={key}>{renderTextWithMentions(part.slice(2, -2), key, connections)}</b>;
    }

    return (
      <React.Fragment key={key}>{renderTextWithMentions(part, key, connections)}</React.Fragment>
    );
  });
};

const renderParagraph = (text: string, key: string, connections: IConnection[]) => (
  <p key={key}>
    {text.split('\n').map((line, index, lines) => (
      <React.Fragment key={`${key}_${index}`}>
        {renderInlineText(line, `${key}_${index}`, connections)}
        {index < lines.length - 1 && <br />}
      </React.Fragment>
    ))}
  </p>
);

const renderMessageBlock = (block: string, key: string, connections: IConnection[]) => {
  const lines = block.split('\n');
  const heading = /^(#{1,4})\s+(.+)$/.exec(lines[0]);

  if (heading && lines.length === 1) {
    return <h4 key={key}>{renderInlineText(heading[2], key, connections)}</h4>;
  }

  if (lines.every((line) => /^\s*[-*]\s+/.test(line))) {
    return (
      <ul key={key}>
        {lines.map((line, index) => (
          <li key={`${key}_${index}`}>
            {renderInlineText(line.replace(/^\s*[-*]\s+/, ''), `${key}_${index}`, connections)}
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
            {renderInlineText(line.replace(/^\s*\d+\.\s+/, ''), `${key}_${index}`, connections)}
          </li>
        ))}
      </ol>
    );
  }

  return renderParagraph(block, key, connections);
};

export const MessageContent = React.memo(({ content, connections }: IMessageContentProps) => {
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
            renderMessageBlock(item.trim(), `block_${index}_${blockIndex}`, connections),
          );
      })}
    </div>
  );
});

MessageContent.displayName = 'MessageContent';
