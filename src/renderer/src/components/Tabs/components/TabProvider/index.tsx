import React from 'react';
import { ITabContext, TabContext } from './context';

export default function TabProvider({ children }) {
  const [value, setValue] = React.useState<ITabContext>({ activeTabId: null, idTabBar: null });

  React.useEffect(() => {
    const onReceiveChangeTabEvent = (event: CustomEvent) => {
      setValue(event.detail);
    };

    document.addEventListener('tab_change', onReceiveChangeTabEvent);

    return () => {
      document.removeEventListener('tab_change', onReceiveChangeTabEvent);
    };
  }, []);

  return <TabContext.Provider value={value}>{children}</TabContext.Provider>;
}

export const useTabContext = () => {
  return React.useContext(TabContext);
};
