/**
 * Centralized Real-Time Context & Provider
 * Manages WebSocket lifecycle tied to user authentication and distributes
 * real-time events across the entire application ecosystem.
 */

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { realtimeClient, ConnectionStatus } from '../realtime/websocketClient';

const RealtimeContext = createContext(null);

export const RealtimeProvider = ({ children }) => {
  const { user } = useAuth();
  const [connectionStatus, setConnectionStatus] = useState(realtimeClient.getStatus());
  const [lastEvent, setLastEvent] = useState(null);

  useEffect(() => {
    // Listen for connection status changes
    const unsubStatus = realtimeClient.onStatusChange((status) => {
      setConnectionStatus(status);
    });

    // Listen to all events globally to update lastEvent
    const unsubEvents = realtimeClient.subscribe('*', (event) => {
      setLastEvent(event);
    });

    return () => {
      unsubStatus();
      unsubEvents();
    };
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('ams_token');
    if (user && token) {
      realtimeClient.connect();
    } else {
      realtimeClient.disconnect();
    }

    return () => {
      // Don't disconnect on minor rerenders, only when unmounting provider
    };
  }, [user]);

  const value = {
    connectionStatus,
    isConnected: connectionStatus === ConnectionStatus.CONNECTED,
    lastEvent,
    subscribe: (entity, cb) => realtimeClient.subscribe(entity, cb),
    client: realtimeClient
  };

  return (
    <RealtimeContext.Provider value={value}>
      {children}
    </RealtimeContext.Provider>
  );
};

export const useRealtime = () => {
  const context = useContext(RealtimeContext);
  if (!context) {
    throw new Error('useRealtime must be used within a RealtimeProvider');
  }
  return context;
};
