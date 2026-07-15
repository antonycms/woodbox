import React from 'react';
import ResizableContainer from '@renderer/components/ResizableContainer';
import useDebounce from '@renderer/hooks/useDebounce';
import useStorage from '@renderer/hooks/useStorage';
import { IconDatabase, IconSettings } from '@renderer/styles/icons';
import { useCssPropertiesWithActiveTheme } from '@renderer/contexts/Theme';
import { SettingsModal } from '@renderer/components/SettingsModal';
import ProjectsMenu from './components/menus/ProjectsMenu';
import { MenuBar } from './components/MenuBar';
import { SidebarActiveContent } from './components/SidebaActiveContent';
import { isPrimaryShortcutPressed } from '@renderer/utils/keyboard';
import styles from './styles.module.css';

type Menu = 'projects';

export const Sidebar = React.memo(() => {
  const [selectedMenu, setSelectedMenu] = React.useState<Menu | null>('projects');
  const [showSettingsModal, setShowSettingsModal] = React.useState(false);
  const [width, _setWidth] = useStorage('sidebar_width', 300);
  const setWidth = useDebounce(_setWidth);

  const style = useCssPropertiesWithActiveTheme((activeTheme) => ({
    borderColor: activeTheme.sideBar.borderColor,
  }));

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isPrimaryShortcutPressed(e) && e.shiftKey && e.key?.toLowerCase?.() === 'f') {
        e.preventDefault();
        setSelectedMenu('projects');

        setTimeout(() => {
          const inputFilterProjects = document.getElementById('input_filter_projects');
          inputFilterProjects?.focus?.();
        });
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className={styles.container} style={style}>
      <MenuBar
        value={selectedMenu}
        onChange={(v: Menu) => setSelectedMenu(v === selectedMenu ? null : v)}
        items={[{ id: 'projects', title: 'Projetos', icon: () => <IconDatabase /> }]}
        footerItems={[{ id: 'settings', title: 'Configurações', icon: () => <IconSettings /> }]}
        onFooterItemClick={() => setShowSettingsModal(true)}
      />

      <ResizableContainer
        minWidth={160}
        maxWidth={800}
        width={width}
        style={{ display: selectedMenu ? 'flex' : 'none' }}
        onResize={(size) => setWidth(size.width)}
      >
        <SidebarActiveContent active={selectedMenu === 'projects'}>
          <ProjectsMenu />
        </SidebarActiveContent>
      </ResizableContainer>

      <SettingsModal show={showSettingsModal} onClose={() => setShowSettingsModal(false)} />
    </div>
  );
});

Sidebar.displayName = 'Sidebar';
