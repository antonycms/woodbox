import React from 'react';
import { useI18n } from '@renderer/contexts/I18n';
import type { IAIQueryApproval } from '@renderer/contexts/Store';
import styles from '../../styles.module.css';

interface IQueryApprovalCardsProps {
  approvals?: IAIQueryApproval[];
  onApprove(approval: IAIQueryApproval): void;
  onReject(approval: IAIQueryApproval): void;
}

export const QueryApprovalCards = React.memo(
  ({ approvals, onApprove, onReject }: IQueryApprovalCardsProps) => {
    const { t } = useI18n();

    if (!approvals?.length) return null;

    return (
      <div className={styles.queryApprovals}>
        {approvals.map((approval) => {
          const status = approval.status || 'pending';
          const isPending = status === 'pending';

          return (
            <div
              key={approval.id}
              className={[styles.queryApprovalCard, styles[`queryApprovalCard_${status}`]].join(
                ' ',
              )}
            >
              <div className={styles.queryApprovalHeader}>
                <strong>{t('aiChat.queryApprovalTitle')}</strong>
                <span>{t(`aiChat.queryApprovalStatus.${status}`)}</span>
              </div>

              <div className={styles.queryApprovalMeta}>
                {[approval.connectionName, approval.database, approval.dialect]
                  .filter(Boolean)
                  .join(' · ')}
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
        })}
      </div>
    );
  },
);

QueryApprovalCards.displayName = 'QueryApprovalCards';
