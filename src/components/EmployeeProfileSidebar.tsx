import React, { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { 
  X, FileText, User, CreditCard, 
  Eye, CheckCircle 
} from 'lucide-react';

interface Employee {
  id: number;
  name: string;
  department: string;
  branch_id?: number;
}

interface Document {
  type: string;
  name: string;
  cloudId: string;
  date: string;
}

interface Props {
  employee: Employee;
  onClose: () => void;
}

export const EmployeeProfileSidebar: React.FC<Props> = ({ employee, onClose }) => {
  const [activeTab, setActiveTab] = useState<'info' | 'documents'>('documents');
  const [documents, setDocuments] = useState<Document[]>([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('');
  const [previewDoc, setPreviewDoc] = useState<{name: string, dataUrl: string} | null>(null);
  const employeeInitial = employee.name?.trim()?.charAt(0) || 'E';

  const loadDocuments = useCallback(async () => {
    try {
      const docs = await invoke<Document[]>('list_employee_documents', { employeeId: employee.id });
      setDocuments(docs);
    } catch (e) {
      console.error('Failed to load documents:', e);
    }
  }, [employee.id]);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: string) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setProgress(10);
    setStatus(`Uploading ${type}...`);

    try {
      const buffer = await file.arrayBuffer();
      const bytes = new Uint8Array(buffer);

      setProgress(40);
      await invoke('upload_employee_document', {
        employeeId: employee.id,
        docType: type,
        fileName: file.name,
        fileBytes: Array.from(bytes)
      });

      setProgress(100);
      setStatus('✅ Upload Successful!');
      setTimeout(() => {
        setUploading(false);
        setStatus('');
        setProgress(0);
        loadDocuments();
      }, 1500);
    } catch (err) {
      setStatus('❌ Upload Failed: ' + err);
      setUploading(false);
    }
  };

  const handlePreview = async (docName: string) => {
    try {
      const bytes = await invoke<number[]>('get_document_preview', { docName });
      const blob = new Blob([new Uint8Array(bytes)], { 
        type: docName.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg' 
      });
      const url = URL.createObjectURL(blob);
      setPreviewDoc({ name: docName, dataUrl: url });
    } catch (e) {
      alert('Could not preview file: ' + e);
    }
  };

  const handleGenerateSlip = async () => {
    setUploading(true);
    setStatus('Calculating Salary & Generating Slip...');
    try {
      const month = new Date().toISOString().slice(0, 7); // current YYYY-MM
      await invoke('generate_payroll_slip', { employeeId: employee.id, month });
      setStatus('✅ Pay Slip Generated & Synced to Cloud!');
      setTimeout(() => {
        setUploading(false);
        setStatus('');
      }, 2000);
    } catch (err) {
      setStatus('❌ Failed: ' + err);
      setTimeout(() => setUploading(false), 3000);
    }
  };

  return (
    <div style={sidebarStyle}>
      {/* Header */}
      <div style={headerStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={avatarStyle}>
            {employeeInitial}
          </div>
          <div>
            <h3 style={{ margin: 0 }}>{employee.name}</h3>
            <p style={{ margin: 0, fontSize: 12, opacity: 0.7 }}>Employee ID: #{employee.id}</p>
          </div>
        </div>
        <button onClick={onClose} style={closeBtnStyle}><X size={20} /></button>
      </div>

      {/* Tabs */}
      <div style={tabContainerStyle}>
        <button 
          onClick={() => setActiveTab('info')}
          style={{ ...tabStyle, borderBottom: activeTab === 'info' ? '2px solid #4f46e5' : 'none' }}
        >Basic Info</button>
        <button 
          onClick={() => setActiveTab('documents')}
          style={{ ...tabStyle, borderBottom: activeTab === 'documents' ? '2px solid #4f46e5' : 'none' }}
        >Documents</button>
      </div>

      {/* Content */}
      <div style={contentStyle}>
        {activeTab === 'info' ? (
          <div style={{ padding: 20 }}>
             <p>Department: {employee.department || 'N/A'}</p>
             <p>Status: Active</p>
          </div>
        ) : (
          <div style={{ padding: 20 }}>
            {/* Action Zone */}
            <div style={{ marginBottom: 24 }}>
                <button 
                  onClick={handleGenerateSlip}
                  disabled={uploading}
                  style={{ 
                    width: '100%', padding: '12px', borderRadius: 10, border: 'none', 
                    background: 'linear-gradient(135deg, #059669, #10b981)', 
                    color: 'white', fontWeight: 700, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    opacity: uploading ? 0.7 : 1
                  }}
                >
                  <CreditCard size={18} /> Generate Monthly Pay Slip
                </button>
            </div>

            {/* Upload Section */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 24 }}>
              <UploadBox icon={<CreditCard size={18} />} label="ID Card" onUpload={(e: React.ChangeEvent<HTMLInputElement>) => handleFileUpload(e, 'Citizenship')} />
              <UploadBox icon={<FileText size={18} />} label="Contract" onUpload={(e: React.ChangeEvent<HTMLInputElement>) => handleFileUpload(e, 'Contract')} />
              <UploadBox icon={<User size={18} />} label="Photo" onUpload={(e: React.ChangeEvent<HTMLInputElement>) => handleFileUpload(e, 'Profile_Photo')} />
            </div>

            {uploading && (
              <div style={{ marginBottom: 20 }}>
                <div style={{ height: 6, background: '#e2e8f0', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ width: `${progress}%`, height: '100%', background: '#4f46e5', transition: 'width 0.3s' }} />
                </div>
                <p style={{ fontSize: 11, color: '#4f46e5', marginTop: 4, fontWeight: 'bold' }}>{status}</p>
              </div>
            )}

            {/* Document List */}
            <h4 style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 12 }}>Stored Documents</h4>
            {documents.length === 0 ? (
                <div style={emptyStyle}>No documents uploaded yet.</div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {documents.map((doc, idx) => (
                    <div key={idx} style={docRowStyle}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={iconBoxStyle}><FileText size={14} /></div>
                        <div>
                          <p style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>{doc.type}</p>
                          <p style={{ margin: 0, fontSize: 10, color: 'var(--text-muted)' }}>{doc.name}</p>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button onClick={() => handlePreview(doc.cloudId || doc.name)} style={actionBtnStyle} title="Preview"><Eye size={14} /></button>
                        <button style={actionBtnStyle} title="Cloud Sync OK"><CheckCircle size={14} color="#10b981" /></button>
                      </div>
                    </div>
                  ))}
                </div>
            )}
          </div>
        )}
      </div>

      {/* Preview Modal */}
      {previewDoc && (
        <div style={modalOverlayStyle}>
           <div style={modalStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 20px', borderBottom: '1px solid #e2e8f0' }}>
                <span style={{ fontWeight: 'bold' }}>Viewing: {previewDoc.name}</span>
                <button onClick={() => { URL.revokeObjectURL(previewDoc.dataUrl); setPreviewDoc(null); }} style={{ border: 'none', background: 'none', cursor: 'pointer' }}><X size={18} /></button>
              </div>
              <div style={{ flex: 1, padding: 10, background: '#f8fafc', overflow: 'auto', display: 'flex', justifyContent: 'center' }}>
                {previewDoc.name.endsWith('.pdf') ? (
                   <iframe src={previewDoc.dataUrl} style={{ width: '100%', height: '100%', border: 'none' }} />
                ) : (
                   <img src={previewDoc.dataUrl} style={{ maxWidth: '100%', objectFit: 'contain' }} />
                )}
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

const UploadBox = ({ icon, label, onUpload }: any) => (
  <div style={uploadBoxStyle}>
    <div style={{ marginBottom: 6 }}>{icon}</div>
    <span style={{ fontSize: 10, fontWeight: 'bold' }}>{label}</span>
    <input 
      type="file" 
      onChange={onUpload}
      style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }} 
    />
  </div>
);

// Styles
const sidebarStyle: React.CSSProperties = {
  position: 'fixed', top: 0, right: 0, width: 450, height: '100vh',
  backgroundColor: 'white', boxShadow: '-10px 0 50px rgba(0,0,0,0.1)',
  zIndex: 1100, display: 'flex', flexDirection: 'column', animation: 'slideIn 0.3s ease'
};
const headerStyle: React.CSSProperties = { padding: '24px', background: '#1e1b4b', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' };
const avatarStyle: React.CSSProperties = { width: 44, height: 44, borderRadius: 12, background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 'bold' };
const closeBtnStyle: React.CSSProperties = { background: 'none', border: 'none', color: 'white', cursor: 'pointer', opacity: 0.7 };
const tabContainerStyle: React.CSSProperties = { display: 'flex', borderBottom: '1px solid #e2e8f0' };
const tabStyle: React.CSSProperties = { flex: 1, padding: '14px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#64748b' };
const contentStyle: React.CSSProperties = { flex: 1, overflowY: 'auto', backgroundColor: '#f8fafc' };
const uploadBoxStyle: React.CSSProperties = {
  position: 'relative', height: 80, border: '2px dashed #cbd5e1', borderRadius: 12,
  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
  color: '#64748b', transition: '0.2s', backgroundColor: 'white'
};
const docRowStyle: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: 'white', borderRadius: 10, border: '1px solid #e2e8f0' };
const iconBoxStyle: React.CSSProperties = { width: 32, height: 32, borderRadius: 8, background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4f46e5' };
const actionBtnStyle: React.CSSProperties = { width: 28, height: 28, borderRadius: 6, border: '1px solid #e2e8f0', background: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' };
const emptyStyle: React.CSSProperties = { padding: 40, textAlign: 'center', color: '#94a3b8', fontSize: 13, backgroundColor: 'white', borderRadius: 12, border: '1px dashed #e2e8f0' };
const modalOverlayStyle: React.CSSProperties = { position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40 };
const modalStyle: React.CSSProperties = { width: '100%', maxWidth: 1000, height: '90vh', backgroundColor: 'white', borderRadius: 12, display: 'flex', flexDirection: 'column', overflow: 'hidden' };
