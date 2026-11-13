import { app } from 'electron';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

if (!app.isPackaged) {
  const userData = join(app.getPath('appData'), 'woodbox-dev');
  const sessionData = join(userData, 'chromium');
  mkdirSync(sessionData, { recursive: true });
  app.setPath('userData', userData);
  app.setPath('sessionData', sessionData);
}

// Acquire the profile lock before loading storage, drivers or other app modules.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  // fix Wayland color bug
  if (process.platform === 'linux') {
    app.commandLine.appendSwitch('disable-features', 'WaylandWpColorManagerV1');
  }

  const application = import('./application');

  app.on('second-instance', () => {
    void application
      .then(({ openAdditionalWindow }) => openAdditionalWindow())
      .catch((error: unknown) => {
        console.error('Falha ao abrir outra janela do Woodbox:', error);
      });
  });

  void application.catch((error: unknown) => {
    console.error('Falha ao inicializar o Woodbox:', error);
    app.exit(1);
  });
}
