"use client"

import React, { useEffect, useState } from 'react'

interface SubscriptionPlan {
  name: string;
  monthlyTokenLimit: number;
  priceCents: number;
}

interface TokenUsageStats {
  tokensUsedInPeriod: number;
  tokenLimit: number;
  percentageUsed: number;
  periodStartDate: Date;
  periodEndDate: Date;
  daysRemaining: number;
  planName: string;
}

export default function TokensSettings() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tokenUsage, setTokenUsage] = useState<TokenUsageStats | null>(null);
  const [availablePlans, setAvailablePlans] = useState<SubscriptionPlan[]>([]);
  const [initialized, setInitialized] = useState(false);
  const [tempMessage, setTempMessage] = useState<string | null>(null);

  useEffect(() => {
    const initializeData = async () => {
      try {
        setLoading(true);
        
        // Try to fetch token usage first
        const usageResponse = await fetch('/api/user/token-usage');
        
        // If token usage doesn't exist (404), initialize it
        if (usageResponse.status === 404) {
          console.log('No token usage record found, initializing...');
          
          // Ensure we have subscription plans
          const plansResponse = await fetch('/api/subscription/plans', { method: 'POST' });
          if (!plansResponse.ok) {
            console.error('Failed to initialize subscription plans');
          }
          
          // Initialize the user's token usage record
          const initResponse = await fetch('/api/user/token-usage/init', { method: 'POST' });
          if (initResponse.ok) {
            console.log('Successfully initialized token usage');
            setInitialized(true);
          } else {
            console.error('Failed to initialize token usage');
            setError('Failed to initialize token usage. Please try again.');
          }
        } else if (usageResponse.ok) {
          // If we successfully got token usage, set it
          const data = await usageResponse.json();
          setTokenUsage(data);
        } else {
          console.error('Error fetching token usage:', usageResponse.status);
          setError('Failed to load token usage information. Please try refreshing the page.');
        }
        
        // Fetch available plans (which should now exist)
        await fetchAvailablePlans();
        
        // If we initialized token usage, fetch it again
        if (initialized) {
          await fetchTokenUsage();
        }
      } catch (err) {
        console.error('Error initializing data:', err);
        setError('Failed to initialize token data. Please try refreshing the page.');
      } finally {
        setLoading(false);
      }
    };
    
    initializeData();
  }, [initialized]);

  const fetchTokenUsage = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/user/token-usage');
      if (!response.ok) {
        throw new Error(`Failed to fetch token usage: ${response.status}`);
      }
      const data = await response.json();
      setTokenUsage(data);
      setError(null);
    } catch (err) {
      console.error('Error fetching token usage:', err);
      setError('Failed to load token usage information. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  const fetchAvailablePlans = async () => {
    try {
      const response = await fetch('/api/subscription/plans');
      if (!response.ok) {
        throw new Error(`Failed to fetch subscription plans: ${response.status}`);
      }
      const data = await response.json();
      setAvailablePlans(data);
    } catch (err) {
      console.error('Error fetching subscription plans:', err);
      // Don't set error here, as the token usage is more important
    }
  };

  // Show temporary message when an upgrade button is clicked
  const handleUpgrade = async (_planName: string) => {
    setTempMessage("Plans and pricing coming soon.");
    
    // Clear the message after a few seconds
    setTimeout(() => {
      setTempMessage(null);
    }, 4000);
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="animate-pulse text-xl">Loading token usage...</div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <h2 className="text-2xl font-semibold mb-6">Token Usage & Subscription</h2>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
          {error}
        </div>
      )}

      {tempMessage && (
        <div className="bg-blue-100 border border-blue-300 text-blue-800 px-4 py-3 rounded mb-6 sticky top-0 z-20">
          {tempMessage}
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
                  You&apos;ve used {tokenUsage.percentageUsed}% of your monthly token allowance.
                  {tokenUsage.percentageUsed > 90 && " Consider upgrading your plan to avoid service interruption."}
                </p>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="mb-6">
          <p>No token usage information available. {initialized ? 'Data is being loaded...' : 'Try refreshing the page.'}</p>
        </div>
      )}

      <hr className="border-t border-gray-200 mb-6" />

      {availablePlans.length > 0 && (
        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-4">Available Plans</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {availablePlans.map((plan) => (
              <div key={plan.name} className="border border-gray-200 rounded-lg p-4 flex flex-col">
                <h4 className="text-md font-semibold">{plan.name}</h4>
                <p className="text-sm mb-2">{plan.monthlyTokenLimit.toLocaleString()} tokens/month</p>
                <p className="text-lg font-bold mb-4">${(plan.priceCents / 100).toFixed(2)}/month</p>
                <button
                  type="button"
                  onClick={() => handleUpgrade(plan.name)}
                  className="mt-auto bg-primary text-primary-foreground py-2 px-4 rounded hover:bg-primary/90 transition-colors"
                >
                  {tokenUsage?.planName === plan.name ? 'Current Plan' : 'Upgrade'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <hr className="border-t border-gray-200 mb-6" />

      <div>
        <h3 className="text-lg font-semibold mb-4">About Tokens</h3>
        <div>
          <p className="mb-3">
            Tokens are the units of measurement for the AI models powering your chats.
            Each conversation uses tokens for both your inputs (prompt tokens) and the AI&apos;s
            responses (completion tokens).
          </p>
          <p className="mb-3">
            Your subscription plan determines how many tokens you can use per month.
            When you reach your limit, you&apos;ll need to upgrade your plan or wait for your
            next billing cycle to continue using the service.
          </p>
          <p>
            The token counter resets automatically at the beginning of each billing period.
          </p>
        </div>
      </div>
    </div>
  );
} 