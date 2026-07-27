import React from 'react';

export const useQueryCancellation = () => {
  const canceledQueryIdsRef = React.useRef<Set<string>>(new Set());
  const [cancelingQueryIds, setCancelingQueryIds] = React.useState<Set<string>>(new Set());

  const markQueryCanceling = React.useCallback((queryExecutionId: string) => {
    canceledQueryIdsRef.current.add(queryExecutionId);
    setCancelingQueryIds((prevState) => new Set(prevState).add(queryExecutionId));
  }, []);

  const forgetCanceledQuery = React.useCallback((queryExecutionId: string) => {
    canceledQueryIdsRef.current.delete(queryExecutionId);
  }, []);

  const wasQueryCanceled = React.useCallback((queryExecutionId: string) => {
    const canceled = canceledQueryIdsRef.current.has(queryExecutionId);

    if (canceled) canceledQueryIdsRef.current.delete(queryExecutionId);

    return canceled;
  }, []);

  const removeCancelingQueryId = React.useCallback((queryExecutionId: string) => {
    setCancelingQueryIds((prevState) => {
      const newState = new Set(prevState);
      newState.delete(queryExecutionId);
      return newState;
    });
  }, []);

  return {
    cancelingQueryIds,
    forgetCanceledQuery,
    markQueryCanceling,
    removeCancelingQueryId,
    wasQueryCanceled,
  };
};
