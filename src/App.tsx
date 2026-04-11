import { useState, useMemo, useEffect } from 'react';
import { Search, ChevronLeft, X, SendHorizontal, CheckCircle2, ShoppingCart } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { TABLES, MENU_ITEMS } from './data/mockData';
import type { MenuItem, OrderItem } from './data/mockData';
import './index.css';

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
  const [tableId, setTableId] = useState<string | null>(null);
  const [category, setCategory] = useState('All');
  const [search, setSearch] = useState('');
  const [order, setOrder] = useState<OrderItem[]>([]);
  const [notes, setNotes] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [showCart, setShowCart] = useState(false);
  const isMobile = useIsMobile();

  const table = TABLES.find(t => t.id === tableId);
  const categories = ['All', ...Array.from(new Set(MENU_ITEMS.map(i => i.category)))];

  const items = useMemo(() =>
    MENU_ITEMS.filter(i =>
      (category === 'All' || i.category === category) &&
      i.name.toLowerCase().includes(search.toLowerCase())
    ), [category, search]);

  const add = (m: MenuItem) =>
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
      const res = await fetch('https://tyde-cafe-pos.vercel.app/api/orders', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ table_number: table.number, items: order.map(i => ({ name: i.name, quantity: i.quantity, price: i.price })), notes }),
      });
      if (res.ok) {
        setSent(true);
        setTimeout(() => { setSent(false); setOrder([]); setNotes(''); setTableId(null); setShowCart(false); }, 2000);
      } else alert('Failed. Retry.');
    } catch { alert('Network error.'); }
    finally { setSending(false); }
  };

  const reset = () => { setTableId(null); setOrder([]); setNotes(''); setShowCart(false); setCategory('All'); setSearch(''); };

  // ══════ TABLE SELECTION ══════
  if (!table) {
    return (
      <div style={{ minHeight: '100vh', background: '#f0f4f8' }}>
        <div style={{ background: '#821a1d', color: '#fff', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: 800, fontSize: '16px' }}>TYDE POS — Captain</span>
        </div>
        <div style={{ padding: '20px 16px 10px' }}>
          <p style={{ fontSize: '18px', fontWeight: 800 }}>Select Table</p>
          <p style={{ fontSize: '13px', color: '#64748b', marginTop: '2px' }}>Tap a table to start taking order</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', padding: '10px 16px' }}>
          {TABLES.map(t => (
            <button key={t.id} onClick={() => setTableId(t.id)} style={{
              background: '#fff', border: t.status === 'occupied' ? '2px solid #821a1d' : '1px solid #e2e8f0',
              borderRadius: '12px', padding: '18px 10px', textAlign: 'center',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px',
            }}>
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
        {/* Header */}
        <div style={{ background: '#821a1d', color: '#fff', padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button onClick={reset} style={{ color: '#fff', display: 'flex' }}><ChevronLeft size={22} /></button>
            <span style={{ fontWeight: 800, fontSize: '15px' }}>Table {table.number}</span>
          </div>
          <button onClick={reset} style={{ color: '#fff', background: 'rgba(255,255,255,0.15)', borderRadius: '8px', padding: '5px 12px', fontSize: '12px', fontWeight: 700 }}>Close</button>
        </div>

        {/* Search */}
        <div style={{ padding: '10px 12px', background: '#fff', borderBottom: '1px solid #e2e8f0', flexShrink: 0 }}>
          <div style={{ position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search menu..."
              style={{ width: '100%', padding: '10px 10px 10px 34px', border: '1px solid #e2e8f0', borderRadius: '10px', fontSize: '14px', outline: 'none', background: '#f8fafc' }} />
          </div>
        </div>

        {/* Horizontal category tabs */}
        <div style={{ display: 'flex', gap: '6px', padding: '10px 12px', background: '#fff', borderBottom: '1px solid #e2e8f0', overflowX: 'auto', flexShrink: 0 }} className="hide-scrollbar">
          {categories.map(c => (
            <button key={c} onClick={() => setCategory(c)} style={{
              padding: '8px 16px', borderRadius: '20px', fontSize: '13px', fontWeight: 700, whiteSpace: 'nowrap',
              background: category === c ? '#821a1d' : '#f1f5f9',
              color: category === c ? '#fff' : '#64748b',
            }}>{c}</button>
          ))}
        </div>

        {/* Menu items grid - FULL WIDTH */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '10px 12px' }} className="hide-scrollbar">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
            {items.map(item => {
              const qty = getQty(item.id);
              return (
                <div key={item.id} style={{
                  background: '#fff', borderRadius: '10px', padding: '12px', border: qty > 0 ? '2px solid #821a1d' : '1px solid #eef2f6',
                  position: 'relative', display: 'flex', flexDirection: 'column', gap: '6px',
                }}>
                  {/* Veg/Non-veg stripe */}
                  <div style={{ position: 'absolute', left: 0, top: '10px', bottom: '10px', width: '4px', borderRadius: '0 4px 4px 0', background: item.isVeg ? '#22c55e' : '#ef4444' }} />
                  
                  <span style={{ fontSize: '13px', fontWeight: 700, paddingLeft: '8px', lineHeight: 1.3 }}>{item.name}</span>
                  <span style={{ fontSize: '14px', fontWeight: 900, paddingLeft: '8px', color: '#1e293b' }}>₹{item.price}</span>
                  
                  {/* ADD or QTY control */}
                  {qty === 0 ? (
                    <button onClick={() => add(item)} style={{
                      marginTop: '4px', padding: '8px', borderRadius: '8px', fontSize: '13px', fontWeight: 800,
                      color: '#821a1d', border: '1px solid #e2e8f0', background: '#fef2f2', textAlign: 'center',
                    }}>+ ADD</button>
                  ) : (
                    <div style={{ marginTop: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0', border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
                      <button onClick={() => dec(item.id)} style={{ flex: 1, padding: '8px', background: '#f8fafc', fontWeight: 800, fontSize: '16px' }}>−</button>
                      <span style={{ flex: 1, textAlign: 'center', fontWeight: 900, fontSize: '15px', color: '#821a1d' }}>{qty}</span>
                      <button onClick={() => add(item)} style={{ flex: 1, padding: '8px', background: '#f8fafc', fontWeight: 800, fontSize: '16px' }}>+</button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {/* spacer for floating bar */}
          <div style={{ height: '80px' }} />
        </div>

        {/* Floating cart bar at bottom */}
        {totalQty > 0 && !showCart && (
          <motion.button
            initial={{ y: 80 }} animate={{ y: 0 }}
            onClick={() => setShowCart(true)}
            style={{
              position: 'fixed', bottom: '16px', left: '12px', right: '12px',
              background: '#821a1d', color: '#fff', borderRadius: '14px',
              padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              boxShadow: '0 8px 25px rgba(130,26,29,0.45)', zIndex: 30, border: 'none',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ background: 'rgba(255,255,255,0.2)', padding: '3px 10px', borderRadius: '8px', fontSize: '12px', fontWeight: 800 }}>{totalQty} items</span>
              <span style={{ fontSize: '14px', fontWeight: 800 }}>VIEW ORDER</span>
            </div>
            <span style={{ fontSize: '17px', fontWeight: 900 }}>₹{total}</span>
          </motion.button>
        )}

        {/* Slide-up cart panel */}
        <AnimatePresence>
          {showCart && (
            <>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                onClick={() => setShowCart(false)}
                style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 39 }} />
              <motion.div
                initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
                transition={{ type: 'spring', damping: 28, stiffness: 300 }}
                style={{
                  position: 'fixed', bottom: 0, left: 0, right: 0,
                  maxHeight: '85vh', zIndex: 40, background: '#fff',
                  borderTopLeftRadius: '20px', borderTopRightRadius: '20px',
                  boxShadow: '0 -10px 40px rgba(0,0,0,0.15)',
                  display: 'flex', flexDirection: 'column',
                }}
              >
                {/* Drag handle */}
                <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0 4px' }}>
                  <div style={{ width: '36px', height: '4px', borderRadius: '4px', background: '#e2e8f0' }} />
                </div>

                {/* Cart header */}
                <div style={{ padding: '8px 16px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0' }}>
                  <div>
                    <p style={{ fontSize: '16px', fontWeight: 800 }}>Your Order</p>
                    <p style={{ fontSize: '12px', color: '#64748b' }}>Table {table.number} • {totalQty} items</p>
                  </div>
                  <button onClick={() => setShowCart(false)} style={{ padding: '6px' }}><X size={22} color="#64748b" /></button>
                </div>

                {/* Cart items */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }} className="hide-scrollbar">
                  {order.map(item => (
                    <div key={item.id} style={{ display: 'flex', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid #f8fafc', gap: '12px' }}>
                      <div style={{ flex: 1 }}>
                        <p style={{ fontSize: '14px', fontWeight: 700 }}>{item.name}</p>
                        <p style={{ fontSize: '13px', fontWeight: 800, color: '#821a1d' }}>₹{item.price * item.quantity}</p>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
                        <button onClick={() => dec(item.id)} style={{ width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', fontWeight: 700, fontSize: '18px' }}>−</button>
                        <span style={{ width: '36px', textAlign: 'center', fontWeight: 900, fontSize: '15px' }}>{item.quantity}</span>
                        <button onClick={() => add(MENU_ITEMS.find(m => m.id === item.id)!)} style={{ width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', fontWeight: 700, fontSize: '18px' }}>+</button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Notes */}
                <div style={{ padding: '8px 16px', borderTop: '1px solid #e2e8f0' }}>
                  <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Special instructions (optional)..."
                    style={{ width: '100%', padding: '10px 12px', fontSize: '13px', border: '1px solid #e2e8f0', borderRadius: '10px', outline: 'none', background: '#f8fafc' }} />
                </div>

                {/* Total + Actions */}
                <div style={{ padding: '12px 16px', borderTop: '1px solid #e2e8f0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <span style={{ fontSize: '14px', fontWeight: 600, color: '#64748b' }}>Subtotal</span>
                    <span style={{ fontSize: '22px', fontWeight: 900 }}>₹{total.toFixed(2)}</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '8px' }}>
                    <button onClick={() => { setOrder([]); setNotes(''); setShowCart(false); }}
                      style={{ background: '#1e293b', color: '#fff', borderRadius: '12px', padding: '14px', fontSize: '14px', fontWeight: 800, textAlign: 'center' }}>CLEAR</button>
                    <button disabled={sending || !order.length} onClick={submit}
                      style={{ background: '#821a1d', color: '#fff', borderRadius: '12px', padding: '14px', fontSize: '14px', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', opacity: sending ? 0.6 : 1 }}>
                      {sending ? 'SENDING...' : 'SEND KOT'}<SendHorizontal size={18} />
                    </button>
                  </div>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* Success */}
        <AnimatePresence>
          {sent && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
              <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }}
                style={{ background: '#fff', borderRadius: '20px', padding: '36px', textAlign: 'center', boxShadow: '0 20px 60px rgba(0,0,0,0.15)', margin: '0 24px' }}>
                <div style={{ width: '60px', height: '60px', borderRadius: '50%', background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
                  <CheckCircle2 size={32} color="#22c55e" />
                </div>
                <p style={{ fontSize: '20px', fontWeight: 900 }}>KOT Sent!</p>
                <p style={{ fontSize: '13px', color: '#64748b', marginTop: '4px' }}>Order sent to kitchen</p>
              </motion.div>
            </motion.div>
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
          <span style={{ fontSize: '11px', opacity: 0.7 }}>Dine In</span>
        </div>
        <button onClick={reset} style={{ color: '#fff', background: 'rgba(255,255,255,0.15)', borderRadius: '8px', padding: '6px 14px', fontSize: '13px', fontWeight: 700 }}>Close</button>
      </div>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* LEFT: Categories + Menu */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ padding: '10px 12px', background: '#fff', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
            <p style={{ fontWeight: 800, fontSize: '14px', whiteSpace: 'nowrap' }}>{category === 'All' ? 'All Items' : category}</p>
            <div style={{ flex: 1, position: 'relative' }}>
              <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search anything..."
                style={{ width: '100%', padding: '9px 10px 9px 34px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '13px', outline: 'none', background: '#f8fafc' }} />
            </div>
          </div>
          <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
            {/* Category sidebar */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', background: '#fff', borderRight: '1px solid #e2e8f0', overflowY: 'auto', minWidth: '120px', maxWidth: '140px', padding: '8px 0', flexShrink: 0 }} className="hide-scrollbar">
              {categories.map(c => (
                <button key={c} onClick={() => setCategory(c)} style={{
                  padding: '12px 16px', fontSize: '13px', fontWeight: category === c ? 800 : 500,
                  color: category === c ? '#821a1d' : '#64748b', textAlign: 'left',
                  background: category === c ? '#fef2f2' : 'transparent',
                  borderLeft: category === c ? '3px solid #821a1d' : '3px solid transparent',
                }}>{c}</button>
              ))}
            </div>
            {/* Menu grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '10px', padding: '12px', alignContent: 'start', overflowY: 'auto', flex: 1 }} className="hide-scrollbar">
              {items.map(item => (
                <button key={item.id} onClick={() => add(item)} style={{
                  background: '#fff', borderRadius: '10px', padding: '14px', border: '1px solid #eef2f6',
                  cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '4px',
                  position: 'relative', minHeight: '90px', textAlign: 'left',
                }}>
                  <div style={{ position: 'absolute', left: 0, top: '12px', bottom: '12px', width: '4px', borderRadius: '0 4px 4px 0', background: item.isVeg ? '#22c55e' : '#ef4444' }} />
                  <span style={{ fontSize: '13px', fontWeight: 700, paddingLeft: '8px', lineHeight: 1.3 }}>{item.name}</span>
                  <span style={{ fontSize: '14px', fontWeight: 900, paddingLeft: '8px', marginTop: 'auto' }}>₹{item.price}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT: Order Panel */}
        <div style={{ width: '300px', minWidth: '300px', borderLeft: '1px solid #e2e8f0', background: '#fff', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div><p style={{ fontSize: '14px', fontWeight: 800 }}>Table {table.number}</p><p style={{ fontSize: '11px', color: '#64748b' }}>Dine In</p></div>
            <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>{totalQty} items</span>
          </div>
          <div style={{ display: 'flex', padding: '8px 16px', borderBottom: '1px solid #e2e8f0', fontSize: '10px', fontWeight: 800, color: '#94a3b8', letterSpacing: '0.05em' }}>
            <span style={{ flex: 1 }}>ITEMS</span><span style={{ width: '100px', textAlign: 'center' }}>QTY.</span><span style={{ width: '65px', textAlign: 'right' }}>PRICE</span>
          </div>
          <div style={{ flex: 1, overflowY: 'auto' }} className="hide-scrollbar">
            {order.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#cbd5e1' }}>
                <ShoppingCart size={40} /><p style={{ marginTop: '12px', fontSize: '13px', fontWeight: 600 }}>No Item Selected</p>
              </div>
            ) : order.map(item => (
              <div key={item.id} style={{ display: 'flex', alignItems: 'center', padding: '10px 16px', borderBottom: '1px solid #f8fafc' }}>
                <span style={{ flex: 1, fontSize: '13px', fontWeight: 600 }}>{item.name}</span>
                <div style={{ display: 'inline-flex', alignItems: 'center', border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden', width: '100px', justifyContent: 'center' }}>
                  <button onClick={() => dec(item.id)} style={{ width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', fontWeight: 700, fontSize: '16px' }}>-</button>
                  <span style={{ width: '32px', textAlign: 'center', fontSize: '14px', fontWeight: 800 }}>{item.quantity}</span>
                  <button onClick={() => add(MENU_ITEMS.find(m => m.id === item.id)!)} style={{ width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', fontWeight: 700, fontSize: '16px' }}>+</button>
                </div>
                <span style={{ width: '65px', textAlign: 'right', fontSize: '13px', fontWeight: 700 }}>₹{item.price * item.quantity}</span>
              </div>
            ))}
          </div>
          {order.length > 0 && (
            <div style={{ padding: '8px 16px', borderTop: '1px solid #e2e8f0' }}>
              <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Order notes (optional)..."
                style={{ width: '100%', padding: '8px 10px', fontSize: '12px', border: '1px solid #e2e8f0', borderRadius: '6px', outline: 'none', background: '#f8fafc' }} />
            </div>
          )}
          <div style={{ padding: '12px 16px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: '#64748b' }}>Subtotal</span>
            <span style={{ fontSize: '18px', fontWeight: 900 }}>₹{total.toFixed(2)}</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', padding: '12px 16px' }}>
            <button onClick={() => { setOrder([]); setNotes(''); }} style={{ background: '#1e293b', color: '#fff', borderRadius: '10px', padding: '14px', fontSize: '14px', fontWeight: 800, textAlign: 'center' }}>CLEAR</button>
            <button disabled={sending || !order.length} onClick={submit}
              style={{ background: '#821a1d', color: '#fff', borderRadius: '10px', padding: '14px', fontSize: '14px', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', opacity: sending || !order.length ? 0.6 : 1 }}>
              {sending ? 'SENDING...' : 'KOT'}<SendHorizontal size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Success */}
      <AnimatePresence>
        {sent && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }}
              style={{ background: '#fff', borderRadius: '20px', padding: '40px', textAlign: 'center', boxShadow: '0 20px 60px rgba(0,0,0,0.15)', minWidth: '260px' }}>
              <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                <CheckCircle2 size={36} color="#22c55e" />
              </div>
              <p style={{ fontSize: '20px', fontWeight: 900 }}>KOT Sent!</p>
              <p style={{ fontSize: '13px', color: '#64748b', marginTop: '4px' }}>Order sent to kitchen counter</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default App;
