'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { PlayCircle } from 'lucide-react';
import { BatchModal } from '@/components/BatchModal';
import { useParams } from 'next/navigation';
import { useConfigsStore } from '@/lib/stores/configsStore';

export default function ConfigPage() {
  const [batchModalOpen, setBatchModalOpen] = useState(false);
  const params = useParams();
  const configId = params?.id as string;
  useConfigsStore(state => state.configs.find(c => c.id === configId));
  
  return (
    <div className="container mx-auto py-4">
      <Button
        variant="outline"
        onClick={() => setBatchModalOpen(true)}
        className="flex items-center mb-4"
      >
        <PlayCircle className="h-4 w-4 mr-2" />
        Run Batch
      </Button>

      {/* BatchModal */}
      <BatchModal
        configId={configId}
        isOpen={batchModalOpen}
        onClose={() => setBatchModalOpen(false)}
      />
      
      {/* Rest of your config edit page */}
    </div>
  );
} 