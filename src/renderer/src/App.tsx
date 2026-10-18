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
import { OnboardingModal } from '@renderer/components/OnboardingModal';

const App = () => {
  const [storesReady, setStoresReady] = React.useState(false);

  const handleStoresInitialized = React.useCallback(() => setStoresReady(true), []);

  return (
    <ContainerApp>
      <StoreInitialization onInitialized={handleStoresInitialized} />
      <AppTabLifecycle />
      <Sidebar />
      <MainContent />
      <AIChatPanel />
      <CentralSearchModal />
      <UpdateAvailableModal />
      {storesReady && <OnboardingModal />}
      <ToastHost />
    </ContainerApp>
  );
};

export default App;
