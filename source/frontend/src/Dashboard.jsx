import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { User, CheckCircle, RefreshCcw, Send, Sparkles, Database, Trash2 } from 'lucide-react';

const API_BASE = "http://localhost:5001/api";

export default function Dashboard({
    residents, setResidents,
    selectedResidents, setSelectedResidents,
    interactions, setInteractions,
    asuId, setAsuId,
    topic, setTopic,
    hideCompleted, setHideCompleted,
    status, setStatus,
    fetchResidents,
    setupStatus,
    checkSetupStatus
}) {
    const [loading, setLoading] = useState(false);
    const [showSaveNudge, setShowSaveNudge] = useState(false);

    const submitReport = async () => {
        if (!asuId) {
            setStatus("Please set your ASU ID in your Profile first.");
            return;
        }
        setLoading(true);
        setStatus("Starting automation...");
        try {
            const payload = {
                asu_id: asuId,
                interactions: selectedResidents.map(r => ({
                    asu_id: r.asu_id,
                    summary: interactions[r.asu_id] || ""
                })),
                feedback: {}
            };
            await axios.post(`${API_BASE}/submit`, payload);
            setStatus("Automation ready! Don't forget to Save to Database.");
            setShowSaveNudge(true);
        } catch (err) {
            console.error("Submission error", err);
            setStatus("Automation failed.");
        }
        setLoading(false);
    };

    const saveToDatabase = async () => {
        setLoading(true);
        setStatus("Saving interactions to database...");
        try {
            const payload = {
                interactions: selectedResidents.map(r => ({
                    asu_id: r.asu_id,
                    summary: interactions[r.asu_id] || ""
                })).filter(i => i.summary.trim() !== "")
            };
            
            if (payload.interactions.length === 0) {
                setStatus("No interactions to save (empty summaries).");
                setLoading(false);
                return;
            }

            const res = await axios.post(`${API_BASE}/save`, payload);
            setStatus(res.data.message);
            setShowSaveNudge(false);
            // Refresh residents to update interaction counts immediately
            await fetchResidents();
        } catch (err) {
            console.error("Save error", err);
            setStatus("Failed to save to database.");
        }
        setLoading(false);
    };

    const toggleResident = (resident) => {
        if (selectedResidents.find(r => r.asu_id === resident.asu_id)) {
            setSelectedResidents(selectedResidents.filter(r => r.asu_id !== resident.asu_id));
        } else {
            setSelectedResidents([...selectedResidents, resident]);
        }
    };

    const generateInteractions = async () => {
        setLoading(true);
        setStatus("Generating interactions via Ollama...");
        const newInteractions = { ...interactions };

        for (const res of selectedResidents) {
            const currentContent = newInteractions[res.asu_id] || "";
            // Use local content as topic if it's short (likely a topic) or use global topic if empty
            // If it's already a full interaction (long), we skip to avoid accidental overwrites
            // unless the user specifically cleared it or typed a short topic.
            const isTopic = currentContent.length > 0 && currentContent.length < 60;
            const isEmpty = currentContent.trim() === "";

            if (isEmpty || isTopic) {
                try {
                    const residentTopic = isTopic ? currentContent : topic;
                    const response = await axios.post(`${API_BASE}/generate`, { 
                        asu_id: res.asu_id, 
                        topic: residentTopic 
                    });
                    newInteractions[res.asu_id] = response.data.interaction;
                } catch (err) {
                    console.error("Error generating for", res.asu_id, err);
                }
            }
        }

        setInteractions(newInteractions);
        setLoading(false);
        setStatus("Generation complete.");
    };

    const clearInteraction = (asuId) => {
        setInteractions(prev => ({ ...prev, [asuId]: "" }));
    };

    const regenerateInteraction = async (resident) => {
        if (!isAiReady) {
            setStatus("Error: AI setup incomplete or Ollama is not running.");
            setShowSetupNudge(true);
            return;
        }
        setLoading(true);
        setStatus(`Regenerating interaction for ${resident.first_name}...`);
        try {
            const currentContent = interactions[resident.asu_id] || "";
            const residentTopic = (currentContent.length > 0 && currentContent.length < 60) ? currentContent : topic;

            const response = await axios.post(`${API_BASE}/generate`, { 
                asu_id: resident.asu_id, 
                topic: residentTopic 
            });
            setInteractions(prev => ({ ...prev, [resident.asu_id]: response.data.interaction }));
            setStatus("Generation complete.");
        } catch (err) {
            console.error("Error generating for", resident.asu_id, err);
            setStatus("Generation failed.");
        }
        setLoading(false);
    };

    const isAiReady = setupStatus?.ollama_running && 
                      setupStatus?.installed_models?.some(m => m.includes(setupStatus?.settings?.llm_model || 'llama3.2:1b'));

    const [showSetupNudge, setShowSetupNudge] = useState(false);

    // Polling if showing nudge
    useEffect(() => {
        let interval;
        if (showSetupNudge && !isAiReady) {
            interval = setInterval(() => {
                checkSetupStatus();
            }, 2000);
        }
        return () => {
            if (interval) clearInterval(interval);
        };
    }, [showSetupNudge, isAiReady]);

    return (
        <div className="dashboard-container" style={{ gap: '0.5rem', paddingTop: '1rem' }}>
            {/* Setup Nudge Overlay */}
            {showSetupNudge && !isAiReady && (
                <div className="wizard-overlay" style={{ zIndex: 2000 }}>
                    <div className="wizard-modal glass-panel" style={{ textAlign: 'center' }}>
                        <h3>AI Setup Incomplete</h3>
                        <p>Ollama is either not running or the AI model hasn't been downloaded yet.</p>
                        <div style={{ display: 'flex', gap: '10px', marginTop: '1.5rem' }}>
                            <button className="primary-button" onClick={() => checkSetupStatus()} style={{ flex: 1 }}>
                                Check Again
                            </button>
                            <button className="secondary-button" onClick={() => setShowSetupNudge(false)} style={{ flex: 1, border: 'none', background: 'transparent' }}>
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Spotlight Nudge Overlay */}
            {showSaveNudge && (
                <div className="nudge-overlay" onClick={() => setShowSaveNudge(false)} />
            )}

            <header className="dashboard-header" style={{ paddingBottom: '0.25rem', marginBottom: '0.5rem', borderBottom: 'none' }}>
                <h1 className="header-title gradient-text" style={{ fontSize: '1.1rem' }}>
                    Weekly Report Automator
                </h1>
            </header>

            <div className="dashboard-grid">
                {/* Resident Selection */}
                <aside className="glass-panel">
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h2 className="panel-title" style={{ marginBottom: 0 }}>
                                <User className="panel-icon" size={24} />
                                Select Residents
                            </h2>
                        </div>
                        <label style={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: '0.75rem', 
                            cursor: 'pointer', 
                            padding: '0.6rem 1rem', 
                            borderRadius: 'var(--border-radius-sm)', 
                            background: 'rgba(255, 255, 255, 0.03)', 
                            border: '1px solid var(--surface-border)',
                            transition: 'all 0.2s ease'
                        }} className="filter-checkbox-label">
                            <input 
                                type="checkbox" 
                                checked={hideCompleted} 
                                onChange={() => setHideCompleted(!hideCompleted)}
                                style={{ 
                                    width: '18px', 
                                    height: '18px', 
                                    cursor: 'pointer',
                                    accentColor: 'var(--accent-color)'
                                }}
                            />
                            <span style={{ fontSize: '0.9rem', fontWeight: 500, color: 'var(--text-secondary)' }}>Hide residents with 3 Interactions</span>
                        </label>
                        {status && status !== "Please set your ASU ID in your Profile first." && (
                            <div className="status-text" style={{ textAlign: 'center', fontSize: '0.8rem', padding: '0.4rem' }}>
                                {status}
                            </div>
                        )}
                    </div>

                    <div className="resident-list">
                        {residents.filter(res => {
                            if (!hideCompleted) return true;
                            const count = res.past_interactions ? res.past_interactions.length : 0;
                            return count < 3;
                        }).map(res => {
                            const isSelected = selectedResidents.find(r => r.asu_id === res.asu_id);
                            const interactionCount = res.past_interactions ? res.past_interactions.length : 0;
                            return (
                                <div
                                    key={res.asu_id}
                                    onClick={() => toggleResident(res)}
                                    className={`resident-card ${isSelected ? 'selected' : ''}`}
                                >
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div className="resident-name">{res.first_name} {res.last_name}</div>
                                        <span className={`count-badge count-${interactionCount > 3 ? 3 : interactionCount}`} style={{ fontSize: '0.75rem', padding: '2px 8px' }} title={`${interactionCount} past interactions`}>
                                            {interactionCount}
                                        </span>
                                    </div>
                                    {isSelected && (
                                        <div style={{ position: 'absolute', right: '0.5rem', bottom: '0.5rem', color: 'var(--accent-color)' }}>
                                            <CheckCircle size={16} />
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    <div className="input-group" style={{ marginTop: '1.5rem', marginBottom: '1rem' }}>
                        <label className="input-label">
                            Custom Topic
                        </label>
                        <input
                            type="text"
                            placeholder="e.g. spring break, midterms"
                            className="premium-input"
                            value={topic}
                            onChange={(e) => setTopic(e.target.value)}
                        />
                    </div>

                    <button
                        className={`btn btn-secondary btn-large ${loading ? 'btn-spin' : ''}`}
                        style={{ marginTop: '1.5rem' }}
                        disabled={selectedResidents.length === 0 || loading}
                        onClick={() => {
                            if (!isAiReady) {
                                setStatus("Error: AI setup incomplete or Ollama is not running.");
                                setShowSetupNudge(true);
                                return;
                            }
                            generateInteractions();
                        }}
                    >
                        {loading ? <RefreshCcw className="btn-icon" size={20} /> : <Sparkles className="btn-icon" size={20} />}
                        Generate Simulations
                    </button>
                </aside>

                {/* Interaction Review */}
                <main className="review-section">
                    {selectedResidents.length === 0 ? (
                        <div className="empty-state glass-panel">
                            <User size={64} className="empty-icon" />
                            <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>No Residents Selected</h3>
                            <p>Select one or more residents from the panel to begin generating interactions.</p>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                            {selectedResidents.map(res => (
                                <div key={res.asu_id} className="interaction-card">
                                    <div className="interaction-header">
                                        <div>
                                            <div className="interaction-name">{res.first_name} {res.last_name}</div>
                                            <div className="interaction-id">ID: {res.asu_id}</div>
                                        </div>
                                        <div className="interaction-actions">
                                            <button 
                                                className="action-btn clear-btn" 
                                                onClick={() => clearInteraction(res.asu_id)}
                                                title="Clear Interaction"
                                            >
                                                <Trash2 size={14} />
                                                <span>Clear</span>
                                            </button>
                                            <button 
                                                className="action-btn regenerate-btn" 
                                                onClick={() => regenerateInteraction(res)}
                                                disabled={loading}
                                                title="Regenerate Interaction"
                                            >
                                                <RefreshCcw size={14} className={loading ? 'spin-icon' : ''} />
                                                <span>Regenerate</span>
                                            </button>
                                        </div>
                                    </div>
                                    <textarea
                                        className="premium-textarea"
                                        value={interactions[res.asu_id] || ""}
                                        onChange={(e) => setInteractions({ ...interactions, [res.asu_id]: e.target.value })}
                                        placeholder="Type a topic (e.g. 'football') and click Generate, or add details..."
                                    />
                                </div>
                            ))}

                            {!loading && (
                                <div style={{ display: 'flex', gap: '1rem' }}>
                                    <div style={{ flex: 1, position: 'relative' }}>
                                        {showSaveNudge && (
                                            <div className="nudge-tooltip">
                                                Click here to save! 💾
                                            </div>
                                        )}
                                        <button
                                            onClick={saveToDatabase}
                                            className={`btn btn-secondary btn-large ${showSaveNudge ? 'pulse-highlight' : ''}`}
                                            style={{ width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center' }}
                                        >
                                            <Database size={20} className="btn-icon" />
                                            <span>Save to Database</span>
                                        </button>
                                    </div>
                                    <div style={{ flex: 1, position: 'relative' }}>
                                        <button
                                            onClick={submitReport}
                                            className="btn btn-primary btn-large"
                                            style={{ width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center' }}
                                        >
                                            <span>Open in QuestionPro Automator</span>
                                            <Send size={20} className="btn-icon" />
                                        </button>
                                        {status === "Please set your ASU ID in your Profile first." && (
                                            <div className="status-text" style={{ 
                                                position: 'absolute', 
                                                bottom: 'calc(100% + 12px)', 
                                                right: 0,
                                                background: 'rgba(248, 81, 73, 0.1)',
                                                color: 'var(--danger-color)',
                                                border: '1px solid rgba(248, 81, 73, 0.2)',
                                                whiteSpace: 'nowrap',
                                                animation: 'none'
                                            }}>
                                                {status}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </main>
            </div>
        </div>
    );
}
