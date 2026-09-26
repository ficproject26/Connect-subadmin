/**
 * Centralized Real-Time State Synchronization Hooks
 * Reusable across any entity in the entire ecosystem.
 * Automatically synchronizes visible frontend state upon backend/Redis events
 * with zero page reload, zero user action, and sub-second propagation.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { realtimeClient } from './websocketClient';

/**
 * Hook to listen for real-time events for an entity and invoke callbacks
 * @param {string|string[]} entityName - Entity name(s) e.g. 'vendors', 'orders'
 * @param {object} handlers - { onCreated, onUpdated, onDeleted, onBatch, onEvent, onRefresh }
 */
export function useRealtimeSync(entityName, handlers = {}) {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    if (!entityName) return;

    const entities = Array.isArray(entityName) ? entityName : [entityName];

    const unsubs = entities.map(ent => {
      return realtimeClient.subscribe(ent, (event) => {
        const { onCreated, onUpdated, onDeleted, onBatch, onEvent, onRefresh } = handlersRef.current;

        if (onEvent) {
          onEvent(event);
        }

        const action = (event.action || '').toLowerCase();

        switch (action) {
          case 'created':
            if (onCreated) {
              onCreated(event.data, event);
            } else if (onRefresh) {
              onRefresh(event);
            }
            break;

          case 'updated':
          case 'status_changed':
            if (onUpdated) {
              onUpdated(event.data, event);
            } else if (onRefresh) {
              onRefresh(event);
            }
            break;

          case 'deleted':
            if (onDeleted) {
              onDeleted(event.entityId, event);
            } else if (onRefresh) {
              onRefresh(event);
            }
            break;

          case 'batch_created':
          case 'batch_updated':
            if (onBatch) {
              onBatch(event.data?.items || [], event);
            } else if (onRefresh) {
              onRefresh(event);
            }
            break;

          default:
            if (onRefresh) {
              onRefresh(event);
            }
            break;
        }
      });
    });

    return () => {
      unsubs.forEach(fn => fn && fn());
    };
  }, [entityName]);
}

/**
 * Hook that maintains an in-memory list state synchronized with real-time events
 * @param {string} entityName - e.g. 'vendors'
 * @param {Array} initialList - initial array of items
 * @param {object} options - { idKey = '_id', filter = null, sort = null, onSync = null }
 */
export function useRealtimeList(entityName, initialList = [], options = {}) {
  const { idKey = '_id', filter = null, sort = null, onSync = null } = options;
  const [items, setItems] = useState(initialList);
  const [lastSyncEvent, setLastSyncEvent] = useState(null);

  // Sync with prop changes if initialList updates
  useEffect(() => {
    if (Array.isArray(initialList)) {
      setItems(initialList);
    }
  }, [initialList]);

  useRealtimeSync(entityName, {
    onCreated: (newItem, event) => {
      setItems(prev => {
        const id = newItem[idKey] || newItem.id || newItem._id;
        const exists = prev.some(item => (item[idKey] || item.id || item._id) === id);
        if (exists) {
          // If already exists, update in place
          return prev.map(item => (item[idKey] || item.id || item._id) === id ? { ...item, ...newItem } : item);
        }

        // Check optional filter
        if (filter && typeof filter === 'function' && !filter(newItem)) {
          return prev;
        }

        let next = [newItem, ...prev];
        if (sort && typeof sort === 'function') {
          next.sort(sort);
        }
        return next;
      });

      setLastSyncEvent(event);
      if (onSync) onSync('created', newItem, event);
    },

    onUpdated: (updatedItem, event) => {
      setItems(prev => {
        const id = updatedItem[idKey] || updatedItem.id || updatedItem._id || event.entityId;
        const exists = prev.some(item => (item[idKey] || item.id || item._id) === id);

        if (!exists) {
          // If item didn't exist in view but now matches filter, add it
          if (filter && typeof filter === 'function' && filter(updatedItem)) {
            let next = [updatedItem, ...prev];
            if (sort && typeof sort === 'function') next.sort(sort);
            return next;
          }
          return prev;
        }

        // If item exists, check if still passes filter
        if (filter && typeof filter === 'function' && !filter(updatedItem)) {
          return prev.filter(item => (item[idKey] || item.id || item._id) !== id);
        }

        // Update in-place
        return prev.map(item => {
          if ((item[idKey] || item.id || item._id) === id) {
            return { ...item, ...updatedItem };
          }
          return item;
        });
      });

      setLastSyncEvent(event);
      if (onSync) onSync('updated', updatedItem, event);
    },

    onDeleted: (deletedId, event) => {
      const id = String(deletedId);
      setItems(prev => prev.filter(item => {
        const itemId = String(item[idKey] || item.id || item._id);
        return itemId !== id;
      }));

      setLastSyncEvent(event);
      if (onSync) onSync('deleted', id, event);
    },

    onBatch: (batchItems, event) => {
      setItems(prev => {
        const itemMap = new Map(prev.map(i => [String(i[idKey] || i.id || i._id), i]));
        batchItems.forEach(b => {
          const bId = String(b[idKey] || b.id || b._id);
          itemMap.set(bId, { ...(itemMap.get(bId) || {}), ...b });
        });
        let next = Array.from(itemMap.values());
        if (filter && typeof filter === 'function') {
          next = next.filter(filter);
        }
        if (sort && typeof sort === 'function') {
          next.sort(sort);
        }
        return next;
      });

      setLastSyncEvent(event);
      if (onSync) onSync('batch', batchItems, event);
    }
  });

  return [items, setItems, { lastSyncEvent, count: items.length }];
}

/**
 * Hook to keep a single entity record synchronized in real-time
 */
export function useRealtimeItem(entityName, itemId, initialData = null) {
  const [data, setData] = useState(initialData);

  useEffect(() => {
    setData(initialData);
  }, [initialData]);

  useRealtimeSync(entityName, {
    onUpdated: (updatedItem, event) => {
      const targetId = String(itemId);
      const incomingId = String(updatedItem._id || updatedItem.id || event.entityId);
      if (incomingId === targetId) {
        setData(prev => ({ ...(prev || {}), ...updatedItem }));
      }
    },
    onDeleted: (deletedId) => {
      if (String(deletedId) === String(itemId)) {
        setData(null);
      }
    }
  });

  return [data, setData];
}
