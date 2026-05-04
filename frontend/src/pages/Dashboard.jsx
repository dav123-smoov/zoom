import { useState, useEffect } from 'react';
import { Users, CalendarDays, UserCheck, ShieldAlert, TrendingUp, AlertTriangle, Activity, Clock, CheckCircle2, XCircle } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area } from 'recharts';
import { api } from '../services/api';

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (<div style={{ background:'#1a1f35',border:'1px solid rgba(148,163,184,0.15)',borderRadius:'10px',padding:'12px 16px',boxShadow:'0 8px 32px rgba(0,0,0,0.4)' }}>
    <p style={{ color:'#94a3b8',fontSize:'0.75rem',marginBottom:'6px' }}>{label}</p>
    {payload.map((p,i) => (<p key={i} style={{ color:p.color,fontSize:'0.82rem',fontWeight:600 }}>{p.name}: {p.value}</p>))}
  </div>);
};

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [trends, setTrends] = useState([]);
  const [trustDist, setTrustDist] = useState([]);
  const [recentActivity, setRecentActivity] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        // OPTIMIZED: Single API call returns all dashboard data at once
        // Before: 4 calls × ~1.5s each = ~6s total
        // After:  1 call × ~1.5s = ~1.5s total
        const data = await api.getDashboardAll();
        setStats(data.stats);
        setTrends(data.trends || []);
        setTrustDist(data.trust_distribution || []);
        setRecentActivity(data.recent_activity || []);
      } catch(e) { console.error('Dashboard load error:', e); }
      setLoading(false);
    }
    load();
  }, []);

  if (loading || !stats) return (<div><div className="page-title"><p>Loading live data from Supabase...</p></div>
    <div className="stats-grid">{[...Array(6)].map((_,i)=>(<div key={i} className="stat-card"><div className="skeleton" style={{width:'100%',height:100}}/></div>))}</div></div>);

  const statCards = [
    { label:'Total Students', value:stats.total_students, icon:Users, color:'blue' },
    { label:'Total Sessions', value:stats.total_sessions, icon:CalendarDays, color:'purple' },
    { label:'Attendance Rate', value:`${stats.attendance_rate}%`, icon:UserCheck, color:'green', change:{value:'+2.3%',dir:'up'} },
    { label:'Avg Trust Score', value:stats.avg_trust_score.toFixed(1), icon:Activity, color:'cyan' },
    { label:'Active Alerts', value:stats.unresolved_alerts, icon:ShieldAlert, color:'red' },
    { label:'Low Trust Students', value:stats.low_trust_students, icon:AlertTriangle, color:'amber' },
  ];

  return (<div>
    <div className="page-title animate-fade-in">
      <p>Welcome back, Dr. Adeyemi · {new Date().toLocaleDateString('en-NG',{weekday:'long',year:'numeric',month:'long',day:'numeric'})} · <span style={{color:'var(--accent-green)',fontWeight:600}}>🟢 Live Data</span></p>
    </div>
    <div className="stats-grid">
      {statCards.map((s,i) => (<div key={i} className={`stat-card ${s.color} animate-fade-in stagger-${i+1}`}>
        <div className={`stat-icon ${s.color}`}><s.icon size={22}/></div>
        <div className="stat-value">{s.value}</div>
        <div className="stat-label">{s.label}</div>
        {s.change && <div className={`stat-change ${s.change.dir}`}><TrendingUp size={12}/>{s.change.value} from last week</div>}
      </div>))}
    </div>
    <div className="charts-grid">
      <div className="card animate-fade-in" style={{animationDelay:'0.2s'}}>
        <div className="card-header"><div><div className="card-title">Attendance Trend</div><div className="card-subtitle">Daily attendance breakdown</div></div></div>
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={trends}>
            <defs><linearGradient id="gP" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#10b981" stopOpacity={0.3}/><stop offset="100%" stopColor="#10b981" stopOpacity={0}/></linearGradient>
            <linearGradient id="gL" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#f59e0b" stopOpacity={0.3}/><stop offset="100%" stopColor="#f59e0b" stopOpacity={0}/></linearGradient></defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.06)"/>
            <XAxis dataKey="date" tick={{fill:'#64748b',fontSize:11}} tickLine={false} axisLine={{stroke:'rgba(148,163,184,0.1)'}} tickFormatter={v=>new Date(v).toLocaleDateString('en',{month:'short',day:'numeric'})}/>
            <YAxis tick={{fill:'#64748b',fontSize:11}} tickLine={false} axisLine={false}/>
            <Tooltip content={<CustomTooltip/>}/>
            <Area type="monotone" dataKey="present" stackId="1" stroke="#10b981" fill="url(#gP)" strokeWidth={2} name="Present"/>
            <Area type="monotone" dataKey="late" stackId="1" stroke="#f59e0b" fill="url(#gL)" strokeWidth={2} name="Late"/>
            <Area type="monotone" dataKey="absent" stackId="1" stroke="#ef4444" fill="rgba(239,68,68,0.1)" strokeWidth={2} name="Absent"/>
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div className="card animate-fade-in" style={{animationDelay:'0.3s'}}>
        <div className="card-header"><div><div className="card-title">Trust Score Distribution</div><div className="card-subtitle">Student trust levels</div></div></div>
        <ResponsiveContainer width="100%" height={280}>
          <PieChart><Pie data={trustDist} cx="50%" cy="50%" innerRadius={65} outerRadius={100} dataKey="count" nameKey="category" stroke="none" paddingAngle={3}>
            {trustDist.map((e,i)=>(<Cell key={i} fill={e.fill}/>))}</Pie>
            <Tooltip content={({active,payload})=>{if(!active||!payload?.length)return null;const d=payload[0].payload;return(<div style={{background:'#1a1f35',border:'1px solid rgba(148,163,184,0.15)',borderRadius:'10px',padding:'12px 16px',boxShadow:'0 8px 32px rgba(0,0,0,0.4)'}}><p style={{color:d.fill,fontWeight:600,fontSize:'0.85rem'}}>{d.category}</p><p style={{color:'#94a3b8',fontSize:'0.78rem'}}>{d.count} students · Avg: {d.avg_score}</p></div>);}}/>
          </PieChart>
        </ResponsiveContainer>
        <div style={{display:'flex',flexWrap:'wrap',gap:'10px',justifyContent:'center',marginTop:'4px'}}>
          {trustDist.map((d,i)=>(<div key={i} style={{display:'flex',alignItems:'center',gap:'6px',fontSize:'0.72rem',color:'#94a3b8'}}><div style={{width:8,height:8,borderRadius:'50%',background:d.fill}}/>{d.category.split(' ')[0]} ({d.count})</div>))}
        </div>
      </div>
    </div>
    <div className="card animate-fade-in" style={{animationDelay:'0.35s'}}>
      <div className="card-header"><div><div className="card-title">Recent Activity</div><div className="card-subtitle">Latest attendance events from Supabase</div></div></div>
      <div className="table-container"><table><thead><tr><th>Student</th><th>Matrix No.</th><th>Session</th><th>Time</th><th>Status</th></tr></thead>
        <tbody>{recentActivity.map((a,i)=>(<tr key={i}><td style={{fontWeight:500,color:'var(--text-primary)'}}>{a.student_name}</td>
          <td><code style={{background:'rgba(59,130,246,0.1)',padding:'2px 8px',borderRadius:'4px',fontSize:'0.78rem',color:'var(--accent-blue)'}}>{a.matrix_number}</code></td>
          <td>{a.session_topic}</td>
          <td style={{fontSize:'0.78rem'}}><Clock size={12} style={{marginRight:4,verticalAlign:'middle',opacity:0.5}}/>{new Date(a.join_time).toLocaleTimeString('en',{hour:'2-digit',minute:'2-digit'})}</td>
          <td><span className={`badge badge-${a.status}`}>{a.status==='present'&&<CheckCircle2 size={11}/>}{a.status==='late'&&<Clock size={11}/>}{a.status==='suspicious'&&<AlertTriangle size={11}/>}{a.status==='absent'&&<XCircle size={11}/>}{a.status.charAt(0).toUpperCase()+a.status.slice(1)}</span></td>
        </tr>))}</tbody></table></div>
    </div>
  </div>);
}
