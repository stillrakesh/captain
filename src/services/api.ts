import { getBackendURL } from '../config';

export interface OrderItem {
  name: string;
  qty: number;
  price: number;
}

export interface OrderPayload {
  tableId: string | number;
  items: OrderItem[];
  notes?: string;
  status: string;
}

export const submitOrder = async (order: OrderPayload): Promise<any> => {
  const baseUrl = getBackendURL();
  if (!baseUrl) throw new Error('Backend URL not configured');

  const response = await fetch(`${baseUrl}/order`, {
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
