"use client"

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/hooks/use-toast";
import { Loader2, Eye, EyeOff, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface CustomModel {
  id: string;
  name: string;
  provider: string;
  apiKey?: string;
  modelId: string;
  baseURL?: string;
}

interface CustomModelModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (model: Omit<CustomModel, 'id'>) => Promise<void>;
  model: CustomModel | null;
}

const PROVIDER_OPTIONS = [
  { value: 'openai', label: 'OpenAI' },
  { value: 'anthropic', label: 'Anthropic' },
  { value: 'google', label: 'Google' },
  { value: 'groq', label: 'Groq' },
  { value: 'custom', label: 'Custom (OpenAI-compatible)' },
];

export default function CustomModelModal({ isOpen, onClose, onSave, model }: CustomModelModalProps) {
  const [name, setName] = useState('');
  const [provider, setProvider] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [modelId, setModelId] = useState('');
  const [baseURL, setBaseURL] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [isApiKeyVisible, setIsApiKeyVisible] = useState(false);
  const [isEditingApiKey, setIsEditingApiKey] = useState(false);
  const [hasEncryptedKey, setHasEncryptedKey] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (model) {
      setName(model.name);
      // Use backend provider slug directly
      setProvider(model.provider);
      setApiKey('');
      setModelId(model.modelId);
      setBaseURL(model.baseURL || '');
      setHasEncryptedKey(true);
      setIsEditingApiKey(false);
    } else {
      // Reset form for new model
      setName('');
      setProvider('');
      setApiKey('');
      setModelId('');
      setBaseURL('');
      setHasEncryptedKey(false);
      setIsEditingApiKey(true); // For new models, always show the API key field
    }
    setIsApiKeyVisible(false); // Reset visibility on open
    setIsSaving(false); // Reset saving state on open
    setTestResult(null); // Reset test result on open
  }, [model, isOpen]);

  // Clear test result when form values change
  useEffect(() => {
    setTestResult(null);
  }, [provider, modelId, apiKey, baseURL]);

  const handleEditApiKey = () => {
    setIsEditingApiKey(true);
    setApiKey('');
    setTestResult(null);
  };

  const handleCancelEditApiKey = () => {
    setIsEditingApiKey(false);
    setApiKey('');
    setTestResult(null);
  };

  const handleTestConnection = async () => {
    if (!provider || !modelId || !apiKey) {
      toast({
        title: "Missing Information",
        description: "Please fill in provider, model ID, and API key before testing.",
        variant: "destructive",
      });
      return;
    }

    setIsTesting(true);
    setTestResult(null);

    try {
      const response = await fetch('/api/models/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          provider, // slug
          modelId,
          apiKey,
          baseURL: isCustomProvider ? baseURL : undefined,
        }),
      });

      const result = await response.json();

      if (result.success) {
        setTestResult({ success: true, message: 'Connection successful' });
      } else {
        setTestResult({ success: false, message: result.error || 'Connection failed' });
      }
    } catch (_error) {
      setTestResult({ success: false, message: 'Network error occurred' });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = async () => {
    if (!name || !provider || !modelId) {
      toast({
        title: "Missing Fields",
        description: "Please fill out all required fields.",
        variant: "destructive",
      });
      return;
    }

    // For new models, API key is required
    if (!model && !apiKey) {
      toast({
        title: "Missing API Key",
        description: "API key is required for new models.",
        variant: "destructive",
      });
      return;
    }
    
    // For editing, only include API key if it's provided (allow updating without changing the key)
    const finalApiKey = isEditingApiKey && apiKey ? apiKey : undefined;

    setIsSaving(true);
    try {
      await onSave({
        name,
        provider, // slug
        apiKey: finalApiKey,
        modelId,
        baseURL: provider === 'custom' ? baseURL : undefined,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const isCustomProvider = provider === 'custom';

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[525px]">
        <DialogHeader>
          <DialogTitle>{model ? 'Edit Custom Model' : 'Add Custom Model'}</DialogTitle>
          <DialogDescription>
            Provide the details for your custom model. API keys are stored securely and are never exposed to the client.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <label htmlFor="name" className="text-right">Name</label>
            <Input id="name" value={name} onChange={e => setName(e.target.value)} className="col-span-3" placeholder="My Custom GPT-4" />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <label htmlFor="provider" className="text-right">Provider</label>
            <Select value={provider} onValueChange={setProvider}>
              <SelectTrigger className="col-span-3">
                <SelectValue placeholder="Select a provider" />
              </SelectTrigger>
              <SelectContent>
                {PROVIDER_OPTIONS.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <label htmlFor="modelId" className="text-right">Model ID</label>
            <Input id="modelId" value={modelId} onChange={e => setModelId(e.target.value)} className="col-span-3" placeholder="e.g., gpt-4o" />
          </div>
          {isCustomProvider && (
            <div className="grid grid-cols-4 items-center gap-4">
              <label htmlFor="baseURL" className="text-right">Base URL</label>
              <Input id="baseURL" value={baseURL} onChange={e => setBaseURL(e.target.value)} className="col-span-3" placeholder="https://api.custom.com/v1" />
            </div>
          )}
          <div className="grid grid-cols-4 items-start gap-4">
            <label htmlFor="apiKey" className="text-right pt-2">API Key</label>
            <div className="col-span-3">
              {hasEncryptedKey && !isEditingApiKey ? (
                <div className="flex items-center gap-2">
                  <div className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-md text-sm text-gray-600">
                    Encrypted
                  </div>
                  <Button 
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleEditApiKey}
                  >
                    Edit Key
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="relative">
                    <Input 
                      id="apiKey" 
                      type={isApiKeyVisible ? 'text' : 'password'}
                      value={apiKey} 
                      onChange={e => setApiKey(e.target.value)} 
                      className="pr-10"
                      placeholder="Your API key"
                    />
                    <Button 
                      type="button"
                      variant="ghost" 
                      size="icon" 
                      className="absolute inset-y-0 right-0 h-full px-3 text-muted-foreground hover:bg-transparent"
                      onClick={() => setIsApiKeyVisible(!isApiKeyVisible)}
                    >
                      {isApiKeyVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      <span className="sr-only">{isApiKeyVisible ? 'Hide API key' : 'Show API key'}</span>
                    </Button>
                  </div>
                  {hasEncryptedKey && (
                    <div className="flex gap-2">
                      <Button 
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={handleCancelEditApiKey}
                        className="text-xs bg-gray-100 hover:bg-gray-200"
                      >
                        Keep existing key
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
        {(isEditingApiKey && apiKey) && (
          <div className="grid grid-cols-4 items-start gap-4">
            <label className="text-right pt-2">Test</label>
            <div className="col-span-3">
              <Button
                variant="outline"
                onClick={handleTestConnection}
                disabled={isTesting || isSaving || !provider || !modelId || !apiKey}
              >
                {isTesting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Run API test
              </Button>
              {testResult && (
                <div className={cn(
                  "flex items-center gap-2 text-sm mt-1",
                  testResult.success ? "text-green-600" : "text-red-600"
                )}>
                  {testResult.success ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <X className="h-4 w-4" />
                  )}
                  <span>{testResult.message}</span>
                </div>
              )}
              {!testResult && (
                <p className="text-sm text-muted-foreground mt-2">This will send a &quot;test&quot; message to the provider using the ID and key.</p>
              )}
            </div>
          </div>
        )}
        <DialogFooter className="mt-4 border-t pt-4">
          <Button variant="outline" onClick={onClose} disabled={isSaving}>Cancel</Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isSaving ? 'Saving...' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} 