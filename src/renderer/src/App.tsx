import React from 'react';
import '@renderer/styles/reset.css';
import '@renderer/init';

import { StoreInitialization } from '@renderer/components/StoreInitialization';
import { ContainerApp } from '@renderer/components/ContainerApp';
import { Sidebar } from '@renderer/components/Sidebar';
import { MainContent } from '@renderer/components/MainContent';
import { CentralSearchModal } from '@renderer/components/CentralSearchModal';
import { AIChatPanel } from '@renderer/components/AIChatPanel';
import { UpdateAvailableModal } from '@renderer/components/UpdateAvailableModal';

import { ToastHost } from '@renderer/components/ToastHost';
import { AppTabLifecycle } from '@renderer/components/AppTabLifecycle';

const App = () => {
  return (
    <ContainerApp>
      <StoreInitialization />
      <AppTabLifecycle />
      <Sidebar />
      <MainContent />
      <AIChatPanel />
      <CentralSearchModal />
      <UpdateAvailableModal />
      <ToastHost />
    </ContainerApp>
  );
};

export default App;
