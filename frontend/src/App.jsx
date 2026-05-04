import { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Users, CalendarDays, BarChart3,
  ShieldAlert, Settings, Bell, Search, Menu
} from 'lucide-react';
import Dashboard from './pages/Dashboard';
import Students from './pages/Students';
import Sessions from './pages/Sessions';
import Analytics from './pages/Analytics';
import FraudAlerts from './pages/FraudAlerts';
import './App.css';

const PAGE_TITLES = {
  '/': { title: 'Dashboard', subtitle: 'Real-time attendance overview' },
  '/students': { title: 'Students', subtitle: 'Manage and monitor students' },
  '/sessions': { title: 'Sessions', subtitle: 'Zoom meeting sessions' },
  '/analytics': { title: 'Analytics', subtitle: 'Attendance insights & trends' },
  '/fraud-alerts': { title: 'Fraud Alerts', subtitle: 'Suspicious behavior detection' },
};

function Header({ onMenuToggle }) {
  const location = useLocation();
  const page = PAGE_TITLES[location.pathname] || PAGE_TITLES['/'];
  return (
    <header className="header">
      <div className="header-left">
        <button className="header-btn mobile-menu-btn" onClick={onMenuToggle}><Menu size={18} /></button>
        <div>
          <h2>{page.title}</h2>
          <span className="header-subtitle">{page.subtitle}</span>
        </div>
      </div>
      <div className="header-right">
        <button className="header-btn" title="Search"><Search size={16} /></button>
        <button className="header-btn notification-btn" title="Notifications">
          <Bell size={16} /><span className="notification-dot"></span>
        </button>
        <div className="header-avatar"><span>DA</span></div>
      </div>
    </header>
  );
}

function Sidebar({ isOpen, onClose }) {
  return (
    <>
      {isOpen && <div className="sidebar-overlay" onClick={onClose} />}
      <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
        <div className="sidebar-logo">
          <div className="logo-icon">📋</div>
          <div><h1>IAAMS</h1><span>Attendance System</span></div>
        </div>
        <nav className="sidebar-nav">
          <div className="nav-section">
            <div className="nav-section-title">Main</div>
            <NavLink to="/" end className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} onClick={onClose}>
              <LayoutDashboard className="nav-icon" size={20} />Dashboard
            </NavLink>
            <NavLink to="/sessions" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} onClick={onClose}>
              <CalendarDays className="nav-icon" size={20} />Sessions
            </NavLink>
            <NavLink to="/students" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} onClick={onClose}>
              <Users className="nav-icon" size={20} />Students
            </NavLink>
          </div>
          <div className="nav-section">
            <div className="nav-section-title">Intelligence</div>
            <NavLink to="/analytics" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} onClick={onClose}>
              <BarChart3 className="nav-icon" size={20} />Analytics
            </NavLink>
            <NavLink to="/fraud-alerts" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} onClick={onClose}>
              <ShieldAlert className="nav-icon" size={20} />Fraud Alerts<span className="nav-badge">4</span>
            </NavLink>
          </div>
          <div className="nav-section">
            <div className="nav-section-title">System</div>
            <div className="nav-item" style={{ cursor: 'default', opacity: 0.5 }}>
              <Settings className="nav-icon" size={20} />Settings
            </div>
          </div>
        </nav>
        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div className="sidebar-user-avatar">DA</div>
            <div className="sidebar-user-info">
              <div className="sidebar-user-name">Dr. Adeyemi</div>
              <div className="sidebar-user-role">Lecturer</div>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}

function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  return (
    <Router>
      <div className="app-layout">
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <Header onMenuToggle={() => setSidebarOpen(!sidebarOpen)} />
        <main className="main-content">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/students" element={<Students />} />
            <Route path="/sessions" element={<Sessions />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/fraud-alerts" element={<FraudAlerts />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
