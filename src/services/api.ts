import { getBackendURL } from '../config';

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
  const baseUrl = getBackendURL();
  if (!baseUrl) throw new Error('Backend URL not configured');

  const response = await fetch(`${baseUrl}/orders`, {
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

export const syncOfflineOrders = async () => {};
export const getOfflineOrders = () => [];
