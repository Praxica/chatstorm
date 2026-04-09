"use client"

import React, { useEffect, useState } from 'react'
import { useSpace } from '@/lib/contexts/SpaceContext'

interface TokenUsageStats {
  tokensUsedInPeriod: number;
  tokenLimit: number;
  percentageUsed: number;
  periodStartDate: Date;
  periodEndDate: Date;
  daysRemaining: number;
  planName: string;
}

export default function SpaceTokensTab() {
  const { space } = useSpace()
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tokenUsage, setTokenUsage] = useState<TokenUsageStats | null>(null);

  useEffect(() => {
    const fetchSpaceTokenUsage = async () => {
      if (!space?.slug) return;
      
      try {
        setLoading(true);
        const response = await fetch(`/api/spaces/${space.slug}/token-usage`);
        
        if (!response.ok) {
          throw new Error(`Failed to fetch space token usage: ${response.status}`);
        }
        
        const data = await response.json();
        setTokenUsage(data);
        setError(null);
      } catch (err) {
        console.error('Error fetching space token usage:', err);
        setError('Failed to load space token usage information. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    fetchSpaceTokenUsage();
  }, [space?.slug]);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="animate-pulse text-xl">Loading space token usage...</div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <h2 className="text-2xl font-semibold mb-6">Space Token Usage</h2>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
          {error}
        </div>
      )}

      {tokenUsage ? (
        <div className="mb-6">
          <div className="mb-4">
            <div className="mb-4">
              <h3 className="text-lg font-semibold">Current Usage</h3>
            </div>
            
            <div className="mb-4">
              <div className="flex justify-between mb-1">
                <span>Tokens Used: {tokenUsage.tokensUsedInPeriod.toLocaleString()}</span>
                <span>Limit: {tokenUsage.tokenLimit.toLocaleString()}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className={`h-2 rounded-full ${tokenUsage.percentageUsed > 90 ? 'bg-red-500' : 'bg-blue-500'}`} 
                  style={{ width: `${Math.min(tokenUsage.percentageUsed, 100)}%` }}
                ></div>
              </div>
            </div>
            
            <div className="text-sm text-gray-600 mb-4">
              <p>Current Plan: <span className="font-semibold">{tokenUsage.planName}</span></p>
              <p>Billing Period: <span className="font-semibold">{new Date(tokenUsage.periodStartDate).toLocaleDateString()} - {new Date(tokenUsage.periodEndDate).toLocaleDateString()}</span></p>
              <p>Days remaining: <span className="font-semibold">{tokenUsage.daysRemaining}</span></p>
            </div>
            
            {tokenUsage.percentageUsed > 80 && (
              <div className="bg-yellow-50 px-4 py-3 rounded-md">
                <p className="text-sm text-yellow-700">
                  This space has used {tokenUsage.percentageUsed}% of its token allowance.
                  {tokenUsage.percentageUsed > 90 && " Consider reviewing the token plan or contact the space owner."}
                </p>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="mb-6">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-blue-900 mb-2">No Token Plan Assigned</h3>
            <p className="text-blue-800 mb-4">
              You don&apos;t currently have a token plan assigned for this space. This means:
            </p>
            <ul className="text-blue-800 mb-4 ml-4 space-y-1">
              <li>• You may have limited or no access to AI models in this space</li>
              <li>• The space administrator needs to assign you a token plan</li>
              <li>• Contact the space owner or administrator for access</li>
            </ul>
            <p className="text-sm text-blue-600">
              Space administrators can assign token plans through the Members tab.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}