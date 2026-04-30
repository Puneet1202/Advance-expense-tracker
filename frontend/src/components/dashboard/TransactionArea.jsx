import { useState } from 'react';
import api from '../../api/axios';

const fmt    = n => Number(n||0).toLocaleString('en-IN');
const fmtDate = s => new Date(s).toLocaleDateString('en-IN',{day:'numeric',month:'short'});

export default function TransactionArea({ trackerData, fetchTrackerData,
  selectedAccountId, setSelectedAccountId, currentMonth }) {

  const { total_income, total_expenses, expense_limit, is_saving_mode, transactions, accounts } = trackerData;
  const [form, setForm] = useState({ type:'expense', amount:'', description:'', account_id:'' });
  const [busy, setBusy] = useState(false);
  const [typeFilter, setTypeFilter] = useState('all');
  const [search, setSearch] = useState('');

  const set = (k,v) => setForm(f=>({...f,[k]:v}));
  const net = total_income - total_expenses;
  const pct = expense_limit>0 ? Math.min((total_expenses/expense_limit)*100,100) : 0;

  const barColor = pct>=100 ? 'var(--red)' : pct>=80 ? 'var(--orange)' : 'var(--green)';

  const addTxn = async (e) => {
    e.preventDefault(); setBusy(true);
    try {
      await api.post('/tracker/transaction',{
        type:form.type, amount:Number(form.amount),
        description:form.description,
        account_id:form.account_id?Number(form.account_id):null
      });
      setForm({type:form.type,amount:'',description:'',account_id:''});
      fetchTrackerData();
    } catch(err){ alert(err.response?.data?.message||'Failed'); }
    finally { setBusy(false); }
  };

  const delTxn = async (id) => {
    if(!window.confirm('Remove this transaction?')) return;
    await api.delete(`/tracker/transaction/${id}`);
    fetchTrackerData();
  };

  const filtered = transactions.filter(t=>{
    if(selectedAccountId && t.account_id!==selectedAccountId) return false;
    if(typeFilter!=='all' && t.type!==typeFilter) return false;
    if(search && !t.description?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const statCards = [
    { label:'Income',    value:total_income,   color:'var(--green)',  bg:'var(--green-bg)',  border:'var(--green-border)',  icon:'↑' },
    { label:'Expenses',  value:total_expenses,  color:'var(--red)',    bg:'var(--red-bg)',    border:'var(--red-border)',    icon:'↓' },
    { label:'Net',       value:Math.abs(net),   color: net<0?'var(--red)':'var(--accent)',
      bg:'var(--accent-glow)', border:'rgba(91,91,214,0.22)',
      icon: net<0?'↓':'↑', prefix: net<0?'-':'+' },
  ];

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>

      {/* Stat cards */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'12px' }}>
        {statCards.map((c,i)=>(
          <div key={c.label} className={`card anim-up d${i+1}`} style={{
            padding:'1.25rem', border:`1.5px solid ${c.border}`,
            background: c.bg, boxShadow:'none'
          }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'10px' }}>
              <span style={{ fontSize:'0.72rem', fontWeight:600, color:'var(--text-3)',
                letterSpacing:'0.04em', textTransform:'uppercase' }}>{c.label}</span>
              <span style={{
                width:'26px', height:'26px', borderRadius:'8px',
                background:'var(--surface)', display:'flex', alignItems:'center',
                justifyContent:'center', fontSize:'0.85rem', fontWeight:700,
                color: c.color, boxShadow:'var(--shadow-sm)'
              }}>{c.icon}</span>
            </div>
            <p className="num" style={{ fontSize:'1.5rem', fontWeight:800,
              color:'var(--text-1)', letterSpacing:'-0.04em' }}>
              {c.prefix||''}₹{fmt(c.value)}
            </p>
          </div>
        ))}
      </div>

      {/* Budget bar */}
      {is_saving_mode && expense_limit>0 && (
        <div className="card anim-up d4" style={{ padding:'1.25rem' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'10px' }}>
            <div>
              <p style={{ fontWeight:600, fontSize:'0.84rem', color:'var(--text-1)', letterSpacing:'-0.02em' }}>
                Budget limit — <span className="num" style={{color:barColor}}>₹{fmt(expense_limit)}</span>
              </p>
              {pct>=80 && <p style={{ fontSize:'0.75rem', color:barColor, marginTop:'3px', fontWeight:500 }}>
                {pct>=100 ? '⚠ Over budget!' : '⚠ Approaching limit'}
              </p>}
            </div>
            <span style={{ fontSize:'0.82rem', fontWeight:700, color:barColor }}>{pct.toFixed(0)}%</span>
          </div>
          <div className="progress-track">
            <div className="progress-fill" style={{ width:`${pct}%`, background:barColor }}/>
          </div>
        </div>
      )}

      {/* Form + History */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1.6fr', gap:'12px', alignItems:'start' }}>

        {/* Add Transaction */}
        <div className="card anim-up d3" style={{ padding:'1.5rem' }}>
          <p style={{ fontWeight:700, fontSize:'0.875rem', letterSpacing:'-0.03em',
            marginBottom:'1.25rem', color:'var(--text-1)' }}>Add Transaction</p>

          <form onSubmit={addTxn} style={{ display:'flex', flexDirection:'column', gap:'12px' }}>

            {/* Type toggle */}
            <div style={{
              display:'grid', gridTemplateColumns:'1fr 1fr', gap:'5px',
              background:'var(--bg-3)', borderRadius:'12px', padding:'4px',
              border:'1px solid var(--border)'
            }}>
              {['expense','income'].map(t=>(
                <button key={t} type="button" onClick={()=>set('type',t)}
                  style={{
                    padding:'9px', borderRadius:'9px', border:'none',
                    fontFamily:'inherit', fontWeight:700, fontSize:'0.82rem',
                    cursor:'pointer', transition:'all 0.2s ease',
                    background: form.type===t
                      ? (t==='expense'?'var(--red)':'var(--green)')
                      : 'transparent',
                    color: form.type===t ? '#fff' : 'var(--text-3)',
                    boxShadow: form.type===t ? 'var(--shadow-sm)' : 'none'
                  }}
                >{t==='expense' ? '↓ Expense' : '↑ Income'}</button>
              ))}
            </div>

            <input type="text" className="field" placeholder="Description (optional)"
              value={form.description} onChange={e=>set('description',e.target.value)}
              style={{ fontSize:'0.85rem' }}/>

            <div style={{ position:'relative' }}>
              <span style={{
                position:'absolute', left:'14px', top:'50%', transform:'translateY(-50%)',
                color:'var(--text-3)', fontWeight:600, fontSize:'0.9rem'
              }}>₹</span>
              <input type="number" className="field" placeholder="0"
                value={form.amount} onChange={e=>set('amount',e.target.value)}
                min="1" required
                style={{ paddingLeft:'28px', fontSize:'1rem', fontWeight:700, letterSpacing:'-0.02em' }}/>
            </div>

            <select className="field" value={form.account_id}
              onChange={e=>set('account_id',e.target.value)} required
              style={{ fontSize:'0.85rem' }}>
              <option value="" disabled>Select account</option>
              {accounts.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}
            </select>

            <button type="submit" disabled={busy}
              className={`btn ${form.type==='income'?'btn-green':'btn-red'}`}
              style={{ width:'100%', padding:'12px', borderRadius:'12px', fontSize:'0.875rem', opacity:busy?0.6:1 }}>
              {busy ? 'Adding…' : `Add ${form.type==='income'?'income':'expense'}${form.amount?' — ₹'+Number(form.amount).toLocaleString('en-IN'):''}`}
            </button>
          </form>
        </div>

        {/* History */}
        <div className="card anim-up d4" style={{ padding:'1.5rem', minHeight:'480px', display:'flex', flexDirection:'column' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1rem' }}>
            <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
              <p style={{ fontWeight:700, fontSize:'0.875rem', letterSpacing:'-0.03em', color:'var(--text-1)' }}>
                {selectedAccountId
                  ? `${accounts.find(a=>a.id===selectedAccountId)?.name||''}`
                  : 'Transactions'}
              </p>
              <span className="badge badge-accent">{filtered.length}</span>
            </div>
            {selectedAccountId && (
              <button className="btn btn-ghost" onClick={()=>setSelectedAccountId(null)}
                style={{ padding:'5px 10px', fontSize:'0.76rem' }}>All</button>
            )}
          </div>

          {/* Filters */}
          <div style={{ display:'flex', gap:'8px', marginBottom:'12px', flexWrap:'wrap' }}>
            <div style={{ display:'flex', background:'var(--bg-3)', borderRadius:'10px',
              padding:'3px', gap:'3px', border:'1px solid var(--border)' }}>
              {['all','income','expense'].map(f=>(
                <button key={f} type="button" onClick={()=>setTypeFilter(f)}
                  style={{
                    padding:'5px 12px', borderRadius:'8px', border:'none',
                    fontFamily:'inherit', fontWeight:600, fontSize:'0.76rem',
                    cursor:'pointer', transition:'all 0.18s',
                    background: typeFilter===f ? 'var(--surface)' : 'transparent',
                    color: typeFilter===f ? 'var(--accent)' : 'var(--text-3)',
                    boxShadow: typeFilter===f ? 'var(--shadow-sm)' : 'none'
                  }}
                >{f==='all'?'All':f==='income'?'Income':'Expense'}</button>
              ))}
            </div>

            <div style={{ flex:1, minWidth:'120px' }}>
              <input type="text" className="field" placeholder="Search…"
                value={search} onChange={e=>setSearch(e.target.value)}
                style={{ padding:'7px 12px', fontSize:'0.82rem' }}/>
            </div>

            {(typeFilter!=='all'||search) && (
              <button className="btn btn-ghost"
                onClick={()=>{setTypeFilter('all');setSearch('');}}
                style={{ padding:'7px 12px', fontSize:'0.78rem', color:'var(--red)' }}>✕</button>
            )}
          </div>

          {/* List */}
          <div style={{ flex:1, overflowY:'auto', display:'flex', flexDirection:'column', gap:'6px' }}>
            {filtered.length===0 ? (
              <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center',
                justifyContent:'center', color:'var(--text-4)', gap:'8px' }}>
                <span style={{ fontSize:'2rem' }}>🔍</span>
                <p style={{ fontSize:'0.84rem', fontWeight:500 }}>No transactions found</p>
              </div>
            ) : filtered.map((t,i)=>(
              <div key={t.id} className="anim-up"
                style={{
                  display:'flex', alignItems:'center', justifyContent:'space-between',
                  padding:'11px 13px', borderRadius:'12px',
                  background:'var(--surface-2)', border:'1px solid var(--border)',
                  transition:'background 0.18s, border-color 0.18s',
                  animationDelay:`${i*0.02}s`
                }}
                onMouseEnter={e=>{e.currentTarget.style.background='var(--bg-4)';e.currentTarget.style.borderColor='var(--border-2)';}}
                onMouseLeave={e=>{e.currentTarget.style.background='var(--surface-2)';e.currentTarget.style.borderColor='var(--border)';}}
              >
                <div style={{ display:'flex', alignItems:'center', gap:'11px', minWidth:0 }}>
                  <div style={{
                    width:'34px', height:'34px', borderRadius:'10px', flexShrink:0,
                    display:'flex', alignItems:'center', justifyContent:'center', fontSize:'0.9rem',
                    background: t.type==='income' ? 'var(--green-bg)' : 'var(--red-bg)',
                    border: `1px solid ${t.type==='income'?'var(--green-border)':'var(--red-border)'}`,
                  }}>
                    {t.type==='income'?'↑':'↓'}
                  </div>
                  <div style={{ minWidth:0 }}>
                    <p style={{ fontWeight:600, fontSize:'0.84rem', color:'var(--text-1)',
                      whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                      {t.description||'No description'}
                    </p>
                    <p style={{ fontSize:'0.72rem', color:'var(--text-4)', marginTop:'2px' }}>
                      <span style={{
                        background:'var(--bg-4)', padding:'1px 7px', borderRadius:'6px',
                        marginRight:'5px', color:'var(--text-3)', fontWeight:500
                      }}>{t.account_name||'General'}</span>
                      {fmtDate(t.created_at)}
                    </p>
                  </div>
                </div>

                <div style={{ display:'flex', alignItems:'center', gap:'10px', flexShrink:0 }}>
                  <span className="num" style={{
                    fontWeight:800, fontSize:'0.88rem', letterSpacing:'-0.03em',
                    color: t.type==='income'?'var(--green)':'var(--red)'
                  }}>
                    {t.type==='income'?'+':'-'}₹{fmt(t.amount)}
                  </span>
                  <button type="button" onClick={()=>delTxn(t.id)}
                    style={{
                      background:'none', border:'none', cursor:'pointer',
                      color:'var(--text-4)', fontSize:'0.82rem', padding:'4px',
                      borderRadius:'6px', transition:'color 0.2s', lineHeight:1
                    }}
                    onMouseEnter={e=>e.currentTarget.style.color='var(--red)'}
                    onMouseLeave={e=>e.currentTarget.style.color='var(--text-4)'}
                  >✕</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
