'use client';

import React from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface TokenPlan {
  id: string;
  name: string;
  tokenLimit: number;
  cadence: 'WEEKLY' | 'MONTHLY';
  priceCents: number;
  isActive: boolean;
}

interface CreateTokenPlanModalProps {
  isOpen: boolean;
  onClose: () => void;
  formData: {
    name: string;
    tokenLimit: string;
    cadence: 'WEEKLY' | 'MONTHLY';
  };
  onFormDataChange: (data: any) => void;
  onSubmit: (e: React.FormEvent) => void;
  isSubmitting: boolean;
  editingPlan: TokenPlan | null;
}

export default function CreateTokenPlanModal({
  isOpen,
  onClose,
  formData,
  onFormDataChange,
  onSubmit,
  isSubmitting,
  editingPlan
}: CreateTokenPlanModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[525px]">
        <DialogHeader>
          <DialogTitle>{editingPlan ? 'Edit' : 'Create'} Token Plan</DialogTitle>
          <DialogDescription>
            {editingPlan ? 'Update the token plan details' : 'Create a new token plan for space members'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <label htmlFor="name" className="text-right text-sm font-medium">Plan Name *</label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => onFormDataChange((prev: { name: string; tokenLimit: string; cadence: 'WEEKLY' | 'MONTHLY' }) => ({ ...prev, name: e.target.value }))}
                placeholder="e.g., Basic, Premium, Student"
                className="col-span-3"
                required
              />
            </div>
            
            <div className="grid grid-cols-4 items-center gap-4">
              <label htmlFor="tokenLimit" className="text-right text-sm font-medium">Token Limit *</label>
              <Input
                id="tokenLimit"
                type="text"
                value={formData.tokenLimit ? parseInt(formData.tokenLimit).toLocaleString() : ''}
                onChange={(e) => {
                  // Remove commas and non-digit characters, keep only numbers
                  const numericValue = e.target.value.replace(/[^0-9]/g, '');
                  onFormDataChange((prev: { name: string; tokenLimit: string; cadence: 'WEEKLY' | 'MONTHLY' }) => ({ ...prev, tokenLimit: numericValue }));
                }}
                placeholder="e.g., 100,000"
                className="col-span-3"
                required
              />
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <label htmlFor="cadence" className="text-right text-sm font-medium">Reset Cadence *</label>
              <Select value={formData.cadence} onValueChange={(value: 'WEEKLY' | 'MONTHLY') => onFormDataChange((prev: { name: string; tokenLimit: string; cadence: 'WEEKLY' | 'MONTHLY' }) => ({ ...prev, cadence: value }))}>
                <SelectTrigger className="col-span-3">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="WEEKLY">Weekly</SelectItem>
                  <SelectItem value="MONTHLY">Monthly</SelectItem>
                </SelectContent>
              </Select>
            </div>

          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : (editingPlan ? 'Update' : 'Create') + ' Plan'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}