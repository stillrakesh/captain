export interface MenuItem {
  id: string;
  name: string;
  price: number;
  category: string;
  description?: string;
  image?: string;
  isVeg: boolean;
}

export interface Table {
  id: string;
  number: string;
  status: 'available' | 'occupied' | 'dirty';
  capacity: number;
  currentOrder?: OrderItem[];
}

export interface OrderItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  instructions?: string;
}

export const MENU_ITEMS: MenuItem[] = [
  { id: '1', name: 'Paneer Tikka', price: 280, category: 'Starters', isVeg: true },
  { id: '2', name: 'Chicken 65', price: 320, category: 'Starters', isVeg: false },
  { id: '3', name: 'Butter Chicken', price: 450, category: 'Main Course', isVeg: false },
  { id: '4', name: 'Dal Makhani', price: 350, category: 'Main Course', isVeg: true },
  { id: '5', name: 'Garlic Naan', price: 60, category: 'Breads', isVeg: true },
  { id: '6', name: 'Jeera Rice', price: 180, category: 'Rice', isVeg: true },
  { id: '7', name: 'Fresh Lime Soda', price: 120, category: 'Drinks', isVeg: true },
  { id: '8', name: 'Mango Lassi', price: 150, category: 'Drinks', isVeg: true },
  { id: '9', name: 'Gulab Jamun', price: 120, category: 'Dessert', isVeg: true },
  { id: '10', name: 'Virgin Mojito', price: 180, category: 'Drinks', isVeg: true },
];

export const TABLES: Table[] = [
  { id: 't1', number: '1', status: 'available', capacity: 2 },
  { id: 't2', number: '2', status: 'occupied', capacity: 4 },
  { id: 't3', number: '3', status: 'available', capacity: 4 },
  { id: 't4', number: '4', status: 'occupied', capacity: 6 },
  { id: 't5', number: '5', status: 'available', capacity: 2 },
  { id: 't6', number: '6', status: 'dirty', capacity: 4 },
  { id: 't7', number: '7', status: 'available', capacity: 8 },
  { id: 't8', number: '8', status: 'available', capacity: 4 },
];
