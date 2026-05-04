/**
 * IAAMS API Service (OPTIMIZED)
 * React Frontend → PHP Backend → Supabase PostgreSQL
 * 
 * Performance: Uses combined endpoints to minimize API calls
 */

const API_URL = 'https://zoom-production-6dcc.up.railway.app/api';

async function fetchAPI(endpoint, options = {}) {
  const res = await fetch(`${API_URL}${endpoint}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  const json = await res.json();
  if (!res.ok || json.success === false) {
    throw new Error(json.error || 'API request failed');
  }
  return json.data;
}

export const api = {
  // OPTIMIZED: Single call returns stats + trends + distribution + activity
  getDashboardAll: () => fetchAPI('/dashboard/all'),

  // Individual endpoints (still available as fallback)
  getDashboardStats: () => fetchAPI('/dashboard/stats'),
  getRecentActivity: () => fetchAPI('/dashboard/recent-activity'),

  // Sessions
  getSessions: (page = 1, limit = 20) => fetchAPI(`/sessions?page=${page}&limit=${limit}`),
  getSessionAttendance: (sessionId) => fetchAPI(`/sessions/${sessionId}/attendance`),

  // Students
  getStudents: (page = 1, limit = 50, search = '') => {
    const params = `?page=${page}&limit=${limit}${search ? `&search=${encodeURIComponent(search)}` : ''}`;
    return fetchAPI(`/students${params}`);
  },
  getStudent: (id) => fetchAPI(`/students/${id}`),

  // Analytics - uses optimized RPC functions
  getAttendanceTrends: () => fetchAPI('/analytics/attendance-trends'),
  getFraudAlerts: () => fetchAPI('/analytics/fraud-alerts'),
  getTrustScoreDistribution: () => fetchAPI('/analytics/trust-distribution'),

  // Export
  exportSessionCSV: (sessionId) => {
    const a = document.createElement('a');
    a.href = `${API_URL}/export/csv/${sessionId}`;
    a.download = `attendance_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  },
};
