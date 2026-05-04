import { useState, useEffect } from 'react';
import { ShieldAlert, AlertTriangle, Clock, WifiOff, UserX, CheckCircle } from 'lucide-react';
import { api } from '../services/api';

const ICONS = { short_duration: Clock, multiple_logins: WifiOff, invalid_format: AlertTriangle, late_pattern: Clock, proxy_suspected: UserX, name_mismatch: AlertTriangle };
const COLORS = { low:{bg:'rgba(148,163,184,0.08)',border:'rgba(148,163,184,0.15)',text:'#94a3b8'}, medium:{bg:'rgba(245,158,11,0.08)',border:'rgba(245,158,11,0.2)',text:'#f59e0b'}, high:{bg:'rgba(239,68,68,0.08)',border:'rgba(239,68,68,0.2)',text:'#ef4444'}, critical:{bg:'rgba(239,68,68,0.12)',border:'rgba(239,68,68,0.3)',text:'#fca5a5'} };

export default function FraudAlerts() {
  const [alerts, setAlerts] = useState([]); const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); const [severityFilter, setSeverityFilter] = useState('all');

  useEffect(() => { api.getFraudAlerts().then(data => { setAlerts(data); setLoading(false); }); }, []);

  const filtered = alerts.filter(a => {
    if (filter==='resolved'&&!a.resolved) return false;
    if (filter==='unresolved'&&a.resolved) return false;
    if (severityFilter!=='all'&&a.severity!==severityFilter) return false;
    return true;
  });

  const counts = { critical: alerts.filter(a=>a.severity==='critical').length, high: alerts.filter(a=>a.severity==='high').length, medium: alerts.filter(a=>a.severity==='medium').length, low: alerts.filter(a=>a.severity==='low').length };

  if(loading) return <div><div className="page-title"><p>Loading fraud alerts...</p></div></div>;

  return (<div>
    <div className="page-title animate-fade-in"><p>AI-detected suspicious behavior · {alerts.filter(a=>!a.resolved).length} unresolved · <span style={{color:'var(--accent-green)'}}>🟢 Live</span></p></div>

    <div className="stats-grid" style={{gridTemplateColumns:'repeat(4,1fr)',marginBottom:24}}>
      {Object.entries(counts).map(([sev,count],i)=>{const c=COLORS[sev];return(
        <div key={sev} className={`stat-card animate-fade-in stagger-${i+1}`} style={{cursor:'pointer',border:severityFilter===sev?`1px solid ${c.text}`:undefined}} onClick={()=>setSeverityFilter(severityFilter===sev?'all':sev)}>
          <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:10}}>
            <div style={{width:10,height:10,borderRadius:'50%',background:c.text,boxShadow:`0 0 8px ${c.text}40`}}/><span style={{fontSize:'0.72rem',textTransform:'uppercase',letterSpacing:'0.8px',color:c.text,fontWeight:600}}>{sev}</span>
          </div><div className="stat-value" style={{color:c.text}}>{count}</div><div className="stat-label">alerts</div>
        </div>);})}
    </div>

    <div className="filters-bar animate-fade-in">
      {['all','unresolved','resolved'].map(f=>(<button key={f} className={`filter-chip ${filter===f?'active':''}`} onClick={()=>setFilter(f)}>{f==='all'?'All':f.charAt(0).toUpperCase()+f.slice(1)}</button>))}
    </div>

    <div style={{display:'flex',flexDirection:'column',gap:12}}>
      {filtered.length===0 ? <div className="card"><div className="empty-state"><CheckCircle size={48} style={{color:'var(--accent-green)',opacity:0.5,marginBottom:12}}/><h3>No alerts</h3><p>No fraud alerts match your filters.</p></div></div> :
       filtered.map((alert,i) => {
        const Icon = ICONS[alert.alert_type]||AlertTriangle;
        const c = COLORS[alert.severity];
        return (<div key={alert.id} className="card animate-fade-in" style={{animationDelay:`${0.05*i}s`,borderLeft:`3px solid ${c.text}`,padding:'18px 24px'}}>
          <div style={{display:'flex',alignItems:'flex-start',gap:16}}>
            <div style={{width:42,height:42,borderRadius:'10px',background:c.bg,border:`1px solid ${c.border}`,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}><Icon size={20} style={{color:c.text}}/></div>
            <div style={{flex:1}}>
              <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:6,flexWrap:'wrap'}}>
                <span style={{fontWeight:600,color:'var(--text-primary)',fontSize:'0.9rem'}}>{alert.student_name}</span>
                <code style={{background:'rgba(59,130,246,0.1)',padding:'2px 8px',borderRadius:'4px',fontSize:'0.72rem',color:'var(--accent-blue)'}}>{alert.matrix_number}</code>
                <span className={`badge badge-${alert.severity}`}>{alert.severity.toUpperCase()}</span>
                <span style={{fontSize:'0.72rem',color:'var(--text-muted)',background:'rgba(255,255,255,0.04)',padding:'2px 8px',borderRadius:'4px'}}>{alert.alert_type.replace(/_/g,' ')}</span>
              </div>
              <p style={{color:'var(--text-secondary)',fontSize:'0.85rem',lineHeight:1.5,marginBottom:8}}>{alert.description}</p>
              <div style={{display:'flex',alignItems:'center',gap:16,fontSize:'0.75rem',color:'var(--text-muted)'}}>
                <span>📚 {alert.session_topic}</span>
                <span>🕐 {new Date(alert.created_at).toLocaleString('en',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})}</span>
                <span>🛡️ Trust: <strong style={{color:alert.trust_score>=60?'var(--accent-amber)':'var(--accent-red)'}}>{alert.trust_score}</strong></span>
              </div>
            </div>
            {!alert.resolved&&<button className="btn btn-secondary btn-sm"><CheckCircle size={14}/>Resolve</button>}
          </div>
        </div>);
      })}
    </div>
  </div>);
}
