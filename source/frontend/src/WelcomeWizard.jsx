import React, { useState, useEffect, useRef } from 'react';
import './WelcomeWizard.css';
import { User, Cpu, Download, CheckCircle, ArrowRight, Loader, Upload, XCircle } from 'lucide-react';
import axios from 'axios';

const WelcomeWizard = ({ onComplete }) => {
  const [step, setStep] = useState(1);
  const [status, setStatus] = useState(null);
  
  // Step 1 State
  const [profile, setProfile] = useState({ name: '', email: '', asuid: '' });
  
  // Step 2 State
  const [hardware, setHardware] = useState(null);
  const [checkingHardware, setCheckingHardware] = useState(false);
  const [isPulling, setIsPulling] = useState(false);
  const [pullError, setPullError] = useState('');
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [downloadStatus, setDownloadStatus] = useState('');

  // Step 3 State
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState('');
  const [syncSuccess, setSyncSuccess] = useState(false);
  const fileInputRef = useRef(null);

  const [sheetOptions, setSheetOptions] = useState([]);
  const [pendingFile, setPendingFile] = useState(null);

  useEffect(() => {
    // Initial status check
    const checkStatus = () => {
      fetch('http://localhost:5001/api/setup/status')
        .then(res => res.json())
        .then(data => setStatus(data))
        .catch(console.error);
    };

    checkStatus();

    // Set up polling for Ollama status if we're on the AI setup step and it's not running
    let interval;
    if (step === 2 && status && !status.ollama_running) {
      interval = setInterval(checkStatus, 2000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [step, status?.ollama_running]);

  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    await fetch('http://localhost:5001/api/setup/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_name: profile.name,
        user_email: profile.email,
        user_asuid: profile.asuid
      })
    });
    setStep(2);
    checkHardware();
  };

  const checkHardware = async () => {
    setCheckingHardware(true);
    try {
      const res = await fetch('http://localhost:5001/api/setup/hardware');
      const data = await res.json();
      setHardware(data);
      
      // Update the status to see if Ollama is running and has models
      const statusRes = await fetch('http://localhost:5001/api/setup/status');
      setStatus(await statusRes.json());
      
    } catch (err) {
      console.error("Hardware check failed", err);
    }
    setCheckingHardware(false);
  };

  const startDownload = async () => {
    setIsPulling(true);
    setPullError('');
    setDownloadProgress(0);
    setDownloadStatus('Starting download...');
    
    // Save model preference
    await fetch('http://localhost:5001/api/setup/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ llm_model: hardware.recommended_model })
    });

    const eventSource = new EventSource(`http://localhost:5001/api/setup/pull/stream?model_name=${hardware.recommended_model}`);

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.status === 'success') {
          eventSource.close();
          setIsPulling(false);
          setStep(3);
        } else if (data.status === 'error') {
          eventSource.close();
          setIsPulling(false);
          setPullError(data.message || "Failed to download model.");
        } else {
          setDownloadProgress(data.progress || 0);
          setDownloadStatus(data.status || 'Downloading...');
        }
      } catch (err) {
        console.error("Error parsing SSE data", err);
      }
    };

    eventSource.onerror = (err) => {
      console.error("EventSource failed:", err);
      eventSource.close();
      setIsPulling(false);
      setPullError("Connection lost. Make sure Ollama is running.");
    };
  };

  const handleSync = async (eventOrSheetName) => {
    let file = null;
    let sheetName = null;

    if (eventOrSheetName?.target?.files) {
        file = eventOrSheetName.target.files[0];
        setPendingFile(file);
    } else if (typeof eventOrSheetName === 'string') {
        file = pendingFile;
        sheetName = eventOrSheetName;
    }

    if (!file) return;

    setIsSyncing(true);
    setSyncStatus(`Uploading and syncing ${file.name}...`);
    
    const formData = new FormData();
    formData.append('file', file);
    if (sheetName) {
        formData.append('sheet_name', sheetName);
    }

    try {
        const res = await axios.post(`http://localhost:5001/api/sync`, formData, {
            headers: {
                'Content-Type': 'multipart/form-data'
            }
        });
        setSyncStatus(`Success: ${res.data.message}`);
        setSyncSuccess(true);
        setSheetOptions([]);
        setPendingFile(null);
    } catch (err) {
        console.error("Sync error:", err);
        if (err.response?.data?.requires_sheet_selection) {
            setSyncStatus("Please select a sheet to sync.");
            setSheetOptions(err.response.data.sheets);
        } else if (err.response?.data?.error) {
            setSyncStatus(`Error: ${err.response.data.error}`);
            setPendingFile(null);
        } else {
            setSyncStatus("An unexpected error occurred during sync.");
            setPendingFile(null);
        }
    } finally {
        setIsSyncing(false);
        if (eventOrSheetName?.target) {
            eventOrSheetName.target.value = '';
        }
    }
  };

  const finishSetup = async () => {
    await fetch('http://localhost:5001/api/setup/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ setup_complete: 'true' })
    });
    onComplete();
  };

  if (!status) return <div className="wizard-overlay"><Loader className="spinner" /></div>;

  return (
    <div className="wizard-overlay">
      <div className="wizard-modal glass-panel">
        <div className="wizard-header">
          <h2>Welcome to Weekly Reporter</h2>
          <div className="wizard-progress">
            <div className={`progress-dot ${step >= 1 ? 'active' : ''}`}></div>
            <div className={`progress-line ${step >= 2 ? 'active' : ''}`}></div>
            <div className={`progress-dot ${step >= 2 ? 'active' : ''}`}></div>
            <div className={`progress-line ${step >= 3 ? 'active' : ''}`}></div>
            <div className={`progress-dot ${step >= 3 ? 'active' : ''}`}></div>
          </div>
        </div>

        {step === 1 && (
          <form className="wizard-step" onSubmit={handleProfileSubmit}>
            <div className="step-icon"><User size={40} /></div>
            <h3>Let's personalize your experience</h3>
            <p>This information will be used to auto-fill your reports.</p>
            
            <div className="input-group">
              <label>Full Name</label>
              <input 
                required 
                type="text" 
                placeholder="e.g. Sparky the Sun Devil"
                value={profile.name}
                onChange={e => setProfile({...profile, name: e.target.value})}
              />
            </div>
            
            <div className="input-group">
              <label>ASU ID</label>
              <input 
                required 
                type="text" 
                placeholder="10-digit ID"
                value={profile.asuid}
                onChange={e => setProfile({...profile, asuid: e.target.value})}
              />
            </div>

            <div className="input-group">
              <label>Email</label>
              <input 
                required 
                type="email" 
                placeholder="sparky@asu.edu"
                value={profile.email}
                onChange={e => setProfile({...profile, email: e.target.value})}
              />
            </div>

            <button type="submit" className="primary-button wizard-next">
              Next Step <ArrowRight size={18} />
            </button>
          </form>
        )}

        {step === 2 && (
          <div className="wizard-step">
            <div className="step-icon"><Cpu size={40} /></div>
            <h3>AI Engine Setup</h3>
            
            {!status.ollama_running ? (
              <div className="ollama-notice">
                <div className="notice-content">
                  <h4>Ollama is required for AI features</h4>
                  <p>Ollama is the local AI engine that writes your reports securely on your computer, without needing the cloud.</p>
                  <ol>
                    <li>Download & install from <a href="https://ollama.com" target="_blank" rel="noreferrer">Ollama.com</a></li>
                    <li>Open the Ollama app to start it running</li>
                    <li>Click the refresh button below</li>
                  </ol>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button className="secondary-button" onClick={checkHardware} style={{ flex: 1 }}>
                      Check Again
                    </button>
                    <button className="secondary-button" onClick={finishSetup} style={{ flex: 1, border: 'none', background: 'transparent', color: '#64748b' }}>
                      Skip for now
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="hardware-scan">
                {checkingHardware ? (
                  <div className="scanning"><Loader className="spinner" /> Scanning system capabilities...</div>
                ) : hardware && (
                  <>
                    <div className="hardware-result">
                      <div className="stat">System RAM: <strong>{hardware.ram_gb} GB</strong></div>
                      <div className="stat">Recommended Tier: <strong className="tier-badge">{hardware.recommendation_level}</strong></div>
                    </div>
                    
                    <div className="model-box">
                      <p>We'll download the perfect AI model for your computer:</p>
                      <h4>{hardware.recommended_model}</h4>
                    </div>

                    {isPulling ? (
                      <div className="downloading-state" style={{ width: '100%', marginTop: '1rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.6rem', fontSize: '0.9rem' }}>
                            <span style={{ fontWeight: '500', color: 'var(--accent-color)' }}>
                              {downloadStatus === 'downloading' ? 'Downloading model...' : downloadStatus || 'Starting...'}
                            </span>
                            <span style={{ fontWeight: 'bold' }}>{downloadProgress}%</span>
                        </div>
                        <div className="progress-bar-container" style={{ width: '100%', height: '10px', background: 'rgba(255,255,255,0.1)', borderRadius: '6px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.05)' }}>
                            <div 
                                className="progress-bar-fill" 
                                style={{ 
                                    width: `${downloadProgress}%`, 
                                    height: '100%', 
                                    background: 'linear-gradient(90deg, #3b82f6, #60a5fa)', 
                                    transition: 'width 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                                    boxShadow: '0 0 10px rgba(59, 130, 246, 0.5)'
                                }}
                            ></div>
                        </div>
                        <p style={{ marginTop: '0.8rem', fontSize: '0.8rem', color: 'var(--text-secondary)', textAlign: 'center' }}>
                            This may take a few minutes depending on your internet connection...
                        </p>
                      </div>
                    ) : (
                      <>
                        {pullError && <div className="error-message">{pullError}</div>}
                        <button className="primary-button wizard-next" onClick={startDownload}>
                          Download AI Model <Download size={18} />
                        </button>
                        <button 
                          className="secondary-button" 
                          onClick={() => setStep(3)} 
                          style={{ marginTop: '10px', width: '100%', border: 'none', background: 'transparent', color: '#64748b', fontSize: '0.9rem' }}
                        >
                          Skip and set up later
                        </button>
                      </>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {step === 3 && (
          <div className="wizard-step success-step">
            <div className="step-icon upload-icon"><Upload size={60} /></div>
            <h3>Final Step: Import Your Data</h3>
            <p>Upload your Excel tracker to easily set up your database.</p>
            
            <div className="upload-container">
              <input 
                type="file" 
                ref={fileInputRef}
                style={{ display: 'none' }} 
                accept=".xlsx, .xls"
                onChange={handleSync}
              />
              <button 
                className={`primary-button wizard-next enter-dashboard ${isSyncing ? 'loading' : ''}`} 
                onClick={() => fileInputRef.current.click()}
                disabled={isSyncing || syncSuccess}
              >
                {isSyncing ? (
                  <><Loader className="spinner" size={18} /> Uploading...</>
                ) : syncSuccess ? (
                  <><CheckCircle size={18} /> Uploaded</>
                ) : (
                  <><Upload size={18} /> Upload Excel Tracker</>
                )}
              </button>
              
              {syncStatus && (
                <div className={`sync-status ${syncStatus.startsWith('Error') ? 'error-text' : 'success-text'}`}>
                    {syncStatus.startsWith('Error') ? <XCircle size={16} /> : <CheckCircle size={16} />}
                    {syncStatus}
                </div>
              )}
            </div>

            <button 
              className="secondary-button wizard-next" 
              onClick={finishSetup}
              style={syncSuccess ? { background: '#10b981', color: 'white', borderColor: '#10b981' } : {}}
            >
              {syncSuccess ? 'Enter Dashboard' : 'Skip & Enter Dashboard'} <ArrowRight size={18} />
            </button>
          </div>
        )}

        {sheetOptions.length > 0 && (
           <div className="wizard-overlay" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '24px' }}>
              <div className="wizard-modal glass-panel" style={{ maxWidth: '400px', width: '90%', padding: '2rem' }}>
                  <h3 style={{ marginTop: 0, fontSize: '1.5rem', marginBottom: '0.5rem' }}>Select Sheet</h3>
                  <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
                      Multiple sheets found in <strong>{pendingFile?.name}</strong>. Which one would you like to sync?
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '300px', overflowY: 'auto' }}>
                      {sheetOptions.map(sheet => (
                          <button 
                              key={sheet} 
                              className="secondary-button"
                              style={{ textAlign: 'left', padding: '1rem', justifyContent: 'flex-start' }}
                              onClick={() => handleSync(sheet)}
                              disabled={isSyncing}
                          >
                              {sheet}
                          </button>
                      ))}
                  </div>
                  <button 
                      className="secondary-button" 
                      style={{ marginTop: '1.5rem', width: '100%', border: 'none', background: 'transparent' }}
                      onClick={() => { setSheetOptions([]); setPendingFile(null); setSyncStatus(""); }}
                      disabled={isSyncing}
                  >
                      Cancel
                  </button>
              </div>
           </div>
        )}
      </div>
    </div>
  );
};

export default WelcomeWizard;
