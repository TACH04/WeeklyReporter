import React, { useState, useEffect } from 'react';
import { User, X, Save, Edit2, Brain, Cpu, CheckCircle2, Download, Trash2, HelpCircle } from 'lucide-react';
import './WelcomeWizard.css';

export default function ProfileModal({ isOpen, onClose, setupStatus, onSaveComplete, onResetSetup }) {
    const [profile, setProfile] = useState({ name: '', email: '', asuid: '' });
    const [isSaving, setIsSaving] = useState(false);
    const [message, setMessage] = useState('');
    const [isEditing, setIsEditing] = useState(false);
    const [hardwareRec, setHardwareRec] = useState(null);
    const [pullingModel, setPullingModel] = useState(null);
    const [pullProgress, setPullProgress] = useState(0);
    const [pullStatus, setPullStatus] = useState('');

    useEffect(() => {
        if (isOpen && setupStatus?.settings) {
            setProfile({
                name: setupStatus.settings.user_name || '',
                email: setupStatus.settings.user_email || '',
                asuid: setupStatus.settings.user_asuid || ''
            });
            setMessage('');
            setIsEditing(!(setupStatus.settings.user_name && setupStatus.settings.user_asuid));
            fetchHardwareRec();
        }
    }, [isOpen, setupStatus]);

    const fetchHardwareRec = async () => {
        try {
            const res = await fetch('http://localhost:5001/api/setup/hardware');
            const data = await res.json();
            setHardwareRec(data);
        } catch (err) {
            console.error("Failed to fetch hardware recommendation", err);
        }
    };

    if (!isOpen) return null;

    const handleSave = async (e) => {
        e.preventDefault();
        setIsSaving(true);
        setMessage('Saving...');
        try {
            await fetch('http://localhost:5001/api/setup/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_name: profile.name,
                    user_email: profile.email,
                    user_asuid: profile.asuid
                })
            });
            setMessage('Profile saved successfully!');
            setTimeout(() => {
                onSaveComplete(profile.asuid);
                setIsEditing(false);
                setMessage('');
            }, 1000);
        } catch (err) {
            console.error("Failed to save profile", err);
            setMessage('Failed to save profile. Please try again.');
        }
        setIsSaving(false);
    };

    const handleModelSelect = async (level, modelName) => {
        setIsSaving(true);
        try {
            await fetch('http://localhost:5001/api/setup/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    llm_model: modelName,
                    llm_model_level: level
                })
            });
            // Update local setupStatus via parent if needed, but for now just show message
            setMessage(`Switched to ${level} model: ${modelName}`);
            setTimeout(() => setMessage(''), 3000);
            
            // Refresh setup status in parent
            if (onSaveComplete) onSaveComplete(profile.asuid);
        } catch (err) {
            console.error("Failed to save model setting", err);
            setMessage('Failed to update model setting.');
        }
        setIsSaving(false);
    };

    const handlePullModel = async (modelName) => {
        setPullingModel(modelName);
        setPullProgress(0);
        setPullStatus('Starting...');
        
        const eventSource = new EventSource(`http://localhost:5001/api/setup/pull/stream?model_name=${modelName}`);

        eventSource.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                if (data.status === 'success') {
                    eventSource.close();
                    setPullingModel(null);
                    setMessage(`Successfully pulled ${modelName}`);
                    if (onSaveComplete) onSaveComplete(profile.asuid);
                } else if (data.status === 'error') {
                    eventSource.close();
                    setPullingModel(null);
                    setMessage(`Failed to pull ${modelName}: ${data.message}`);
                } else {
                    setPullProgress(data.progress || 0);
                    setPullStatus(data.status || 'Downloading...');
                }
            } catch (err) {
                console.error("Error parsing Profile SSE data", err);
            }
        };

        eventSource.onerror = (err) => {
            console.error("Profile EventSource failed:", err);
            eventSource.close();
            setPullingModel(null);
            setMessage('Connection lost during download.');
        };
    };

    const handleDeleteModel = async (modelName) => {
        if (!window.confirm(`Are you sure you want to delete the ${modelName} model?`)) return;
        
        setIsSaving(true);
        try {
            const res = await fetch('http://localhost:5001/api/setup/delete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ model_name: modelName })
            });
            const data = await res.json();
            if (data.success) {
                setMessage(`Successfully deleted ${modelName}`);
                if (onSaveComplete) onSaveComplete(profile.asuid);
            } else {
                setMessage(`Failed to delete ${modelName}: ${data.error}`);
            }
        } catch (err) {
            console.error("Failed to delete model", err);
            setMessage('Error deleting model.');
        }
        setIsSaving(false);
    };

    const modelLevels = [
        { level: 'Low', name: 'qwen2.5:1.5b', desc: 'Fastest, works on any hardware' },
        { level: 'Medium', name: 'qwen2.5:3b', desc: 'Balanced speed and quality' },
        { level: 'High', name: 'llama3.1:8b', desc: 'Premium quality, recommended for 16GB+ RAM' }
    ];

    const currentModelLevel = setupStatus?.settings?.llm_model_level || 
        modelLevels.find(m => m.name === setupStatus?.settings?.llm_model)?.level || 
        'Medium';


    return (
        <div className="wizard-overlay" style={{ zIndex: 3000 }}>
            <div className="wizard-modal glass-panel profile-modal-wide" style={{ position: 'relative' }}>
                <button 
                    onClick={onClose} 
                    style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
                >
                    <X size={24} />
                </button>
                
                <div className="modal-two-columns">
                    {/* Left Column: Profile Info */}
                    <div className="modal-column">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                            <div style={{ padding: '0.75rem', background: 'rgba(88, 166, 255, 0.1)', borderRadius: '12px', color: 'var(--accent-color)' }}>
                                <User size={28} />
                            </div>
                            <div>
                                <h2 style={{ margin: 0, fontSize: '1.5rem' }}>Your Profile</h2>
                            </div>
                        </div>

                        {!isEditing ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                                <div className="profile-info-grid" style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1rem' }}>
                                    <div className="info-group" style={{ background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--surface-border)' }}>
                                        <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Full Name</label>
                                        <div style={{ fontSize: '1.1rem', fontWeight: '500', marginTop: '0.25rem' }}>{profile.name || 'Not set'}</div>
                                    </div>
                                    <div className="info-group" style={{ background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--surface-border)' }}>
                                        <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>ASU ID</label>
                                        <div style={{ fontSize: '1.1rem', fontWeight: '500', marginTop: '0.25rem' }}>{profile.asuid || 'Not set'}</div>
                                    </div>
                                    <div className="info-group" style={{ background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--surface-border)' }}>
                                        <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Email</label>
                                        <div style={{ fontSize: '1.1rem', fontWeight: '500', marginTop: '0.25rem' }}>{profile.email || 'Not set'}</div>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '0.5rem' }}>
                                    <button type="button" className="btn btn-primary" onClick={() => setIsEditing(true)}>
                                        <Edit2 size={18} />
                                        Edit Profile
                                    </button>
                                    <button 
                                        type="button" 
                                        className="btn btn-secondary" 
                                        onClick={() => {
                                            if (window.confirm("Launch the setup tutorial again? You won't lose your data.")) {
                                                onResetSetup();
                                            }
                                        }}
                                        style={{ borderStyle: 'dashed' }}
                                    >
                                        <HelpCircle size={18} />
                                        Replay Tutorial
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                                <div className="input-group">
                                    <label className="input-label">Full Name</label>
                                    <input 
                                        required 
                                        type="text" 
                                        className="premium-input"
                                        style={{ width: '100%' }}
                                        placeholder="e.g. Sparky the Sun Devil"
                                        value={profile.name}
                                        onChange={e => setProfile({...profile, name: e.target.value})}
                                    />
                                </div>
                            
                            <div className="input-group">
                                <label className="input-label">ASU ID</label>
                                <input 
                                    required 
                                    type="text" 
                                    className="premium-input"
                                    style={{ width: '100%' }}
                                    placeholder="10-digit ID"
                                    value={profile.asuid}
                                    onChange={e => setProfile({...profile, asuid: e.target.value})}
                                />
                            </div>

                            <div className="input-group">
                                <label className="input-label">Email</label>
                                <input 
                                    required 
                                    type="email" 
                                    className="premium-input"
                                    style={{ width: '100%' }}
                                    placeholder="sparky@asu.edu"
                                    value={profile.email}
                                    onChange={e => setProfile({...profile, email: e.target.value})}
                                />
                            </div>

                            {message && (
                                <div style={{ 
                                    padding: '0.75rem', 
                                    borderRadius: '8px', 
                                    background: message.includes('success') ? 'rgba(46, 160, 67, 0.1)' : 'rgba(248, 81, 73, 0.1)',
                                    color: message.includes('success') ? 'var(--success-color)' : 'var(--danger-color)',
                                    fontSize: '0.9rem',
                                    textAlign: 'center'
                                }}>
                                    {message}
                                </div>
                            )}

                            <div style={{ display: 'flex', justifyContent: 'flex-start', gap: '1rem', marginTop: '0.5rem' }}>
                                <button type="button" className="btn btn-secondary" onClick={() => setIsEditing(false)} disabled={isSaving}>
                                    Cancel
                                </button>
                                <button type="submit" className="btn btn-primary" disabled={isSaving}>
                                    <Save size={18} />
                                    {isSaving ? 'Saving...' : 'Save Changes'}
                                </button>
                            </div>
                        </form>
                        )}
                    </div>

                    {/* Right Column: AI Model Settings */}
                    <div className="modal-column" style={{ paddingLeft: '2.5rem', borderLeft: '1px solid var(--surface-border)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                            <div style={{ padding: '0.6rem', background: 'rgba(139, 92, 246, 0.1)', borderRadius: '10px', color: '#8b5cf6' }}>
                                <Brain size={24} />
                            </div>
                            <div>
                                <h3 style={{ margin: 0, fontSize: '1.2rem' }}>AI Model Settings</h3>
                            </div>
                        </div>

                        <div className="model-selector-vertical">
                            {modelLevels.map((m) => {
                                const isRecommended = hardwareRec?.recommendation_level === m.level;
                                const isActive = currentModelLevel === m.level;
                                const isInstalled = setupStatus?.installed_models?.some(im => im.startsWith(m.name));

                                return (
                                    <div 
                                        key={m.level}
                                        className={`model-card ${isActive ? 'active' : ''}`}
                                        style={{ cursor: 'pointer', padding: '1.25rem' }}
                                        onClick={() => handleModelSelect(m.level, m.name)}
                                    >
                                        {isRecommended && <div className="recommended-badge">Recommended</div>}
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                <div className="model-level" style={{ marginBottom: 0 }}>{m.level}</div>
                                                <span style={{ color: 'rgba(255,255,255,0.2)' }}>•</span>
                                                <div className="model-name-label" style={{ marginTop: 0 }}>{m.desc}</div>
                                            </div>
                                            {isActive && isInstalled && <CheckCircle2 size={18} style={{ color: 'var(--success-color)' }} />}
                                        </div>

                                        
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem' }}>
                                            {pullingModel === m.name ? (
                                                <div style={{ width: '100%', marginTop: '0.25rem' }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem', fontSize: '0.75rem' }}>
                                                        <span style={{ color: 'var(--accent-color)', fontWeight: '500' }}>{pullStatus}...</span>
                                                        <span>{pullProgress}%</span>
                                                    </div>
                                                    <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', overflow: 'hidden' }}>
                                                        <div 
                                                            style={{ 
                                                                width: `${pullProgress}%`, 
                                                                height: '100%', 
                                                                background: 'var(--accent-color)',
                                                                transition: 'width 0.3s ease'
                                                            }}
                                                        ></div>
                                                    </div>
                                                </div>
                                            ) : (
                                                <>
                                                    <div className="status-indicator" style={{ marginTop: 0, display: 'flex', alignItems: 'center' }}>
                                                        <div className={`status-dot ${isInstalled ? 'installed' : 'missing'}`}></div>
                                                        <span style={{ color: isInstalled ? 'var(--success-color)' : 'var(--text-secondary)' }}>
                                                            {isInstalled ? 'Installed' : 'Not Found'}
                                                        </span>
                                                        {isInstalled && (
                                                            <button 
                                                                onClick={(e) => { e.stopPropagation(); handleDeleteModel(m.name); }}
                                                                style={{ background: 'transparent', border: 'none', color: 'var(--danger-color)', cursor: 'pointer', padding: '0 4px', marginLeft: '12px', opacity: 0.7, display: 'flex', alignItems: 'center' }}
                                                                title="Delete model"
                                                            >
                                                                <Trash2 size={14} />
                                                            </button>
                                                        )}
                                                    </div>


                                                    {!isInstalled && (
                                                        <button 
                                                            className="btn btn-secondary" 
                                                            style={{ padding: '0.35rem 0.75rem', fontSize: '0.7rem', width: 'auto', gap: '0.5rem' }}
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handlePullModel(m.name);
                                                            }}
                                                            disabled={pullingModel !== null}
                                                        >
                                                            <Download size={12} />
                                                            Pull Model
                                                        </button>
                                                    )}
                                                </>
                                            )}
                                        </div>


                                    </div>
                                );
                            })}
                        </div>

                        <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', border: '1px solid var(--surface-border)' }}>
                            <Cpu size={18} style={{ color: 'var(--text-secondary)' }} />
                            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                System: <strong style={{ color: 'var(--text-primary)' }}>{hardwareRec?.ram_gb || '??'} GB RAM</strong>
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
