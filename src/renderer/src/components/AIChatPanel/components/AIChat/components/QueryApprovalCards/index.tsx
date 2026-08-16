import React from 'react';
import { useI18n } from '@renderer/contexts/I18n';
import type { IAIQueryApproval } from '@renderer/contexts/Store';
import { CopyIcon } from '@renderer/styles/icons';
import { isReadOnlySelectQuery } from '../../utils/queryApprovals';
import styles from '../../styles.module.css';

export interface IQueryApprovalApproveOptions {
  allowUnsafe?: boolean;
  sql?: string;
}

interface IQueryApprovalCardsProps {
  approvals?: IAIQueryApproval[];
  onApprove(approval: IAIQueryApproval, options?: IQueryApprovalApproveOptions): void;
  onCopy?(approval: IAIQueryApproval): void;
  onReject(approval: IAIQueryApproval): void;
}

interface IQueryApprovalCardProps {
  approval: IAIQueryApproval;
  onApprove(approval: IAIQueryApproval, options?: IQueryApprovalApproveOptions): void;
  onCopy?(approval: IAIQueryApproval): void;
  onReject(approval: IAIQueryApproval): void;
}

export const QueryApprovalCard = React.memo(
  ({ approval, onApprove, onCopy, onReject }: IQueryApprovalCardProps) => {
    const { t } = useI18n();
    const [editing, setEditing] = React.useState(false);
    const [editedSql, setEditedSql] = React.useState(approval.sql);
    const [unsafeConfirming, setUnsafeConfirming] = React.useState(false);
    const status = approval.status || 'pending';
    const isPending = status === 'pending';
    const executableSql = editing ? editedSql.trim() : approval.sql;
    const isUnsafe = !isReadOnlySelectQuery(executableSql);
    const canApprove = !!executableSql;

    const handleApproveClick = () => {
      if (!canApprove) return;

      if (isUnsafe && !unsafeConfirming) {
        setUnsafeConfirming(true);
        return;
      }

      onApprove(approval, { allowUnsafe: isUnsafe, sql: executableSql });
    };

    const handleEditClick = () => {
      setEditedSql(approval.sql);
      setUnsafeConfirming(false);
      setEditing(true);
    };

    const handleCancelEdit = () => {
      setEditedSql(approval.sql);
      setUnsafeConfirming(false);
      setEditing(false);
    };

    return (
      <div
        className={[
          styles.queryApprovalCard,
          styles[`queryApprovalCard_${status}`],
          isPending && isUnsafe && styles.queryApprovalCard_unsafe,
        ]
          .filter(Boolean)
          .join(' ')}
      >
        <div className={styles.queryApprovalHeader}>
          <strong>
            {t('aiChat.queryApprovalTitle')}
            {isPending && isUnsafe && <span>{t('aiChat.queryApprovalUnsafeBadge')}</span>}
          </strong>
          <span>{t(`aiChat.queryApprovalStatus.${status}`)}</span>
        </div>

        <div className={styles.queryApprovalMeta}>
          {[approval.connectionName, approval.database, approval.dialect].filter(Boolean).join(' · ')}
        </div>

        {editing ? (
          <textarea
            className={styles.queryApprovalEditor}
            value={editedSql}
            spellCheck={false}
            onChange={(event) => {
              setEditedSql(event.target.value);
              setUnsafeConfirming(false);
            }}
          />
        ) : (
          <pre>
            <code>{approval.sql}</code>
          </pre>
        )}

        {isPending && isUnsafe && (
          <div className={styles.queryApprovalWarning}>
            {t('aiChat.queryApprovalUnsafeWarning')}
          </div>
        )}

        {isPending && (
          <div className={styles.queryApprovalActions}>
            <div className={styles.queryApprovalActionsLeft}>
              {!editing && !!onCopy && (
                <button
                  type="button"
                  className={styles.queryApprovalButtonIcon}
                  title={t('aiChat.queryApprovalCopy')}
                  aria-label={t('aiChat.queryApprovalCopy')}
                  onClick={() => onCopy(approval)}
                >
                  <CopyIcon size={14} />
                </button>
              )}
            </div>

            <div className={styles.queryApprovalActionsRight}>
              {!editing && (
                <button
                  type="button"
                  className={styles.queryApprovalButtonSecondary}
                  onClick={handleEditClick}
                >
                  {t('aiChat.queryApprovalEdit')}
                </button>
              )}
              {editing ? (
                <button
                  type="button"
                  className={styles.queryApprovalButtonSecondary}
                  onClick={handleCancelEdit}
                >
                  {t('aiChat.queryApprovalCancelEdit')}
                </button>
              ) : (
                <button
                  type="button"
                  className={styles.queryApprovalButtonReject}
                  onClick={() => onReject(approval)}
                >
                  {t('aiChat.queryApprovalReject')}
                </button>
              )}
              <button
                type="button"
                className={styles.queryApprovalButtonPrimary}
                disabled={!canApprove}
                onClick={handleApproveClick}
              >
                {unsafeConfirming
                  ? t('aiChat.queryApprovalUnsafeConfirm')
                  : editing
                    ? t('aiChat.queryApprovalSaveAndRun')
                    : t('aiChat.queryApprovalApprove')}
              </button>
            </div>
          </div>
        )}
      </div>
    );
  },
);

QueryApprovalCard.displayName = 'QueryApprovalCard';

export const QueryApprovalCards = React.memo(
  ({ approvals, onApprove, onCopy, onReject }: IQueryApprovalCardsProps) => {
    if (!approvals?.length) return null;

    return (
      <div className={styles.queryApprovals}>
        {approvals.map((approval) => (
          <QueryApprovalCard
            key={approval.id}
            approval={approval}
            onApprove={onApprove}
            onCopy={onCopy}
            onReject={onReject}
          />
        ))}
      </div>
    );
  },
);

QueryApprovalCards.displayName = 'QueryApprovalCards';
