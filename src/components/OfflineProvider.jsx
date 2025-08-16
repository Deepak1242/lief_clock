"use client";
import { useEffect } from 'react';
import { useApolloClient } from '@apollo/client';
import { offlineSync } from '@/lib/offlineSync';

export function OfflineProvider({ children }) {
  const apolloClient = useApolloClient();

  useEffect(() => {
    // Initialize offline sync with Apollo Client
    offlineSync.setApolloClient(apolloClient);
    
    console.log('Offline sync initialized with Apollo Client');
  }, [apolloClient]);

  return children;
}
