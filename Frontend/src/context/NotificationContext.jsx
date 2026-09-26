import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from './AuthContext';
import { apiRequest, API_BASE_URL } from '../services/api';
import { realtimeClient, ConnectionStatus } from '../realtime/websocketClient';

const NotificationContext = createContext(null);

export const NotificationProvider = ({ children }) => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [filterType, setFilterType] = useState('all');
  const [latestToast, setLatestToast] = useState(null);
  const eventSourceRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);

  // Fetch notifications from server on initial mount / filter change
  const fetchNotifications = useCallback(async (type = filterType) => {
    try {
      setLoading(true);
      const data = await apiRequest(`/notifications?type=${type}`);
      if (data && data.success) {
        setNotifications(data.notifications || []);
        setUnreadCount(data.unreadCount || 0);
      }
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
    } finally {
      setLoading(false);
    }
  }, [filterType]);

  // Mark single notification as read
  const markAsRead = async (id) => {
    try {
      await apiRequest(`/notifications/${id}/read`, { method: 'PATCH' });

      setNotifications(prev =>
        prev.map(n => (n._id === id || n.id === id ? { ...n, isRead: true } : n))
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (err) {
      console.error('Failed to mark read:', err);
    }
  };

  // Mark all notifications as read
  const markAllAsRead = async () => {
    try {
      await apiRequest('/notifications/mark-all-read', { method: 'POST' });

      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error('Failed to mark all read:', err);
    }
  };

  // Delete / dismiss notification
  const removeNotification = async (id) => {
    try {
      await apiRequest(`/notifications/${id}`, { method: 'DELETE' });

      setNotifications(prev => {
        const item = prev.find(n => n._id === id || n.id === id);
        if (item && !item.isRead) {
          setUnreadCount(c => Math.max(0, c - 1));
        }
        return prev.filter(n => n._id !== id && n.id !== id);
      });
    } catch (err) {
      console.error('Failed to delete notification:', err);
    }
  };

  // Unified Real-Time WebSocket Event Listener
  useEffect(() => {
    if (!user) return;

    fetchNotifications();

    // Subscribe to centralized real-time notifications via WebSocket
    const unsubRealtime = realtimeClient.subscribe('notifications', (event) => {
      const action = (event.action || '').toLowerCase();
      const notifData = event.data;

      if (action === 'created' && notifData) {
        setNotifications(prev => {
          if (prev.some(n => (n._id || n.id) === (notifData._id || notifData.id))) {
            return prev;
          }
          return [notifData, ...prev];
        });

        setUnreadCount(prev => prev + 1);
        setLatestToast(notifData);
      } else if (action === 'updated' && notifData) {
        setNotifications(prev =>
          prev.map(n => ((n._id || n.id) === (notifData._id || notifData.id) ? { ...n, ...notifData } : n))
        );
      } else if (action === 'deleted') {
        const delId = String(event.entityId || notifData?._id || notifData?.id);
        setNotifications(prev => prev.filter(n => String(n._id || n.id) !== delId));
      }
    });

    // Secondary SSE fallback only if WebSocket is disconnected for prolonged periods
    let fallbackTimer = null;
    const unsubStatus = realtimeClient.onStatusChange((status) => {
      if (status === ConnectionStatus.DISCONNECTED) {
        fallbackTimer = setTimeout(() => {
          connectSSEFallback();
        }, 15000);
      } else if (status === ConnectionStatus.CONNECTED) {
        if (fallbackTimer) clearTimeout(fallbackTimer);
        if (eventSourceRef.current) {
          eventSourceRef.current.close();
          eventSourceRef.current = null;
        }
      }
    });

    function connectSSEFallback() {
      if (eventSourceRef.current || realtimeClient.getStatus() === ConnectionStatus.CONNECTED) return;
      const authToken = localStorage.getItem('ams_token') || '';
      if (!authToken) return;

      const base = API_BASE_URL || '';
      const sseUrl = `${base}/api/notifications/stream?token=${encodeURIComponent(authToken)}`;

      try {
        const es = new EventSource(sseUrl);
        eventSourceRef.current = es;

        es.onmessage = (event) => {
          try {
            const parsed = JSON.parse(event.data);
            if (parsed.type === 'notification' && parsed.data) {
              const newNotif = parsed.data;
              setNotifications(prev => {
                if (prev.some(n => (n._id || n.id) === (newNotif._id || newNotif.id))) return prev;
                return [newNotif, ...prev];
              });
              setUnreadCount(prev => prev + 1);
              setLatestToast(newNotif);
            }
          } catch (e) {}
        };

        es.onerror = () => {
          try { es.close(); } catch (e) {}
          eventSourceRef.current = null;
        };
      } catch (err) {}
    }

    return () => {
      unsubRealtime();
      unsubStatus();
      if (fallbackTimer) clearTimeout(fallbackTimer);
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, [user, fetchNotifications]);

  // Auto-dismiss latest toast after 6 seconds
  useEffect(() => {
    if (!latestToast) return;
    const timer = setTimeout(() => {
      setLatestToast(null);
    }, 6000);
    return () => clearTimeout(timer);
  }, [latestToast]);

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        loading,
        filterType,
        setFilterType,
        fetchNotifications,
        markAsRead,
        markAllAsRead,
        removeNotification,
        latestToast,
        dismissToast: () => setLatestToast(null)
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};
