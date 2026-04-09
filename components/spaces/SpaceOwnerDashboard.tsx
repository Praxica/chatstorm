'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ConfirmModal } from '@/components/ui/confirm-modal';
import ModelsSettings from '@/components/settings/ModelsSettings';
import SpaceMembersTab from './SpaceMembersTab';
import SpaceTemplatesTab from './SpaceTemplatesTab';
import SpaceSettingsTab from './SpaceSettingsTab';
import SpaceTokenPlansTab from './SpaceTokenPlansTab';
import CreateTemplateModal from './CreateTemplateModal';
import { useToast } from '@/components/hooks/use-toast';
import { Badge } from "@/components/ui/badge";
import { Building2 } from 'lucide-react';
import * as LucideIcons from 'lucide-react';

interface SpaceOwnerDashboardProps {
  space: any;
  defaultTab?: string;
}

export default function SpaceOwnerDashboard({ space, defaultTab = 'members' }: SpaceOwnerDashboardProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [members, setMembers] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(defaultTab);
  const [currentSpace, setCurrentSpace] = useState(space);
  
  // Template modal state
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [userConfigs, setUserConfigs] = useState<any[]>([]);
  const [selectedConfig, setSelectedConfig] = useState('');
  const [templateName, setTemplateName] = useState('');
  const [templateDescription, setTemplateDescription] = useState('');
  const [isCreatingTemplate, setIsCreatingTemplate] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<any>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [templateToDelete, setTemplateToDelete] = useState<any>(null);
  const [isDeletingTemplate, setIsDeletingTemplate] = useState(false);

  const renderSpaceIcon = (iconName?: string) => {
    if (!iconName) {
      return <Building2 className="h-5 w-5" />;
    }
    
    // Convert to PascalCase for Lucide component names
    const pascalCaseIconName = iconName.charAt(0).toUpperCase() + iconName.slice(1).toLowerCase();
    
    const IconComponent = (LucideIcons as any)[pascalCaseIconName];
    if (IconComponent) {
      return <IconComponent className="h-5 w-5" />;
    }
    
    return <Building2 className="h-5 w-5" />;
  };

  useEffect(() => {
    fetchSpaceData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [space.id]);

  useEffect(() => {
    setActiveTab(defaultTab);
  }, [defaultTab]);

  const fetchSpaceData = async () => {
    try {
      // Fetch members
      const membersRes = await fetch(`/api/spaces/${currentSpace.slug}/members`);
      const membersData = await membersRes.json();
      setMembers(membersData.members || []);

      // Fetch templates
      const templatesRes = await fetch(`/api/spaces/${currentSpace.slug}/templates`);
      const templatesData = await templatesRes.json();
      setTemplates(templatesData.templates || []);
    } catch (error) {
      console.error('Error fetching space data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSpaceUpdate = (updatedSpace: any) => {
    setCurrentSpace(updatedSpace);
  };

  const handleApproveMember = async (memberId: string) => {
    try {
      const res = await fetch(`/api/spaces/${space.slug}/members/${memberId}/approve`, {
        method: 'POST',
      });
      if (res.ok) {
        fetchSpaceData();
        toast({
          title: "Member Approved",
          description: "The member has been approved and granted access to the space.",
        });
      } else {
        throw new Error('Failed to approve member');
      }
    } catch (error) {
      console.error('Error approving member:', error);
      toast({
        title: "Error",
        description: "Failed to approve member. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleRejectMember = async (memberId: string) => {
    try {
      const res = await fetch(`/api/spaces/${space.slug}/members/${memberId}/reject`, {
        method: 'POST',
      });
      if (res.ok) {
        fetchSpaceData();
        toast({
          title: "Member Rejected",
          description: "The member request has been rejected.",
        });
      } else {
        throw new Error('Failed to reject member');
      }
    } catch (error) {
      console.error('Error rejecting member:', error);
      toast({
        title: "Error",
        description: "Failed to reject member. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleUpdateRole = async (memberId: string, newRole: string) => {
    try {
      const res = await fetch(`/api/spaces/${space.slug}/members/${memberId}/role`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ role: newRole }),
      });
      
      if (res.ok) {
        fetchSpaceData();
        toast({
          title: "Role Updated",
          description: `Member role changed to ${newRole}.`,
        });
      } else {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to update member role');
      }
    } catch (error: any) {
      console.error('Error updating member role:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to update member role. Please try again.",
        variant: "destructive",
      });
      throw error; // Re-throw so the component can handle it
    }
  };

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    router.push(`/spaces/${currentSpace.slug}/admin/${value}`);
  };

  const handleOpenTemplateModal = async () => {
    setIsTemplateModalOpen(true);
    // Fetch user's configs when modal opens
    try {
      const response = await fetch('/api/configs');
      if (response.ok) {
        const configs = await response.json();
        setUserConfigs(configs);
      }
    } catch (error) {
      console.error('Error fetching user configs:', error);
      toast({
        title: "Error",
        description: "Failed to load your apps. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleCloseTemplateModal = () => {
    setIsTemplateModalOpen(false);
    setSelectedConfig('');
    setTemplateName('');
    setTemplateDescription('');
    setEditingTemplate(null);
  };

  const handleConfigSelect = (configId: string) => {
    setSelectedConfig(configId);
    const config = userConfigs.find(c => c.id === configId);
    if (config) {
      setTemplateName(config.title);
    }
  };

  const handleCreateTemplate = async () => {
    if (!selectedConfig || !templateName.trim()) {
      toast({
        title: "Missing Information",
        description: "Please select an app and enter a template name.",
        variant: "destructive",
      });
      return;
    }

    setIsCreatingTemplate(true);
    try {
      const isEditing = !!editingTemplate;
      const url = isEditing 
        ? `/api/spaces/${space.slug}/templates/${editingTemplate.id}`
        : `/api/spaces/${space.slug}/templates`;
      const method = isEditing ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          configId: selectedConfig,
          title: templateName.trim(),
          description: templateDescription.trim(),
        }),
      });

      if (response.ok) {
        toast({
          title: isEditing ? "Template Updated" : "Template Created",
          description: `"${templateName}" has been ${isEditing ? 'updated' : 'added to your space'}.`,
        });
        handleCloseTemplateModal();
        fetchSpaceData(); // Refresh templates list
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to ${isEditing ? 'update' : 'create'} template`);
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || `Failed to ${editingTemplate ? 'update' : 'create'} template. Please try again.`,
        variant: "destructive",
      });
    } finally {
      setIsCreatingTemplate(false);
    }
  };

  const handleEditTemplate = async (template: any) => {
    setEditingTemplate(template);
    setSelectedConfig(template.configId);
    setTemplateName(template.title);
    setTemplateDescription(template.description || '');
    setIsTemplateModalOpen(true);
    
    // Fetch user's configs for the dropdown
    try {
      const response = await fetch('/api/configs');
      if (response.ok) {
        const configs = await response.json();
        setUserConfigs(configs);
      }
    } catch (error) {
      console.error('Error fetching user configs:', error);
      toast({
        title: "Error",
        description: "Failed to load your apps. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleDeleteTemplate = (template: any) => {
    setTemplateToDelete(template);
    setDeleteModalOpen(true);
  };

  const confirmDeleteTemplate = async () => {
    if (!templateToDelete) return;
    
    setIsDeletingTemplate(true);
    try {
      const response = await fetch(`/api/spaces/${space.slug}/templates/${templateToDelete.id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        toast({
          title: "Template Deleted",
          description: `"${templateToDelete.title}" has been removed.`,
        });
        fetchSpaceData(); // Refresh templates list
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete template');
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to delete template. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsDeletingTemplate(false);
      setDeleteModalOpen(false);
      setTemplateToDelete(null);
    }
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex-shrink-0 border-b bg-gray-50">
        <div className="flex items-center gap-4 px-6 py-4">
          <Badge variant="secondary" className="text-lg px-3 py-1 flex items-center gap-2">
            {renderSpaceIcon(currentSpace.badgeIcon)}
            {currentSpace.name}
          </Badge>
          <Tabs value={activeTab} onValueChange={handleTabChange} className="w-auto">
            <TabsList>
              <TabsTrigger 
                value="members" 
                className="px-4 py-2 text-sm font-medium text-black data-[state=active]:bg-black data-[state=active]:text-white hover:bg-accent hover:text-accent-foreground"
              >
                Members
              </TabsTrigger>
              <TabsTrigger 
                value="templates" 
                className="px-4 py-2 text-sm font-medium text-black data-[state=active]:bg-black data-[state=active]:text-white hover:bg-accent hover:text-accent-foreground"
              >
                Templates
              </TabsTrigger>
              <TabsTrigger 
                value="models" 
                className="px-4 py-2 text-sm font-medium text-black data-[state=active]:bg-black data-[state=active]:text-white hover:bg-accent hover:text-accent-foreground"
              >
                Models
              </TabsTrigger>
              <TabsTrigger 
                value="token-plans" 
                className="px-4 py-2 text-sm font-medium text-black data-[state=active]:bg-black data-[state=active]:text-white hover:bg-accent hover:text-accent-foreground"
              >
                Token Plans
              </TabsTrigger>
              <TabsTrigger 
                value="settings" 
                className="px-4 py-2 text-sm font-medium text-black data-[state=active]:bg-black data-[state=active]:text-white hover:bg-accent hover:text-accent-foreground"
              >
                Settings
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>
      
      <div className="flex-1 overflow-auto">
        <Tabs value={activeTab} className="h-full">
          <TabsContent value="members" className="h-full">
            <SpaceMembersTab 
              space={currentSpace}
              members={members}
              loading={loading}
              onApproveMember={handleApproveMember}
              onRejectMember={handleRejectMember}
              onUpdateRole={handleUpdateRole}
              userRole={currentSpace.userRole}
              onMemberUpdate={fetchSpaceData}
            />
          </TabsContent>

          <TabsContent value="templates" className="h-full">
            <SpaceTemplatesTab 
              templates={templates}
              onCreateTemplate={handleOpenTemplateModal}
              onEditTemplate={handleEditTemplate}
              onDeleteTemplate={handleDeleteTemplate}
            />
          </TabsContent>

          <TabsContent value="models" className="h-full">
            <div className="container mx-auto max-w-6xl h-full">
              <ModelsSettings 
                isSpaceContext={true}
                spaceSlug={currentSpace.slug}
                spaceModelSettings={currentSpace.modelSettings}
                labels={{
                  title: "Model Settings",
                  description: "Configure which AI models are available to members of this space",
                  saveButton: "Save Space Settings"
                }}
              />
            </div>
          </TabsContent>

          <TabsContent value="token-plans" className="h-full">
            <SpaceTokenPlansTab space={currentSpace} />
          </TabsContent>

          <TabsContent value="settings" className="h-full">
            <SpaceSettingsTab 
              space={currentSpace} 
              templates={templates} 
              onSpaceUpdate={handleSpaceUpdate}
            />
          </TabsContent>
        </Tabs>
      </div>

      {/* Template Creation Modal */}
      <CreateTemplateModal
        isOpen={isTemplateModalOpen}
        onClose={handleCloseTemplateModal}
        userConfigs={userConfigs}
        selectedConfig={selectedConfig}
        templateName={templateName}
        templateDescription={templateDescription}
        isCreating={isCreatingTemplate}
        editingTemplate={editingTemplate}
        onConfigSelect={handleConfigSelect}
        onTemplateNameChange={setTemplateName}
        onTemplateDescriptionChange={setTemplateDescription}
        onCreateTemplate={handleCreateTemplate}
      />

      {/* Delete Template Confirmation Modal */}
      {deleteModalOpen && templateToDelete && (
        <ConfirmModal
          title="Delete Template"
          message={<span>Are you sure you want to delete <b>{templateToDelete.title}</b>? This action cannot be undone.</span>}
          onConfirm={confirmDeleteTemplate}
          onCancel={() => { setDeleteModalOpen(false); setTemplateToDelete(null); }}
          isLoading={isDeletingTemplate}
          confirmText="Delete"
        />
      )}
    </div>
  );
}