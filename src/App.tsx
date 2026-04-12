import { useState, useMemo, useEffect, useCallback } from 'react';
import { Search, ChevronLeft, X, SendHorizontal, CheckCircle2, ShoppingCart, RefreshCw, LayoutGrid, Clock, IndianRupee } from 'lucide-react';
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
        const tableNum = String(t.table_number || t.number);
        // Find if this table has a running order
        const tableOrder = backendOrders.filter(o => String(o.table_number) === tableNum);
        const itemCount = tableOrder.reduce((s, o) => s + o.items.reduce((ss, i) => ss + i.quantity, 0), 0);
        const val = tableOrder.reduce((s, o) => s + o.items.reduce((ss, i) => ss + (i.price * i.quantity), 0), 0);

        return {
          id: String(t.id),
          number: tableNum,
          status: itemCount > 0 ? 'occupied' : (t.status || 'available').toLowerCase(),
          capacity: t.capacity || 4,
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
          category: i.category,
          isVeg: i.isVeg ?? true
        }));
      }

      setTables(fetchedTables);
      setMenu(fetchedMenu);
      setError(null);
    } catch (err) {
      if (!silent) setError('Connection failed. Retrying in background...');
      console.error(err);
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  // Poll for updates every 10 seconds for real-time tracking
  useEffect(() => {
    fetchData();
    const interval = setInterval(() => fetchData(true), 10000);
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
        // After success, wait, then redirect to home
        setTimeout(() => { 
          setSent(false); 
          setOrder([]); 
          setNotes(''); 
          setTableId(null); 
          setShowCart(false);
          fetchData(true);
        }, 1500);
      } else {
        alert('Failed to place order. Try again.');
      }
    } catch {
      alert('Network error. Check connection.');
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

  // --- LOADING / ERRORS ---
  if (loading && !tables.length) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', flexDirection: 'column' }}>
        <RefreshCw className="animate-spin" size={32} color="#821a1d" />
        <p style={{ marginTop: '16px', fontWeight: 600, color: '#64748b' }}>Initializing Captain App...</p>
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
            <span style={{ fontWeight: 800, fontSize: '16px', letterSpacing: '-0.02em' }}>TYDE POS CAPTAIN</span>
          </div>
          <button onClick={() => fetchData()} style={{ color: '#fff', padding: '4px' }}><RefreshCw size={20} className={loading ? 'animate-spin' : ''} /></button>
        </header>

        <div style={{ padding: '24px 16px 16px' }}>
          <h1 style={{ fontSize: '20px', fontWeight: 900, color: '#1e293b' }}>Table Status</h1>
          <p style={{ fontSize: '13px', color: '#64748b', marginTop: '2px' }}>Real-time floor monitoring</p>
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
                  gap: '8px',
                  boxShadow: isOcc ? '0 4px 12px rgba(130,26,29,0.1)' : '0 1px 3px rgba(0,0,0,0.02)',
                  position: 'relative',
                  overflow: 'hidden'
                }}
              >
                {isOcc && (
                  <div style={{ position: 'absolute', top: 0, right: 0, padding: '4px 10px', background: '#821a1d', color: '#fff', fontSize: '9px', fontWeight: 900, borderBottomLeftRadius: '10px' }}>RUNNING</div>
                )}
                
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <span style={{ fontSize: '28px', fontWeight: 900, color: isOcc ? '#821a1d' : '#1e293b' }}>T-{t.number}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: isOcc ? '#821a1d' : '#94a3b8' }}>
                    <Clock size={12} />
                    <span style={{ fontSize: '10px', fontWeight: 700 }}>{t.capacity}P</span>
                  </div>
                </div>

                <div style={{ marginTop: '4px' }}>
                  {isOcc ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <span style={{ fontSize: '13px', fontWeight: 800, color: '#1e293b' }}>{t.orderCount} Items Added</span>
                      <span style={{ fontSize: '14px', fontWeight: 900, color: '#821a1d' }}>₹{t.orderValue}</span>
                    </div>
                  ) : (
                    <span style={{ fontSize: '12px', fontWeight: 700, color: '#16a34a', background: '#f0fdf4', padding: '4px 8px', borderRadius: '6px' }}>VACANT</span>
                  )}
                </div>
              </motion.button>
            );
          })}
        </div>
      </div>
    );
  }

  // ══════ ORDERING INTERFACE ══════
  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: isMobile ? 'column' : 'row', background: '#f0f4f8', overflow: 'hidden' }}>
      {/* Sidebar/Header */}
      <div style={{ 
        width: isMobile ? '100%' : '320px', 
        background: '#821a1d', 
        color: '#fff', 
        padding: '16px', 
        display: 'flex', 
        flexDirection: isMobile ? 'row' : 'column',
        justifyContent: 'space-between',
        alignItems: isMobile ? 'center' : 'stretch',
        flexShrink: 0,
        zIndex: 20
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button onClick={reset} style={{ color: '#fff', background: 'rgba(255,255,255,0.2)', padding: '6px', borderRadius: '10px' }}><ChevronLeft size={22} /></button>
          <div>
            <p style={{ fontSize: '18px', fontWeight: 900 }}>Table {table.number}</p>
            <p style={{ fontSize: '11px', opacity: 0.8, fontWeight: 700 }}>{table.status.toUpperCase()}</p>
          </div>
        </div>
        {!isMobile && (
           <div style={{ marginTop: 'auto', padding: '16px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
             <p style={{ fontSize: '13px', fontWeight: 600 }}>Quick Stats</p>
             <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ fontSize: '12px' }}>Total Added: {totalQty}</span>
                <span style={{ fontSize: '15px', fontWeight: 900 }}>Value: ₹{total}</span>
             </div>
           </div>
        )}
      </div>

      {/* Main Content: Categories & Items */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Search & Tabs */}
        <div style={{ background: '#fff', borderBottom: '1px solid #e2e8f0', padding: '12px', zIndex: 15 }}>
          <div style={{ position: 'relative', marginBottom: '12px' }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search dishes..."
              style={{ width: '100%', padding: '12px 12px 12px 38px', border: '1px solid #e2e8f0', borderRadius: '12px', fontSize: '14px', outline: 'none', background: '#f8fafc' }} />
          </div>
          <div style={{ display: 'flex', gap: '8px', overflowX: 'auto' }} className="hide-scrollbar">
            {categories.map(c => (
              <button key={c} onClick={() => setCategory(c)} style={{
                padding: '8px 16px', borderRadius: '25px', fontSize: '13px', fontWeight: 800, whiteSpace: 'nowrap',
                background: category === c ? '#821a1d' : '#f1f5f9',
                color: category === c ? '#fff' : '#64748b',
                transition: '0.2s'
              }}>{c}</button>
            ))}
          </div>
        </div>

        {/* Menu Grid */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }} className="hide-scrollbar">
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${isMobile ? 2 : 4}, 1fr)`, gap: '12px' }}>
            {items.map(item => {
              const qty = getQty(item.id);
              return (
                <div key={item.id} style={{
                  background: '#fff', borderRadius: '16px', padding: '16px', 
                  border: qty > 0 ? '2px solid #821a1d' : '1px solid #f1f5f9',
                  display: 'flex', flexDirection: 'column', gap: '10px',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.02)', position: 'relative'
                }}>
                  <div style={{ position: 'absolute', left: 0, top: '16px', bottom: '16px', width: '4px', background: item.isVeg ? '#22c55e' : '#ef4444', borderRadius: '0 4px 4px 0' }} />
                  <div>
                    <p style={{ fontSize: '14px', fontWeight: 800, lineHeight: 1.3, color: '#1e293b' }}>{item.name}</p>
                    <p style={{ fontSize: '16px', fontWeight: 900, color: '#821a1d', marginTop: '4px' }}>₹{item.price}</p>
                  </div>
                  
                  {qty === 0 ? (
                    <motion.button whileTap={{ scale: 0.95 }} onClick={() => add(item)} 
                      style={{ background: '#fef2f2', color: '#821a1d', padding: '10px', borderRadius: '12px', fontSize: '13px', fontWeight: 900, border: '1px solid rgba(130,26,29,0.1)' }}>+ ADD</motion.button>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', background: '#f8fafc', borderRadius: '12px', overflow: 'hidden', border: '1px solid #e2e8f0' }}>
                      <button onClick={() => dec(item.id)} style={{ flex: 1, padding: '10px', fontWeight: 800, fontSize: '18px' }}>−</button>
                      <span style={{ padding: '0 8px', fontWeight: 900, fontSize: '16px', color: '#821a1d' }}>{qty}</span>
                      <button onClick={() => add(item)} style={{ flex: 1, padding: '10px', fontWeight: 800, fontSize: '18px' }}>+</button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <div style={{ height: '100px' }} />
        </div>
      </div>

      {/* Persistent Floating Action Bar (Mobile only) */}
      {isMobile && totalQty > 0 && !showCart && (
        <motion.div initial={{ y: 100 }} animate={{ y: 0 }} style={{ position: 'fixed', bottom: '24px', left: '16px', right: '16px', zIndex: 30 }}>
          <button onClick={() => setShowCart(true)} style={{ 
            width: '100%', background: '#821a1d', color: '#fff', borderRadius: '16px', padding: '18px 24px', 
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', 
            boxShadow: '0 12px 30px rgba(130,26,29,0.3)', border: 'none'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ background: 'rgba(255,255,255,0.2)', padding: '5px 12px', borderRadius: '10px', fontSize: '13px', fontWeight: 900 }}>{totalQty} ITEMS</div>
              <span style={{ fontSize: '15px', fontWeight: 800 }}>VIEW ORDER</span>
            </div>
            <span style={{ fontSize: '20px', fontWeight: 900 }}>₹{total}</span>
          </button>
        </motion.div>
      )}

      {/* Cart Drawer / Panel */}
      <AnimatePresence>
        {showCart && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowCart(false)}
              style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 40, backdropFilter: 'blur(4px)' }} />
            <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              style={{ 
                position: 'fixed', bottom: 0, left: 0, right: 0, maxHeight: '90vh', zIndex: 50, background: '#fff', 
                borderTopLeftRadius: '32px', borderTopRightRadius: '32px', display: 'flex', flexDirection: 'column' 
              }}>
              <div style={{ display: 'flex', justifyContent: 'center', padding: '14px 0 6px' }}><div style={{ width: '48px', height: '5px', borderRadius: '5px', background: '#e2e8f0' }} /></div>
              
              <div style={{ padding: '10px 24px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f1f5f9' }}>
                <div>
                  <h2 style={{ fontSize: '22px', fontWeight: 900, color: '#1e293b' }}>Confirm Order</h2>
                  <p style={{ fontSize: '14px', color: '#64748b', fontWeight: 600 }}>Table {table.number} • Current Selection</p>
                </div>
                <button onClick={() => setShowCart(false)} style={{ background: '#f1f5f9', padding: '8px', borderRadius: '12px' }}><X size={24} color="#64748b" /></button>
              </div>

              <div style={{ flex: 1, overflowY: 'auto', padding: '8px 24px' }}>
                {order.map(item => (
                  <div key={item.id} style={{ display: 'flex', alignItems: 'center', padding: '16px 0', borderBottom: '1px solid #f8fafc', gap: '16px' }}>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: '16px', fontWeight: 800 }}>{item.name}</p>
                      <p style={{ fontSize: '15px', fontWeight: 900, color: '#821a1d' }}>₹{item.price * item.quantity}</p>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', border: '1px solid #e2e8f0', borderRadius: '14px', overflow: 'hidden' }}>
                      <button onClick={() => dec(item.id)} style={{ width: '44px', height: '44px', background: '#f8fafc', fontWeight: 800, fontSize: '20px' }}>−</button>
                      <span style={{ width: '44px', textAlign: 'center', fontWeight: 900, fontSize: '17px' }}>{item.quantity}</span>
                      <button onClick={() => add(item)} style={{ width: '44px', height: '44px', background: '#f8fafc', fontWeight: 800, fontSize: '20px' }}>+</button>
                    </div>
                  </div>
                ))}

                <div style={{ marginTop: '20px' }}>
                   <p style={{ fontSize: '14px', fontWeight: 800, color: '#64748b', marginBottom: '8px' }}>Cooking Instructions</p>
                   <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="E.g. Make it extra spicy, No onions, etc."
                    style={{ width: '100%', padding: '14px', border: '1px solid #e2e8f0', borderRadius: '16px', fontSize: '14px', height: '80px', outline: 'none', background: '#f8fafc', resize: 'none' }} />
                </div>
              </div>

              <div style={{ padding: '24px', borderTop: '1px solid #f1f5f9', background: '#fff' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
                  <span style={{ fontSize: '16px', fontWeight: 700, color: '#64748b' }}>Subtotal Amount</span>
                  <span style={{ fontSize: '26px', fontWeight: 900 }}>₹{total.toFixed(2)}</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '12px' }}>
                  <button onClick={() => { setOrder([]); setNotes(''); setShowCart(false); }} 
                    style={{ background: '#f1f5f9', color: '#1e293b', borderRadius: '16px', padding: '18px', fontSize: '15px', fontWeight: 800 }}>CLEAR</button>
                  <button disabled={sending || !order.length} onClick={submit}
                    style={{ 
                      background: '#821a1d', color: '#fff', borderRadius: '16px', padding: '18px', 
                      fontSize: '15px', fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', 
                      boxShadow: '0 8px 20px rgba(130,26,29,0.2)', opacity: sending ? 0.7 : 1 
                    }}>
                    {sending ? 'PROCESSING...' : 'SEND & PRINT KOT'}<SendHorizontal size={20} />
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Success Modal */}
      <AnimatePresence>
        {sent && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
            <motion.div initial={{ scale: 0.8, y: 20 }} animate={{ scale: 1, y: 0 }} style={{ background: '#fff', borderRadius: '32px', padding: '48px 32px', textAlign: 'center', boxShadow: '0 25px 50px rgba(0,0,0,0.3)', width: '85%', maxWidth: '380px' }}>
              <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
                <CheckCircle2 size={48} color="#22c55e" />
              </div>
              <h3 style={{ fontSize: '24px', fontWeight: 900, color: '#1e293b' }}>KOT Successful!</h3>
              <p style={{ fontSize: '15px', color: '#64748b', marginTop: '10px', lineHeight: 1.5 }}>The order has been sent to the kitchen and the printer has been triggered.</p>
              <div style={{ marginTop: '24px', fontSize: '13px', fontWeight: 700, color: '#821a1d' }}>Redirecting to tables...</div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default App;
