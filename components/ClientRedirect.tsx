'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface ClientRedirectProps {
  to: string;
  reason: string;
}

export default function ClientRedirect({ to, reason: _reason }: ClientRedirectProps) {
  const router = useRouter();
  
  useEffect(() => {
    router.replace(to);
  }, [to, router]);

  return (
    <div className="p-8">
      <p>Redirecting to dashboard...</p>
    </div>
  );
}