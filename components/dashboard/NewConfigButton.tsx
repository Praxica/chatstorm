"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { NewConfigModal } from './NewConfigModal';
import { useCreateConfig } from '@/lib/hooks/useCreateConfig';

export function NewConfigButton() {
  const [showConfigModal, setShowConfigModal] = useState(false);
  const { createConfig } = useCreateConfig();

  return (
    <>
      <Button
        onClick={() => setShowConfigModal(true)}
        className="w-full"
      >
        Design a new Chat
      </Button>

      <NewConfigModal
        isOpen={showConfigModal}
        onClose={() => setShowConfigModal(false)}
        onSave={createConfig}
        type={null}
        defaultTitle="New Chat Design"
      />
    </>
  );
} 