'use client'

import { PreviewDataLoader } from "../components/PreviewDataLoader";
import { use } from "react";

interface PreviewLayoutProps {
  children: React.ReactNode;
  params: Promise<{ templateId: string }>;
}

export default function PreviewLayout({ children, params }: PreviewLayoutProps) {
  const { templateId } = use(params);

  return (
    <PreviewDataLoader templateId={templateId}>
      <div className="flex-1 h-full overflow-hidden">
        {children}
      </div>
    </PreviewDataLoader>
  );
} 