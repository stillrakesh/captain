import { useState, useMemo, useEffect, useCallback } from 'react';
import { Search, ChevronLeft, SendHorizontal, CheckCircle2, RefreshCw, LayoutGrid, Clock, UtensilsCrossed, ReceiptText } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { API_BASE } from './config';
import socket from './services/socket';
import { submitOrder, syncOfflineOrders, OrderPayload } from './services/api';
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

interface BackendOrder {
  id: number;
  table_number: string;
  items: { name: string; quantity: number; price: number }[];
  notes: string;
  status: string;
  timestamp: string;
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
  const [showCart, setShowCart] = useState(false);
  
  // --- API FETCHERS ---
  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [tRes, mRes, oRes] = await Promise.all([
        fetch(`${API_BASE}/tables`),
        fetch(`${API_BASE}/menu`),
        fetch(`${API_BASE}/orders`)
      ]);
      
      const tData = await tRes.json();
      const mData = await mRes.json();
      const oData = await oRes.json();

      const backendOrders: BackendOrder[] = oData.orders || [];

      // Normalize Tables and merge with order info
      const fetchedTables = (tData.tables || []).map((t: any) => {
        const tableNumRaw = t.name || t.table_number || t.number;
        const tableNum = String(tableNumRaw).replace(/Table\s+/i, '');
        
        // Find if this table has a running order
        const tableOrders = backendOrders.filter(o => String(o.table_number) === tableNum);
        
        // Aggregate all items for this table
        const activeItemMap: Record<string, number> = {};
        let val = 0;
        tableOrders.forEach(o => {
          o.items.forEach(i => {
            activeItemMap[i.name] = (activeItemMap[i.name] || 0) + i.quantity;
            val += (i.price || 0) * i.quantity;
          });
        });

        const activeItems = Object.keys(activeItemMap).map(name => ({
          name,
          quantity: activeItemMap[name]
        }));

        return {
          id: String(t.id),
          number: tableNum,
          status: activeItems.length > 0 ? 'occupied' : (t.status === 'blank' ? 'available' : t.status || 'available').toLowerCase(),
          capacity: t.seats || t.capacity || 4,
          orderCount: activeItems.reduce((s, i) => s + i.quantity, 0),
          orderValue: val,
          activeItems: activeItems
        };
      });

      // Normalize Menu
      let fetchedMenu: MenuItem[] = [];
      const rawItems = mData.menu || mData.items || [];
      if (Array.isArray(rawItems)) {
        fetchedMenu = rawItems.map((i: any) => ({
          id: String(i.id),
          name: i.name,
          price: i.price,
          category: i.cat || i.category,
          isVeg: (i.type || '').toLowerCase() === 'veg'
        }));
      }

      setTables(fetchedTables);
      setMenu(fetchedMenu);
    } catch (err) {
      console.error(err);
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    syncOfflineOrders();
    
    // Socket Listeners
    socket.on('connect', () => console.log('Connected to real-time server'));
    socket.on('order_created', () => {
      console.log('Order created on backend');
      fetchData(true);
    });
    socket.on('order_updated', () => {
      console.log('Order updated on backend');
      fetchData(true);
    });

    const interval = setInterval(() => fetchData(true), 6000);
    return () => {
      clearInterval(interval);
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
      table_number: table.number,
      items: order.map(i => ({ name: i.name, quantity: i.quantity, price: i.price })),
      notes,
      status: 'NEW'
    };

    try {
      setError(null);
      await submitOrder(payload);
      setSent(true);
      setTimeout(() => { 
        setSent(false); 
        setOrder([]); 
        setNotes(''); 
        setTableId(null); 
        setShowCart(false);
        fetchData(true);
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

  if (loading && !tables.length) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', flexDirection: 'column' }}>
        <RefreshCw className="animate-spin" size={32} color="#821a1d" />
        <p style={{ marginTop: '16px', fontWeight: 600, color: '#64748b' }}>Establishing Connection...</p>
      </div>
    );
  }

  if (!table) {
    return (
      <div style={{ minHeight: '100vh', background: '#f1f5f9' }}>
        <header style={{ background: '#821a1d', color: '#fff', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, zIndex: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <LayoutGrid size={20} />
            <span style={{ fontWeight: 800, fontSize: '16px', letterSpacing: '0.5px' }}>CAPTAIN DASHBOARD</span>
          </div>
          <button onClick={() => fetchData()} style={{ color: '#fff', background: 'rgba(255,255,255,0.1)', padding: '6px', borderRadius: '10px' }}><RefreshCw size={20} className={loading ? 'animate-spin' : ''} /></button>
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
      <header style={{ background: '#821a1d', color: '#fff', padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button onClick={reset} style={{ color: '#fff', background: 'rgba(255,255,255,0.15)', padding: '6px', borderRadius: '10px' }}><ChevronLeft size={24} /></button>
          <div>
            <span style={{ fontWeight: 900, fontSize: '17px' }}>Table {table.number}</span>
            <p style={{ fontSize: '10px', opacity: 0.8, fontWeight: 700 }}>READY TO ORDER</p>
          </div>
        </div>
        <button onClick={reset} style={{ color: '#fff', background: 'rgba(255,255,255,0.2)', borderRadius: '8px', padding: '6px 14px', fontSize: '12px', fontWeight: 800 }}>CLOSE</button>
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
