import React from 'react';
import { useI18n } from '@renderer/contexts/I18n';
import type { IAIQueryApproval } from '@renderer/contexts/Store';
import { isReadOnlySelectQuery } from '../../utils/queryApprovals';
import styles from '../../styles.module.css';

export interface IQueryApprovalApproveOptions {
  allowUnsafe?: boolean;
}

interface IQueryApprovalCardsProps {
  approvals?: IAIQueryApproval[];
  onApprove(approval: IAIQueryApproval, options?: IQueryApprovalApproveOptions): void;
  onReject(approval: IAIQueryApproval): void;
}

interface IQueryApprovalCardProps {
  approval: IAIQueryApproval;
  onApprove(approval: IAIQueryApproval, options?: IQueryApprovalApproveOptions): void;
  onReject(approval: IAIQueryApproval): void;
}

export const QueryApprovalCard = React.memo(
  ({ approval, onApprove, onReject }: IQueryApprovalCardProps) => {
    const { t } = useI18n();
    const [unsafeConfirming, setUnsafeConfirming] = React.useState(false);
    const status = approval.status || 'pending';
    const isPending = status === 'pending';
    const isUnsafe = !isReadOnlySelectQuery(approval.sql);

    const handleApproveClick = () => {
      if (isUnsafe && !unsafeConfirming) {
        setUnsafeConfirming(true);
        return;
      }

      onApprove(approval, { allowUnsafe: isUnsafe });
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

        <pre>
          <code>{approval.sql}</code>
        </pre>

        {isPending && isUnsafe && (
          <div className={styles.queryApprovalWarning}>
            {t('aiChat.queryApprovalUnsafeWarning')}
          </div>
        )}

        {isPending && (
          <div className={styles.queryApprovalActions}>
            <button type="button" onClick={() => onReject(approval)}>
              {t('aiChat.queryApprovalReject')}
            </button>
            <button type="button" onClick={handleApproveClick}>
              {unsafeConfirming
                ? t('aiChat.queryApprovalUnsafeConfirm')
                : t('aiChat.queryApprovalApprove')}
            </button>
          </div>
        )}
      </div>
    );
  },
);

QueryApprovalCard.displayName = 'QueryApprovalCard';

export const QueryApprovalCards = React.memo(
  ({ approvals, onApprove, onReject }: IQueryApprovalCardsProps) => {
    if (!approvals?.length) return null;

    return (
      <div className={styles.queryApprovals}>
        {approvals.map((approval) => (
          <QueryApprovalCard
            key={approval.id}
            approval={approval}
            onApprove={onApprove}
            onReject={onReject}
          />
        ))}
      </div>
    );
  },
);

QueryApprovalCards.displayName = 'QueryApprovalCards';
