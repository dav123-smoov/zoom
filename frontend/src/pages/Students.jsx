import { useState, useEffect } from 'react';
import { Search, ChevronUp, ChevronDown, AlertTriangle, Shield, Users } from 'lucide-react';
import { api } from '../services/api';

export default function Students() {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState('name');
  const [sortDir, setSortDir] = useState('asc');

  useEffect(() => {
    async function load() {
      const res = await api.getStudents(1, 50, search);
      setStudents(res.data);
      setLoading(false);
    }
    load();
  }, [search]);

  const sorted = [...students].sort((a, b) => {
    const dir = sortDir === 'asc' ? 1 : -1;
    if (typeof a[sortField] === 'string') return a[sortField].localeCompare(b[sortField]) * dir;
    return (a[sortField] - b[sortField]) * dir;
  });

  const toggleSort = (f) => {
    if (sortField === f) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(f); setSortDir('asc'); }
  };

  const SortIcon = ({ field }) => (
    <span onClick={() => toggleSort(field)} style={{ cursor: 'pointer', marginLeft: 4, display: 'inline-flex', opacity: sortField === field ? 1 : 0.3 }}>
      {sortField === field && sortDir === 'desc' ? <ChevronDown size={13} /> : <ChevronUp size={13} />}
    </span>
  );

  // Generate avatar initials from name
  const getInitials = (name) => name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

  return (
    <div>
      <div className="page-title animate-fade-in">
        <h1 style={{ fontSize: '1.6rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 10 }}>
          <Users size={26} style={{ color: 'var(--accent-blue)' }} />
          Students
        </h1>
        <p>
          {students.length} registered participants ·{' '}
          <span style={{ color: 'var(--accent-green)' }}>Live from Supabase</span>
        </p>
        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>
          Students are automatically registered when they join a Zoom session with a valid display name.
        </p>
      </div>

      <div className="card animate-fade-in" style={{ animationDelay: '0.1s' }}>
        <div className="search-container">
          <Search className="search-icon" size={18} />
          <input
            type="text"
            placeholder="Search by name or matrix number..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Student <SortIcon field="name" /></th>
                <th>Matrix Number</th>
                <th>Sessions Joined <SortIcon field="total_sessions" /></th>
                <th>Active Alerts <SortIcon field="active_alerts" /></th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {loading
                ? [...Array(5)].map((_, i) => (
                    <tr key={i}>
                      {[...Array(5)].map((_, j) => (
                        <td key={j}><div className="skeleton" style={{ width: '80%', height: 18 }} /></td>
                      ))}
                    </tr>
                  ))
                : sorted.map(s => (
                    <tr key={s.id}>
                      {/* Student name + avatar */}
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{
                            width: 34, height: 34, borderRadius: '50%',
                            background: 'linear-gradient(135deg, rgba(59,130,246,0.2), rgba(99,102,241,0.2))',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '0.7rem', fontWeight: 700, color: 'var(--accent-blue)', flexShrink: 0,
                            border: '1px solid rgba(59,130,246,0.2)'
                          }}>
                            {getInitials(s.name)}
                          </div>
                          <div>
                            <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.85rem' }}>{s.name}</div>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{s.email || ''}</div>
                          </div>
                        </div>
                      </td>

                      {/* Matrix number */}
                      <td>
                        <code style={{
                          background: 'rgba(59,130,246,0.1)', padding: '3px 10px',
                          borderRadius: '4px', fontSize: '0.8rem',
                          color: 'var(--accent-blue)', fontWeight: 500
                        }}>
                          {s.matrix_number}
                        </code>
                      </td>

                      {/* Sessions joined — replaces trust score */}
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                            {s.total_sessions ?? 0}
                          </span>
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>sessions</span>
                        </div>
                      </td>

                      {/* Active alerts */}
                      <td>
                        {s.active_alerts > 0
                          ? <span className="badge badge-high" style={{ gap: 4 }}>
                              <AlertTriangle size={11} />{s.active_alerts}
                            </span>
                          : <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>—</span>
                        }
                      </td>

                      {/* Status */}
                      <td>
                        {s.flagged
                          ? <span className="badge badge-suspicious"><Shield size={11} />Flagged</span>
                          : <span className="badge badge-present">Active</span>
                        }
                      </td>
                    </tr>
                  ))
              }
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
