import React, { useState, useEffect, useRef } from 'react';
import './WelcomeWizard.css';
import {
  User, Cpu, Download, CheckCircle, ArrowRight, Loader,
  Upload, XCircle, ShieldCheck, AlertTriangle, ExternalLink,
  Zap, RefreshCw
} from 'lucide-react';
import axios from 'axios';

const API = 'http://localhost:5001';

// ─── Step 0: Prerequisites Check ────────────────────────────────────────────
const PrereqStep = ({ onNext }) => {
  const [checks, setChecks] = useState({
    python: { status: 'checking', label: 'Python 3.10+', hint: 'Required to run the backend server', link: 'https://www.python.org/downloads/' },
    ollama: { status: 'checking', label: 'Ollama AI Engine', hint: 'Runs AI models locally on your machine', link: 'https://ollama.com/' },
    chrome: { status: 'checking', label: 'Google Chrome', hint: 'Used for automated form submission', link: 'https://www.google.com/chrome/' },
  });

  const runChecks = async () => {
    setChecks(prev => ({
      python: { ...prev.python, status: 'checking' },
      ollama: { ...prev.ollama, status: 'checking' },
      chrome: { ...prev.chrome, status: 'checking' },
    }));

    try {
      const res = await fetch(`${API}/api/setup/status`);
      const data = await res.json();

      // If the server responds, Python is working
      setChecks(prev => ({ ...prev, python: { ...prev.python, status: 'ok' } }));

      // Check Ollama from status endpoint
      setChecks(prev => ({
        ...prev,
        ollama: { ...prev.ollama, status: data.ollama_running ? 'ok' : 'warn' }
      }));

      // Chrome: check via dedicated server-side endpoint
      try {
        const chromeRes = await fetch(`${API}/api/setup/check_chrome`);
        const chromeData = await chromeRes.json();
        setChecks(prev => ({ ...prev, chrome: { ...prev.chrome, status: chromeData.chrome_installed ? 'ok' : 'error' } }));
      } catch {
        setChecks(prev => ({ ...prev, chrome: { ...prev.chrome, status: 'error' } }));
      }
    } catch {
      setChecks(prev => ({
        python: { ...prev.python, status: 'error' },
        ollama: { ...prev.ollama, status: 'warn' },
        chrome: { ...prev.chrome, status: 'error' },
      }));
    }
  };

  useEffect(() => { runChecks(); }, []);

  const allGood = Object.values(checks).every(c => c.status === 'ok' || c.status === 'warn');
  const criticalOk = checks.python.status === 'ok';

  const icons = {
    checking: <Loader size={18} className="prereq-spinner" />,
    ok: <CheckCircle size={18} className="prereq-ok" />,
    warn: <AlertTriangle size={18} className="prereq-warn" />,
    error: <XCircle size={18} className="prereq-error" />,
  };

  return (
    <div className="wizard-step">
      <div className="step-icon prereq-icon"><ShieldCheck size={40} /></div>
      <h3>Let's check your setup</h3>
      <p>We'll scan your system to make sure everything is ready before we begin.</p>

      <div className="prereq-list">
        {Object.entries(checks).map(([key, check]) => (
          <div key={key} className={`prereq-item prereq-${check.status}`}>
            <div className="prereq-left">
              {icons[check.status]}
              <div>
                <div className="prereq-label">{check.label}</div>
                <div className="prereq-hint">
                  {check.status === 'warn' && key === 'ollama'
                    ? 'Not running — you can start it after this step'
                    : check.hint}
                </div>
              </div>
            </div>
            {(check.status === 'error' || (check.status === 'warn' && key !== 'ollama')) && (
              <a href={check.link} target="_blank" rel="noreferrer" className="prereq-link">
                Install <ExternalLink size={12} />
              </a>
            )}
          </div>
        ))}
      </div>

      <button className="secondary-button refresh-btn" onClick={runChecks}>
        <RefreshCw size={15} /> Re-scan
      </button>

      <button
        className="primary-button wizard-next"
        onClick={onNext}
        disabled={!criticalOk}
      >
        {criticalOk ? <>Continue <ArrowRight size={18} /></> : 'Fix issues above to continue'}
      </button>
    </div>
  );
};

// ─── Step 1: Profile ─────────────────────────────────────────────────────────
const ProfileStep = ({ onNext }) => {
  const [profile, setProfile] = useState({ name: '', email: '', asuid: '' });

  const handleSubmit = async (e) => {
    e.preventDefault();
    await fetch(`${API}/api/setup/save`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_name: profile.name,
        user_email: profile.email,
        user_asuid: profile.asuid
      })
    });
    onNext();
  };

  return (
    <form className="wizard-step" onSubmit={handleSubmit}>
      <div className="step-icon"><User size={40} /></div>
      <h3>Personalize your experience</h3>
      <p>This info auto-fills your reports so you never have to type it again.</p>

      <div className="input-group">
        <label>Full Name</label>
        <input required type="text" placeholder="e.g. Sparky the Sun Devil"
          value={profile.name} onChange={e => setProfile({ ...profile, name: e.target.value })} />
      </div>

      <div className="input-group">
        <label>ASU ID</label>
        <input required type="text" placeholder="10-digit ID"
          value={profile.asuid} onChange={e => setProfile({ ...profile, asuid: e.target.value })} />
      </div>

      <div className="input-group">
        <label>Email</label>
        <input required type="email" placeholder="sparky@asu.edu"
          value={profile.email} onChange={e => setProfile({ ...profile, email: e.target.value })} />
      </div>

      <button type="submit" className="primary-button wizard-next">
        Next Step <ArrowRight size={18} />
      </button>
    </form>
  );
};

// ─── Step 2: AI Setup ─────────────────────────────────────────────────────────
const AIStep = ({ onNext }) => {
  const [status, setStatus] = useState(null);
  const [hardware, setHardware] = useState(null);
  const [checking, setChecking] = useState(true);
  const [isPulling, setIsPulling] = useState(false);
  const [pullError, setPullError] = useState('');
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [downloadStatus, setDownloadStatus] = useState('');

  const checkAll = async () => {
    setChecking(true);
    try {
      const [statusRes, hwRes] = await Promise.all([
        fetch(`${API}/api/setup/status`),
        fetch(`${API}/api/setup/hardware`)
      ]);
      setStatus(await statusRes.json());
      setHardware(await hwRes.json());
    } catch (err) {
      console.error(err);
    }
    setChecking(false);
  };

  useEffect(() => { checkAll(); }, []);

  // Poll when Ollama is not running
  useEffect(() => {
    if (status && !status.ollama_running) {
      const id = setInterval(async () => {
        const res = await fetch(`${API}/api/setup/status`);
        const data = await res.json();
        setStatus(data);
        if (data.ollama_running) clearInterval(id);
      }, 2500);
      return () => clearInterval(id);
    }
  }, [status?.ollama_running]);

  const startDownload = async () => {
    setIsPulling(true); setPullError(''); setDownloadProgress(0); setDownloadStatus('Starting…');
    await fetch(`${API}/api/setup/save`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        llm_model: hardware.recommended_model,
        llm_model_level: hardware.recommendation_level
      })
    });

    const es = new EventSource(`${API}/api/setup/pull/stream?model_name=${hardware.recommended_model}`);
    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.status === 'success') { es.close(); setIsPulling(false); onNext(); }
        else if (data.status === 'error') { es.close(); setIsPulling(false); setPullError(data.message || 'Failed.'); }
        else { setDownloadProgress(data.progress || 0); setDownloadStatus(data.status || 'Downloading…'); }
      } catch (e) { console.error(e); }
    };
    es.onerror = () => { es.close(); setIsPulling(false); setPullError('Connection lost. Is Ollama running?'); };
  };

  if (checking) return (
    <div className="wizard-step">
      <div className="step-icon"><Cpu size={40} /></div>
      <h3>AI Engine Setup</h3>
      <div className="scanning-row"><Loader size={18} className="prereq-spinner" /> Scanning system…</div>
    </div>
  );

  return (
    <div className="wizard-step">
      <div className="step-icon"><Cpu size={40} /></div>
      <h3>AI Engine Setup</h3>

      {!status?.ollama_running ? (
        <div className="ollama-notice">
          <h4>⚡ Ollama needs to be running</h4>
          <p>Ollama processes your reports locally — nothing leaves your computer.</p>
          <ol>
            <li>Download &amp; install from <a href="https://ollama.com" target="_blank" rel="noreferrer">Ollama.com</a></li>
            <li>Open the Ollama app</li>
            <li>Come back here — we'll detect it automatically</li>
          </ol>
          <div className="scanning-row"><Loader size={16} className="prereq-spinner" /> Waiting for Ollama…</div>
          <button className="secondary-button" style={{ marginTop: '1rem', border: 'none', background: 'transparent', color: '#64748b' }} onClick={onNext}>
            Skip for now
          </button>
        </div>
      ) : (
        <>
          {hardware && (
            <div className="hardware-scan">
              <div className="hardware-result">
                <div className="stat">RAM: <strong>{hardware.ram_gb} GB</strong></div>
                <div className="stat">Tier: <strong className="tier-badge">{hardware.recommendation_level}</strong></div>
              </div>
              <div className="model-box">
                <p>Recommended model for your system:</p>
                <h4>{hardware.recommended_model}</h4>
              </div>
            </div>
          )}

          {isPulling ? (
            <div style={{ width: '100%' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.6rem', fontSize: '0.9rem' }}>
                <span style={{ color: 'var(--accent-color)', fontWeight: 500 }}>{downloadStatus}</span>
                <span style={{ fontWeight: 'bold' }}>{downloadProgress}%</span>
              </div>
              <div className="wz-progress-track">
                <div className="wz-progress-fill" style={{ width: `${downloadProgress}%` }} />
              </div>
              <p style={{ marginTop: '0.8rem', fontSize: '0.8rem', color: 'var(--text-secondary)', textAlign: 'center' }}>
                This may take a few minutes…
              </p>
            </div>
          ) : (
            <>
              {pullError && <div className="error-message">{pullError}</div>}
              <button className="primary-button wizard-next" onClick={startDownload}>
                Download AI Model <Download size={18} />
              </button>
              <button className="secondary-button" onClick={onNext}
                style={{ marginTop: '8px', width: '100%', border: 'none', background: 'transparent', color: '#64748b', fontSize: '0.9rem' }}>
                Skip — use a model I already have
              </button>
            </>
          )}
        </>
      )}
    </div>
  );
};

// ─── Step 3: Data Import ───────────────────────────────────────────────────────
const DataStep = ({ onFinish }) => {
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState(null);
  const [syncSuccess, setSyncSuccess] = useState(false);
  const [sheetOptions, setSheetOptions] = useState([]);
  const [pendingFile, setPendingFile] = useState(null);
  const fileInputRef = useRef(null);

  const handleSync = async (eventOrSheetName) => {
    let file = null, sheetName = null;
    if (eventOrSheetName?.target?.files) {
      file = eventOrSheetName.target.files[0];
      setPendingFile(file);
    } else if (typeof eventOrSheetName === 'string') {
      file = pendingFile; sheetName = eventOrSheetName;
    }
    if (!file) return;
    setIsSyncing(true); setSyncStatus({ message: `Uploading ${file.name}…`, type: 'info' });
    const formData = new FormData();
    formData.append('file', file);
    if (sheetName) formData.append('sheet_name', sheetName);
    try {
      const res = await axios.post(`${API}/api/sync`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      setSyncStatus({ 
        message: res.data.message, 
        type: 'success', 
        count: res.data.synced_count,
        file: file.name,
        backup: res.data.backup_collection
      }); 
      setSyncSuccess(true); setSheetOptions([]); setPendingFile(null);
    } catch (err) {
      if (err.response?.data?.requires_sheet_selection) {
        setSyncStatus({ message: 'Multiple sheets found — pick one below:', type: 'selection' }); 
        setSheetOptions(err.response.data.sheets);
      } else {
        setSyncStatus({ message: err.response?.data?.error || 'Unexpected error.', type: 'error' }); 
        setPendingFile(null);
      }
    } finally {
      setIsSyncing(false);
      if (eventOrSheetName?.target) eventOrSheetName.target.value = '';
    }
  };

  return (
    <div className="wizard-step success-step">
      <div className="step-icon upload-icon"><Upload size={40} /></div>
      <h3>Import Your Resident Data</h3>
      <p>Upload your Excel tracker to pre-populate the database. You can always do this later.</p>

      <div className="upload-container">
        <input type="file" ref={fileInputRef} style={{ display: 'none' }} accept=".xlsx,.xls" onChange={handleSync} />

        <button
          className={`primary-button wizard-next ${isSyncing ? 'loading' : ''}`}
          onClick={() => fileInputRef.current.click()}
          disabled={isSyncing || syncSuccess}
        >
          {isSyncing ? <><Loader className="spinner" size={18} /> Uploading…</>
            : syncSuccess ? <><CheckCircle size={18} /> Uploaded!</>
              : <><Upload size={18} /> Upload Excel Tracker</>}
        </button>

        {syncStatus && syncStatus.type === 'success' ? (
          <div className="sync-success-card">
            <div className="success-header">
              <div className="success-badge"><CheckCircle size={16} /> Data Synced</div>
              <span className="success-timestamp">{new Date().toLocaleTimeString()}</span>
            </div>
            <div className="success-body">
              <div className="success-stat">
                <span className="stat-value">{syncStatus.count}</span>
                <span className="stat-label">Residents</span>
              </div>
              <div className="success-details">
                <div className="detail-item">
                  <span className="detail-label">Source</span>
                  <span className="detail-value">{syncStatus.file}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Backup</span>
                  <span className="detail-value mono">{syncStatus.backup}</span>
                </div>
              </div>
            </div>
          </div>
        ) : syncStatus && (
          <div className={`sync-status ${syncStatus.type === 'error' ? 'error-text' : syncStatus.type === 'selection' ? 'warning-text' : ''}`}>
            {syncStatus.type === 'error' ? <XCircle size={16} /> : (syncStatus.type === 'info' ? <Loader className="spinner" size={16} /> : <AlertTriangle size={16} />)}
            {syncStatus.message}
          </div>
        )}

        {sheetOptions.length > 0 && (
          <div className="sheet-selection-list">
            {sheetOptions.map(sheet => (
              <button key={sheet} className="secondary-button sheet-btn"
                onClick={() => handleSync(sheet)} disabled={isSyncing}>
                {sheet}
              </button>
            ))}
          </div>
        )}
      </div>

      <button
        className="secondary-button wizard-next"
        onClick={onFinish}
        style={syncSuccess ? { background: '#10b981', color: 'white', borderColor: '#10b981', marginTop: '0.5rem' } : { marginTop: '0.5rem' }}
      >
        {syncSuccess ? 'Enter Dashboard' : 'Skip & Enter Dashboard'} <ArrowRight size={18} />
      </button>
    </div>
  );
};


// ─── Main Wizard ──────────────────────────────────────────────────────────────
const STEPS = [
  { label: 'Check' },
  { label: 'Profile' },
  { label: 'AI' },
  { label: 'Data' },
];

const WelcomeWizard = ({ onComplete }) => {
  const [step, setStep] = useState(0);

  const finishSetup = async () => {
    await fetch(`${API}/api/setup/save`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ setup_complete: 'true' })
    });
    onComplete();
  };

  const next = () => setStep(s => s + 1);

  return (
    <div className="wizard-overlay">
      <div className="wizard-modal glass-panel">

        {/* ── Header ── */}
        <div className="wizard-header">
          <div className="wizard-logo">
            <Zap size={22} className="wizard-logo-icon" />
            <span>Weekly Reporter</span>
          </div>
          <h2>Welcome! Let's get you set up.</h2>

          {/* Progress bar */}
          <div className="wizard-progress">
            {STEPS.map((s, i) => (
              <React.Fragment key={i}>
                <div className={`progress-dot ${step >= i ? 'active' : ''} ${step === i ? 'current' : ''}`}>
                  {step > i ? <CheckCircle size={8} /> : null}
                </div>
                {i < STEPS.length - 1 && (
                  <div className={`progress-line ${step > i ? 'active' : ''}`} />
                )}
              </React.Fragment>
            ))}
          </div>
          <div className="step-label">Step {step + 1} of {STEPS.length} — {STEPS[step].label}</div>
        </div>

        {/* ── Step Content ── */}
        <div key={step} className="step-wrapper">
          {step === 0 && <PrereqStep onNext={next} />}
          {step === 1 && <ProfileStep onNext={next} />}
          {step === 2 && <AIStep onNext={next} />}
          {step === 3 && <DataStep onFinish={finishSetup} />}
        </div>

      </div>
    </div>
  );
};

export default WelcomeWizard;
