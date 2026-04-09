'use client'

import { use } from 'react';
import { ShareDataLoader } from '../components/ShareDataLoader'

interface ShareLayoutProps {
  children: React.ReactNode;
  params: Promise<{ shareId: string }>;
}

export default function ShareLayout({ children, params }: ShareLayoutProps) {
  const { shareId } = use(params);
  console.log('[ShareLayout] Rendering layout for share:', shareId);

  return (
    <ShareDataLoader shareId={shareId}>
      {children}
    </ShareDataLoader>
  );
} 