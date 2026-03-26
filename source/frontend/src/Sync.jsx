import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Database, RefreshCw, Copy, CheckCircle, XCircle, Search, FileDown, ClipboardList, Edit, Trash2, UserPlus, Save, Plus, X } from 'lucide-react';

const API_BASE = "http://localhost:5001/api";

export default function Sync({ residents, fetchResidents }) {
    const [status, setStatus] = useState("");
    const [isSyncing, setIsSyncing] = useState(false);
    const [isCopying, setIsCopying] = useState(false);
    const [loading, setLoading] = useState(false);
    const [expandedRow, setExpandedRow] = useState(null);
    const [searchTerm, setSearchTerm] = useState("");
    const [sheetOptions, setSheetOptions] = useState([]);
    const [pendingFile, setPendingFile] = useState(null);
    const [isPasteModalOpen, setIsPasteModalOpen] = useState(false);
    const [pastedData, setPastedData] = useState("");

    // CRUD State
    const [isResidentModalOpen, setIsResidentModalOpen] = useState(false);
    const [isInteractionModalOpen, setIsInteractionModalOpen] = useState(false);
    const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
    const [deleteType, setDeleteType] = useState(null); // 'resident' or 'interaction'
    const [deleteId, setDeleteId] = useState(null);
    
    const [editingResident, setEditingResident] = useState(null); // null = adding new
    const [residentForm, setResidentForm] = useState({ asu_id: '', first_name: '', last_name: '', email: '', room: '' });
    
    const [editingInteraction, setEditingInteraction] = useState(null);
    const [interactionContent, setInteractionContent] = useState("");
    
    const [isEditMode, setIsEditMode] = useState(false);

    useEffect(() => {
        if (!residents || residents.length === 0) {
            fetchResidents();
        }
    }, []);

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
        setStatus(`Uploading and syncing ${file.name}...`);
        
        const formData = new FormData();
        formData.append('file', file);
        if (sheetName) {
            formData.append('sheet_name', sheetName);
        }

        try {
            const res = await axios.post(`${API_BASE}/sync`, formData, {
                headers: {
                    'Content-Type': 'multipart/form-data'
                }
            });
            setStatus(`Success: ${res.data.message}`);
            // Automatically refresh data after a successful sync
            fetchResidents();
            setSheetOptions([]);
            setPendingFile(null);
        } catch (err) {
            console.error("Sync error:", err);
            if (err.response?.data?.requires_sheet_selection) {
                setStatus("Please select a sheet to sync.");
                setSheetOptions(err.response.data.sheets);
            } else if (err.response?.data?.error) {
                setStatus(`Error: ${err.response.data.error}`);
                setPendingFile(null);
            } else {
                setStatus("An unexpected error occurred during sync.");
                setPendingFile(null);
            }
        } finally {
            setIsSyncing(false);
            if (eventOrSheetName?.target) {
                eventOrSheetName.target.value = '';
            }
        }
    };

    const handlePasteImport = async () => {
        if (!pastedData.trim()) return;

        setIsSyncing(true);
        setStatus(`Uploading pasted data...`);
        setIsPasteModalOpen(false);

        try {
            const res = await axios.post(`${API_BASE}/sync/paste`, { text: pastedData });
            setStatus(`Success: ${res.data.message}`);
            fetchResidents();
            setPastedData("");
        } catch (err) {
            console.error("Paste sync error:", err);
            if (err.response?.data?.error) {
                setStatus(`Error: ${err.response.data.error}`);
            } else {
                setStatus("An unexpected error occurred during paste sync.");
            }
        } finally {
            setIsSyncing(false);
        }
    };

    // --- RESIDENT CRUD HANDLERS ---
    const openResidentModal = (resident = null) => {
        if (resident) {
            setEditingResident(resident);
            setResidentForm({
                asu_id: resident.asu_id,
                first_name: resident.first_name || '',
                last_name: resident.last_name || '',
                email: resident.email || '',
                room: resident.room || ''
            });
        } else {
            setEditingResident(null);
            setResidentForm({ asu_id: '', first_name: '', last_name: '', email: '', room: '' });
        }
        setIsResidentModalOpen(true);
    };

    const handleResidentSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            if (editingResident) {
                await axios.put(`${API_BASE}/residents/${editingResident.asu_id}`, residentForm);
                setStatus(`Resident ${residentForm.first_name} updated successfully.`);
            } else {
                await axios.post(`${API_BASE}/residents`, residentForm);
                setStatus(`Resident ${residentForm.first_name} added successfully.`);
            }
            setIsResidentModalOpen(false);
            fetchResidents();
        } catch (err) {
            console.error("Resident save error:", err);
            setStatus(`Error: ${err.response?.data?.error || "Failed to save resident"}`);
        } finally {
            setLoading(false);
        }
    };

    const confirmDelete = (type, id) => {
        setDeleteType(type);
        setDeleteId(id);
        setIsDeleteConfirmOpen(true);
    };

    const handleDelete = async () => {
        setLoading(true);
        try {
            if (deleteType === 'resident') {
                await axios.delete(`${API_BASE}/residents/${deleteId}`);
                setStatus("Resident deleted successfully.");
            } else {
                await axios.delete(`${API_BASE}/interactions/${deleteId}`);
                setStatus("Interaction deleted successfully.");
            }
            setIsDeleteConfirmOpen(false);
            fetchResidents();
        } catch (err) {
            console.error("Delete error:", err);
            setStatus(`Error: ${err.response?.data?.error || "Failed to delete"}`);
        } finally {
            setLoading(false);
        }
    };

    // --- INTERACTION CRUD HANDLERS ---
    const openInteractionModal = (interaction) => {
        setEditingInteraction(interaction);
        setInteractionContent(interaction.content);
        setIsInteractionModalOpen(true);
    };

    const handleInteractionSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            await axios.put(`${API_BASE}/interactions/${editingInteraction.id}`, { content: interactionContent });
            setStatus("Interaction updated successfully.");
            setIsInteractionModalOpen(false);
            fetchResidents();
        } catch (err) {
            console.error("Interaction save error:", err);
            setStatus(`Error: ${err.response?.data?.error || "Failed to save interaction"}`);
        } finally {
            setLoading(false);
        }
    };

    const handleCopyExport = async () => {
        setIsCopying(true);
        try {
            const res = await axios.get(`${API_BASE}/export`);
            const exportText = res.data.text;
            
            // Try clipboard API first
            if (navigator.clipboard && window.isSecureContext) {
                await navigator.clipboard.writeText(exportText);
                setStatus("Data copied to clipboard! Ready to paste into Excel.");
            } else {
                // Fallback for non-secure contexts (like some local dev environments)
                const textArea = document.createElement("textarea");
                textArea.value = exportText;
                
                // Move text area out of viewport to avoid scrolling
                textArea.style.position = "fixed";
                textArea.style.left = "-999999px";
                textArea.style.top = "-999999px";
                document.body.appendChild(textArea);
                textArea.focus();
                textArea.select();
                
                try {
                    document.execCommand('copy');
                    setStatus("Data copied to clipboard! Ready to paste into Excel.");
                } catch (err) {
                    console.error('Fallback format copy failed', err);
                    setStatus("Failed to copy data. Please try again.");
                } finally {
                    textArea.remove();
                }
            }
        } catch (err) {
            console.error("Export error", err);
            setStatus("Failed to generate export data.");
        }
        setIsCopying(false);
        // Clear success message after a few seconds
        setTimeout(() => { if(status.includes("copied")) setStatus(""); }, 5000);
    };

    const toggleRow = (asuId) => {
        if (expandedRow === asuId) {
            setExpandedRow(null);
        } else {
            setExpandedRow(asuId);
        }
    };

    const filteredData = (residents || []).filter(resident => {
        const fullString = `${resident.first_name || ''} ${resident.last_name || ''} ${resident.asu_id || ''} ${resident.room || ''}`.toLowerCase();
        return fullString.includes(searchTerm.toLowerCase());
    });

    return (
        <div className="dashboard-container">
            <header className="dashboard-header">
                <div>
                    <h1 className="header-title gradient-text" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <Database size={32} />
                        Data Sync Hub
                    </h1>
                    <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
                        Manage resident data, sync from your current tracker, and export for external use.
                    </p>
                    {status && (
                        <div className={`status-text mt-3 ${status.startsWith('Error') ? 'error-text' : 'success-text'}`} 
                             style={{ marginTop: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            {status.startsWith('Error') ? <XCircle size={18} /> : 
                             (status.startsWith('Success') || status.includes('copied') ? <CheckCircle size={18} /> : null)}
                            {status}
                        </div>
                    )}
                </div>

                <div className="header-controls" style={{ gap: '1rem' }}>
                    <input 
                        type="file" 
                        id="excel-upload" 
                        style={{ display: 'none' }} 
                        accept=".xlsx, .xls"
                        onChange={handleSync}
                    />
                    <button 
                        onClick={() => document.getElementById('excel-upload').click()} 
                        disabled={isSyncing}
                        className={`btn btn-primary ${isSyncing ? 'btn-spin' : ''}`}
                        title="Upload an Excel tracker file from your computer to update the database."
                    >
                        <RefreshCw size={18} className="btn-icon" />
                        Upload .xlsx
                    </button>
                    
                    <button 
                        onClick={() => setIsPasteModalOpen(true)} 
                        disabled={isSyncing}
                        className="btn btn-secondary"
                        title="Paste tabular data directly from Excel."
                    >
                        <ClipboardList size={18} className="btn-icon" />
                        Paste from Excel
                    </button>
                </div>
            </header>

            <div className="glass-panel" style={{ marginTop: '2rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                    <h2 className="panel-title" style={{ margin: 0 }}>
                        Resident Database ({filteredData.length})
                    </h2>
                    
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <button 
                            onClick={() => setIsEditMode(!isEditMode)}
                            className={`btn ${isEditMode ? 'btn-primary' : 'btn-secondary'}`}
                            style={{ padding: '8px 16px', height: '42px' }}
                            title="Enable or disable manual editing of the database."
                        >
                            <Edit size={18} className="btn-icon" />
                            {isEditMode ? 'Finish' : 'Edit'}
                        </button>

                        {isEditMode && (
                            <button 
                                onClick={() => openResidentModal()} 
                                className="btn btn-secondary"
                                style={{ padding: '8px 16px', height: '42px' }}
                                title="Add a new resident manually to the database."
                            >
                                <UserPlus size={18} className="btn-icon" />
                                Add
                            </button>
                        )}

                        <button 
                            onClick={handleCopyExport} 
                            disabled={isCopying || loading || (residents && residents.length === 0)}
                            className="btn btn-secondary"
                            style={{ padding: '8px 16px', height: '42px' }}
                            title="Copies all resident data to clipboard in a format you can paste directly into Excel."
                        >
                            <Copy size={18} className="btn-icon" />
                            {isCopying ? "Copying..." : "Copy Database"}
                        </button>

                        <div className="input-group" style={{ margin: 0, width: '300px' }}>
                            <div style={{ position: 'relative' }}>
                                <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                                <input 
                                    type="text" 
                                    placeholder="Search by name, ID, or room..." 
                                    className="premium-input"
                                    style={{ paddingLeft: '40px' }}
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {loading ? (
                    <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                        <RefreshCw size={32} className="btn-spin" style={{ marginBottom: '1rem' }} />
                        <p>Loading database...</p>
                    </div>
                ) : filteredData.length === 0 ? (
                    <div className="empty-state">
                        <Database size={48} className="empty-icon" />
                        <h3 style={{ fontSize: '1.2rem', marginBottom: '0.5rem' }}>No Data Found</h3>
                        <p>No residents match your search or the database is empty.</p>
                        {residents && residents.length === 0 && (
                            <button onClick={handleSync} className="btn btn-primary" style={{ marginTop: '1rem' }}>
                                Run Initial Sync
                            </button>
                        )}
                    </div>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                                    <th style={{ padding: '1rem', fontWeight: 500 }}>Name</th>
                                    <th style={{ padding: '1rem', fontWeight: 500 }}>ASU ID</th>
                                    <th style={{ padding: '1rem', fontWeight: 500 }}>Room</th>
                                    <th style={{ padding: '1rem', fontWeight: 500 }}>Interactions</th>
                                    <th style={{ padding: '1rem', textAlign: 'right', fontWeight: 500 }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredData.map(res => {
                                    const interactionCount = res.past_interactions ? res.past_interactions.length : 0;
                                    const isExpanded = expandedRow === res.asu_id;
                                    
                                    return (
                                        <React.Fragment key={res.asu_id}>
                                            <tr 
                                                style={{ 
                                                    borderBottom: '1px solid var(--border-color)',
                                                    backgroundColor: isExpanded ? 'rgba(255,255,255,0.02)' : 'transparent',
                                                    transition: 'background-color 0.2s ease',
                                                    position: 'relative'
                                                }}
                                                className="resident-row"
                                            >
                                                <td style={{ padding: '1rem', fontWeight: 500 }}>
                                                    {res.first_name} {res.last_name}
                                                </td>
                                                <td style={{ padding: '1rem', fontFamily: 'monospace' }}>
                                                    {res.asu_id}
                                                </td>
                                                <td style={{ padding: '1rem' }}>
                                                    {res.room || '-'}
                                                </td>
                                                <td style={{ padding: '1rem' }}>
                                                    <span className={`count-badge count-${interactionCount > 3 ? 3 : interactionCount}`}>
                                                        {interactionCount} logged
                                                    </span>
                                                </td>
                                                <td style={{ padding: '1rem', textAlign: 'right' }}>
                                                    <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                                                        {isEditMode && (
                                                            <>
                                                                <button 
                                                                    onClick={() => openResidentModal(res)}
                                                                    className="icon-btn"
                                                                    title="Edit Resident"
                                                                >
                                                                    <Edit size={16} />
                                                                </button>
                                                                <button 
                                                                    onClick={() => confirmDelete('resident', res.asu_id)}
                                                                    className="icon-btn danger"
                                                                    title="Delete Resident"
                                                                >
                                                                    <Trash2 size={16} />
                                                                </button>
                                                                <div style={{ width: '1px', background: 'var(--border-color)', margin: '0 0.5rem' }}></div>
                                                            </>
                                                        )}
                                                        <button 
                                                            onClick={() => toggleRow(res.asu_id)}
                                                            className="btn btn-secondary"
                                                            style={{ padding: '6px 12px', fontSize: '0.9rem' }}
                                                            disabled={interactionCount === 0}
                                                        >
                                                            {isExpanded ? 'Hide' : 'View Text'}
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                            {isExpanded && interactionCount > 0 && (
                                                <tr>
                                                    <td colSpan="5" style={{ padding: 0 }}>
                                                        <div style={{ 
                                                            padding: '1.5rem', 
                                                            backgroundColor: 'rgba(0,0,0,0.2)',
                                                            borderBottom: '1px solid var(--border-color)',
                                                            borderLeft: '4px solid var(--accent-color)'
                                                        }}>
                                                            <h4 style={{ margin: '0 0 1rem 0', color: 'var(--text-secondary)', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                                                Past Interaction Records
                                                            </h4>
                                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                                                {res.past_interactions.map((interaction, idx) => (
                                                                    <div key={interaction.id || idx} style={{ 
                                                                        padding: '1rem', 
                                                                        backgroundColor: 'var(--surface-color)', 
                                                                        borderRadius: '8px',
                                                                        border: '1px solid var(--border-color)',
                                                                        lineHeight: 1.5,
                                                                        display: 'flex',
                                                                        justifyContent: 'space-between',
                                                                        alignItems: 'flex-start'
                                                                    }}>
                                                                        <div style={{ flex: 1 }}>
                                                                            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', fontWeight: 600, display: 'flex', justifyContent: 'space-between' }}>
                                                                                <span>RECORD #{res.past_interactions.length - idx}</span>
                                                                                <span>{interaction.timestamp ? new Date(interaction.timestamp).toLocaleDateString() : ''}</span>
                                                                            </div>
                                                                            <div style={{ whiteSpace: 'pre-wrap' }}>
                                                                                {interaction.content}
                                                                            </div>
                                                                        </div>
                                                                        <div style={{ display: 'flex', gap: '0.25rem', marginLeft: '1rem' }}>
                                                                            {isEditMode && (
                                                                                <>
                                                                                    <button onClick={() => openInteractionModal(interaction)} className="icon-btn" title="Edit Interaction"><Edit size={14} /></button>
                                                                                    <button onClick={() => confirmDelete('interaction', interaction.id)} className="icon-btn danger" title="Delete Interaction"><Trash2 size={14} /></button>
                                                                                </>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </React.Fragment>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {sheetOptions.length > 0 && (
                <div className="wizard-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div className="wizard-modal glass-panel" style={{ maxWidth: '400px', width: '90%', padding: '2rem' }}>
                        <h3 style={{ marginTop: 0, fontSize: '1.5rem', marginBottom: '0.5rem' }}>Select Sheet</h3>
                        <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
                            Multiple sheets found in <strong>{pendingFile?.name}</strong>. Which one would you like to sync?
                        </p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '300px', overflowY: 'auto' }}>
                            {sheetOptions.map(sheet => (
                                <button 
                                    key={sheet} 
                                    className="btn btn-secondary"
                                    style={{ textAlign: 'left', padding: '1rem', justifyContent: 'flex-start' }}
                                    onClick={() => handleSync(sheet)}
                                    disabled={isSyncing}
                                >
                                    {sheet}
                                </button>
                            ))}
                        </div>
                        <button 
                            className="btn btn-secondary" 
                            style={{ marginTop: '1.5rem', width: '100%', border: 'none', background: 'transparent' }}
                            onClick={() => { setSheetOptions([]); setPendingFile(null); setStatus(""); }}
                            disabled={isSyncing}
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}

            {isPasteModalOpen && (
                <div className="wizard-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div className="wizard-modal glass-panel" style={{ maxWidth: '700px', width: '90%', padding: '2rem' }}>
                        <h3 style={{ marginTop: 0, fontSize: '1.5rem', marginBottom: '0.5rem' }}>Paste from Excel</h3>
                        <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
                            Highlight your rows in Excel (or Google Sheets), copy them, and paste them into the box below. We'll intelligently sniff out the format!
                        </p>
                        <textarea
                            value={pastedData}
                            onChange={(e) => setPastedData(e.target.value)}
                            placeholder="Paste your copied tabular data here..."
                            style={{
                                width: '100%',
                                minHeight: pastedData ? '100px' : '200px',
                                padding: '1rem',
                                backgroundColor: 'var(--background-color)',
                                border: '1px solid var(--border-color)',
                                color: 'var(--text-color)',
                                borderRadius: '8px',
                                marginBottom: '1rem',
                                fontFamily: 'monospace',
                                whiteSpace: 'pre',
                                resize: 'vertical'
                            }}
                        />
                        
                        {pastedData.trim() && (
                            <div style={{ marginBottom: '1.5rem' }}>
                                <h4 style={{ margin: '0 0 0.5rem 0', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Data Preview:</h4>
                                <div style={{ overflowX: 'auto', maxHeight: '200px', backgroundColor: 'var(--surface-color)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                                    <table style={{ minWidth: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                                        <tbody>
                                            {pastedData.split('\n').slice(0, 5).map((line, i) => (
                                                <tr key={i} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                                    {line.split('\t').map((cell, j) => (
                                                        <td key={j} style={{ padding: '0.5rem', borderRight: '1px solid var(--border-color)', color: 'var(--text-color)' }}>
                                                            {cell.length > 40 ? cell.substring(0, 40) + '...' : cell}
                                                        </td>
                                                    ))}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                {pastedData.split('\n').length > 5 && (
                                    <div style={{ textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-secondary)', padding: '0.5rem' }}>
                                        Showing first 5 rows... ({pastedData.split('\n').length} total)
                                    </div>
                                )}
                            </div>
                        )}
                        
                        <div style={{ display: 'flex', gap: '1rem' }}>
                            <button 
                                className="btn btn-primary" 
                                style={{ flex: 1 }}
                                onClick={handlePasteImport}
                                disabled={!pastedData.trim() || isSyncing}
                            >
                                {isSyncing ? "Importing..." : "Run Intelligent Import"}
                            </button>
                            <button 
                                className="btn btn-secondary" 
                                style={{ flex: 1, borderColor: 'transparent' }}
                                onClick={() => { setIsPasteModalOpen(false); setPastedData(""); }}
                                disabled={isSyncing}
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Resident CRUD Modal */}
            {isResidentModalOpen && (
                <div className="wizard-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div className="wizard-modal glass-panel" style={{ maxWidth: '500px', width: '90%', padding: '2rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                            <h3 style={{ margin: 0, fontSize: '1.5rem' }}>{editingResident ? 'Edit Resident' : 'Add New Resident'}</h3>
                            <button onClick={() => setIsResidentModalOpen(false)} className="icon-btn"><X size={20} /></button>
                        </div>
                        <form onSubmit={handleResidentSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                            <div className="input-group" style={{ width: '100%' }}>
                                <label className="input-label">ASU ID <span className="required-indicator">Required</span></label>
                                <input 
                                    className="premium-input" 
                                    style={{ width: '100%' }}
                                    value={residentForm.asu_id}
                                    onChange={e => setResidentForm({...residentForm, asu_id: e.target.value})}
                                    placeholder="e.g. 1220000000"
                                    required
                                    disabled={editingResident} // Don't allow changing ID for now to avoid FK issues unless we implement cascade
                                />
                                {editingResident && <small style={{ color: 'var(--text-secondary)' }}>ASU ID cannot be changed after creation.</small>}
                            </div>
                            <div style={{ display: 'flex', gap: '1rem' }}>
                                <div className="input-group" style={{ flex: 1 }}>
                                    <label className="input-label">First Name</label>
                                    <input 
                                        className="premium-input" 
                                        style={{ width: '100%' }}
                                        value={residentForm.first_name}
                                        onChange={e => setResidentForm({...residentForm, first_name: e.target.value})}
                                        placeholder="First Name"
                                    />
                                </div>
                                <div className="input-group" style={{ flex: 1 }}>
                                    <label className="input-label">Last Name</label>
                                    <input 
                                        className="premium-input" 
                                        style={{ width: '100%' }}
                                        value={residentForm.last_name}
                                        onChange={e => setResidentForm({...residentForm, last_name: e.target.value})}
                                        placeholder="Last Name"
                                    />
                                </div>
                            </div>
                            <div className="input-group" style={{ width: '100%' }}>
                                <label className="input-label">Email</label>
                                <input 
                                    className="premium-input" 
                                    style={{ width: '100%' }}
                                    type="email"
                                    value={residentForm.email}
                                    onChange={e => setResidentForm({...residentForm, email: e.target.value})}
                                    placeholder="email@asu.edu"
                                />
                            </div>
                            <div className="input-group" style={{ width: '100%' }}>
                                <label className="input-label">Room Number</label>
                                <input 
                                    className="premium-input" 
                                    style={{ width: '100%' }}
                                    value={residentForm.room}
                                    onChange={e => setResidentForm({...residentForm, room: e.target.value})}
                                    placeholder="e.g. A123"
                                />
                            </div>
                            <button type="submit" className="btn btn-primary" style={{ marginTop: '1rem' }} disabled={loading}>
                                <Save size={18} className="btn-icon" />
                                {loading ? 'Saving...' : (editingResident ? 'Update Resident' : 'Add Resident')}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* Interaction Edit Modal */}
            {isInteractionModalOpen && (
                <div className="wizard-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div className="wizard-modal glass-panel" style={{ maxWidth: '600px', width: '90%', padding: '2rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                            <h3 style={{ margin: 0, fontSize: '1.5rem' }}>Edit Interaction</h3>
                            <button onClick={() => setIsInteractionModalOpen(false)} className="icon-btn"><X size={20} /></button>
                        </div>
                        <form onSubmit={handleInteractionSubmit}>
                            <div className="input-group" style={{ width: '100%', marginBottom: '1.5rem' }}>
                                <label className="input-label">Record Content</label>
                                <textarea 
                                    className="premium-textarea"
                                    value={interactionContent}
                                    onChange={e => setInteractionContent(e.target.value)}
                                    placeholder="Enter interaction content..."
                                    required
                                />
                            </div>
                            <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={loading}>
                                <Save size={18} className="btn-icon" />
                                {loading ? 'Saving...' : 'Save Changes'}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {isDeleteConfirmOpen && (
                <div className="wizard-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div className="wizard-modal glass-panel" style={{ maxWidth: '400px', width: '90%', padding: '2rem', textAlign: 'center' }}>
                        <div style={{ color: 'var(--danger-color)', marginBottom: '1rem' }}>
                            <Trash2 size={48} />
                        </div>
                        <h3 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>Are you sure?</h3>
                        <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>
                            {deleteType === 'resident' 
                                ? "This will permanentely delete this resident and ALL of their associated interaction records. This action cannot be undone."
                                : "This will permanentely delete this interaction record. This action cannot be undone."}
                        </p>
                        <div style={{ display: 'flex', gap: '1rem' }}>
                            <button className="btn btn-danger" style={{ flex: 1 }} onClick={handleDelete} disabled={loading}>
                                {loading ? 'Deleting...' : 'Yes, Delete'}
                            </button>
                            <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setIsDeleteConfirmOpen(false)} disabled={loading}>
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
