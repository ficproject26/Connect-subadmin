import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from './AuthContext';

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

  const token = localStorage.getItem('ams_token');

  // Fetch notifications from server
  const fetchNotifications = useCallback(async (type = filterType) => {
    try {
      setLoading(true);
      const authToken = localStorage.getItem('ams_token');
      const res = await fetch(`/api/notifications?type=${type}`, {
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {})
        }
      });
      const data = await res.json();
      if (data.success) {
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
      const authToken = localStorage.getItem('ams_token');
      await fetch(`/api/notifications/${id}/read`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {})
        }
      });

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
      const authToken = localStorage.getItem('ams_token');
      await fetch('/api/notifications/mark-all-read', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {})
        }
      });

      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error('Failed to mark all read:', err);
    }
  };

  // Delete / dismiss notification
  const removeNotification = async (id) => {
    try {
      const authToken = localStorage.getItem('ams_token');
      await fetch(`/api/notifications/${id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {})
        }
      });

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

  // Setup Real-time Server-Sent Events (SSE)
  useEffect(() => {
    if (!user) return;

    function connectSSE() {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }

      const authToken = localStorage.getItem('ams_token') || '';
      const sseUrl = `/api/notifications/stream?token=${encodeURIComponent(authToken)}`;

      try {
        const es = new EventSource(sseUrl);
        eventSourceRef.current = es;

        es.onmessage = (event) => {
          try {
            const parsed = JSON.parse(event.data);
            if (parsed.type === 'notification' && parsed.data) {
              const newNotif = parsed.data;

              // Prepend to notifications list
              setNotifications(prev => {
                if (prev.some(n => n._id === newNotif._id || n.id === newNotif.id)) {
                  return prev;
                }
                return [newNotif, ...prev];
              });

              setUnreadCount(prev => prev + 1);

              // Trigger interactive floating toast
              setLatestToast(newNotif);
            }
          } catch (e) {
            // keepalive or non-JSON message
          }
        };

        es.onerror = () => {
          es.close();
          // Auto reconnect after 5s
          reconnectTimeoutRef.current = setTimeout(connectSSE, 5000);
        };
      } catch (err) {
        console.error('SSE initialization error:', err);
      }
    }

    connectSSE();
    fetchNotifications();

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
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
