'use client';

import React, { createContext, useContext, ReactNode } from 'react';
import { Space, SpaceRole } from '@/lib/types/space';

interface SpaceContextType {
  space: Space | null;
  userRole: SpaceRole | null;
  isSpaceContext: boolean;
}

const SpaceContext = createContext<SpaceContextType>({
  space: null,
  userRole: null,
  isSpaceContext: false,
});

export const SpaceProvider = ({
  children,
  space,
  userRole
}: {
  children: ReactNode;
  space: Space | null;
  userRole: SpaceRole | null;
}) => {
  return (
    <SpaceContext.Provider value={{
      space,
      userRole,
      isSpaceContext: !!space
    }}>
      {children}
    </SpaceContext.Provider>
  );
};

export const useSpace = () => {
  const context = useContext(SpaceContext);
  if (!context) {
    throw new Error('useSpace must be used within a SpaceProvider');
  }
  return context;
};

// Safe version of useSpace that returns null instead of throwing
export const useSpaceSafe = () => {
  const context = useContext(SpaceContext);
  return context;
};

// Helper hook to get space ID for API calls
export const useSpaceId = () => {
  const { space } = useSpace();
  return space?.id || null;
};