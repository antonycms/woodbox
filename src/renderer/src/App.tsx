import React from 'react';
import '@renderer/styles/reset.css';
import '@renderer/init';

import { ContainerApp } from '@renderer/components/ContainerApp';
import { Sidebar } from '@renderer/components/Sidebar';
import { MainContent } from '@renderer/components/MainContent';
import { CentralSearchModal } from '@renderer/components/CentralSearchModal';
import { AIChatPanel } from '@renderer/components/AIChatPanel';

import AIChatPanelProvider from '@renderer/contexts/AIChatPanel';
import AppTabProvider from '@renderer/contexts/AppTab';
import StoreContextProvider from '@renderer/contexts/Store';
import ToastProvider from '@renderer/contexts/Toast';
import ThemeProvider from '@renderer/contexts/Theme';
import I18nProvider from '@renderer/contexts/I18n';

const App = () => {
  return (
    <I18nProvider>
      <ThemeProvider>
        <StoreContextProvider>
          <ContainerApp>
            <ToastProvider>
              <AppTabProvider>
                <AIChatPanelProvider>
                  <Sidebar />

                  <MainContent />

                  <AIChatPanel />

                  <CentralSearchModal />
                </AIChatPanelProvider>
              </AppTabProvider>
            </ToastProvider>
          </ContainerApp>
        </StoreContextProvider>
      </ThemeProvider>
    </I18nProvider>
  );
};

export default App;
