'use client';

import React from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';

interface CreateTemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  userConfigs: any[];
  selectedConfig: string;
  templateName: string;
  templateDescription: string;
  isCreating: boolean;
  editingTemplate: any;
  onConfigSelect: (configId: string) => void;
  onTemplateNameChange: (name: string) => void;
  onTemplateDescriptionChange: (description: string) => void;
  onCreateTemplate: () => void;
}

export default function CreateTemplateModal({
  isOpen,
  onClose,
  userConfigs,
  selectedConfig,
  templateName,
  templateDescription,
  isCreating,
  editingTemplate,
  onConfigSelect,
  onTemplateNameChange,
  onTemplateDescriptionChange,
  onCreateTemplate
}: CreateTemplateModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[525px]">
        <DialogHeader>
          <DialogTitle>{editingTemplate ? 'Edit Template' : 'Create Template'}</DialogTitle>
          <DialogDescription>
            {editingTemplate 
              ? 'Update the template details below.'
              : 'Create a new template from one of your existing apps to share with space members.'
            }
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <label htmlFor="config-select" className="text-right">Select App</label>
            <Select value={selectedConfig} onValueChange={onConfigSelect}>
              <SelectTrigger id="config-select" className="col-span-3">
                <SelectValue placeholder="Choose one of your apps" />
              </SelectTrigger>
              <SelectContent>
                {userConfigs.map((config) => (
                  <SelectItem key={config.id} value={config.id}>
                    {config.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <label htmlFor="template-name" className="text-right">Template Name</label>
            <Input
              id="template-name"
              value={templateName}
              onChange={(e) => onTemplateNameChange(e.target.value)}
              className="col-span-3"
              placeholder="Enter template name"
            />
          </div>

          <div className="grid grid-cols-4 items-start gap-4">
            <label htmlFor="template-description" className="text-right pt-2">Description</label>
            <Textarea
              id="template-description"
              value={templateDescription}
              onChange={(e) => onTemplateDescriptionChange(e.target.value)}
              className="col-span-3"
              placeholder="Describe what this template is for... (optional)"
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button 
            onClick={onCreateTemplate}
            disabled={isCreating || !selectedConfig || !templateName.trim()}
          >
            {isCreating 
              ? (editingTemplate ? "Updating..." : "Creating...") 
              : (editingTemplate ? "Update Template" : "Create Template")
            }
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}