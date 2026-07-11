import { getBackendURL } from '../config';

export interface OrderItem {
  name: string;
  qty: number;
  price: number;
}

export interface OrderPayload {
  tableId: string | number;
  tableNumber: string;
  items: OrderItem[];
  notes?: string;
  status: string;
}

/**
 * Submit a new order from the Captain App.
 *
 * Sends to POST /api/orders (new canonical endpoint).
 * The server normalises table IDs and qty→quantity internally.
 */
export const submitOrder = async (order: OrderPayload): Promise<any> => {
  const baseUrl = getBackendURL();
  if (!baseUrl) throw new Error('Backend URL not configured');

  const payload = {
    table_id:  String(order.tableId),
    items: order.items.map(i => ({
      name:     i.name,
      quantity: Number(i.qty || 1),
      price:    Number(i.price)
    })),
    notes: order.notes || '',
  };

  const response = await fetch(`${baseUrl}/api/orders`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `Server error: ${response.status}`);
  }

  return await response.json();
};

/**
 * Offline order queue — placeholder for future offline-first support.
 */
export const syncOfflineOrders = async () => {};
export const getOfflineOrders  = () => [];
