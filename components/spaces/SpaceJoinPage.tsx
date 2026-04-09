'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/hooks/use-toast';
import { useRouter } from 'next/navigation';

interface SpaceJoinPageProps {
  space: any;
  userRole?: string;
  membershipStatus?: string;
  userEmail?: string;
}

export default function SpaceJoinPage({ space, userRole, membershipStatus, userEmail }: SpaceJoinPageProps) {
  const { toast } = useToast();
  const router = useRouter();
  const [isJoining, setIsJoining] = useState(false);
  

  const handleJoinRequest = async () => {
    setIsJoining(true);
    try {
      const response = await fetch(`/api/spaces/${space.slug}/join`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        await response.json();

        if (space.signupMode === 'open') {
          toast({
            title: "Welcome!",
            description: "You&apos;ve successfully joined the space.",
          });
          // Refresh the page to show the space dashboard
          router.refresh();
        } else if (space.signupMode === 'approval') {
          toast({
            title: "Request Submitted",
            description: "Your request to join has been submitted for approval.",
          });
          // Force a hard refresh to ensure the server re-checks membership status
          window.location.reload();
        }
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to join space');
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to join space. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsJoining(false);
    }
  };

  // If user is already an ACTIVE member, redirect to appropriate dashboard
  // Note: Don't redirect if status is pending, even if role is member
  if (membershipStatus === 'active' && (userRole === 'owner' || userRole === 'admin' || userRole === 'member')) {
    const redirectPath = (userRole === 'owner' || userRole === 'admin') 
      ? `/spaces/${space.slug}/admin` 
      : `/spaces/${space.slug}/dashboard`;
    router.push(redirectPath);
    return null;
  }

  // Normalize status for robustness
  const normalizedStatus = typeof membershipStatus === 'string' ? membershipStatus.toLowerCase() : undefined;
  if (typeof window !== 'undefined') {
    // eslint-disable-next-line no-console
    console.log('[SpaceJoinPage] membershipStatus:', membershipStatus, 'normalized:', normalizedStatus);
  }

  // If user has pending membership, show awaiting approval message
  if (normalizedStatus === 'pending') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full text-center">
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">{space.name}</h1>
            <div className="bg-yellow-50 p-4 rounded-md mb-4">
              <h2 className="font-medium text-yellow-900 mb-2">Request Pending</h2>
              <p className="text-yellow-800 text-sm">
                Your request to join this space is pending approval from the administrators. 
                You&apos;ll receive an email notification once your request has been reviewed.
              </p>
            </div>
            
            {space.joinInstructions && (
              <div className="bg-blue-50 p-4 rounded-md mb-4">
                <h3 className="font-medium text-blue-900 mb-2">Space Guidelines</h3>
                <p className="text-blue-800 text-sm whitespace-pre-wrap">
                  {space.joinInstructions}
                </p>
              </div>
            )}
            
            <div className="text-center">
              <p className="text-sm text-gray-500">
                Please check your email for updates on your request status.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const getSignupModeMessage = () => {
    switch (space.signupMode) {
      case 'closed':
        return {
          title: 'Registration Closed',
          message: 'Registration for this space is closed. Please contact the space administrator for more information.',
          showJoinButton: false,
        };
      case 'open':
        return {
          title: 'Join Space',
          message: 'You can join this space immediately.',
          showJoinButton: true,
          buttonText: 'Join Space',
        };
      case 'approval':
        return {
          title: 'Request to Join',
          message: '',
          showJoinButton: true,
          buttonText: 'Request to Join',
        };
      default:
        return {
          title: 'Join Space',
          message: 'Contact the space administrator to join.',
          showJoinButton: false,
        };
    }
  };

  const signupInfo = getSignupModeMessage();

  // Determine if user's email domain is allowed (only when restriction is configured)
  const allowedDomains = typeof space.allowedEmailDomain === 'string'
    ? space.allowedEmailDomain
        .split(',')
        .map((d: string) => d.trim().toLowerCase().replace(/^@+/, ''))
        .filter((d: string) => d.length > 0)
    : [];
  const isDomainRestrictionActive = allowedDomains.length > 0;
  const userEmailLower = typeof userEmail === 'string' ? userEmail.toLowerCase() : undefined;
  const isUserDomainAllowed = !isDomainRestrictionActive || (
    !!userEmailLower && allowedDomains.some((d: string) => userEmailLower.endsWith(`@${d}`))
  );

  // Temporary debug logs to verify domain check
  if (typeof window !== 'undefined') {
    // eslint-disable-next-line no-console
    console.log('[SpaceJoinPage] email:', userEmailLower, 'domains:', allowedDomains, 'allowed?', isUserDomainAllowed);
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <div className="text-center">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">{space.name}</h1>
            {space.description && (
              <p className="text-gray-600 mb-6">{space.description}</p>
            )}
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h2 className="text-xl font-semibold mb-4">{signupInfo.title}</h2>
              <p className="text-gray-600 mb-6">{signupInfo.message}</p>
              
              {space.joinInstructions && (
                <div className="bg-blue-50 p-4 rounded-md mb-6">
                  <h3 className="font-medium text-blue-900 mb-2">Instructions</h3>
                  <p className="text-blue-800 text-sm whitespace-pre-wrap">
                    {space.joinInstructions}
                  </p>
                </div>
              )}

              {isDomainRestrictionActive && !isUserDomainAllowed && (() => {
                const pretty = allowedDomains.map((d: string) => `@${d}`).join(', ')
                return (
                  <div className="bg-yellow-50 p-4 rounded-md mb-6">
                    <p className="text-yellow-800 text-sm">
                      <strong>Note:</strong> Only users with {pretty} email addresses can join this space.
                    </p>
                  </div>
                )
              })()}

              {signupInfo.showJoinButton && isUserDomainAllowed && membershipStatus !== 'pending' && (
                <Button 
                  onClick={handleJoinRequest}
                  disabled={isJoining}
                  className="w-full"
                >
                  {isJoining ? 'Processing...' : signupInfo.buttonText}
                </Button>
              )}

              {signupInfo.showJoinButton && !isUserDomainAllowed && membershipStatus !== 'pending' && (
                <div className="text-center">
                  <p className="text-sm text-gray-500">
                    You must use an approved email domain to join this space.
                  </p>
                </div>
              )}

              {!signupInfo.showJoinButton && (
                <div className="text-center">
                  <p className="text-sm text-gray-500">
                    Need access? Contact the space administrator.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}