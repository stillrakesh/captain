import { API_BASE } from '../config';

export interface OrderItem {
  name: string;
  quantity: number;
  price: number;
}

export interface OrderPayload {
  table_number: string;
  items: OrderItem[];
  notes?: string;
  status: string;
}

export const submitOrder = async (order: OrderPayload): Promise<any> => {
  const response = await fetch(`${API_BASE}/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(order),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || 'Failed to send order');
  }
  
  return await response.json();
};

// These are no longer used but kept empty to avoid breaking imports elsewhere if any
export const syncOfflineOrders = async () => {};
export const getOfflineOrders = () => [];
