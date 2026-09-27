import React from 'react';
import { TabContentAlter } from '../TabContentAlter';
import { TabContentDelete } from '../TabContentDelete';
import { TabcontentError } from '../TabContentError';
import { TabContentExplain } from '../TabContentExplain';
import { TabContentGeneric } from '../TabContentGeneric';
import { TabContentSelect } from '../TabContentSelect';

type IQueryResultContentProps = React.ComponentProps<typeof TabContentSelect>;

export const QueryResultContent = (props: IQueryResultContentProps) => {
  const { data, onCancelQuery, cancelingQuery } = props;

  if (data.type === 'ERROR') return <TabcontentError data={data} />;
  if (data.type === 'DELETE') return <TabContentDelete data={data} />;
  if (data.type === 'ALTER') return <TabContentAlter data={data} />;

  if (data.type === 'EXPLAIN') {
    return <TabContentExplain data={data} onCancelQuery={onCancelQuery} cancelingQuery={cancelingQuery} />
  }

  if (data.type === 'SELECT' || data.columns?.length) {
    return <TabContentSelect {...props} readOnly={data.type !== 'SELECT'} />;
  }

  return <TabContentGeneric data={data} />;
};
