import { ReactNode } from 'react';
import { Header } from './Header';

interface MainLayoutProps {
  leftSidebar: ReactNode;
  viewer: ReactNode;
  rightPanel: ReactNode;
}

export function MainLayout({ leftSidebar, viewer, rightPanel }: MainLayoutProps) {
  return (
    <div className="h-screen flex flex-col overflow-hidden bg-background">
      <Header />
      
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar - 250px fixed */}
        <aside className="w-64 border-r border-border bg-sidebar flex flex-col overflow-hidden shrink-0">
          {leftSidebar}
        </aside>

        {/* Center - DICOM Viewer (flexible) */}
        <main className="flex-1 bg-viewer overflow-hidden">
          {viewer}
        </main>

        {/* Right Panel - 400px fixed */}
        <aside className="w-[400px] border-l border-border bg-card flex flex-col overflow-hidden shrink-0">
          {rightPanel}
        </aside>
      </div>
    </div>
  );
}
