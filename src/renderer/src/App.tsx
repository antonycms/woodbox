import React from 'react';
import '@renderer/styles/reset.css';
import '@renderer/init';

import { ContainerApp } from '@renderer/components/ContainerApp';
import { Sidebar } from '@renderer/components/Sidebar';
import { MainContent } from '@renderer/components/MainContent';

import AppTabProvider from './contexts/AppTab';
import StoreContextProvider from './contexts/Store';
import ToastProvider from './contexts/Toast';

const App = () => {
  return (
    <StoreContextProvider>
      <ContainerApp>
        <ToastProvider>
          <AppTabProvider>
            <Sidebar />

            <MainContent />
          </AppTabProvider>
        </ToastProvider>
      </ContainerApp>
    </StoreContextProvider>
  );
};

export default App;
