'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { FileText, Plus, Edit, Trash2 } from 'lucide-react';

interface SpaceTemplatesTabProps {
  templates: any[];
  onCreateTemplate: () => void;
  onEditTemplate: (template: any) => void;
  onDeleteTemplate: (template: any) => void;
}

export default function SpaceTemplatesTab({ 
  templates, 
  onCreateTemplate, 
  onEditTemplate, 
  onDeleteTemplate 
}: SpaceTemplatesTabProps) {
  return (
    <div className="container mx-auto max-w-6xl h-full flex flex-col">
      {/* Scrollable content area */}
      <div className="flex-1 overflow-auto px-8 py-6">
        <div className="space-y-6">
          <div>
            <h2 className="text-xl font-semibold mb-2">Space Templates</h2>
            <p className="text-muted-foreground mb-6">
              Create and manage chat templates that members can use as starting points.
            </p>
          </div>

          <div className="pt-4 border-t">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold">Available Templates</h3>
              <Button onClick={onCreateTemplate}>
                <Plus className="h-4 w-4 mr-2" />
                Create Template
              </Button>
            </div>
          </div>

          <div className="space-y-3">
            {templates.length === 0 ? (
              <div className="text-center py-10 border-2 border-dashed rounded-lg">
                <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                <p className="text-sm text-muted-foreground">No templates created yet</p>
                <p className="text-sm text-muted-foreground">Create your first template to get started</p>
              </div>
            ) : (
              templates.map((template) => (
                <div key={template.id} className="p-4 border rounded-lg">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="font-semibold">{template.title}</div>
                      <div className="text-sm text-muted-foreground mt-1">{template.description}</div>
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onEditTemplate(template)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onDeleteTemplate(template)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}