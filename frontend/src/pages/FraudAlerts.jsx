import { useState, useEffect } from 'react';
import { ShieldAlert, AlertTriangle, Clock, WifiOff, UserX, CheckCircle, Video, ChevronRight, Check } from 'lucide-react';
import { api } from '../services/api';

const ICONS = { 
  short_duration: Clock, 
  multiple_logins: WifiOff, 
  invalid_format: AlertTriangle, 
  late_pattern: Clock, 
  proxy_suspected: UserX, 
  name_mismatch: AlertTriangle 
};

const COLORS = { 
  low: { bg: 'rgba(148,163,184,0.08)', border: 'rgba(148,163,184,0.15)', text: '#94a3b8' }, 
  medium: { bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.2)', text: '#f59e0b' }, 
  high: { bg: 'rgba(239,68,68,0.08)', border: 'rgba(239,68,68,0.2)', text: '#ef4444' }, 
  critical: { bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.3)', text: '#fca5a5' } 
};

export default function FraudAlerts() {
  const [alerts, setAlerts] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedSessionId, setSelectedSessionId] = useState('all');
  const [filter, setFilter] = useState('all'); 
  const [severityFilter, setSeverityFilter] = useState('all');
  const [resolvingId, setResolvingId] = useState(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 960);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 960);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    Promise.all([
      api.getFraudAlerts(),
      api.getSessions(1, 100)
    ]).then(([alertsData, sessionsData]) => {
      setAlerts(alertsData || []);
      window.dispatchEvent(new Event('alerts-updated'));
      
      const sessionsList = [...(sessionsData?.data || [])];
      const loadedIds = new Set(sessionsList.map(s => s.id));
      
      // Ensure we include any session that has alerts but wasn't in the top 100 sessions
      alertsData.forEach(a => {
        if (a.session_id && !loadedIds.has(a.session_id)) {
          loadedIds.add(a.session_id);
          sessionsList.push({
            id: a.session_id,
            topic: a.session_topic || 'Untitled Session',
            scheduled_time: a.created_at,
            course_code: 'CSC401',
            status: 'completed',
            total_present: 0,
            total_late: 0,
            total_absent: 0
          });
        }
      });
      
      // Sort sessions by date descending
      sessionsList.sort((a, b) => new Date(b.scheduled_time) - new Date(a.scheduled_time));
      setSessions(sessionsList);
      setLoading(false);
    }).catch(err => {
      console.error(err);
      setLoading(false);
    });
  }, []);

  const handleResolve = (alertId) => {
    setResolvingId(alertId);
    api.resolveFraudAlert(alertId)
      .then(() => {
        setAlerts(prev => prev.map(a => a.id === alertId ? { ...a, resolved: true } : a));
        setResolvingId(null);
        window.dispatchEvent(new Event('alerts-updated'));
      })
      .catch(err => {
        console.error(err);
        alert('Failed to resolve alert: ' + err.message);
        setResolvingId(null);
      });
  };

  // Filter alerts by selected session/meeting
  const sessionFilteredAlerts = alerts.filter(a => {
    if (selectedSessionId === 'all') return true;
    return a.session_id === selectedSessionId;
  });

  // Apply unresolved/resolved and severity filters
  const filtered = sessionFilteredAlerts.filter(a => {
    if (filter === 'resolved' && !a.resolved) return false;
    if (filter === 'unresolved' && a.resolved) return false;
    if (severityFilter !== 'all' && a.severity !== severityFilter) return false;
    return true;
  });

  const counts = { 
    critical: sessionFilteredAlerts.filter(a => a.severity === 'critical').length, 
    high: sessionFilteredAlerts.filter(a => a.severity === 'high').length, 
    medium: sessionFilteredAlerts.filter(a => a.severity === 'medium').length, 
    low: sessionFilteredAlerts.filter(a => a.severity === 'low').length 
  };

  const selectedSessionInfo = selectedSessionId === 'all' 
    ? { topic: 'All Meetings', course_code: 'All Courses' }
    : sessions.find(s => s.id === selectedSessionId) || { topic: 'Selected Session', course_code: 'CSC401' };

  if (loading) {
    return (
      <div>
        <div className="page-title">
          <p>Loading fraud alerts...</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-title animate-fade-in" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 800 }}>Fraud Alerts</h1>
          <p>
            AI-detected suspicious behavior · {alerts.filter(a => !a.resolved).length} unresolved overall · <span style={{ color: 'var(--accent-green)', fontWeight: 600 }}>🟢 Live</span>
          </p>
        </div>
      </div>

      {/* Stats Grid - reflects statistics for the selected session */}
      <div className="stats-grid animate-fade-in" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: 24 }}>
        {Object.entries(counts).map(([sev, count], i) => {
          const c = COLORS[sev];
          const isFilterActive = severityFilter === sev;
          return (
            <div 
              key={sev} 
              className={`stat-card animate-fade-in stagger-${i + 1}`} 
              style={{ 
                cursor: 'pointer', 
                border: isFilterActive ? `1px solid ${c.text}` : '1px solid var(--border-subtle)',
                background: isFilterActive ? `${c.bg}` : undefined,
                transition: 'all var(--transition-base)'
              }} 
              onClick={() => setSeverityFilter(severityFilter === sev ? 'all' : sev)}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: c.text, boxShadow: `0 0 8px ${c.text}40` }} />
                <span style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.8px', color: c.text, fontWeight: 600 }}>{sev}</span>
              </div>
              <div className="stat-value" style={{ color: c.text }}>{count}</div>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: 4 }}>
                {selectedSessionId === 'all' ? 'total alerts' : 'session alerts'}
              </div>
            </div>
          );
        })}
      </div>

      {/* Mobile Selector Dropdown */}
      {isMobile && (
        <div className="card animate-fade-in" style={{ marginBottom: 20, padding: '16px 20px' }}>
          <label style={{ display: 'block', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--text-muted)', fontWeight: 600, marginBottom: 8 }}>
            Meeting History
          </label>
          <select 
            value={selectedSessionId} 
            onChange={(e) => {
              setSelectedSessionId(e.target.value);
              setSeverityFilter('all');
            }}
            style={{
              width: '100%',
              padding: '10px 14px',
              background: 'var(--bg-input)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '8px',
              color: 'var(--text-primary)',
              fontSize: '0.85rem',
              outline: 'none',
              cursor: 'pointer'
            }}
          >
            <option value="all">All Meetings ({alerts.filter(a => !a.resolved).length} unresolved)</option>
            {sessions.map(s => {
              const sessionAlerts = alerts.filter(a => a.session_id === s.id);
              const unresolved = sessionAlerts.filter(a => !a.resolved).length;
              return (
                <option key={s.id} value={s.id}>
                  {s.course_code} - {s.topic} ({unresolved} unresolved / {sessionAlerts.length} total)
                </option>
              );
            })}
          </select>
        </div>
      )}

      {/* 2-Column Split Layout for Desktop */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '320px 1fr', gap: 24, alignItems: 'flex-start' }}>
        
        {/* Desktop Sidebar: Meeting History Selector */}
        {!isMobile && (
          <div className="card animate-fade-in" style={{ padding: '18px', display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 'calc(100vh - 320px)', overflowY: 'auto', position: 'sticky', top: 'calc(var(--header-height) + 20px)' }}>
            <div style={{ paddingBottom: 12, borderBottom: '1px solid var(--border-subtle)', marginBottom: 8 }}>
              <h3 style={{ fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--text-primary)' }}>Meeting History</h3>
              <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Filter alerts by specific session</p>
            </div>
            
            {/* All Meetings Item */}
            <div 
              onClick={() => {
                setSelectedSessionId('all');
                setSeverityFilter('all');
              }}
              style={{
                padding: '10px 14px',
                borderRadius: '8px',
                cursor: 'pointer',
                background: selectedSessionId === 'all' ? 'rgba(59, 130, 246, 0.12)' : 'rgba(255, 255, 255, 0.02)',
                border: selectedSessionId === 'all' ? '1px solid var(--accent-blue)' : '1px solid var(--border-subtle)',
                transition: 'all var(--transition-fast)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}
            >
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.82rem', color: selectedSessionId === 'all' ? 'var(--accent-blue)' : 'var(--text-primary)' }}>All Meetings</div>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Show all alerts mixed</div>
              </div>
              {alerts.filter(a => !a.resolved).length > 0 ? (
                <span className="badge badge-suspicious" style={{ fontSize: '0.62rem', padding: '2px 6px' }}>
                  {alerts.filter(a => !a.resolved).length}
                </span>
              ) : (
                <span className="badge badge-completed" style={{ fontSize: '0.62rem', padding: '2px 6px' }}>✓</span>
              )}
            </div>

            {/* Individual Sessions */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {sessions.map(s => {
                const sessionAlerts = alerts.filter(a => a.session_id === s.id);
                const unresolved = sessionAlerts.filter(a => !a.resolved).length;
                const isSelected = selectedSessionId === s.id;
                
                return (
                  <div
                    key={s.id}
                    onClick={() => {
                      setSelectedSessionId(s.id);
                      setSeverityFilter('all');
                    }}
                    style={{
                      padding: '10px 14px',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      background: isSelected ? 'rgba(59, 130, 246, 0.12)' : 'rgba(255, 255, 255, 0.01)',
                      border: isSelected ? '1px solid var(--accent-blue)' : '1px solid var(--border-subtle)',
                      transition: 'all var(--transition-fast)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: 8
                    }}
                    className="meeting-list-item"
                  >
                    <div style={{ overflow: 'hidden', flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                        <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 600 }}>{s.course_code}</span>
                        {s.status === 'active' && <span style={{ color: 'var(--accent-green)', fontSize: '0.6rem', fontWeight: 600 }}>● Live</span>}
                      </div>
                      <div style={{ 
                        fontWeight: 600, 
                        fontSize: '0.8rem', 
                        color: isSelected ? 'var(--accent-blue)' : 'var(--text-primary)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                      }}>
                        {s.topic}
                      </div>
                      <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                        {new Date(s.scheduled_time).toLocaleDateString('en', { month: 'short', day: 'numeric' })}
                      </div>
                    </div>

                    <div>
                      {sessionAlerts.length > 0 ? (
                        <span className={`badge ${unresolved > 0 ? 'badge-suspicious' : 'badge-completed'}`} style={{ fontSize: '0.62rem', padding: '2px 6px' }}>
                          {unresolved > 0 ? unresolved : '✓'}
                        </span>
                      ) : (
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', paddingRight: 4 }}>0</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Right Pane: Alerts Details */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, width: '100%' }}>
          
          {/* Active Meeting Context Header */}
          <div className="card animate-fade-in" style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <span style={{ fontSize: '0.72rem', color: 'var(--accent-blue)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                {selectedSessionInfo.course_code}
              </span>
              <h2 style={{ fontSize: '1.05rem', fontWeight: 700, marginTop: 2 }}>{selectedSessionInfo.topic}</h2>
              {selectedSessionId !== 'all' && (
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>
                  🕐 Scheduled: {new Date(sessions.find(s => s.id === selectedSessionId)?.scheduled_time).toLocaleString()}
                </div>
              )}
            </div>
            
            <div className="filters-bar" style={{ marginBottom: 0 }}>
              {['all', 'unresolved', 'resolved'].map(f => (
                <button 
                  key={f} 
                  className={`filter-chip ${filter === f ? 'active' : ''}`} 
                  onClick={() => setFilter(f)}
                  style={{ padding: '4px 12px', fontSize: '0.72rem' }}
                >
                  {f === 'all' ? 'All Alerts' : f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Alerts List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {filtered.length === 0 ? (
              <div className="card">
                <div className="empty-state">
                  <CheckCircle size={48} style={{ color: 'var(--accent-green)', opacity: 0.5, marginBottom: 12 }} />
                  <h3>No alerts found</h3>
                  <p>No fraud alerts match your current meeting or filter selections.</p>
                </div>
              </div>
            ) : (
              filtered.map((alert, i) => {
                const Icon = ICONS[alert.alert_type] || AlertTriangle;
                const c = COLORS[alert.severity];
                return (
                  <div 
                    key={alert.id} 
                    className="card animate-fade-in" 
                    style={{ 
                      animationDelay: `${0.03 * i}s`, 
                      borderLeft: `3px solid ${c.text}`, 
                      padding: '16px 20px',
                      opacity: alert.resolved ? 0.7 : 1,
                      transition: 'opacity var(--transition-base)'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
                      <div style={{ width: 40, height: 40, borderRadius: '8px', background: c.bg, border: `1px solid ${c.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Icon size={18} style={{ color: c.text }} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.85rem' }}>{alert.student_name}</span>
                          <code style={{ background: 'rgba(59,130,246,0.1)', padding: '1px 6px', borderRadius: '4px', fontSize: '0.7rem', color: 'var(--accent-blue)' }}>{alert.matrix_number}</code>
                          <span className={`badge badge-${alert.severity}`} style={{ fontSize: '0.65rem', padding: '2px 8px' }}>{alert.severity.toUpperCase()}</span>
                          <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.04)', padding: '1px 6px', borderRadius: '4px' }}>
                            {alert.alert_type.replace(/_/g, ' ')}
                          </span>
                          {alert.resolved && (
                            <span className="badge badge-present" style={{ fontSize: '0.65rem', padding: '2px 8px', background: 'rgba(16,185,129,0.12)', color: 'var(--accent-green)' }}>
                              RESOLVED
                            </span>
                          )}
                        </div>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', lineHeight: 1.4, marginBottom: 8 }}>
                          {alert.description}
                        </p>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: '0.72rem', color: 'var(--text-muted)', flexWrap: 'wrap' }}>
                          {selectedSessionId === 'all' && <span>📚 {alert.session_topic}</span>}
                          <span>🕐 {new Date(alert.created_at).toLocaleString('en', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                          <span>🛡️ Trust Score: <strong style={{ color: alert.trust_score >= 60 ? 'var(--accent-amber)' : 'var(--accent-red)' }}>{alert.trust_score}%</strong></span>
                        </div>
                      </div>
                      
                      {!alert.resolved && (
                        <button 
                          className="btn btn-secondary btn-sm" 
                          onClick={() => handleResolve(alert.id)}
                          disabled={resolvingId === alert.id}
                          style={{ flexShrink: 0, padding: '6px 12px', fontSize: '0.75rem', gap: 4 }}
                        >
                          {resolvingId === alert.id ? (
                            'Resolving...'
                          ) : (
                            <>
                              <Check size={12} />
                              Resolve
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
