import { useState, useEffect } from 'react';
import { Download, Clock, CheckCircle2, XCircle, AlertTriangle, Users, Video } from 'lucide-react';
import { api } from '../services/api';

export default function Sessions() {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedSession, setSelectedSession] = useState(null);
  const [attendance, setAttendance] = useState([]);
  const [loadingAttendance, setLoadingAttendance] = useState(false);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    api.getSessions().then(res => { setSessions(res.data); setLoading(false); });
  }, []);

  const viewAttendance = async (session) => {
    setSelectedSession(session);
    setLoadingAttendance(true);
    const data = await api.getSessionAttendance(session.id);
    setAttendance(data);
    setLoadingAttendance(false);
  };

  const filtered = filter === 'all' ? sessions : sessions.filter(s => s.status === filter);

  return (
    <div>
      <div className="page-title animate-fade-in">
        <p>Zoom meeting sessions · <span style={{color:'var(--accent-green)'}}>Live from Supabase</span></p>
      </div>

      <div className="filters-bar animate-fade-in">
        {['all','active','completed'].map(f => (
          <button key={f} className={`filter-chip ${filter===f?'active':''}`} onClick={() => setFilter(f)}>
            {f === 'all' ? 'All Sessions' : f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(340px,1fr))',gap:16,marginBottom:28}}>
        {loading ? [...Array(4)].map((_,i) => (
          <div key={i} className="card"><div className="skeleton" style={{width:'100%',height:160}}/></div>
        )) : filtered.map((s,i) => (
          <div key={s.id} className={`card animate-fade-in stagger-${Math.min(i+1,6)}`}
            style={{cursor:'pointer', border: selectedSession?.id===s.id ? '1px solid var(--accent-blue)' : undefined}}
            onClick={() => viewAttendance(s)}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:16}}>
              <div>
                <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:6}}>
                  <Video size={16} style={{color:'var(--accent-blue)',opacity:0.7}}/>
                  <span className={`badge badge-${s.status}`}>
                    {s.status === 'active' ? '● Live' : s.status.charAt(0).toUpperCase() + s.status.slice(1)}
                  </span>
                </div>
                <h3 style={{fontSize:'1rem',fontWeight:600,marginBottom:4}}>{s.topic}</h3>
                <p style={{fontSize:'0.78rem',color:'var(--text-muted)'}}>
                  {s.course_code} · {new Date(s.scheduled_time).toLocaleDateString('en',{month:'short',day:'numeric',year:'numeric'})}
                </p>
              </div>
              {s.status === 'completed' && (
                <button className="btn btn-secondary btn-sm" onClick={e => {e.stopPropagation(); api.exportSessionCSV(s.id);}}>
                  <Download size={14}/>CSV
                </button>
              )}
            </div>
            <div style={{display:'flex',gap:16,paddingTop:12,borderTop:'1px solid var(--border-subtle)'}}>
              {[
                {v:s.total_present,l:'Present',c:'green'},
                {v:s.total_late,l:'Late',c:'amber'},
                {v:s.total_absent,l:'Absent',c:'red'},
                {v: s.status === 'active' ? '● Live' : (s.duration_minutes > 0 ? s.duration_minutes+'m' : '—'), l:'Duration', c: s.status === 'active' ? 'green' : 'text-primary'}
              ].map((x,j) => (
                <div key={j} style={{textAlign:'center',flex:1}}>
                  <div style={{fontSize:'1.2rem',fontWeight:700,color:`var(--accent-${x.c})`}}>{x.v}</div>
                  <div style={{fontSize:'0.68rem',color:'var(--text-muted)',textTransform:'uppercase'}}>{x.l}</div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {selectedSession && (
        <div className="card animate-fade-in">
          <div className="card-header">
            <div>
              <div className="card-title"><Users size={18} style={{marginRight:8,verticalAlign:'middle'}}/>Attendance: {selectedSession.topic}</div>
              <div className="card-subtitle">{new Date(selectedSession.scheduled_time).toLocaleDateString('en',{weekday:'long',month:'long',day:'numeric',year:'numeric'})}</div>
            </div>
            <button className="btn btn-secondary btn-sm" onClick={() => api.exportSessionCSV(selectedSession.id)}><Download size={14}/>Export CSV</button>
          </div>
          {loadingAttendance ? <div style={{padding:40,textAlign:'center',color:'var(--text-muted)'}}>Loading...</div> : (
            <div className="table-container">
              <table>
                <thead><tr><th>#</th><th>Student</th><th>Matrix</th><th>Join</th><th>Leave</th><th>Duration</th><th>% Attended</th><th>Status</th></tr></thead>
                <tbody>
                  {attendance.map((a,i) => (
                    <tr key={a.id}>
                      <td>{i+1}</td>
                      <td style={{fontWeight:500,color:'var(--text-primary)'}}>{a.student_name}</td>
                      <td><code style={{background:'rgba(59,130,246,0.1)',padding:'2px 8px',borderRadius:'4px',fontSize:'0.78rem',color:'var(--accent-blue)'}}>{a.matrix_number}</code></td>
                      <td>{new Date(a.join_time).toLocaleTimeString('en',{hour:'2-digit',minute:'2-digit'})}</td>
                      <td>{a.leave_time ? new Date(a.leave_time).toLocaleTimeString('en',{hour:'2-digit',minute:'2-digit'}) : '—'}</td>
                      <td>{Math.round(a.duration_seconds/60)} min</td>
                      <td style={{fontWeight:600,color:a.attendance_percentage>=50?'var(--accent-green)':'var(--accent-red)'}}>{a.attendance_percentage ?? 0}%</td>
                      <td><span className={`badge badge-${a.status}`}>{a.status.charAt(0).toUpperCase()+a.status.slice(1)}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
