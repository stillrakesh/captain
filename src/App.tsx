import { useState, useMemo, useEffect } from 'react';
import { Search, ChevronLeft, X, SendHorizontal, CheckCircle2, ShoppingCart, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import './index.css';

// --- TYPES ---
interface MenuItem {
  id: string;
  name: string;
  price: number;
  category: string;
  isVeg: boolean;
}

interface Table {
  id: string;
  number: string;
  status: 'available' | 'occupied' | 'dirty';
  capacity: number;
}

interface OrderItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
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
  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [tRes, mRes] = await Promise.all([
        fetch(`${BASE_URL}/api/tables`),
        fetch(`${BASE_URL}/api/menu`)
      ]);
      
      if (!tRes.ok || !mRes.ok) throw new Error('Failed to fetch data');

      const tData = await tRes.json();
      const mData = await mRes.json();

      setTables(tData);
      setMenu(mData);
    } catch (err) {
      setError('Connection failed. Please check your internet.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const table = tables.find(t => t.id === tableId);
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
          // Refresh table status after order
          fetchData();
        }, 2000);
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

  // --- LOADING / ERROR STATES ---
  if (loading && !tables.length) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f0f4f8', flexDirection: 'column', gap: '16px' }}>
        <RefreshCw className="animate-spin" size={32} color="#821a1d" />
        <p style={{ fontWeight: 600, color: '#64748b' }}>Syncing with POS System...</p>
      </div>
    );
  }

  if (error && !tables.length) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f0f4f8', flexDirection: 'column', gap: '20px', padding: '20px', textAlign: 'center' }}>
        <p style={{ fontSize: '18px', fontWeight: 800, color: '#1e293b' }}>Offline</p>
        <p style={{ color: '#64748b', maxWidth: '280px' }}>{error}</p>
        <button onClick={fetchData} style={{ background: '#821a1d', color: '#fff', padding: '12px 24px', borderRadius: '12px', fontWeight: 800 }}>RETRY</button>
      </div>
    );
  }

  // ══════ TABLE SELECTION ══════
  if (!table) {
    return (
      <div style={{ minHeight: '100vh', background: '#f0f4f8' }}>
        <div style={{ background: '#821a1d', color: '#fff', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, zIndex: 10 }}>
          <span style={{ fontWeight: 800, fontSize: '16px' }}>TYDE POS — Captain</span>
          <button onClick={fetchData} style={{ color: '#fff', opacity: 0.8 }}><RefreshCw size={20} className={loading ? 'animate-spin' : ''} /></button>
        </div>
        <div style={{ padding: '20px 16px 10px' }}>
          <p style={{ fontSize: '18px', fontWeight: 800 }}>Select Table</p>
          <p style={{ fontSize: '13px', color: '#64748b', marginTop: '2px' }}>Tap a table to start taking order</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', padding: '10px 16px' }}>
          {tables.map(t => (
            <button key={t.id} onClick={() => setTableId(t.id)} style={{
              background: '#fff', border: t.status === 'occupied' ? '2px solid #821a1d' : '1px solid #e2e8f0',
              borderRadius: '12px', padding: '18px 10px', textAlign: 'center',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px',
              transition: 'transform 0.1s active', transform: 'scale(1)'
            }}
            onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.95)'}
            onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1)'}
            >
              <span style={{ fontSize: '26px', fontWeight: 900, color: t.status === 'occupied' ? '#821a1d' : '#1e293b' }}>{t.number}</span>
              <span style={{
                fontSize: '9px', fontWeight: 800, letterSpacing: '0.06em', padding: '2px 8px', borderRadius: '20px',
                background: t.status === 'available' ? '#f0fdf4' : t.status === 'occupied' ? '#fef2f2' : '#fef9c3',
                color: t.status === 'available' ? '#16a34a' : t.status === 'occupied' ? '#dc2626' : '#a16207',
              }}>{t.status === 'available' ? 'VACANT' : t.status === 'occupied' ? 'RUNNING' : 'DIRTY'}</span>
              <span style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 600 }}>{t.capacity} seats</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ══════ MOBILE ORDER VIEW ══════
  if (isMobile) {
    return (
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: '#f0f4f8', overflow: 'hidden' }}>
        <div style={{ background: '#821a1d', color: '#fff', padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button onClick={reset} style={{ color: '#fff', display: 'flex' }}><ChevronLeft size={22} /></button>
            <span style={{ fontWeight: 800, fontSize: '15px' }}>Table {table.number}</span>
          </div>
          <button onClick={reset} style={{ color: '#fff', background: 'rgba(255,255,255,0.15)', borderRadius: '8px', padding: '5px 12px', fontSize: '12px', fontWeight: 700 }}>Close</button>
        </div>

        <div style={{ padding: '10px 12px', background: '#fff', borderBottom: '1px solid #e2e8f0', flexShrink: 0 }}>
          <div style={{ position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search menu..."
              style={{ width: '100%', padding: '10px 10px 10px 34px', border: '1px solid #e2e8f0', borderRadius: '10px', fontSize: '14px', outline: 'none', background: '#f8fafc' }} />
          </div>
        </div>

        <div style={{ display: 'flex', gap: '6px', padding: '10px 12px', background: '#fff', borderBottom: '1px solid #e2e8f0', overflowX: 'auto', flexShrink: 0 }} className="hide-scrollbar">
          {categories.map(c => (
            <button key={c} onClick={() => setCategory(c)} style={{
              padding: '8px 16px', borderRadius: '20px', fontSize: '13px', fontWeight: 700, whiteSpace: 'nowrap',
              background: category === c ? '#821a1d' : '#f1f5f9',
              color: category === c ? '#fff' : '#64748b',
            }}>{c}</button>
          ))}
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '10px 12px' }} className="hide-scrollbar">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
            {items.map(item => {
              const qty = getQty(item.id);
              return (
                <div key={item.id} style={{
                  background: '#fff', borderRadius: '10px', padding: '12px', border: qty > 0 ? '2px solid #821a1d' : '1px solid #eef2f6',
                  position: 'relative', display: 'flex', flexDirection: 'column', gap: '6px',
                }}>
                  <div style={{ position: 'absolute', left: 0, top: '10px', bottom: '10px', width: '4px', borderRadius: '0 4px 4px 0', background: item.isVeg ? '#22c55e' : '#ef4444' }} />
                  <span style={{ fontSize: '13px', fontWeight: 700, paddingLeft: '8px', lineHeight: 1.3 }}>{item.name}</span>
                  <span style={{ fontSize: '14px', fontWeight: 900, paddingLeft: '8px', color: '#1e293b' }}>₹{item.price}</span>
                  {qty === 0 ? (
                    <button onClick={() => add(item)} style={{ marginTop: '4px', padding: '10px', borderRadius: '10px', fontSize: '13px', fontWeight: 800, color: '#821a1d', border: '1px solid #e2e8f0', background: '#fef2f2' }}>+ ADD</button>
                  ) : (
                    <div style={{ marginTop: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #e2e8f0', borderRadius: '10px', overflow: 'hidden' }}>
                      <button onClick={() => dec(item.id)} style={{ flex: 1, padding: '10px', background: '#f8fafc', fontWeight: 800, fontSize: '18px' }}>−</button>
                      <span style={{ flex: 1, textAlign: 'center', fontWeight: 900, fontSize: '15px', color: '#821a1d' }}>{qty}</span>
                      <button onClick={() => add(item)} style={{ flex: 1, padding: '10px', background: '#f8fafc', fontWeight: 800, fontSize: '18px' }}>+</button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <div style={{ height: '80px' }} />
        </div>

        {totalQty > 0 && !showCart && (
          <motion.button initial={{ y: 80 }} animate={{ y: 0 }} onClick={() => setShowCart(true)}
            style={{ position: 'fixed', bottom: '16px', left: '12px', right: '12px', background: '#821a1d', color: '#fff', borderRadius: '16px', padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: '0 8px 30px rgba(130,26,29,0.4)', zIndex: 30, border: 'none' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ background: 'rgba(255,255,255,0.2)', padding: '4px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: 800 }}>{totalQty} items</span>
              <span style={{ fontSize: '15px', fontWeight: 800 }}>VIEW ORDER</span>
            </div>
            <span style={{ fontSize: '18px', fontWeight: 900 }}>₹{total}</span>
          </motion.button>
        )}

        <AnimatePresence>
          {showCart && (
            <>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowCart(false)}
                style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 39, backdropFilter: 'blur(2px)' }} />
              <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 30, stiffness: 300 }}
                style={{ position: 'fixed', bottom: 0, left: 0, right: 0, maxHeight: '85vh', zIndex: 40, background: '#fff', borderTopLeftRadius: '24px', borderTopRightRadius: '24px', display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 4px' }}><div style={{ width: '40px', height: '4px', borderRadius: '4px', background: '#e2e8f0' }} /></div>
                <div style={{ padding: '8px 20px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f1f5f9' }}>
                  <div><p style={{ fontSize: '18px', fontWeight: 800 }}>Review Order</p><p style={{ fontSize: '13px', color: '#64748b' }}>Table {table.number} • {totalQty} items</p></div>
                  <button onClick={() => setShowCart(false)} style={{ padding: '8px' }}><X size={24} color="#64748b" /></button>
                </div>
                <div style={{ flex: 1, overflowY: 'auto' }} className="hide-scrollbar">
                  {order.map(item => (
                    <div key={item.id} style={{ display: 'flex', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid #f8fafc', gap: '12px' }}>
                      <div style={{ flex: 1 }}><p style={{ fontSize: '15px', fontWeight: 700 }}>{item.name}</p><p style={{ fontSize: '14px', fontWeight: 800, color: '#821a1d' }}>₹{item.price * item.quantity}</p></div>
                      <div style={{ display: 'flex', alignItems: 'center', border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden' }}>
                        <button onClick={() => dec(item.id)} style={{ width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', fontWeight: 700, fontSize: '20px' }}>−</button>
                        <span style={{ width: '40px', textAlign: 'center', fontWeight: 900, fontSize: '16px' }}>{item.quantity}</span>
                        <button onClick={() => add(item)} style={{ width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', fontWeight: 700, fontSize: '20px' }}>+</button>
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{ padding: '12px 20px', borderTop: '1px solid #f1f5f9' }}>
                  <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Any special requests? (e.g. less spicy)"
                    style={{ width: '100%', padding: '12px 14px', fontSize: '14px', border: '1px solid #e2e8f0', borderRadius: '12px', outline: 'none', background: '#f8fafc' }} />
                </div>
                <div style={{ padding: '16px 20px 24px', borderTop: '1px solid #f1f5f9' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}><span style={{ fontSize: '15px', fontWeight: 600, color: '#64748b' }}>Estimated Total</span><span style={{ fontSize: '24px', fontWeight: 900 }}>₹{total.toFixed(2)}</span></div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '10px' }}>
                    <button onClick={() => { setOrder([]); setNotes(''); setShowCart(false); }} style={{ background: '#1e293b', color: '#fff', borderRadius: '14px', padding: '16px', fontSize: '15px', fontWeight: 800 }}>CLEAR</button>
                    <button disabled={sending || !order.length} onClick={submit}
                      style={{ background: '#821a1d', color: '#fff', borderRadius: '14px', padding: '16px', fontSize: '15px', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', opacity: sending ? 0.7 : 1 }}>
                      {sending ? 'PLACING...' : 'CONFIRM KOT'}<SendHorizontal size={20} />
                    </button>
                  </div>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // ══════ DESKTOP ORDER VIEW ══════
  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#f0f4f8' }}>
      <div style={{ background: '#821a1d', color: '#fff', padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button onClick={reset} style={{ color: '#fff', display: 'flex' }}><ChevronLeft size={22} /></button>
          <span style={{ fontWeight: 800, fontSize: '15px' }}>Table {table.number}</span>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
           <button onClick={fetchData} style={{ color: '#fff', opacity: 0.8 }}><RefreshCw size={20} className={loading ? 'animate-spin' : ''} /></button>
           <button onClick={reset} style={{ color: '#fff', background: 'rgba(255,255,255,0.15)', borderRadius: '8px', padding: '6px 14px', fontSize: '13px', fontWeight: 700 }}>Close</button>
        </div>
      </div>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ padding: '10px 12px', background: '#fff', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
            <p style={{ fontWeight: 800, fontSize: '14px', whiteSpace: 'nowrap' }}>{category === 'All' ? 'All Items' : category}</p>
            <div style={{ flex: 1, position: 'relative' }}>
              <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search menu..."
                style={{ width: '100%', padding: '9px 10px 9px 34px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '13px', outline: 'none', background: '#f8fafc' }} />
            </div>
          </div>
          <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', background: '#fff', borderRight: '1px solid #e2e8f0', overflowY: 'auto', minWidth: '140px', maxWidth: '160px', padding: '8px 0' }} className="hide-scrollbar">
              {categories.map(c => (
                <button key={c} onClick={() => setCategory(c)} style={{ padding: '14px 20px', fontSize: '13px', fontWeight: category === c ? 800 : 500, color: category === c ? '#821a1d' : '#64748b', textAlign: 'left', background: category === c ? '#fef2f2' : 'transparent', borderLeft: category === c ? '4px solid #821a1d' : '4px solid transparent' }}>{c}</button>
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '12px', padding: '16px', alignContent: 'start', overflowY: 'auto', flex: 1 }} className="hide-scrollbar">
              {items.map(item => (
                <button key={item.id} onClick={() => add(item)} style={{ background: '#fff', borderRadius: '12px', padding: '16px', border: '1px solid #eef2f6', display: 'flex', flexDirection: 'column', gap: '6px', position: 'relative', minHeight: '100px', textAlign: 'left', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}>
                  <div style={{ position: 'absolute', left: 0, top: '15px', bottom: '15px', width: '4px', borderRadius: '0 4px 4px 0', background: item.isVeg ? '#22c55e' : '#ef4444' }} />
                  <span style={{ fontSize: '14px', fontWeight: 700, paddingLeft: '10px', lineHeight: 1.4 }}>{item.name}</span>
                  <span style={{ fontSize: '16px', fontWeight: 900, paddingLeft: '10px', marginTop: 'auto', color: '#1e293b' }}>₹{item.price}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div style={{ width: '340px', minWidth: '340px', borderLeft: '1px solid #e2e8f0', background: '#fff', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div><p style={{ fontSize: '16px', fontWeight: 800 }}>Table {table.number}</p><p style={{ fontSize: '12px', color: '#64748b' }}>KOT Dashboard</p></div>
            <span style={{ fontSize: '13px', background: '#f1f5f9', padding: '4px 10px', borderRadius: '8px', color: '#64748b', fontWeight: 700 }}>{totalQty} items</span>
          </div>
          <div style={{ display: 'flex', padding: '10px 20px', borderBottom: '1px solid #e2e8f0', fontSize: '11px', fontWeight: 800, color: '#94a3b8', letterSpacing: '0.05em' }}>
            <span style={{ flex: 1 }}>ITEM NAME</span><span style={{ width: '100px', textAlign: 'center' }}>QTY.</span><span style={{ width: '70px', textAlign: 'right' }}>PRICE</span>
          </div>
          <div style={{ flex: 1, overflowY: 'auto' }} className="hide-scrollbar">
            {order.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#cbd5e1', padding: '40px' }}>
                <ShoppingCart size={48} /><p style={{ marginTop: '16px', fontSize: '15px', fontWeight: 600, textAlign: 'center' }}>Select items from the menu to build your KOT</p>
              </div>
            ) : order.map(item => (
              <div key={item.id} style={{ display: 'flex', alignItems: 'center', padding: '12px 20px', borderBottom: '1px solid #f8fafc' }}>
                <span style={{ flex: 1, fontSize: '14px', fontWeight: 600 }}>{item.name}</span>
                <div style={{ display: 'inline-flex', alignItems: 'center', border: '1px solid #e2e8f0', borderRadius: '10px', overflow: 'hidden', width: '100px', justifyContent: 'center' }}>
                  <button onClick={() => dec(item.id)} style={{ width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', fontWeight: 800 }}>-</button>
                  <span style={{ width: '36px', textAlign: 'center', fontSize: '14px', fontWeight: 800 }}>{item.quantity}</span>
                  <button onClick={() => add(item)} style={{ width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', fontWeight: 800 }}>+</button>
                </div>
                <span style={{ width: '70px', textAlign: 'right', fontSize: '14px', fontWeight: 700 }}>₹{item.price * item.quantity}</span>
              </div>
            ))}
          </div>
          {order.length > 0 && (
            <div style={{ padding: '12px 20px', borderTop: '1px solid #e2e8f0' }}>
              <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Add cooking instructions..."
                style={{ width: '100%', padding: '10px 14px', fontSize: '13px', border: '1px solid #e2e8f0', borderRadius: '8px', outline: 'none', background: '#f8fafc' }} />
            </div>
          )}
          <div style={{ padding: '16px 20px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '14px', fontWeight: 600, color: '#64748b' }}>Total Value</span>
            <span style={{ fontSize: '22px', fontWeight: 900 }}>₹{total.toFixed(2)}</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', padding: '16px 20px 24px' }}>
            <button onClick={() => { setOrder([]); setNotes(''); }} style={{ background: '#1e293b', color: '#fff', borderRadius: '12px', padding: '16px', fontSize: '15px', fontWeight: 800 }}>CLEAR</button>
            <button disabled={sending || !order.length} onClick={submit}
              style={{ background: '#821a1d', color: '#fff', borderRadius: '12px', padding: '16px', fontSize: '15px', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
              {sending ? 'PLACING...' : 'PLACE KOT'}<SendHorizontal size={18} />
            </button>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {(sent || sending) && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} style={{ background: '#fff', borderRadius: '24px', padding: '48px', textAlign: 'center', boxShadow: '0 20px 60px rgba(0,0,0,0.2)', minWidth: '320px' }}>
              {sending ? (
                <><RefreshCw className="animate-spin" size={48} color="#821a1d" style={{ margin: '0 auto 20px' }} /><p style={{ fontSize: '20px', fontWeight: 900 }}>Sending KOT...</p></>
              ) : (
                <><div style={{ width: '72px', height: '72px', borderRadius: '50%', background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}><CheckCircle2 size={40} color="#22c55e" /></div><p style={{ fontSize: '24px', fontWeight: 900 }}>KOT Sent!</p><p style={{ fontSize: '14px', color: '#64748b', marginTop: '8px' }}>The kitchen has received the order for Table {table?.number || ''}</p></>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default App;
