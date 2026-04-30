import { useState } from 'react';
import api from '../../api/axios';

const ICONS = { cash:'💵', upi:'📱', gpay:'📱', phonepe:'📱', hdfc:'🏦', sbi:'🏦',
  bank:'🏦', axis:'🏦', card:'💳', credit:'💳', debit:'💳', wallet:'👝' };
const getIcon = (name='') => {
  const n = name.toLowerCase();
  return Object.entries(ICONS).find(([k])=>n.includes(k))?.[1] ?? '💰';
};
const fmt = n => Number(n||0).toLocaleString('en-IN');

export default function Sidebar({ trackerData, fetchTrackerData, selectedAccountId, setSelectedAccountId }) {
  const { is_saving_mode, expense_limit, accounts } = trackerData;
  const [accName, setAccName]     = useState('');
  const [limitVal, setLimitVal]   = useState(expense_limit||'');
  const [addingAcc, setAddingAcc] = useState(false);
  const [transferModal, setTransferModal] = useState(null);

  const totalBal = accounts.reduce((s,a)=>s+(a.balance||0),0);

  const toggleSaving = async () => {
    await api.post('/tracker/settings', { expense_limit:Number(limitVal), is_saving_mode:!is_saving_mode });
    fetchTrackerData();
  };
  const saveLimit = async (e) => {
    e.preventDefault();
    await api.post('/tracker/settings', { expense_limit:Number(limitVal), is_saving_mode });
    fetchTrackerData();
  };
  const addAcc = async (e) => {
    e.preventDefault(); if(!accName.trim()) return;
    setAddingAcc(true);
    try { await api.post('/tracker/account',{name:accName}); setAccName(''); fetchTrackerData(); }
    catch { alert('Failed'); } finally { setAddingAcc(false); }
  };
  const delAcc = async (id, name, ok=false, transferTo=null, autoName=null) => {
    if(!ok && !window.confirm(`Delete "${name}"?`)) return;
    try {
      await api.delete(`/tracker/account/${id}`,{data:{transfer_account_id:transferTo,auto_create_account_name:autoName}});
      setTransferModal(null);
      if(selectedAccountId===id) setSelectedAccountId(null);
      fetchTrackerData();
    } catch(err) {
      if(err.response?.data?.message==='BALANCE_REMAINING') {
        const others = accounts.filter(a=>a.id!==id);
        setTransferModal({id,name,balance:err.response.data.balance,others,
          target:others.length>0?others[0].id:'new',newName:''});
      } else alert(err.response?.data?.message||'Failed');
    }
  };

  return (
    <>
      <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>

        {/* Balance card */}
        <div className="card anim-up" style={{
          padding:'1.5rem',
          background:'linear-gradient(135deg, var(--accent) 0%, #7C3AED 100%)',
          border:'none', boxShadow:'0 8px 32px var(--accent-glow)', overflow:'hidden', position:'relative'
        }}>
          <div style={{
            position:'absolute', top:'-30px', right:'-30px', width:'120px', height:'120px',
            borderRadius:'50%', background:'rgba(255,255,255,0.07)', pointerEvents:'none'
          }}/>
          <p style={{ color:'rgba(255,255,255,0.65)', fontSize:'0.72rem', fontWeight:600,
            letterSpacing:'0.06em', textTransform:'uppercase', marginBottom:'8px' }}>
            Total Balance
          </p>
          <p className="num" style={{
            fontSize:'2rem', fontWeight:800, color:'#fff', letterSpacing:'-0.04em', lineHeight:1
          }}>
            ₹{fmt(Math.abs(totalBal))}
            {totalBal < 0 && <span style={{ fontSize:'1rem', marginLeft:'6px', opacity:0.7 }}>deficit</span>}
          </p>
          <p style={{ color:'rgba(255,255,255,0.5)', fontSize:'0.75rem', marginTop:'8px' }}>
            {accounts.length} account{accounts.length!==1?'s':''}
          </p>
        </div>

        {/* Saving mode */}
        <div className="card anim-up d1" style={{ padding:'1.25rem' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
            <div>
              <p style={{ fontWeight:700, fontSize:'0.875rem', color:'var(--text-1)', letterSpacing:'-0.02em' }}>Saving Mode</p>
              <p style={{ fontSize:'0.75rem', color:'var(--text-3)', marginTop:'2px' }}>
                {is_saving_mode ? 'Budget active' : 'Disabled'}
              </p>
            </div>
            <button className={`toggle ${is_saving_mode?'on':''}`} onClick={toggleSaving}/>
          </div>
          {is_saving_mode && (
            <form onSubmit={saveLimit} style={{ display:'flex', gap:'8px', marginTop:'1rem' }}>
              <input type="number" className="field" placeholder="Monthly limit (₹)"
                value={limitVal} onChange={e=>setLimitVal(e.target.value)} required
                style={{ fontSize:'0.85rem' }}/>
              <button type="submit" className="btn btn-accent" style={{ padding:'10px 14px', borderRadius:'10px', flexShrink:0 }}>Save</button>
            </form>
          )}
        </div>

        {/* Accounts */}
        <div className="card anim-up d2" style={{ padding:'1.25rem' }}>
          <p style={{ fontWeight:700, fontSize:'0.875rem', letterSpacing:'-0.02em',
            marginBottom:'1rem', color:'var(--text-1)' }}>Accounts</p>

          <form onSubmit={addAcc} style={{ display:'flex', gap:'8px', marginBottom:'12px' }}>
            <input type="text" className="field" placeholder="e.g. Cash, HDFC, UPI"
              value={accName} onChange={e=>setAccName(e.target.value)} required
              style={{ fontSize:'0.85rem' }}/>
            <button type="submit" className="btn btn-accent"
              disabled={addingAcc}
              style={{ padding:'10px 14px', borderRadius:'10px', flexShrink:0, fontSize:'1.1rem' }}>
              +
            </button>
          </form>

          <div style={{ display:'flex', flexDirection:'column', gap:'6px', maxHeight:'260px', overflowY:'auto' }}>
            {accounts.length===0 ? (
              <div style={{ textAlign:'center', padding:'1.5rem', color:'var(--text-4)', fontSize:'0.82rem' }}>
                No accounts yet
              </div>
            ) : accounts.map(acc => {
              const selected = selectedAccountId===acc.id;
              return (
                <button key={acc.id} type="button"
                  onClick={()=>setSelectedAccountId(selected?null:acc.id)}
                  style={{
                    display:'flex', alignItems:'center', justifyContent:'space-between',
                    padding:'10px 12px', borderRadius:'12px', cursor:'pointer',
                    border: selected ? '1.5px solid var(--accent)' : '1.5px solid var(--border)',
                    background: selected ? 'var(--accent-glow)' : 'var(--bg-3)',
                    transition:'all 0.2s ease', textAlign:'left', width:'100%',
                    fontFamily:'inherit'
                  }}
                >
                  <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
                    <span style={{ fontSize:'1.1rem' }}>{getIcon(acc.name)}</span>
                    <div>
                      <p style={{ fontWeight:600, fontSize:'0.82rem', color:'var(--text-1)' }}>{acc.name}</p>
                      <p className="num" style={{
                        fontSize:'0.78rem', fontWeight:700,
                        color: acc.balance<0 ? 'var(--red)' : 'var(--green)'
                      }}>₹{fmt(Math.abs(acc.balance||0))}{acc.balance<0?' ↓':''}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={e=>{e.stopPropagation();delAcc(acc.id,acc.name);}}
                    style={{
                      background:'none', border:'none', cursor:'pointer',
                      color:'var(--text-4)', fontSize:'0.8rem', padding:'4px',
                      borderRadius:'6px', transition:'color 0.2s'
                    }}
                    onMouseEnter={e=>e.currentTarget.style.color='var(--red)'}
                    onMouseLeave={e=>e.currentTarget.style.color='var(--text-4)'}
                  >✕</button>
                </button>
              );
            })}
          </div>

          {selectedAccountId && (
            <button className="btn btn-ghost" onClick={()=>setSelectedAccountId(null)}
              style={{ width:'100%', marginTop:'8px', fontSize:'0.8rem', padding:'8px' }}>
              Clear filter
            </button>
          )}
        </div>
      </div>

      {/* Transfer Modal */}
      {transferModal && (
        <div className="modal-bg">
          <div className="card anim-card" style={{ maxWidth:'380px', width:'100%', padding:'1.75rem', boxShadow:'var(--shadow-xl)' }}>
            <h3 style={{ fontWeight:700, fontSize:'1rem', letterSpacing:'-0.03em', marginBottom:'0.75rem' }}>Transfer balance</h3>
            <p style={{ color:'var(--text-3)', fontSize:'0.85rem', lineHeight:1.6, marginBottom:'1.25rem' }}>
              <b style={{color:'var(--text-1)'}}>{transferModal.name}</b> has ₹{fmt(transferModal.balance)}.
              {transferModal.others.length>0 ? ' Select where to transfer it:' : ''}
            </p>
            {transferModal.others.length>0 ? (
              <select className="field" style={{ marginBottom:'1.25rem' }}
                value={transferModal.target}
                onChange={e=>setTransferModal({...transferModal,target:Number(e.target.value)})}>
                {transferModal.others.map(a=><option key={a.id} value={a.id}>{a.name} (₹{fmt(a.balance)})</option>)}
              </select>
            ) : (
              <input type="text" className="field" placeholder="New account name"
                style={{ marginBottom:'1.25rem' }}
                value={transferModal.newName}
                onChange={e=>setTransferModal({...transferModal,newName:e.target.value})}/>
            )}
            <div style={{ display:'flex', gap:'10px', justifyContent:'flex-end' }}>
              <button className="btn btn-ghost" onClick={()=>setTransferModal(null)}>Cancel</button>
              <button className="btn btn-red" onClick={()=>{
                const to = transferModal.target==='new'?null:transferModal.target;
                const an = transferModal.target==='new'?transferModal.newName.trim():null;
                if(transferModal.target==='new'&&!an){alert('Enter account name');return;}
                delAcc(transferModal.id,transferModal.name,true,to,an);
              }}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
