import { API_BASE } from '../config';

export interface OrderItem {
  name: string;
  price: number;
  quantity: number;
}

export interface OrderPayload {
  table_number: string;
  items: OrderItem[];
  status: string;
  notes?: string;
  id?: string; // Local ID for offline tracking
}

const OFFLINE_ORDERS_KEY = 'offline_orders';

export const getOfflineOrders = (): OrderPayload[] => {
  const stored = localStorage.getItem(OFFLINE_ORDERS_KEY);
  return stored ? JSON.parse(stored) : [];
};

export const saveOfflineOrder = (order: OrderPayload) => {
  const orders = getOfflineOrders();
  orders.push({ ...order, id: Date.now().toString() });
  localStorage.setItem(OFFLINE_ORDERS_KEY, JSON.stringify(orders));
};

export const removeOfflineOrder = (id: string) => {
  const orders = getOfflineOrders();
  const filtered = orders.filter(o => o.id !== id);
  localStorage.setItem(OFFLINE_ORDERS_KEY, JSON.stringify(filtered));
};

export const submitOrder = async (order: OrderPayload, retryCount = 3): Promise<any> => {
  try {
    const response = await fetch(`${API_BASE}/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(order),
    });

    if (!response.ok) throw new Error('Failed to send order');
    return await response.json();
  } catch (error) {
    if (retryCount > 0) {
      console.log(`Retrying order... attempts left: ${retryCount}`);
      return submitOrder(order, retryCount - 1);
    }
    // If all retries fail, save offline
    saveOfflineOrder(order);
    throw error;
  }
};

export const syncOfflineOrders = async () => {
  const orders = getOfflineOrders();
  if (orders.length === 0) return;

  console.log(`Syncing ${orders.length} offline orders...`);
  for (const order of orders) {
    try {
      await fetch(`${API_BASE}/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(order),
      });
      removeOfflineOrder(order.id!);
    } catch (error) {
       console.error('Failed to sync order, will retry later', error);
    }
  }
};

// Listen for online status to sync
window.addEventListener('online', syncOfflineOrders);
