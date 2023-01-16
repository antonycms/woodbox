import React from 'react';
import ResizableContainer from '@renderer/components/ResizableContainer';
import { VerticalBar } from '@renderer/components/VerticalBar';
import useDebounce from '@renderer/hooks/useDebounce';
import useStorage from '@renderer/hooks/useStorage';
import { IconDatabase, IconSettings } from '@renderer/styles/icons';
import ProjectsMenu from './components/menus/ProjectsMenu';
import SettingsMenu from './components/menus/SettingsMenu';
import styles from './styles.module.css';
import { SidebarActiveContent } from './components/SidebaActiveContent';

type Menu = 'projects' | 'settings';

export const Sidebar = React.memo(() => {
  const [selectedMenu, setSelectedMenu] = React.useState<Menu>('projects');
  const [width, _setWidth] = useStorage('sidebar_width', 300);
  const setWidth = useDebounce(_setWidth);

  return (
    <div className={styles.container}>
      <VerticalBar
        value={selectedMenu}
        onChange={(v: Menu) => setSelectedMenu(v === selectedMenu ? null : v)}
        items={[
          { id: 'projects', title: 'Projetos', icon: () => <IconDatabase /> },
          { id: 'settings', title: 'Configurações', icon: () => <IconSettings /> },
        ]}
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

        <SidebarActiveContent active={selectedMenu === 'settings'}>
          <SettingsMenu />
        </SidebarActiveContent>
      </ResizableContainer>
    </div>
  );
});

Sidebar.displayName = 'Sidebar';
