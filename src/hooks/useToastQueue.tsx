import { useEffect, useState } from 'react';
import { useToast } from './useToast';

interface ToastQueueItem {
  id: string;
  title: string;
  description?: string;
  variant?: 'default' | 'destructive';
  timestamp: number;
}

const TOAST_HISTORY_KEY = 'toast_history';
const MAX_HISTORY_ITEMS = 50;

export const useToastQueue = () => {
  const { toast } = useToast();
  const [queue, setQueue] = useState<ToastQueueItem[]>([]);
  const [processing, setProcessing] = useState(false);

  // Load history from localStorage
  const getHistory = (): ToastQueueItem[] => {
    try {
      const stored = localStorage.getItem(TOAST_HISTORY_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  };

  // Save to history
  const saveToHistory = (item: ToastQueueItem) => {
    const history = getHistory();
    const newHistory = [item, ...history].slice(0, MAX_HISTORY_ITEMS);
    localStorage.setItem(TOAST_HISTORY_KEY, JSON.stringify(newHistory));
  };

  // Clear history
  const clearHistory = () => {
    localStorage.removeItem(TOAST_HISTORY_KEY);
  };

  // Add to queue
  const queueToast = (
    title: string,
    description?: string,
    variant?: 'default' | 'destructive'
  ) => {
    const item: ToastQueueItem = {
      id: `toast-${Date.now()}-${Math.random()}`,
      title,
      description,
      variant,
      timestamp: Date.now(),
    };

    setQueue((prev) => [...prev, item]);
    saveToHistory(item);
  };

  // Process queue
  useEffect(() => {
    if (queue.length > 0 && !processing) {
      setProcessing(true);
      const item = queue[0];

      toast({
        title: item.title,
        description: item.description,
        variant: item.variant,
      });

      // Remove from queue after showing
      setTimeout(() => {
        setQueue((prev) => prev.slice(1));
        setProcessing(false);
      }, 300); // Small delay between toasts
    }
  }, [queue, processing, toast]);

  // Success pattern
  const success = (title: string, description?: string) => {
    queueToast(title, description, 'default');
  };

  // Error pattern
  const error = (title: string, description?: string) => {
    queueToast(title, description || 'Ocorreu um erro. Tente novamente.', 'destructive');
  };

  return {
    success,
    error,
    queueToast,
    getHistory,
    clearHistory,
  };
};
