'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/hooks/use-toast';
import { ConfirmModal } from '@/components/ui/confirm-modal';
import CreateTokenPlanModal from './CreateTokenPlanModal';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Plus, Edit2, Trash2, Star } from 'lucide-react';

interface TokenPlan {
  id: string;
  name: string;
  tokenLimit: number;
  cadence: 'WEEKLY' | 'MONTHLY';
  priceCents: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface SpaceTokenPlansTabProps {
  space: any;
}

export default function SpaceTokenPlansTab({ space }: SpaceTokenPlansTabProps) {
  const { toast } = useToast();
  const [tokenPlans, setTokenPlans] = useState<TokenPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingPlan, setEditingPlan] = useState<TokenPlan | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [planToDelete, setPlanToDelete] = useState<TokenPlan | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    tokenLimit: '',
    cadence: 'MONTHLY' as 'WEEKLY' | 'MONTHLY',
  });

  useEffect(() => {
    fetchTokenPlans();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [space.slug]);

  const fetchTokenPlans = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/spaces/${space.slug}/token-plans`);
      if (response.ok) {
        const data = await response.json();
        setTokenPlans(data.tokenPlans || []);
      } else {
        throw new Error('Failed to fetch token plans');
      }
    } catch (error) {
      console.error('Error fetching token plans:', error);
      toast({
        title: "Error",
        description: "Failed to load token plans. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      tokenLimit: '',
      cadence: 'MONTHLY',
    });
    setEditingPlan(null);
    setShowCreateModal(false);
  };

  const handleCreatePlan = () => {
    resetForm();
    setShowCreateModal(true);
  };

  const handleEditPlan = (plan: TokenPlan) => {
    setFormData({
      name: plan.name,
      tokenLimit: plan.tokenLimit.toString(),
      cadence: plan.cadence,
    });
    setEditingPlan(plan);
    setShowCreateModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim() || !formData.tokenLimit) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const url = editingPlan 
        ? `/api/spaces/${space.slug}/token-plans/${editingPlan.id}`
        : `/api/spaces/${space.slug}/token-plans`;
      
      const method = editingPlan ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.name.trim(),
          tokenLimit: parseInt(formData.tokenLimit),
          cadence: formData.cadence,
        }),
      });

      if (response.ok) {
        toast({
          title: "Success",
          description: `Token plan ${editingPlan ? 'updated' : 'created'} successfully.`,
        });
        resetForm();
        fetchTokenPlans();
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to ${editingPlan ? 'update' : 'create'} token plan`);
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || `Failed to ${editingPlan ? 'update' : 'create'} token plan.`,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeletePlan = (plan: TokenPlan) => {
    setPlanToDelete(plan);
    setDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!planToDelete) return;

    try {
      const response = await fetch(`/api/spaces/${space.slug}/token-plans/${planToDelete.id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        toast({
          title: "Success",
          description: "Token plan deleted successfully.",
        });
        fetchTokenPlans();
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete token plan');
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to delete token plan.",
        variant: "destructive",
      });
    } finally {
      setDeleteModalOpen(false);
      setPlanToDelete(null);
    }
  };


  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-pulse text-lg">Loading token plans...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-6xl h-full flex flex-col">
      <div className="flex-1 overflow-auto px-8 py-6">
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold mb-2">Token Plans</h2>
              <p className="text-muted-foreground">
                Manage token usage plans for space members
              </p>
            </div>
            <Button onClick={handleCreatePlan} className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Create Plan
            </Button>
          </div>


      {/* Token Plans List */}
      <TooltipProvider>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {tokenPlans
            .sort((a, b) => a.tokenLimit - b.tokenLimit)
            .map((plan) => (
            <Card key={plan.id} className={`relative ${!plan.isActive ? 'opacity-60' : ''}`}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="cursor-default">{plan.name}</span>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Plan created on {new Date(plan.createdAt).toLocaleDateString()}</p>
                        {plan.updatedAt !== plan.createdAt && (
                          <p>Last updated on {new Date(plan.updatedAt).toLocaleDateString()}</p>
                        )}
                      </TooltipContent>
                    </Tooltip>
                    {space.defaultTokenPlanId === plan.id && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Star className="h-4 w-4 text-blue-500 fill-blue-500" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="font-normal">This is the default plan assigned to new members</p>
                        </TooltipContent>
                      </Tooltip>
                    )}
                  </CardTitle>
                  <div className="flex items-center gap-1">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditPlan(plan)}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Edit plan details</p>
                      </TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeletePlan(plan)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Delete this plan</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Badge variant={plan.isActive ? "default" : "secondary"}>
                        {plan.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{plan.isActive ? 'This plan is available for assignment' : 'This plan is not available for new assignments'}</p>
                    </TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Badge variant="outline">
                        {plan.cadence.toLowerCase()}
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Token limits reset every {plan.cadence.toLowerCase()}</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="text-sm text-gray-600">Token Limit</p>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <p className="text-lg font-semibold cursor-default">{plan.tokenLimit.toLocaleString()}</p>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Members with this plan can use up to {plan.tokenLimit.toLocaleString()} tokens per {plan.cadence.toLowerCase()}</p>
                    </TooltipContent>
                  </Tooltip>
                </div>

              </CardContent>
            </Card>
          ))}
        </div>
      </TooltipProvider>

      {tokenPlans.length === 0 && (
        <Card>
          <CardContent className="text-center py-8">
            <p className="text-gray-600">No token plans created yet.</p>
          </CardContent>
        </Card>
      )}

      {/* Token Plan Modal */}
      <CreateTokenPlanModal
        isOpen={showCreateModal}
        onClose={resetForm}
        formData={formData}
        onFormDataChange={setFormData}
        onSubmit={handleSubmit}
        isSubmitting={isSubmitting}
        editingPlan={editingPlan}
      />

      {/* Delete Confirmation Modal */}
      {deleteModalOpen && planToDelete && (
        <ConfirmModal
          title="Delete Token Plan"
          message={
            <span>
              Are you sure you want to delete <b>{planToDelete.name}</b>? 
              This action cannot be undone.
            </span>
          }
          onConfirm={confirmDelete}
          onCancel={() => {
            setDeleteModalOpen(false);
            setPlanToDelete(null);
          }}
          confirmText="Delete"
        />
      )}
        </div>
      </div>
    </div>
  );
}