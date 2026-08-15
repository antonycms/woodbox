import React from 'react';
import { useI18n } from '@renderer/contexts/I18n';
import type { IAIQueryApproval } from '@renderer/contexts/Store';
import styles from '../../styles.module.css';

interface IQueryApprovalCardsProps {
  approvals?: IAIQueryApproval[];
  onApprove(approval: IAIQueryApproval): void;
  onReject(approval: IAIQueryApproval): void;
}

interface IQueryApprovalCardProps {
  approval: IAIQueryApproval;
  onApprove(approval: IAIQueryApproval): void;
  onReject(approval: IAIQueryApproval): void;
}

export const QueryApprovalCard = React.memo(
  ({ approval, onApprove, onReject }: IQueryApprovalCardProps) => {
    const { t } = useI18n();
    const status = approval.status || 'pending';
    const isPending = status === 'pending';

    return (
      <div
        className={[styles.queryApprovalCard, styles[`queryApprovalCard_${status}`]].join(' ')}
      >
        <div className={styles.queryApprovalHeader}>
          <strong>{t('aiChat.queryApprovalTitle')}</strong>
          <span>{t(`aiChat.queryApprovalStatus.${status}`)}</span>
        </div>

        <div className={styles.queryApprovalMeta}>
          {[approval.connectionName, approval.database, approval.dialect].filter(Boolean).join(' · ')}
        </div>

        <pre>
          <code>{approval.sql}</code>
        </pre>

        {isPending && (
          <div className={styles.queryApprovalActions}>
            <button type="button" onClick={() => onReject(approval)}>
              {t('aiChat.queryApprovalReject')}
            </button>
            <button type="button" onClick={() => onApprove(approval)}>
              {t('aiChat.queryApprovalApprove')}
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
