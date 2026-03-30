import React, { useState, useEffect } from 'react'
import Dashboard from './Dashboard'
import Sync from './Sync'
import './App.css'
import { Database, Home, ChevronLeft, ChevronRight, Loader, User, Power } from 'lucide-react'
import WelcomeWizard from './WelcomeWizard'
import ProfileModal from './ProfileModal'

function App() {
  const [currentPage, setCurrentPage] = useState('dashboard');
  // Shared State
  const [residents, setResidents] = useState([]);
  const [selectedResidents, setSelectedResidents] = useState([]);
  const [interactions, setInteractions] = useState({});
  const [asuId, setAsuId] = useState("");
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [topic, setTopic] = useState("");
  const [hideCompleted, setHideCompleted] = useState(false);
  const [status, setStatus] = useState("");
  const [setupStatus, setSetupStatus] = useState(null);
  const [isSetupComplete, setIsSetupComplete] = useState(null); // null = loading

  const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001';

  const checkSetupStatus = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/setup/status`);
      const data = await res.json();
      setIsSetupComplete(data.setup_complete);
      setSetupStatus(data);
      if (data.settings && data.settings.user_asuid) {
        setAsuId(data.settings.user_asuid);
      }
    } catch (err) {
      console.error("Error checking setup status", err);
      setTimeout(checkSetupStatus, 2000);
    }
  };

  const fetchResidents = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/residents`);
      const data = await res.json();
      if (Array.isArray(data)) {
        setResidents(data);
      }
    } catch (err) {
      console.error("Error fetching residents", err);
    }
  };

  useEffect(() => {
    checkSetupStatus();
  }, []);

  useEffect(() => {
    if (isSetupComplete) {
      fetchResidents();
    }
  }, [isSetupComplete]);

  const sharedState = {
    residents, setResidents,
    selectedResidents, setSelectedResidents,
    interactions, setInteractions,
    asuId, setAsuId,
    topic, setTopic,
    hideCompleted, setHideCompleted,
    status, setStatus,
    fetchResidents,
    setupStatus, checkSetupStatus
  };

  if (isSetupComplete === null) {
    return (
      <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center' }}>
        <Loader className="spinner" size={40} style={{ color: '#3b82f6', animation: 'spin 1s linear infinite' }} />
      </div>
    );
  }

  // Use loose check for string "false" or boolean false
  if (isSetupComplete === false || isSetupComplete === 'false') {
    return <WelcomeWizard onComplete={() => setIsSetupComplete(true)} />;
  }

  return (
    <div className="app-layout sidebar-collapsed">
      {/* Premium Sidebar Navigation */}
      <nav className="sidebar collapsed">
        <div className="nav-items" style={{ marginTop: '2rem' }}>
          <button 
            className={`nav-button ${currentPage === 'dashboard' ? 'active' : ''}`}
            onClick={() => setCurrentPage('dashboard')}
            title="Generator"
          >
            <Home size={20} />
          </button>
          
          <button 
            className={`nav-button ${currentPage === 'sync' ? 'active' : ''}`}
            onClick={() => setCurrentPage('sync')}
            title="Data Sync"
          >
            <Database size={20} />
          </button>
          
          <button 
            className="nav-button"
            onClick={() => setIsProfileOpen(true)}
            title="Profile"
          >
            <User size={20} />
          </button>

          <button 
            className="nav-button"
            title="Quit App"
            style={{ marginTop: 'auto', color: '#ef4444' }}
            onClick={async () => {
              if (!confirm('Stop Weekly Reporter?')) return;
              try {
                await fetch(`${API_BASE_URL}/api/quit`, { method: 'POST' });
              } catch (_) {}
              window.close();
            }}
          >
            <Power size={20} />
          </button>
        </div>
      </nav>

      <ProfileModal 
        isOpen={isProfileOpen} 
        onClose={() => setIsProfileOpen(false)} 
        setupStatus={setupStatus}
        onSaveComplete={(newAsuId) => {
          setAsuId(newAsuId);
          checkSetupStatus();
        }}
        onResetSetup={async () => {
          try {
            await fetch(`${API_BASE_URL}/api/setup/save`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ setup_complete: 'false' })
            });
            setIsSetupComplete(false);
            setIsProfileOpen(false);
          } catch (err) {
            console.error("Failed to reset setup", err);
          }
        }}
      />

      {/* Main Content Area */}
      <main className="main-content">
        {currentPage === 'dashboard' ? (
          <Dashboard {...sharedState} />
        ) : (
          <Sync residents={residents} fetchResidents={fetchResidents} />
        )}
      </main>
    </div>
  )
}

export default App
