import type { ReactNode } from 'react';
import { MainLayout } from '@/components/Layout/MainLayout';

interface ReportWorkspaceViewProps {
  leftSidebar: ReactNode;
  viewer: ReactNode;
  rightPanel: ReactNode;
}

export function ReportWorkspaceView({ leftSidebar, viewer, rightPanel }: ReportWorkspaceViewProps) {
  return (
    <MainLayout
      leftSidebar={leftSidebar}
      viewer={viewer}
      rightPanel={rightPanel}
    />
  );
}
