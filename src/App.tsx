import { useState, useMemo, useEffect, useCallback } from 'react';
import { Search, ChevronLeft, X, SendHorizontal, CheckCircle2, ShoppingCart, RefreshCw, LayoutGrid, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
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
  status: 'available' | 'occupied' | 'dirty' | 'RUNNING';
  capacity: number;
  orderCount?: number;
  orderValue?: number;
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

const BASE_URL = 'https://pos-roan-six.vercel.app';

function useIsMobile() {
  const [mobile, setMobile] = useState(window.innerWidth < 768);
  useEffect(() => {
    const h = () => setMobile(window.innerWidth < 768);
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, []);
  return mobile;
}

const App = () => {
  // Data State
  const [tables, setTables] = useState<Table[]>([]);
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [activeOrders, setActiveOrders] = useState<BackendOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // UI State
  const [tableId, setTableId] = useState<string | null>(null);
  const [category, setCategory] = useState('All');
  const [search, setSearch] = useState('');
  const [order, setOrder] = useState<OrderItem[]>([]);
  const [notes, setNotes] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [showCart, setShowCart] = useState(false);
  
  const isMobile = useIsMobile();

  // --- API FETCHERS ---
  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [tRes, mRes, oRes] = await Promise.all([
        fetch(`${BASE_URL}/api/tables`),
        fetch(`${BASE_URL}/api/menu`),
        fetch(`${BASE_URL}/api/orders`)
      ]);
      
      const tData = await tRes.json();
      const mData = await mRes.json();
      const oData = await oRes.json();

      const backendOrders: BackendOrder[] = oData.orders || [];
      setActiveOrders(backendOrders);

      // Normalize Tables and merge with order info
      const fetchedTables = (tData.tables || []).map((t: any) => {
        // Find if name is something like "Table 1" -> extract "1"
        const tableNumRaw = t.name || t.table_number || t.number;
        const tableNum = String(tableNumRaw).replace(/Table\s+/i, '');
        
        // Find if this table has a running order
        const tableOrder = backendOrders.filter(o => String(o.table_number) === tableNum);
        const itemCount = tableOrder.reduce((s, o) => s + o.items.reduce((ss, i) => ss + i.quantity, 0), 0);
        const val = tableOrder.reduce((s, o) => s + o.items.reduce((ss, i) => ss + (i.price * i.quantity), 0), 0);

        return {
          id: String(t.id),
          number: tableNum,
          status: itemCount > 0 ? 'occupied' : (t.status === 'blank' ? 'available' : t.status || 'available').toLowerCase(),
          capacity: t.seats || t.capacity || 4,
          orderCount: itemCount,
          orderValue: val
        };
      });

      // Normalize Menu
      let fetchedMenu: MenuItem[] = [];
      const rawItems = mData.items || mData.menu || [];
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
      setError(null);
    } catch (err) {
      if (!silent) setError('Connection failed.');
      console.error(err);
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(() => fetchData(true), 15000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const table = useMemo(() => tables.find(t => t.id === tableId), [tables, tableId]);
  const categories = useMemo(() => ['All', ...Array.from(new Set(menu.map(i => i.category)))], [menu]);

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
    try {
      const res = await fetch(`${BASE_URL}/api/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          table_number: table.number,
          items: order.map(i => ({ name: i.name, quantity: i.quantity, price: i.price })),
          notes,
        }),
      });
      if (res.ok) {
        setSent(true);
        setTimeout(() => { 
          setSent(false); 
          setOrder([]); 
          setNotes(''); 
          setTableId(null); 
          setShowCart(false);
          fetchData(true);
        }, 1500);
      } else {
        alert('Failed. Retry.');
      }
    } catch {
      alert('Network error.');
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
        <p style={{ marginTop: '16px', fontWeight: 600, color: '#64748b' }}>Syncing Tables...</p>
      </div>
    );
  }

  // ══════ TABLE SELECTION ══════
  if (!table) {
    return (
      <div style={{ minHeight: '100vh', background: '#f0f4f8' }}>
        <header style={{ background: '#821a1d', color: '#fff', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, zIndex: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <LayoutGrid size={20} />
            <span style={{ fontWeight: 800, fontSize: '16px' }}>TYDE POS CAPTAIN</span>
          </div>
          <button onClick={() => fetchData()} style={{ color: '#fff' }}><RefreshCw size={20} className={loading ? 'animate-spin' : ''} /></button>
        </header>

        <div style={{ padding: '24px 16px 12px' }}>
          <h1 style={{ fontSize: '20px', fontWeight: 900, color: '#1e293b' }}>Select Table</h1>
          <p style={{ fontSize: '13px', color: '#64748b' }}>Real-time Floor Map</p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', padding: '0 16px 40px' }}>
          {tables.map(t => {
            const isOcc = t.status === 'occupied';
            return (
              <motion.button 
                whileTap={{ scale: 0.96 }}
                key={t.id} 
                onClick={() => setTableId(t.id)} 
                style={{
                  background: '#fff', 
                  border: isOcc ? '2px solid #821a1d' : '1px solid #e2e8f0',
                  borderRadius: '16px', 
                  padding: '20px 16px', 
                  textAlign: 'left',
                  display: 'flex', 
                  flexDirection: 'column', 
                  gap: '6px',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
                  position: 'relative'
                }}
              >
                {isOcc && <div style={{ position: 'absolute', top: 0, right: 0, padding: '3px 8px', background: '#821a1d', color: '#fff', fontSize: '8px', fontWeight: 900, borderBottomLeftRadius: '8px' }}>RUNNING</div>}
                
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '24px', fontWeight: 900, color: isOcc ? '#821a1d' : '#1e293b' }}>T-{t.number}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#94a3b8' }}>
                    <Clock size={12} />
                    <span style={{ fontSize: '10px', fontWeight: 700 }}>{t.capacity}</span>
                  </div>
                </div>

                <div style={{ marginTop: '2px' }}>
                  {isOcc ? (
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontSize: '12px', fontWeight: 700, color: '#64748b' }}>{t.orderCount} Items</span>
                      <span style={{ fontSize: '14px', fontWeight: 900, color: '#821a1d' }}>₹{t.orderValue}</span>
                    </div>
                  ) : (
                    <span style={{ fontSize: '12px', fontWeight: 700, color: '#16a34a' }}>VACANT</span>
                  )}
                </div>
              </motion.button>
            );
          })}
        </div>
      </div>
    );
  }

  // ══════ ORDERING ══════
  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: '#f0f4f8', overflow: 'hidden' }}>
      <header style={{ background: '#821a1d', color: '#fff', padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button onClick={reset} style={{ color: '#fff' }}><ChevronLeft size={22} /></button>
          <span style={{ fontWeight: 800, fontSize: '16px' }}>Table {table.number}</span>
        </div>
        <button onClick={reset} style={{ color: '#fff', background: 'rgba(255,255,255,0.2)', borderRadius: '8px', padding: '5px 12px', fontSize: '12px', fontWeight: 700 }}>Close</button>
      </header>

      <div style={{ background: '#fff', borderBottom: '1px solid #e2e8f0', padding: '10px', flexShrink: 0 }}>
        <div style={{ position: 'relative', marginBottom: '10px' }}>
          <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search..."
            style={{ width: '100%', padding: '10px 10px 10px 34px', border: '1px solid #e2e8f0', borderRadius: '10px', fontSize: '14px', outline: 'none', background: '#f8fafc' }} />
        </div>
        <div style={{ display: 'flex', gap: '8px', overflowX: 'auto' }} className="hide-scrollbar">
          {categories.map(c => (
            <button key={c} onClick={() => setCategory(c)} style={{
              padding: '6px 14px', borderRadius: '20px', fontSize: '12px', fontWeight: 800, whiteSpace: 'nowrap',
              background: category === c ? '#821a1d' : '#f1f5f9',
              color: category === c ? '#fff' : '#64748b',
            }}>{c}</button>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '10px' }} className="hide-scrollbar">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
          {items.map(item => {
            const qty = getQty(item.id);
            return (
              <div key={item.id} style={{
                background: '#fff', borderRadius: '12px', padding: '12px', 
                border: qty > 0 ? '2px solid #821a1d' : '1px solid #f1f5f9',
                display: 'flex', flexDirection: 'column', gap: '8px', position: 'relative'
              }}>
                <div style={{ position: 'absolute', left: 0, top: '10px', bottom: '10px', width: '3px', background: item.isVeg ? '#22c55e' : '#ef4444', borderRadius: '0 4px 4px 0' }} />
                <div>
                  <p style={{ fontSize: '13px', fontWeight: 800, lineHeight: 1.3 }}>{item.name}</p>
                  <p style={{ fontSize: '14px', fontWeight: 900, color: '#821a1d', marginTop: '2px' }}>₹{item.price}</p>
                </div>
                {qty === 0 ? (
                  <button onClick={() => add(item)} style={{ background: '#fef2f2', color: '#821a1d', padding: '8px', borderRadius: '8px', fontSize: '12px', fontWeight: 900, border: '1px solid #e2e8f0' }}>+ ADD</button>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', background: '#f8fafc', borderRadius: '8px', overflow: 'hidden', border: '1px solid #e2e8f0' }}>
                    <button onClick={() => dec(item.id)} style={{ flex: 1, padding: '8px', fontWeight: 800, fontSize: '18px' }}>−</button>
                    <span style={{ textAlign: 'center', fontWeight: 900, fontSize: '15px' }}>{qty}</span>
                    <button onClick={() => add(item)} style={{ flex: 1, padding: '8px', fontWeight: 800, fontSize: '18px' }}>+</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <div style={{ height: '80px' }} />
      </div>

      {totalQty > 0 && !showCart && (
        <motion.div initial={{ y: 100 }} animate={{ y: 0 }} style={{ position: 'fixed', bottom: '16px', left: '12px', right: '12px', zIndex: 30 }}>
          <button onClick={() => setShowCart(true)} style={{ 
            width: '100%', background: '#821a1d', color: '#fff', borderRadius: '14px', padding: '16px 20px', 
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: '0 8px 25px rgba(130,26,29,0.3)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ShoppingCart size={20} />
              <span style={{ fontSize: '14px', fontWeight: 800 }}>{totalQty} Items | ₹{total}</span>
            </div>
            <span style={{ fontSize: '14px', fontWeight: 900 }}>VIEW ORDER</span>
          </button>
        </motion.div>
      )}

      <AnimatePresence>
        {showCart && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowCart(false)}
              style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 40, backdropFilter: 'blur(4px)' }} />
            <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 30 }}
              style={{ position: 'fixed', bottom: 0, left: 0, right: 0, maxHeight: '85vh', zIndex: 50, background: '#fff', borderTopLeftRadius: '24px', borderTopRightRadius: '24px', display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 4px' }}><div style={{ width: '40px', height: '4px', borderRadius: '4px', background: '#e2e8f0' }} /></div>
              <div style={{ padding: '8px 20px 16px', borderBottom: '1px solid #f1f5f9' }}>
                <h2 style={{ fontSize: '18px', fontWeight: 900 }}>Table {table.number} Order</h2>
                <p style={{ fontSize: '12px', color: '#64748b' }}>Confirm items to send to kitchen</p>
              </div>
              <div style={{ flex: 1, overflowY: 'auto', padding: '10px 20px' }}>
                {order.map(item => (
                  <div key={item.id} style={{ display: 'flex', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid #f8fafc', gap: '12px' }}>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: '14px', fontWeight: 700 }}>{item.name}</p>
                      <p style={{ fontSize: '13px', fontWeight: 800, color: '#821a1d' }}>₹{item.price * item.quantity}</p>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', border: '1px solid #e2e8f0', borderRadius: '10px', overflow: 'hidden' }}>
                      <button onClick={() => dec(item.id)} style={{ width: '36px', height: '36px', background: '#f8fafc', fontWeight: 800 }}>−</button>
                      <span style={{ width: '36px', textAlign: 'center', fontWeight: 900 }}>{item.quantity}</span>
                      <button onClick={() => add(item)} style={{ width: '36px', height: '36px', background: '#f8fafc', fontWeight: 800 }}>+</button>
                    </div>
                  </div>
                ))}
                <div style={{ marginTop: '16px' }}>
                   <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Special instructions..."
                    style={{ width: '100%', padding: '12px', border: '1px solid #e2e8f0', borderRadius: '12px', fontSize: '13px', height: '60px', outline: 'none', background: '#f8fafc' }} />
                </div>
              </div>
              <div style={{ padding: '20px', borderTop: '1px solid #f1f5f9' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                  <span style={{ fontSize: '14px', fontWeight: 700 }}>Total Value</span>
                  <span style={{ fontSize: '20px', fontWeight: 900 }}>₹{total.toFixed(2)}</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '10px' }}>
                  <button onClick={() => { setOrder([]); setNotes(''); setShowCart(false); }} style={{ background: '#f1f5f9', borderRadius: '12px', padding: '14px', fontSize: '14px', fontWeight: 800 }}>CLEAR</button>
                  <button disabled={sending || !order.length} onClick={submit}
                    style={{ background: '#821a1d', color: '#fff', borderRadius: '12px', padding: '14px', fontSize: '14px', fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', opacity: sending ? 0.7 : 1 }}>
                    {sending ? '...' : 'SEND & PRINT KOT'}<SendHorizontal size={18} />
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
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} style={{ background: '#fff', borderRadius: '24px', padding: '40px 20px', textAlign: 'center', boxShadow: '0 20px 40px rgba(0,0,0,0.2)', width: '80%' }}>
              <CheckCircle2 size={48} color="#22c55e" style={{ margin: '0 auto 16px' }} />
              <h3 style={{ fontSize: '20px', fontWeight: 900 }}>KOT SENT!</h3>
              <p style={{ fontSize: '14px', color: '#64748b', marginTop: '8px' }}>Order placed for Table {table.number}</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default App;
