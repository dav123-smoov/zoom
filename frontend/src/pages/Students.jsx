import { useState, useEffect } from 'react';
import { Search, ChevronUp, ChevronDown, Shield, AlertTriangle } from 'lucide-react';
import { api } from '../services/api';

function TrustScoreCell({ score }) {
  let level = 'critical';
  if (score >= 90) level = 'excellent'; else if (score >= 75) level = 'good'; else if (score >= 60) level = 'fair'; else if (score >= 40) level = 'poor';
  return (<div style={{minWidth:120}}>
    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:4}}>
      <span style={{fontWeight:600,fontSize:'0.85rem',color:'var(--text-primary)'}}>{score.toFixed(1)}</span>
      <span style={{fontSize:'0.65rem',textTransform:'uppercase',letterSpacing:'0.5px',color:`var(--accent-${level==='excellent'||level==='good'?'green':level==='fair'?'amber':'red'})`}}>{level}</span>
    </div>
    <div className="trust-score-bar"><div className={`trust-score-fill ${level}`} style={{width:`${score}%`}}/></div>
  </div>);
}

export default function Students() {
  const [students, setStudents] = useState([]); const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(''); const [sortField, setSortField] = useState('name'); const [sortDir, setSortDir] = useState('asc');

  useEffect(() => { async function load() { const res = await api.getStudents(1,50,search); setStudents(res.data); setLoading(false); } load(); }, [search]);

  const sorted = [...students].sort((a,b) => { const dir = sortDir==='asc'?1:-1; if(typeof a[sortField]==='string') return a[sortField].localeCompare(b[sortField])*dir; return (a[sortField]-b[sortField])*dir; });
  const toggleSort = (f) => { if(sortField===f) setSortDir(d=>d==='asc'?'desc':'asc'); else { setSortField(f); setSortDir('asc'); } };
  const SortIcon = ({field}) => (<span onClick={()=>toggleSort(field)} style={{cursor:'pointer',marginLeft:4,display:'inline-flex',opacity:sortField===field?1:0.3}}>{sortField===field&&sortDir==='desc'?<ChevronDown size={13}/>:<ChevronUp size={13}/>}</span>);

  return (<div>
    <div className="page-title animate-fade-in"><p>{students.length} registered students · <span style={{color:'var(--accent-green)'}}>Live from Supabase</span></p></div>
    <div className="card animate-fade-in" style={{animationDelay:'0.1s'}}>
      <div className="search-container"><Search className="search-icon" size={18}/><input type="text" placeholder="Search by name or matrix number..." value={search} onChange={e=>setSearch(e.target.value)}/></div>
      <div className="table-container"><table><thead><tr><th>Student <SortIcon field="name"/></th><th>Matrix Number</th><th>Trust Score <SortIcon field="trust_score"/></th><th>Sessions <SortIcon field="total_sessions"/></th><th>Alerts</th><th>Status</th></tr></thead>
        <tbody>{loading ? [...Array(5)].map((_,i)=>(<tr key={i}>{[...Array(6)].map((_,j)=>(<td key={j}><div className="skeleton" style={{width:'80%',height:18}}/></td>))}</tr>)) :
          sorted.map(s => (<tr key={s.id}>
            <td><div style={{display:'flex',alignItems:'center',gap:10}}>
              <div style={{width:34,height:34,borderRadius:'50%',background:s.trust_score>=75?'linear-gradient(135deg,rgba(16,185,129,0.2),rgba(59,130,246,0.2))':s.trust_score>=50?'linear-gradient(135deg,rgba(245,158,11,0.2),rgba(251,191,36,0.2))':'linear-gradient(135deg,rgba(239,68,68,0.2),rgba(248,113,113,0.2))',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'0.7rem',fontWeight:700,color:'var(--text-primary)',flexShrink:0}}>{s.name.split(' ').map(n=>n[0]).join('')}</div>
              <div><div style={{fontWeight:600,color:'var(--text-primary)',fontSize:'0.85rem'}}>{s.name}</div><div style={{fontSize:'0.72rem',color:'var(--text-muted)'}}>{s.email||''}</div></div>
            </div></td>
            <td><code style={{background:'rgba(59,130,246,0.1)',padding:'3px 10px',borderRadius:'4px',fontSize:'0.8rem',color:'var(--accent-blue)',fontWeight:500}}>{s.matrix_number}</code></td>
            <td><TrustScoreCell score={s.trust_score}/></td>
            <td style={{fontWeight:500}}>{s.total_sessions}</td>
            <td>{s.active_alerts>0?<span className="badge badge-high" style={{gap:4}}><AlertTriangle size={11}/>{s.active_alerts}</span>:<span style={{color:'var(--text-muted)',fontSize:'0.8rem'}}>—</span>}</td>
            <td>{s.flagged?<span className="badge badge-suspicious"><Shield size={11}/>Flagged</span>:<span className="badge badge-present">Active</span>}</td>
          </tr>))}</tbody></table></div>
    </div>
  </div>);
}
