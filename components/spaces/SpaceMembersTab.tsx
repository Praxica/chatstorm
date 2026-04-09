'use client';

import React, { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { 
  Users, 
  Check, 
  X, 
  Filter, 
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  UserCheck,
  UserX,
  ShieldCheck,
  Shield
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ConfirmModal } from '@/components/ui/confirm-modal';
import EditMemberPlanModal from './EditMemberPlanModal';
import { useToast } from '@/components/hooks/use-toast';

interface TokenUsage {
  tokensUsed: number;
  tokenLimit: number;
  planName: string;
  cadence: string;
  periodStartDate: string | null;
  periodEndDate: string | null;
  percentageUsed: number;
}

interface Member {
  id: string;
  userId: string;
  role: string;
  status: string;
  joinedAt: string;
  user?: {
    email?: string;
  };
  tokenUsage?: TokenUsage;
}

interface SpaceMembersTabProps {
  space: any;
  members: Member[];
  loading: boolean;
  onApproveMember: (memberId: string) => void;
  onRejectMember?: (memberId: string) => void;
  onUpdateRole?: (memberId: string, newRole: string) => void;
  userRole?: string;
  onMemberUpdate?: () => void;
}

type SortField = 'email' | 'role' | 'status' | 'createdAt';
type SortDirection = 'asc' | 'desc';
type StatusFilter = 'all' | 'active' | 'pending';

export default function SpaceMembersTab({ 
  space, 
  members, 
  loading, 
  onApproveMember,
  onRejectMember,
  onUpdateRole,
  userRole,
  onMemberUpdate
}: SpaceMembersTabProps) {
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sortField, setSortField] = useState<SortField>('email');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  
  // Modal state
  const [approveModal, setApproveModal] = useState<{ isOpen: boolean; memberId: string | null; memberEmail: string }>({
    isOpen: false,
    memberId: null,
    memberEmail: ''
  });

  const [resetUsageModal, setResetUsageModal] = useState<{ 
    isOpen: boolean; 
    memberId: string | null; 
    memberEmail: string;
    currentUsage: number;
    isProcessing: boolean;
  }>({
    isOpen: false,
    memberId: null,
    memberEmail: '',
    currentUsage: 0,
    isProcessing: false
  });
  const [rejectModal, setRejectModal] = useState<{ isOpen: boolean; memberId: string | null; memberEmail: string }>({
    isOpen: false,
    memberId: null,
    memberEmail: ''
  });
  const [roleChangeModal, setRoleChangeModal] = useState<{ 
    isOpen: boolean; 
    memberId: string | null; 
    memberEmail: string; 
    currentRole: string;
    newRole: string;
  }>({
    isOpen: false,
    memberId: null,
    memberEmail: '',
    currentRole: '',
    newRole: ''
  });
  const [ownerTransferModal, setOwnerTransferModal] = useState<{
    isOpen: boolean;
    selectedMemberId: string | null;
  }>({
    isOpen: false,
    selectedMemberId: null
  });
  const [editPlanModal, setEditPlanModal] = useState<{
    isOpen: boolean;
    member: Member | null;
  }>({
    isOpen: false,
    member: null
  });
  const [isProcessing, setIsProcessing] = useState(false);
  const [pendingActionModal, setPendingActionModal] = useState<{
    isOpen: boolean;
    member: Member | null;
    isProcessing: boolean;
  }>({
    isOpen: false,
    member: null,
    isProcessing: false
  });

  const isOwner = userRole === 'owner';

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const handleRoleClick = (memberId: string, currentRole: string) => {
    const member = members.find(m => m.userId === memberId);
    const memberEmail = member?.user?.email || member?.userId || 'Unknown user';
    
    if (currentRole === 'owner') {
      // Only owner can transfer ownership
      if (!isOwner) return;
      setOwnerTransferModal({
        isOpen: true,
        selectedMemberId: null
      });
    } else {
      // For member/admin role changes
      if (!isOwner) return;
      const newRole = currentRole === 'member' ? 'admin' : 'member';
      setRoleChangeModal({
        isOpen: true,
        memberId,
        memberEmail,
        currentRole,
        newRole
      });
    }
  };

  const confirmRoleChange = async () => {
    if (!roleChangeModal.memberId || !onUpdateRole) return;
    
    setIsProcessing(true);
    try {
      await onUpdateRole(roleChangeModal.memberId, roleChangeModal.newRole);
      toast({
        title: 'Role Updated',
        description: `Member role changed to ${roleChangeModal.newRole}`,
      });
      setRoleChangeModal({
        isOpen: false,
        memberId: null,
        memberEmail: '',
        currentRole: '',
        newRole: ''
      });
    } catch (_error) {
      toast({
        title: 'Error',
        description: 'Failed to update member role',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const confirmOwnerTransfer = async () => {
    if (!ownerTransferModal.selectedMemberId || !onUpdateRole) return;
    
    setIsProcessing(true);
    try {
      await onUpdateRole(ownerTransferModal.selectedMemberId, 'owner');
      toast({
        title: 'Ownership Transferred',
        description: 'Space ownership has been transferred successfully',
      });
      setOwnerTransferModal({
        isOpen: false,
        selectedMemberId: null
      });
    } catch (_error) {
      toast({
        title: 'Error',
        description: 'Failed to transfer ownership',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };


  const confirmApprove = async () => {
    if (!approveModal.memberId) return;
    
    setIsProcessing(true);
    try {
      await onApproveMember(approveModal.memberId);
      toast({
        title: 'Member Approved',
        description: 'The member has been approved and granted access to the space.',
      });
      setApproveModal({ isOpen: false, memberId: null, memberEmail: '' });
    } catch (_error) {
      toast({
        title: 'Error',
        description: 'Failed to approve member',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const confirmReject = async () => {
    if (!rejectModal.memberId || !onRejectMember) return;
    
    setIsProcessing(true);
    try {
      await onRejectMember(rejectModal.memberId);
      toast({
        title: 'Member Rejected',
        description: 'The member request has been rejected.',
      });
      setRejectModal({ isOpen: false, memberId: null, memberEmail: '' });
    } catch (_error) {
      toast({
        title: 'Error',
        description: 'Failed to reject member',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const cancelApprove = () => {
    setApproveModal({ isOpen: false, memberId: null, memberEmail: '' });
  };

  const cancelReject = () => {
    setRejectModal({ isOpen: false, memberId: null, memberEmail: '' });
  };

  const handleEditPlan = (member: Member) => {
    if (userRole !== 'admin' && userRole !== 'owner') return;
    setEditPlanModal({
      isOpen: true,
      member
    });
  };

  const handleResetUsage = (member: Member) => {
    if (userRole !== 'admin' && userRole !== 'owner') return;
    setResetUsageModal({
      isOpen: true,
      memberId: member.userId,
      memberEmail: member.user?.email || member.userId,
      currentUsage: member.tokenUsage?.tokensUsed || 0,
      isProcessing: false
    });
  };

  const closeEditPlanModal = () => {
    setEditPlanModal({
      isOpen: false,
      member: null
    });
  };

  const confirmResetUsage = async () => {
    if (!resetUsageModal.memberId) return;
    
    setResetUsageModal(prev => ({ ...prev, isProcessing: true }));
    
    try {
      const response = await fetch(`/api/spaces/${space.slug}/members/${resetUsageModal.memberId}/reset-usage`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to reset token usage');
      }

      toast({
        title: 'Token Usage Reset',
        description: `Token usage has been reset to 0 for ${resetUsageModal.memberEmail}`,
      });
      
      // Close modal and refresh data
      setResetUsageModal({
        isOpen: false,
        memberId: null,
        memberEmail: '',
        currentUsage: 0,
        isProcessing: false
      });
      
      // Trigger refresh if callback provided
      if (onMemberUpdate) {
        onMemberUpdate();
      }
    } catch (_error) {
      toast({
        title: 'Error',
        description: 'Failed to reset token usage',
        variant: 'destructive',
      });
    } finally {
      setResetUsageModal(prev => ({ ...prev, isProcessing: false }));
    }
  };

  const cancelResetUsage = () => {
    setResetUsageModal({
      isOpen: false,
      memberId: null,
      memberEmail: '',
      currentUsage: 0,
      isProcessing: false
    });
  };

  const handleMemberPlanUpdate = () => {
    closeEditPlanModal();
    if (onMemberUpdate) {
      onMemberUpdate();
    }
  };

  const handlePendingClick = (member: Member) => {
    if (member.status === 'pending' && (userRole === 'admin' || userRole === 'owner')) {
      setPendingActionModal({
        isOpen: true,
        member,
        isProcessing: false
      });
    }
  };

  const closePendingActionModal = () => {
    setPendingActionModal({
      isOpen: false,
      member: null,
      isProcessing: false
    });
  };

  const handleModalApprove = async () => {
    if (pendingActionModal.member) {
      setPendingActionModal(prev => ({ ...prev, isProcessing: true }));
      try {
        await onApproveMember(pendingActionModal.member.userId);
        closePendingActionModal();
      } catch (_error) {
        // Error handling is done by the parent component
        setPendingActionModal(prev => ({ ...prev, isProcessing: false }));
      }
    }
  };

  const handleModalReject = async () => {
    if (pendingActionModal.member && onRejectMember) {
      setPendingActionModal(prev => ({ ...prev, isProcessing: true }));
      try {
        await onRejectMember(pendingActionModal.member.userId);
        closePendingActionModal();
      } catch (_error) {
        // Error handling is done by the parent component
        setPendingActionModal(prev => ({ ...prev, isProcessing: false }));
      }
    }
  };

  const filteredAndSortedMembers = useMemo(() => {
    let filtered = members;
    
    // Apply status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(member => member.status === statusFilter);
    }

    // Apply sorting
    filtered = [...filtered].sort((a, b) => {
      let aValue: string | Date;
      let bValue: string | Date;

      switch (sortField) {
        case 'email':
          aValue = a.user?.email || a.userId || '';
          bValue = b.user?.email || b.userId || '';
          break;
        case 'role':
          aValue = a.role || '';
          bValue = b.role || '';
          break;
        case 'status':
          aValue = a.status || '';
          bValue = b.status || '';
          break;
        case 'createdAt':
          aValue = new Date(a.joinedAt || 0);
          bValue = new Date(b.joinedAt || 0);
          break;
        default:
          aValue = '';
          bValue = '';
      }

      if (sortField === 'createdAt') {
        const result = (aValue as Date).getTime() - (bValue as Date).getTime();
        return sortDirection === 'asc' ? result : -result;
      } else {
        const result = (aValue as string).toLowerCase().localeCompare((bValue as string).toLowerCase());
        return sortDirection === 'asc' ? result : -result;
      }
    });

    return filtered;
  }, [members, statusFilter, sortField, sortDirection]);

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />;
    }
    return sortDirection === 'asc' 
      ? <ArrowUp className="h-4 w-4" />
      : <ArrowDown className="h-4 w-4" />;
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'Unknown';
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch {
      return 'Unknown';
    }
  };

  const getStatusBadge = (status: string, member: Member) => {
    if (status === 'active') {
      return (
        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
          <UserCheck className="h-3 w-3 mr-1" />
          Active
        </span>
      );
    } else {
      // Make pending status clickable for admins/owners
      const canManagePending = userRole === 'admin' || userRole === 'owner';
      
      if (canManagePending) {
        return (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 hover:bg-yellow-200 transition-colors cursor-pointer"
                onClick={() => handlePendingClick(member)}
              >
                <UserX className="h-3 w-3 mr-1" />
                Pending
              </button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Click to approve or reject this member</p>
            </TooltipContent>
          </Tooltip>
        );
      } else {
        return (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
            <UserX className="h-3 w-3 mr-1" />
            Pending
          </span>
        );
      }
    }
  };

  const getRoleBadge = (role: string, memberId: string) => {
    const isClickable = isOwner && (role === 'member' || role === 'admin' || role === 'owner');
    
    const getTooltipText = () => {
      if (!isClickable) return undefined;
      if (role === 'owner') return 'Click to transfer ownership';
      return `Click to change to ${role === 'member' ? 'admin' : 'member'}`;
    };
    
    const badge = (
      <span 
        className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
          role === 'owner' 
            ? 'bg-purple-100 text-purple-800'
            : role === 'admin'
            ? 'bg-blue-100 text-blue-800'
            : 'bg-gray-100 text-gray-800'
        } ${
          isClickable ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''
        }`}
        onClick={isClickable ? () => handleRoleClick(memberId, role) : undefined}
      >
        {role === 'owner' ? (
          <ShieldCheck className="h-3 w-3 mr-1" />
        ) : role === 'admin' ? (
          <Shield className="h-3 w-3 mr-1" />
        ) : (
          <Users className="h-3 w-3 mr-1" />
        )}
        {role.charAt(0).toUpperCase() + role.slice(1)}
      </span>
    );

    if (isClickable && getTooltipText()) {
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            {badge}
          </TooltipTrigger>
          <TooltipContent>
            <p>{getTooltipText()}</p>
          </TooltipContent>
        </Tooltip>
      );
    }

    return badge;
  };
  return (
    <TooltipProvider>
      <div className="container mx-auto max-w-6xl h-full flex flex-col">
      {/* Scrollable content area */}
      <div className="flex-1 overflow-auto px-8 py-6">
        <div className="space-y-6">
          <div>
            <h2 className="text-xl font-semibold mb-2">Space Members</h2>
            <p className="text-muted-foreground mb-6">
              Manage members, approve requests, and control access to your space.
            </p>
          </div>

          {/* Stats section */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="p-4 border rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Members</p>
                  <p className="text-2xl font-bold">{members.length}</p>
                </div>
                <Users className="h-8 w-8 text-muted-foreground" />
              </div>
            </div>
            <div className="p-4 border rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Active</p>
                  <p className="text-2xl font-bold">{members.filter(m => m.status === 'active').length}</p>
                </div>
                <UserCheck className="h-8 w-8 text-green-600" />
              </div>
            </div>
            <div className="p-4 border rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Pending</p>
                  <p className="text-2xl font-bold">{members.filter(m => m.status === 'pending').length}</p>
                </div>
                <UserX className="h-8 w-8 text-yellow-600" />
              </div>
            </div>
          </div>

          {/* Filters and Sort */}
          <div className="flex justify-between items-center gap-4 pb-4 border-b">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Filter by Status:</span>
                <Select value={statusFilter} onValueChange={(value: StatusFilter) => setStatusFilter(value)}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Sort by:</span>
                <Select value={`${sortField}-${sortDirection}`} onValueChange={(value) => {
                  const [field, direction] = value.split('-') as [SortField, SortDirection];
                  setSortField(field);
                  setSortDirection(direction);
                }}>
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="email-asc">Email (A-Z)</SelectItem>
                    <SelectItem value="email-desc">Email (Z-A)</SelectItem>
                    <SelectItem value="role-asc">Role (A-Z)</SelectItem>
                    <SelectItem value="role-desc">Role (Z-A)</SelectItem>
                    <SelectItem value="status-asc">Status (A-Z)</SelectItem>
                    <SelectItem value="status-desc">Status (Z-A)</SelectItem>
                    <SelectItem value="createdAt-desc">Date (Newest)</SelectItem>
                    <SelectItem value="createdAt-asc">Date (Oldest)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="text-sm text-muted-foreground">
              Showing {filteredAndSortedMembers.length} of {members.length} members
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-8">
              <p className="text-muted-foreground">Loading members...</p>
            </div>
          ) : filteredAndSortedMembers.length === 0 ? (
            <div className="flex justify-center py-8">
              <p className="text-muted-foreground">No members found matching the current filters.</p>
            </div>
          ) : (
            <div className="overflow-hidden">
              {/* Table Header */}
              <div className="border-b border-border">
                <div className="grid grid-cols-12 gap-4 pl-0 pr-6 py-4 text-sm font-bold text-black">
                  <button 
                    className="group col-span-3 flex items-center gap-2 text-left hover:text-gray-600 transition-colors"
                    onClick={() => handleSort('email')}
                  >
                    Email
                    {getSortIcon('email')}
                  </button>
                  <button 
                    className="group col-span-2 flex items-center gap-2 text-left hover:text-gray-600 transition-colors"
                    onClick={() => handleSort('createdAt')}
                  >
                    Signup Date
                    {getSortIcon('createdAt')}
                  </button>
                  <button 
                    className="group col-span-1 flex items-center gap-2 text-left hover:text-gray-600 transition-colors"
                    onClick={() => handleSort('status')}
                  >
                    Status
                    {getSortIcon('status')}
                  </button>
                  <button 
                    className="group col-span-2 flex items-center gap-2 text-left hover:text-gray-600 transition-colors"
                    onClick={() => handleSort('role')}
                  >
                    Role
                    {getSortIcon('role')}
                  </button>
                  <div className="col-span-1 text-left">
                    Plan
                  </div>
                  <div className="col-span-3 text-left">
                    Token Usage
                  </div>
                </div>
              </div>
              
              {/* Table Body */}
              <div className="divide-y">
                {filteredAndSortedMembers.map((member) => (
                  <div key={member.id} className="grid grid-cols-12 gap-4 pl-0 pr-6 py-4 hover:bg-muted/30 transition-colors">
                    {/* Email */}
                    <div className="col-span-3 text-sm">
                      {member.user?.email || member.userId || 'Unknown'}
                    </div>
                    
                    {/* Signup Date */}
                    <div className="col-span-2 text-sm text-muted-foreground">
                      {formatDate(member.joinedAt)}
                    </div>
                    
                    {/* Status */}
                    <div className="col-span-1">
                      {getStatusBadge(member.status, member)}
                    </div>
                    
                    {/* Role */}
                    <div className="col-span-2">
                      {getRoleBadge(member.role, member.userId)}
                    </div>

                    {/* Token Plan */}
                    <div className="col-span-1">
                      {member.status === 'active' && member.tokenUsage ? (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                onClick={() => handleEditPlan(member)}
                                className="text-sm font-medium text-black hover:text-gray-600 underline cursor-pointer"
                                disabled={userRole !== 'admin' && userRole !== 'owner'}
                              >
                                {member.tokenUsage.planName}
                              </button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Click to edit plan</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      ) : (
                        <div className="text-sm text-muted-foreground">
                          {member.status === 'pending' ? 'Pending' : 'No plan'}
                        </div>
                      )}
                    </div>

                    {/* Token Usage */}
                    <div className="col-span-3">
                      {member.status === 'active' && member.tokenUsage ? (
                        <div className="text-sm">
                          {member.tokenUsage.tokensUsed > 0 ? (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <button
                                    onClick={() => handleResetUsage(member)}
                                    className="font-medium text-black hover:text-gray-600 underline cursor-pointer"
                                    disabled={userRole !== 'admin' && userRole !== 'owner'}
                                  >
                                    {member.tokenUsage.tokensUsed.toLocaleString()}
                                  </button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Reset token usage</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          ) : (
                            <span className="font-medium">{member.tokenUsage.tokensUsed.toLocaleString()}</span>
                          )}
                          <span className="text-muted-foreground"> / {member.tokenUsage.tokenLimit.toLocaleString()}</span>
                          <span className="text-muted-foreground"> ({member.tokenUsage.percentageUsed}% {member.tokenUsage.cadence.toLowerCase()})</span>
                        </div>
                      ) : (
                        <div className="text-sm text-muted-foreground">
                          {member.status === 'pending' ? 'Pending' : 'No usage'}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Fixed footer with action buttons */}
      {/* <div className="flex justify-end py-4 px-6 border-t bg-background">
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Invite Members
        </Button>
      </div> */}
    </div>

    {/* Approve Confirmation Modal */}
    {approveModal.isOpen && (
      <ConfirmModal
        title="Approve Member Request"
        message={
          <span>
            Are you sure you want to approve <strong>{approveModal.memberEmail}</strong>? 
            They will be granted access to the space and receive an email notification.
          </span>
        }
        onConfirm={confirmApprove}
        onCancel={cancelApprove}
        isLoading={isProcessing}
        confirmText="Approve"
      />
    )}

    {/* Reject Confirmation Modal */}
    {rejectModal.isOpen && (
      <ConfirmModal
        title="Reject Member Request"
        message={
          <span>
            Are you sure you want to reject <strong>{rejectModal.memberEmail}</strong>? 
            They will be removed from pending members and receive an email notification.
          </span>
        }
        onConfirm={confirmReject}
        onCancel={cancelReject}
        isLoading={isProcessing}
        confirmText="Reject"
      />
    )}

    {/* Role Change Confirmation Modal */}
    {roleChangeModal.isOpen && (
      <ConfirmModal
        title={`Change Role to ${roleChangeModal.newRole.charAt(0).toUpperCase() + roleChangeModal.newRole.slice(1)}`}
        message={
          <span>
            Are you sure you want to change <strong>{roleChangeModal.memberEmail}</strong>&apos;s role from 
            <strong> {roleChangeModal.currentRole}</strong> to <strong>{roleChangeModal.newRole}</strong>?
          </span>
        }
        onConfirm={confirmRoleChange}
        onCancel={() => setRoleChangeModal({
          isOpen: false,
          memberId: null,
          memberEmail: '',
          currentRole: '',
          newRole: ''
        })}
        isLoading={isProcessing}
        confirmText="Change Role"
      />
    )}

    {/* Owner Transfer Modal */}
    <Dialog open={ownerTransferModal.isOpen} onOpenChange={(open) => {
      if (!isProcessing) {
        setOwnerTransferModal({ isOpen: open, selectedMemberId: null });
      }
    }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Transfer Ownership</DialogTitle>
          <DialogDescription>
            Select a member to transfer ownership to. This action cannot be undone.
            You will become an admin after the transfer.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium">Select New Owner:</label>
            <Select 
              value={ownerTransferModal.selectedMemberId || ""} 
              onValueChange={(value) => setOwnerTransferModal(prev => ({
                ...prev,
                selectedMemberId: value
              }))}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Choose a member" />
              </SelectTrigger>
              <SelectContent>
                {members
                  .filter(member => member.role !== 'owner' && member.status === 'active')
                  .map(member => (
                    <SelectItem key={member.userId} value={member.userId}>
                      {member.user?.email || member.userId} ({member.role})
                    </SelectItem>
                  ))
                }
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button 
            variant="outline" 
            onClick={() => setOwnerTransferModal({ isOpen: false, selectedMemberId: null })}
            disabled={isProcessing}
          >
            Cancel
          </Button>
          <Button 
            onClick={confirmOwnerTransfer}
            disabled={!ownerTransferModal.selectedMemberId || isProcessing}
          >
            {isProcessing ? 'Transferring...' : 'Transfer Ownership'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {/* Edit Member Plan Modal */}
    <EditMemberPlanModal
      isOpen={editPlanModal.isOpen}
      onClose={closeEditPlanModal}
      member={editPlanModal.member}
      spaceSlug={space.slug}
      onMemberUpdate={handleMemberPlanUpdate}
    />

    {/* Pending Member Action Modal */}
    {pendingActionModal.isOpen && pendingActionModal.member && (
      <Dialog open={pendingActionModal.isOpen} onOpenChange={(open) => {
        if (!open && !pendingActionModal.isProcessing) {
          closePendingActionModal();
        }
      }}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Manage Pending Member</DialogTitle>
            <DialogDescription>
              Choose an action for {pendingActionModal.member.user?.email || pendingActionModal.member.userId}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <p className="text-sm text-muted-foreground mb-2">Member Details:</p>
                <p className="font-medium">{pendingActionModal.member.user?.email || pendingActionModal.member.userId}</p>
                <p className="text-xs text-muted-foreground">Requested to join on {formatDate(pendingActionModal.member.joinedAt)}</p>
                
                {pendingActionModal.isProcessing && (
                  <div className="mt-3 flex items-center gap-2 text-sm text-blue-600">
                    <div className="animate-spin h-4 w-4 border-2 border-blue-600 border-t-transparent rounded-full"></div>
                    Processing request...
                  </div>
                )}
              </div>
            </div>
          </div>
          <DialogFooter className="flex gap-2">
            <Button 
              variant="outline" 
              onClick={closePendingActionModal}
              disabled={pendingActionModal.isProcessing}
            >
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleModalReject}
              disabled={pendingActionModal.isProcessing}
              className="flex items-center gap-2"
            >
              <X className="h-4 w-4" />
              {pendingActionModal.isProcessing ? 'Rejecting...' : 'Reject'}
            </Button>
            <Button 
              onClick={handleModalApprove}
              disabled={pendingActionModal.isProcessing}
              className="flex items-center gap-2 bg-green-600 hover:bg-green-700 disabled:bg-green-400"
            >
              <Check className="h-4 w-4" />
              {pendingActionModal.isProcessing ? 'Approving...' : 'Approve'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )}

    {/* Reset Token Usage Modal */}
    {resetUsageModal.isOpen && resetUsageModal.memberEmail && (
      <ConfirmModal
        title="Reset Token Usage"
        message={
          <span>
            Are you sure you want to reset token usage to 0 for <strong>{resetUsageModal.memberEmail}</strong>? 
            This will set their current period usage back to 0 tokens.
          </span>
        }
        onConfirm={confirmResetUsage}
        onCancel={cancelResetUsage}
        isLoading={resetUsageModal.isProcessing}
        cancelDisabled={resetUsageModal.isProcessing}
        confirmText="Reset Usage"
      />
    )}
    </TooltipProvider>
  );
}