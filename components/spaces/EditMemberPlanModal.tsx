'use client';

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/hooks/use-toast';

interface TokenPlan {
  id: string;
  name: string;
  tokenLimit: number;
  cadence: 'WEEKLY' | 'MONTHLY';
  isActive: boolean;
}

interface Member {
  id: string;
  user?: {
    email?: string;
  };
  tokenPlanId?: string;
}

interface EditMemberPlanModalProps {
  isOpen: boolean;
  onClose: () => void;
  member: Member | null;
  spaceSlug: string;
  onMemberUpdate: () => void;
}

export default function EditMemberPlanModal({
  isOpen,
  onClose,
  member,
  spaceSlug,
  onMemberUpdate
}: EditMemberPlanModalProps) {
  const { toast } = useToast();
  const [tokenPlans, setTokenPlans] = useState<TokenPlan[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<string>('none');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen && spaceSlug) {
      fetchTokenPlans();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, spaceSlug]);

  useEffect(() => {
    if (member) {
      setSelectedPlanId(member.tokenPlanId || 'none');
    }
  }, [member]);

  const fetchTokenPlans = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/spaces/${spaceSlug}/token-plans`);
      if (response.ok) {
        const data = await response.json();
        setTokenPlans(data.tokenPlans || []);
      }
    } catch (error) {
      console.error('Error fetching token plans:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!member) return;

    setIsSaving(true);
    try {
      const response = await fetch(`/api/spaces/${spaceSlug}/members/${member.id}/token-plan`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tokenPlanId: selectedPlanId === 'none' ? null : selectedPlanId,
        }),
      });

      if (response.ok) {
        toast({
          title: "Success",
          description: "Member's token plan updated successfully.",
        });
        onMemberUpdate();
        onClose();
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update member token plan');
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update member's token plan.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    if (!isSaving) {
      onClose();
    }
  };

  if (!member) return null;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Edit Token Plan</DialogTitle>
          <DialogDescription>
            Update the token plan for {member.user?.email || 'this member'}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <label htmlFor="token-plan" className="text-right text-sm font-medium">Token Plan</label>
            <Select 
              value={selectedPlanId} 
              onValueChange={setSelectedPlanId}
              disabled={isLoading}
            >
              <SelectTrigger id="token-plan" className="col-span-3">
                <SelectValue placeholder="Select a token plan" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No specific plan (use space default)</SelectItem>
                {tokenPlans
                  .filter(plan => plan.isActive)
                  .sort((a, b) => a.tokenLimit - b.tokenLimit)
                  .map((plan) => (
                  <SelectItem key={plan.id} value={plan.id}>
                    {plan.name} ({plan.tokenLimit.toLocaleString()} tokens {plan.cadence.toLowerCase()})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving || isLoading}>
            {isSaving ? 'Saving...' : 'Save Changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}