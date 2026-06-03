import { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, LineChart, Line, Cell } from 'recharts';
import { TrendingUp, Users, Clock, ShieldCheck, BarChart3, Activity } from 'lucide-react';
import { api } from '../services/api';

const TT = ({active,payload,label}) => {
  if(!active||!payload?.length)return null;
  return <div style={{background:'#1a1f35',border:'1px solid rgba(148,163,184,0.15)',borderRadius:'10px',padding:'12px 16px',boxShadow:'0 8px 32px rgba(0,0,0,0.4)'}}>
    <p style={{color:'#94a3b8',fontSize:'0.75rem',marginBottom:'6px'}}>{label}</p>
    {payload.map((p,i)=><p key={i} style={{color:p.color,fontSize:'0.82rem',fontWeight:600}}>{p.name}: {p.value}</p>)}
  </div>;
};

export default function Analytics() {
  const [trends, setTrends] = useState([]);
  const [stats, setStats] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.getAttendanceTrends(), api.getDashboardStats(), api.getFraudAlerts()])
      .then(([t, s, a]) => { 
        setTrends(t); 
        setStats(s); 
        setAlerts(a || []); 
        setLoading(false); 
      })
      .catch(e => {
        console.error('Analytics load error:', e);
        setLoading(false);
      });
  }, []);

  const rateData = trends.map(t => ({
    date: new Date(t.date).toLocaleDateString('en',{month:'short',day:'numeric'}),
    rate: t.total > 0 ? Math.round(((t.present+t.late)/t.total)*100) : 0,
  }));

  const compData = trends.map(t => ({
    name: t.topic.length > 18 ? t.topic.substring(0,16)+'...' : t.topic,
    Present: t.present, Late: t.late, Absent: t.absent,
  }));

  const totalSessions = trends.length;
  const avgAttendance = totalSessions > 0 ? Math.round(trends.reduce((sum,t) => sum + (t.total > 0 ? ((t.present+t.late)/t.total)*100 : 0), 0) / totalSessions * 10) / 10 : 0;
  const avgPunctuality = totalSessions > 0 ? Math.round(trends.reduce((sum,t) => sum + (t.present + t.late > 0 ? (t.present/(t.present+t.late))*100 : 0), 0) / totalSessions * 10) / 10 : 0;
  const avgDuration = totalSessions > 0 ? Math.round(trends.reduce((sum,t) => sum + (t.avg_duration || 0), 0) / totalSessions * 10) / 10 : 0;
  
  const activeStudents = stats?.total_students || 0;
  const unresolvedAlerts = stats?.unresolved_alerts || 0;

  const radarData = [
    {metric:'Attendance',value:avgAttendance},
    {metric:'Punctuality',value:avgPunctuality},
    {metric:'Duration',value:Math.min(100, (avgDuration / 60) * 100)},
    {metric:'Consistency',value:totalSessions > 0 ? Math.min(avgAttendance, avgPunctuality) : 0}
  ];

  const summaries = [
    {icon:TrendingUp,label:'Avg Attendance',value:`${avgAttendance}%`,color:'green'},
    {icon:Clock,label:'Avg Punctuality',value:`${avgPunctuality}%`,color:'blue'},
    {icon:Users,label:'Unique Attendees',value:`${activeStudents}`,color:'purple'},
    {icon:ShieldCheck,label:'Active Alerts',value:`${unresolvedAlerts}`,color:'red'},
  ];

  const alertCounts = alerts.reduce((acc, a) => {
    acc[a.alert_type] = (acc[a.alert_type] || 0) + 1;
    return acc;
  }, {});

  const alertChartData = [
    { name: 'Short Duration', count: alertCounts['short_duration'] || 0, fill: '#ef4444' },
    { name: 'Multiple Logins', count: alertCounts['multiple_logins'] || 0, fill: '#f59e0b' },
    { name: 'Name Mismatch', count: alertCounts['name_mismatch'] || 0, fill: '#3b82f6' },
    { name: 'Proxy Suspected', count: alertCounts['proxy_suspected'] || 0, fill: '#8b5cf6' },
  ];

  if(loading || !stats) return <div><div className="page-title"><p>Loading analytics data...</p></div></div>;

  return (<div>
    <div className="page-title animate-fade-in"><p>Live insights from Supabase · <span style={{color:'var(--accent-green)'}}>🟢 Connected</span></p></div>
    <div className="stats-grid" style={{gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))',marginBottom:24}}>
      {summaries.map((s,i)=><div key={i} className={`stat-card ${s.color} animate-fade-in stagger-${i+1}`}><div className={`stat-icon ${s.color}`}><s.icon size={20}/></div><div className="stat-value" style={{fontSize:'1.5rem'}}>{s.value}</div><div className="stat-label">{s.label}</div></div>)}
    </div>
    <div className="charts-grid">
      <div className="card animate-fade-in"><div className="card-header"><div><div className="card-title"><Activity size={16} style={{marginRight:6,verticalAlign:'middle'}}/>Attendance Rate</div></div></div>
        <ResponsiveContainer width="100%" height={280}><LineChart data={rateData}><CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.06)"/><XAxis dataKey="date" tick={{fill:'#64748b',fontSize:11}} tickLine={false}/><YAxis domain={[0,100]} tick={{fill:'#64748b',fontSize:11}} tickLine={false} axisLine={false} tickFormatter={v=>`${v}%`}/><Tooltip content={<TT/>}/><Line type="monotone" dataKey="rate" stroke="#3b82f6" strokeWidth={3} dot={{r:5,fill:'#3b82f6',stroke:'#1a1f35',strokeWidth:2}} name="Rate %"/></LineChart></ResponsiveContainer>
      </div>
      <div className="card animate-fade-in"><div className="card-header"><div><div className="card-title"><BarChart3 size={16} style={{marginRight:6,verticalAlign:'middle'}}/>Session Comparison</div></div></div>
        <ResponsiveContainer width="100%" height={280}><BarChart data={compData} barGap={2}><CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.06)"/><XAxis dataKey="name" tick={{fill:'#64748b',fontSize:10}} tickLine={false}/><YAxis tick={{fill:'#64748b',fontSize:11}} tickLine={false} axisLine={false}/><Tooltip content={<TT/>}/><Bar dataKey="Present" fill="#10b981" radius={[4,4,0,0]}/><Bar dataKey="Late" fill="#f59e0b" radius={[4,4,0,0]}/><Bar dataKey="Absent" fill="#ef4444" radius={[4,4,0,0]}/></BarChart></ResponsiveContainer>
      </div>
      <div className="card animate-fade-in"><div className="card-header"><div><div className="card-title">Performance Profile</div></div></div>
        <ResponsiveContainer width="100%" height={300}><RadarChart data={radarData}><PolarGrid stroke="rgba(148,163,184,0.1)"/><PolarAngleAxis dataKey="metric" tick={{fill:'#94a3b8',fontSize:12}}/><PolarRadiusAxis domain={[0,100]} tick={{fill:'#64748b',fontSize:10}} axisLine={false}/><Radar dataKey="value" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.2} strokeWidth={2}/></RadarChart></ResponsiveContainer>
      </div>
      <div className="card animate-fade-in"><div className="card-header"><div><div className="card-title">Fraud Alerts Breakdown</div></div></div>
        <ResponsiveContainer width="100%" height={260}><BarChart data={alertChartData} layout="vertical"><CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.06)"/><XAxis type="number" tick={{fill:'#64748b',fontSize:11}} tickLine={false} axisLine={false}/><YAxis type="category" dataKey="name" width={120} tick={{fill:'#94a3b8',fontSize:10}} tickLine={false} axisLine={false}/><Tooltip/><Bar dataKey="count" radius={[0,6,6,0]}>{alertChartData.map((e,i)=><Cell key={i} fill={e.fill}/>)}</Bar></BarChart></ResponsiveContainer>
      </div>
    </div>
  </div>);
}
