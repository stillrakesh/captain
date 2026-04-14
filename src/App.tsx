import { useState, useMemo, useEffect, useCallback } from 'react';
import { Search, ChevronLeft, SendHorizontal, CheckCircle2, RefreshCw, LayoutGrid, Clock, UtensilsCrossed, ReceiptText, Settings, Wifi, WifiOff, Save } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { getBackendURL } from './config';
import socket, { reconnectSocket } from './services/socket';
import { submitOrder, syncOfflineOrders, type OrderPayload } from './services/api';
import './index.css';

// --- TYPES ---
interface MenuItem {
  id: string;
  name: string;
  price: number;
  category: string;
  isVeg?: boolean;
}

interface Table {
  id: string;
  number: string;
  status: 'available' | 'occupied' | 'dirty';
  capacity: number;
  orderCount?: number;
  orderValue?: number;
  activeItems?: { name: string; quantity: number }[];
}

interface OrderItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
}



const App = () => {
  // Data State
  const [tables, setTables] = useState<Table[]>([]);
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);

  // UI State
  const [tableId, setTableId] = useState<string | null>(null);
  const [category, setCategory] = useState('All');
  const [search, setSearch] = useState('');
  const [order, setOrder] = useState<OrderItem[]>([]);
  const [notes, setNotes] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [showCart, setShowCart] = useState(false);
  const [showSettings, setShowSettings] = useState(!localStorage.getItem('backend_url'));
  const [backendUrlInput, setBackendUrlInput] = useState(localStorage.getItem('backend_url') || '');
  const [connected, setConnected] = useState(false);

  // --- API FETCHERS ---
  const fetchData = useCallback(async (silent = false) => {
    const baseUrl = getBackendURL();
    if (!baseUrl) {
      if (!silent) setLoading(false);
      return;
    }

    if (!silent) setLoading(true);
    setFetchError(null);

    try {
      const [tRes, mRes] = await Promise.all([
        fetch(`${baseUrl}/tables`),
        fetch(`${baseUrl}/menu`)
      ]);

      if (!tRes.ok || !mRes.ok) throw new Error('Backend failed to respond');

      const rawTables = await tRes.json();
      const rawMenu = await mRes.json();

      // 1. Process Tables (Standardized for OCCUPIED/FREE)
      const fetchedTables: Table[] = rawTables.map((t: any) => ({
        id: String(t.id),
        number: t.name.replace('Table ', ''),
        status: t.status === 'occupied' ? 'occupied' : 'available',
        capacity: 4, 
        orderCount: (t.items || t.orders || []).length,
        orderValue: t.total || 0,
        activeItems: (t.items || t.orders || []).map((i: any) => ({ name: i.name, quantity: i.qty || 1 }))
      }));
      
      // 2. Process Menu
      const fetchedMenu: MenuItem[] = rawMenu.map((i: any) => ({
        id: String(i.id),
        name: i.name,
        price: Number(i.price),
        category: i.category || 'General',
        isVeg: (i.type || '').toLowerCase() === 'veg'
      }));

      setTables(fetchedTables);
      setMenu(fetchedMenu);
    } catch (err) {
      console.error('[CaptainApp] Fetch Error:', err);
      setFetchError('Failed to load data from backend. Check settings.');
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const baseUrl = getBackendURL();
    if (!baseUrl) {
      setLoading(false);
      return;
    }

    fetchData();
    syncOfflineOrders();

    // Socket Listeners
    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('order_created', () => {
      console.log('Order created on backend');
      fetchData(true);
    });
    socket.on('order_updated', () => {
      console.log('Order updated on backend');
      fetchData(true);
    });
    socket.on('table_updated', (data: any) => {
      console.log('Table updated on backend');
      // If it's a bulk update or deletion
      if (data.tables) {
        fetchData(true);
      } else {
        // Direct update for a single table
        setTables(prev => prev.map(t => String(t.id) === String(data.id) ? {
          ...t,
          status: (data.status || 'VACANT').toLowerCase(),
          orderCount: (data.orders || []).reduce((s: number, o: any) => s + (o.items || []).length, 0)
        } : t));
      }
    });

    socket.on('menu_updated', (newMenu: any[]) => {
      console.log('Menu updated on backend');
      const fetchedMenu: MenuItem[] = newMenu.map((i: any) => ({
        id: String(i.id),
        name: i.name || 'Unknown Item',
        price: Number(i.price) || 0,
        category: i.category || i.cat || 'General',
        isVeg: (i.is_veg !== undefined ? i.is_veg : (i.type || '').toLowerCase() === 'veg')
      }));
      setMenu(fetchedMenu);
    });

    if (socket.connected) setConnected(true);

    const interval = setInterval(() => fetchData(true), 6000);
    return () => {
      clearInterval(interval);
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('order_created');
      socket.off('order_updated');
    };
  }, [fetchData]);

  const table = useMemo(() => tables.find(t => t.id === tableId), [tables, tableId]);

  const categories = useMemo(() => {
    const cats = Array.from(new Set(menu.map(i => i.category))).filter(Boolean);
    return ['All', ...cats.sort()];
  }, [menu]);

  const items = useMemo(() =>
    menu.filter(i =>
      (category === 'All' || i.category === category) &&
      i.name.toLowerCase().includes(search.toLowerCase())
    ), [category, search, menu]);

  const add = (m: MenuItem | OrderItem) =>
    setOrder(p => {
      const ex = p.find(i => i.id === m.id);
      if (ex) return p.map(i => i.id === m.id ? { ...i, quantity: i.quantity + 1 } : i);
      return [...p, { id: m.id, name: m.name, price: m.price, quantity: 1 }];
    });

  const dec = (id: string) =>
    setOrder(p => {
      const ex = p.find(i => i.id === id);
      if (ex && ex.quantity > 1) return p.map(i => i.id === id ? { ...i, quantity: i.quantity - 1 } : i);
      return p.filter(i => i.id !== id);
    });

  const getQty = (id: string) => order.find(i => i.id === id)?.quantity || 0;
  const total = order.reduce((s, i) => s + i.price * i.quantity, 0);
  const totalQty = order.reduce((s, i) => s + i.quantity, 0);

  const submit = async () => {
    if (!order.length || !table) return;
    setSending(true);

    const payload: OrderPayload = {
      tableId: table.id,
      items: order.map(i => ({ name: i.name, qty: i.quantity, price: i.price })),
      notes,
      status: 'NEW'
    };

    try {
      setError(null);
      await submitOrder(payload);

      // 🔥 Important: Reload immediately after success
      fetchData(true);

      setSent(true);
      setTimeout(() => {
        setSent(false);
        setOrder([]);
        setNotes('');
        setTableId(null);
        setShowCart(false);
      }, 1500);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Network error - floor might be disconnected.');
    } finally {
      setSending(false);
    }
  };

  const reset = () => {
    setTableId(null);
    setOrder([]);
    setNotes('');
    setShowCart(false);
    setCategory('All');
    setSearch('');
  };

  const saveSettings = () => {
    if (!backendUrlInput) return alert('Please enter a valid URL');
    localStorage.setItem('backend_url', backendUrlInput);
    reconnectSocket();
    setShowSettings(false);
    fetchData();
  };

  if (showSettings) {
    return (
      <div style={{ minHeight: '100vh', background: '#f8fafc', display: 'flex', flexDirection: 'column' }}>
        <header style={{ background: '#821a1d', color: '#fff', padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Settings size={22} />
          <span style={{ fontWeight: 800, fontSize: '18px' }}>CONNECTION SETTINGS</span>
        </header>

        <div style={{ padding: '30px 20px', flex: 1 }}>
          <div style={{ background: '#fff', borderRadius: '24px', padding: '24px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', border: '1px solid #e2e8f0' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 900, marginBottom: '8px' }}>Server Configuration</h2>
            <p style={{ fontSize: '14px', color: '#64748b', marginBottom: '24px' }}>Enter the local IP and port of your POS backend server.</p>

            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 800, color: '#475569', marginBottom: '8px' }}>BACKEND URL</label>
              <input
                value={backendUrlInput}
                onChange={e => setBackendUrlInput(e.target.value)}
                placeholder="http://192.168.1.5:3000"
                style={{ width: '100%', padding: '16px', border: '1px solid #e2e8f0', borderRadius: '14px', fontSize: '15px', outline: 'none', background: '#f1f5f9' }}
              />
            </div>

            <button
              onClick={saveSettings}
              style={{ width: '100%', background: '#821a1d', color: '#fff', padding: '18px', borderRadius: '16px', fontSize: '16px', fontWeight: 900, border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}
            >
              <Save size={20} /> CONNECT TO SERVER
            </button>
          </div>

          {!getBackendURL() && (
            <div style={{ marginTop: '24px', padding: '16px', borderRadius: '16px', background: '#fef2f2', border: '1px solid #fee2e2', color: '#991b1b', fontSize: '14px', fontWeight: 700, textAlign: 'center' }}>
              ⚠️ Please configure backend to start taking orders.
            </div>
          )}
        </div>
      </div>
    );
  }

  if (loading && !tables.length) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', flexDirection: 'column' }}>
        <RefreshCw className="animate-spin" size={32} color="#821a1d" />
        <p style={{ marginTop: '16px', fontWeight: 600, color: '#64748b' }}>Establishing Connection...</p>
      </div>
    );
  }

  if (fetchError && !tables.length) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', flexDirection: 'column', padding: '20px', textAlign: 'center' }}>
        <WifiOff size={48} color="#ef4444" />
        <h2 style={{ marginTop: '20px', fontWeight: 900, fontSize: '20px' }}>CONNECTION FAILED</h2>
        <p style={{ marginTop: '10px', color: '#64748b', fontSize: '14px' }}>{fetchError}</p>
        <div style={{ display: 'flex', gap: '10px', marginTop: '30px' }}>
          <button onClick={() => fetchData()} style={{ background: '#821a1d', color: '#fff', padding: '12px 24px', borderRadius: '12px', fontWeight: 900 }}>RETRY</button>
          <button onClick={() => setShowSettings(true)} style={{ background: '#f1f5f9', color: '#64748b', padding: '12px 24px', borderRadius: '12px', fontWeight: 900 }}>SETTINGS</button>
        </div>
      </div>
    );
  }

  if (!table) {
    return (
      <div style={{ minHeight: '100vh', background: '#f1f5f9' }}>
        <header style={{ background: '#821a1d', color: '#fff', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, zIndex: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <LayoutGrid size={20} />
              <span style={{ fontWeight: 800, fontSize: '16px', letterSpacing: '0.5px' }}>CAPTAIN</span>
            </div>
            <div style={{ width: '1px', height: '16px', background: 'rgba(255,255,255,0.3)', margin: '0 4px' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: connected ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)', padding: '4px 8px', borderRadius: '20px' }}>
              {connected ? <Wifi size={12} color="#4ade80" /> : <WifiOff size={12} color="#f87171" />}
              <span style={{ fontSize: '10px', fontWeight: 900, color: connected ? '#4ade80' : '#f87171' }}>{connected ? 'LIVE' : 'OFFLINE'}</span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={() => fetchData()} style={{ color: '#fff', background: 'rgba(255,255,255,0.1)', padding: '8px', borderRadius: '10px' }}><RefreshCw size={20} className={loading ? 'animate-spin' : ''} /></button>
            <button onClick={() => setShowSettings(true)} style={{ color: '#fff', background: 'rgba(255,255,255,0.1)', padding: '8px', borderRadius: '10px' }}><Settings size={20} /></button>
          </div>
        </header>

        <div style={{ padding: '24px 16px 16px' }}>
          <h1 style={{ fontSize: '20px', fontWeight: 900, color: '#0f172a' }}>Real-time Floor</h1>
          <p style={{ fontSize: '13px', color: '#64748b', marginTop: '2px' }}>Live table status from POS</p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px', padding: '0 16px 40px' }}>
          {tables.map(t => {
            const isOcc = t.status === 'occupied';
            return (
              <motion.button
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.96 }}
                key={t.id}
                onClick={() => setTableId(t.id)}
                style={{
                  background: '#fff',
                  border: isOcc ? '2px solid #821a1d' : '1px solid #e2e8f0',
                  borderRadius: '20px',
                  padding: '24px 20px',
                  textAlign: 'left',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)',
                  position: 'relative',
                  overflow: 'hidden'
                }}
              >
                {isOcc && <div style={{ position: 'absolute', top: 0, right: 0, padding: '4px 12px', background: '#821a1d', color: '#fff', fontSize: '9px', fontWeight: 900, borderBottomLeftRadius: '12px', letterSpacing: '0.05em' }}>RUNNING</div>}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '28px', fontWeight: 900, color: isOcc ? '#821a1d' : '#1e293b' }}>{t.number}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#94a3b8' }}>
                    <Clock size={12} />
                    <span style={{ fontSize: '11px', fontWeight: 700 }}>{t.capacity}</span>
                  </div>
                </div>
                <div>
                  {isOcc ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <UtensilsCrossed size={14} color="#64748b" />
                        <span style={{ fontSize: '13px', fontWeight: 700, color: '#64748b' }}>{t.orderCount} Items</span>
                      </div>
                      <span style={{ fontSize: '16px', fontWeight: 900, color: '#821a1d' }}>₹{t.orderValue}</span>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#22c55e' }} />
                      <span style={{ fontSize: '13px', fontWeight: 700, color: '#22c55e' }}>VACANT</span>
                    </div>
                  )}
                </div>
              </motion.button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: '#f8fafc', overflow: 'hidden' }}>
      <header style={{ background: '#821a1d', color: '#fff', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button onClick={reset} style={{ color: '#fff', background: 'rgba(255,255,255,0.15)', padding: '6px', borderRadius: '10px' }}><ChevronLeft size={24} /></button>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontWeight: 900, fontSize: '16px' }}>Table {table.number}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: connected ? '#4ade80' : '#f87171' }} />
              <span style={{ fontSize: '9px', fontWeight: 900, color: connected ? '#4ade80' : '#f87171', opacity: 0.9 }}>{connected ? 'LIVE' : 'OFFLINE'}</span>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          {table.status === 'occupied' && (
            <button
              onClick={async () => {
                if (window.confirm(`Are you sure you want to clear Table ${table.number} and mark it as free?`)) {
                  try {
                    const baseUrl = getBackendURL();
                    await fetch(`${baseUrl}/table/${table.id}/clear`, { method: 'POST' });
                    reset();
                    fetchData(true);
                  } catch (err) {
                    alert('Failed to clear table. Check connection.');
                  }
                }
              }}
              style={{ color: '#fff', background: 'rgba(255,255,255,0.2)', borderRadius: '8px', padding: '6px 12px', fontSize: '11px', fontWeight: 800 }}
            >
              CLEAR TABLE
            </button>
          )}
          <button onClick={() => setShowSettings(true)} style={{ color: '#fff', background: 'rgba(255,255,255,0.1)', padding: '6px', borderRadius: '10px' }}><Settings size={20} /></button>
          <button onClick={reset} style={{ color: '#fff', background: 'rgba(255,255,255,0.2)', borderRadius: '8px', padding: '6px 12px', fontSize: '11px', fontWeight: 800 }}>CLOSE</button>
        </div>
      </header>

      <div style={{ background: '#fff', borderBottom: '1px solid #e2e8f0', padding: '12px', flexShrink: 0 }}>
        <div style={{ position: 'relative', marginBottom: '12px' }}>
          <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search dishes..."
            style={{ width: '100%', padding: '12px 12px 12px 40px', border: '1px solid #e2e8f0', borderRadius: '12px', fontSize: '14px', outline: 'none', background: '#f1f5f9' }} />
        </div>
        <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }} className="hide-scrollbar">
          {categories.map(c => (
            <button key={c} onClick={() => setCategory(c)} style={{
              padding: '8px 18px', borderRadius: '25px', fontSize: '13px', fontWeight: 800, whiteSpace: 'nowrap',
              background: category === c ? '#821a1d' : '#f1f5f9',
              color: category === c ? '#fff' : '#64748b',
              transition: 'all 0.2s'
            }}>{c}</button>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '12px', display: 'flex', flexDirection: 'column', gap: '16px' }} className="hide-scrollbar">
        {table.activeItems && table.activeItems.length > 0 && (
          <div style={{ background: '#fff', borderRadius: '16px', border: '1px dashed #cbd5e1', padding: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <ReceiptText size={18} color="#821a1d" />
              <span style={{ fontSize: '14px', fontWeight: 900, color: '#1e293b' }}>Running Order Items</span>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {table.activeItems.map((item, idx) => (
                <span key={idx} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', padding: '6px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: 700, color: '#64748b' }}>
                  {item.name} <span style={{ color: '#821a1d', borderLeft: '1px solid #e2e8f0', marginLeft: '6px', paddingLeft: '6px' }}>{item.quantity}</span>
                </span>
              ))}
            </div>
          </div>
        )}

        <div>
          <p style={{ fontSize: '14px', fontWeight: 900, marginBottom: '12px', color: '#64748b' }}>{category} Items</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
            {items.map(item => {
              const qty = getQty(item.id);
              return (
                <div key={item.id} style={{
                  background: '#fff', borderRadius: '16px', padding: '16px',
                  border: qty > 0 ? '2px solid #821a1d' : '1px solid #eef2f6',
                  display: 'flex', flexDirection: 'column', gap: '10px', position: 'relative',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
                }}>
                  <div style={{ position: 'absolute', left: 0, top: '16px', bottom: '16px', width: '4px', background: item.isVeg ? '#22c55e' : '#ef4444', borderRadius: '0 4px 4px 0' }} />
                  <div>
                    <p style={{ fontSize: '14px', fontWeight: 800, lineHeight: 1.3 }}>{item.name}</p>
                    <p style={{ fontSize: '16px', fontWeight: 900, color: '#821a1d', marginTop: '2px' }}>₹{item.price}</p>
                  </div>
                  {qty === 0 ? (
                    <button onClick={() => add(item)} style={{ background: '#fef2f2', color: '#821a1d', padding: '10px', borderRadius: '12px', fontSize: '13px', fontWeight: 900, border: '1px solid #fecaca' }}>+ ADD</button>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', background: '#f8fafc', borderRadius: '12px', overflow: 'hidden', border: '1px solid #e2e8f0' }}>
                      <button onClick={() => dec(item.id)} style={{ flex: 1, padding: '10px', fontWeight: 800, fontSize: '20px' }}>−</button>
                      <span style={{ width: '32px', textAlign: 'center', fontWeight: 900, fontSize: '15px' }}>{qty}</span>
                      <button onClick={() => add(item)} style={{ flex: 1, padding: '10px', fontWeight: 800, fontSize: '20px' }}>+</button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
        <div style={{ height: '100px' }} />
      </div>

      {totalQty > 0 && !showCart && (
        <motion.div initial={{ y: 100 }} animate={{ y: 0 }} style={{ position: 'fixed', bottom: '20px', left: '16px', right: '16px', zIndex: 30 }}>
          <button onClick={() => setShowCart(true)} style={{
            width: '100%', background: '#821a1d', color: '#fff', borderRadius: '18px', padding: '18px 24px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: '0 10px 25px rgba(130,26,29,0.4)', border: 'none'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ background: 'rgba(255,255,255,0.2)', padding: '4px 12px', borderRadius: '10px', fontSize: '12px', fontWeight: 900 }}>{totalQty} ITEMS</div>
              <span style={{ fontSize: '15px', fontWeight: 800 }}>VIEW CART</span>
            </div>
            <span style={{ fontSize: '20px', fontWeight: 900 }}>₹{total}</span>
          </button>
        </motion.div>
      )}

      <AnimatePresence>
        {showCart && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowCart(false)}
              style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 40, backdropFilter: 'blur(6px)' }} />
            <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 30 }}
              style={{ position: 'fixed', bottom: 0, left: 0, right: 0, maxHeight: '90vh', zIndex: 50, background: '#fff', borderTopLeftRadius: '28px', borderTopRightRadius: '28px', display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', justifyContent: 'center', padding: '14px 0 6px' }}><div style={{ width: '44px', height: '5px', borderRadius: '5px', background: '#e2e8f0' }} /></div>
              <div style={{ padding: '8px 24px 16px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h2 style={{ fontSize: '20px', fontWeight: 900 }}>KOT Confirmation</h2>
                  <p style={{ fontSize: '13px', color: '#64748b' }}>Confirm new items for Table {table.number}</p>
                </div>
                <button onClick={() => setShowCart(false)} style={{ color: '#64748b', fontSize: '24px', fontWeight: 900, background: 'none', border: 'none', cursor: 'pointer' }}>×</button>
              </div>
              <div style={{ flex: 1, overflowY: 'auto', padding: '10px 24px' }}>
                {order.map(item => (
                  <div key={item.id} style={{ display: 'flex', alignItems: 'center', padding: '16px 0', borderBottom: '1px solid #f8fafc', gap: '14px' }}>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: '15px', fontWeight: 800 }}>{item.name}</p>
                      <p style={{ fontSize: '14px', fontWeight: 900, color: '#821a1d' }}>₹{item.price * item.quantity}</p>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden' }}>
                      <button onClick={() => dec(item.id)} style={{ width: '40px', height: '40px', background: '#f8fafc', fontWeight: 800 }}>−</button>
                      <span style={{ width: '40px', textAlign: 'center', fontWeight: 900 }}>{item.quantity}</span>
                      <button onClick={() => add(item)} style={{ width: '40px', height: '40px', background: '#f8fafc', fontWeight: 800 }}>+</button>
                    </div>
                  </div>
                ))}
                <div style={{ marginTop: '20px' }}>
                  <p style={{ fontSize: '13px', fontWeight: 800, color: '#475569', marginBottom: '8px' }}>Kitchen Notes</p>
                  <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="E.g. Extra spicy, no onions..."
                    style={{ width: '100%', padding: '14px', border: '1px solid #e2e8f0', borderRadius: '16px', fontSize: '14px', height: '80px', outline: 'none', background: '#f8fafc', resize: 'none' }} />
                </div>
              </div>
              <div style={{ padding: '24px', borderTop: '1px solid #f1f5f9' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
                  <span style={{ fontSize: '15px', fontWeight: 700, color: '#64748b' }}>Addition Subtotal</span>
                  <span style={{ fontSize: '24px', fontWeight: 900 }}>₹{total.toFixed(2)}</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '12px' }}>
                  <button onClick={() => { setOrder([]); setNotes(''); setShowCart(false); }} style={{ background: '#f1f5f9', borderRadius: '16px', padding: '16px', fontSize: '15px', fontWeight: 800 }}>CLEAR</button>
                  <button disabled={sending || !order.length} onClick={submit}
                    style={{ background: '#821a1d', color: '#fff', borderRadius: '16px', padding: '16px', fontSize: '15px', fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', opacity: sending ? 0.7 : 1 }}>
                    {sending ? '...' : 'SEND & PRINT KOT'}<SendHorizontal size={20} />
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {sent && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
            <motion.div initial={{ scale: 0.8 }} animate={{ scale: 1 }} style={{ background: '#fff', borderRadius: '32px', padding: '40px 24px', textAlign: 'center', width: '85%', maxWidth: '360px' }}>
              <div style={{ width: '70px', height: '70px', borderRadius: '50%', background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                <CheckCircle2 size={40} color="#22c55e" />
              </div>
              <h3 style={{ fontSize: '22px', fontWeight: 900 }}>KOT SENT!</h3>
              <p style={{ fontSize: '14px', color: '#64748b', marginTop: '10px' }}>Kitchen has received the new items.</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {error && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
            <motion.div initial={{ scale: 0.8 }} animate={{ scale: 1 }} style={{ background: '#fff', borderRadius: '32px', padding: '40px 24px', textAlign: 'center', width: '85%', maxWidth: '360px' }}>
              <div style={{ width: '70px', height: '70px', borderRadius: '50%', background: '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                <RefreshCw size={40} color="#ef4444" />
              </div>
              <h3 style={{ fontSize: '22px', fontWeight: 900 }}>ORDER FAILED</h3>
              <p style={{ fontSize: '14px', color: '#64748b', marginTop: '10px' }}>{error}</p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '24px' }}>
                <button onClick={submit} style={{ background: '#821a1d', color: '#fff', borderRadius: '16px', padding: '16px', fontSize: '15px', fontWeight: 900, border: 'none' }}>
                  RETRY SENDING
                </button>
                <button onClick={() => setError(null)} style={{ background: '#f1f5f9', color: '#64748b', borderRadius: '16px', padding: '16px', fontSize: '15px', fontWeight: 800, border: 'none' }}>
                  CANCEL
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default App;
