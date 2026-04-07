import React, { useEffect, useState, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import {
  Check, X as XIcon, Plus, Trash2,
  Clock, AlertCircle, Filter, CalendarDays
} from 'lucide-react';

interface LeaveRequest {
  id: number;
  employeeId: number;
  employeeName: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  status: string;
  reason: string;
  approvedBy: string;
}

interface LeaveStats {
  pending: number;
  approvedToday: number;
  currentlyOnLeave: number;
}

const statusColors: Record<string, { bg: string; text: string; border: string }> = {
  pending: { bg: 'rgba(245,158,11,0.1)', text: '#f59e0b', border: '#f59e0b' },
  approved: { bg: 'rgba(16,185,129,0.1)', text: '#10b981', border: '#10b981' },
  rejected: { bg: 'rgba(239,68,68,0.1)', text: '#ef4444', border: '#ef4444' },
};

const leaveTypeIcons: Record<string, string> = {
  'Sick Leave': '🤒',
  'Casual Leave': '🏖️',
  'Paid Leave': '💰',
  'Maternity Leave': '👶',
  'Paternity Leave': '👨‍',
  'Emergency Leave': '🚨',
};

export const LeaveManagement: React.FC = () => {
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [stats, setStats] = useState<LeaveStats>({ pending: 0, approvedToday: 0, currentlyOnLeave: 0 });
  const [leaveTypes, setLeaveTypes] = useState<string[]>([]);
  const [employees, setEmployees] = useState<{ id: number; name: string }[]>([]);
  const [filterStatus, setFilterStatus] = useState('all');
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    employeeId: '',
    leaveType: 'Casual Leave',
    startDate: '',
    endDate: '',
    reason: '',
  });
  const [processing, setProcessing] = useState<number | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [leavesData, statsData, typesData, empsData] = await Promise.all([
        invoke<LeaveRequest[]>('list_leave_requests', { status: filterStatus }),
        invoke<LeaveStats>('get_leave_stats'),
        invoke<string[]>('get_leave_types'),
        invoke<{ id: number; name: string }[]>('list_employees'),
      ]);
      setLeaves(leavesData || []);
      setStats(statsData);
      setLeaveTypes(typesData);
      setEmployees(empsData);
    } catch (e) {
      console.error('Failed to load leave data:', e);
    } finally {
      setLoading(false);
    }
  }, [filterStatus]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleAddLeave = async () => {
    if (!formData.employeeId || !formData.startDate || !formData.endDate) {
      alert('Please fill in all required fields');
      return;
    }
    try {
      await invoke('add_leave_request', {
        employeeId: parseInt(formData.employeeId),
        leaveType: formData.leaveType,
        startDate: formData.startDate,
        endDate: formData.endDate,
        reason: formData.reason || null,
      });
      setShowForm(false);
      setFormData({ employeeId: '', leaveType: 'Casual Leave', startDate: '', endDate: '', reason: '' });
      fetchData();
    } catch (e) {
      alert('Failed to add leave request: ' + e);
    }
  };

  const handleStatusUpdate = async (leaveId: number, status: string) => {
    setProcessing(leaveId);
    try {
      await invoke('update_leave_status', {
        leaveId,
        status,
        approvedBy: status === 'approved' ? 'Admin' : null,
      });
      fetchData();
    } catch (e) {
      alert('Failed to update: ' + e);
    } finally {
      setProcessing(null);
    }
  };

  const handleDelete = async (leaveId: number) => {
    if (!confirm('Are you sure you want to delete this leave request?')) return;
    try {
      await invoke('delete_leave_request', { leaveId });
      fetchData();
    } catch (e) {
      alert('Failed to delete: ' + e);
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const getStatusBadge = (status: string) => {
    const c = statusColors[status] || statusColors.pending;
    return (
      <span style={{
        padding: '4px 12px', borderRadius: '12px', fontSize: '12px', fontWeight: '600',
        backgroundColor: c.bg, color: c.text, border: `1px solid ${c.border}`,
        textTransform: 'capitalize'
      }}>
        {status}
      </span>
    );
  };

  return (
    <div style={{ padding: '24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '24px' }}>Leave Management</h1>
          <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: '14px' }}>
            Manage employee leave requests, approvals, and records
          </p>
        </div>
        <button onClick={() => setShowForm(!showForm)} style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          padding: '10px 20px', borderRadius: '8px', fontWeight: '600'
        }}>
          <Plus size={18} /> New Leave Request
        </button>
      </div>

      {/* Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '24px' }}>
        <StatCard
          icon={<Clock size={24} />}
          label="Pending Requests"
          value={String(stats.pending)}
          color="var(--warning)"
          bgColor="rgba(245,158,11,0.1)"
        />
        <StatCard
          icon={<Check size={24} />}
          label="Approved Today"
          value={String(stats.approvedToday)}
          color="var(--success)"
          bgColor="rgba(16,185,129,0.1)"
        />
        <StatCard
          icon={<CalendarDays size={24} />}
          label="Currently On Leave"
          value={String(stats.currentlyOnLeave)}
          color="var(--primary-color)"
          bgColor="rgba(26,35,126,0.1)"
        />
      </div>

      {/* New Leave Form */}
      {showForm && (
        <div style={{
          backgroundColor: 'var(--surface-color)', padding: '24px',
          borderRadius: '12px', border: '1px solid var(--border-color)', marginBottom: '24px'
        }}>
          <h3 style={{ margin: '0 0 20px', fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Plus size={18} color="var(--primary-color)" /> New Leave Request
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr) 2fr', gap: '16px', alignItems: 'end' }}>
            <div>
              <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>
                Employee *
              </label>
              <select
                value={formData.employeeId}
                onChange={(e) => setFormData({ ...formData, employeeId: e.target.value })}
                style={{ marginBottom: 0 }}
              >
                <option value="">Select Employee</option>
                {employees.map(emp => (
                  <option key={emp.id} value={emp.id}>{emp.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>
                Leave Type *
              </label>
              <select
                value={formData.leaveType}
                onChange={(e) => setFormData({ ...formData, leaveType: e.target.value })}
                style={{ marginBottom: 0 }}
              >
                {leaveTypes.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>
                Start Date *
              </label>
              <input
                type="date"
                value={formData.startDate}
                onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                style={{ marginBottom: 0 }}
              />
            </div>
            <div>
              <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>
                End Date *
              </label>
              <input
                type="date"
                value={formData.endDate}
                onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                style={{ marginBottom: 0 }}
              />
            </div>
          </div>
          <div style={{ marginTop: '16px' }}>
            <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>
              Reason (Optional)
            </label>
            <textarea
              value={formData.reason}
              onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
              placeholder="Enter reason for leave..."
              rows={3}
              style={{ width: '100%', padding: '10px', border: '1px solid var(--border-color)', borderRadius: '6px', fontFamily: 'inherit', resize: 'vertical' }}
            />
          </div>
          <div style={{ display: 'flex', gap: '12px', marginTop: '16px', justifyContent: 'flex-end' }}>
            <button onClick={() => setShowForm(false)} style={{
              background: 'var(--bg-color)', color: 'var(--text-color)', border: '1px solid var(--border-color)'
            }}>
              Cancel
            </button>
            <button onClick={handleAddLeave}>Submit Request</button>
          </div>
        </div>
      )}

      {/* Filter Bar */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: '16px', padding: '12px 16px',
        backgroundColor: 'var(--surface-color)', borderRadius: '8px',
        border: '1px solid var(--border-color)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Filter size={16} color="var(--text-muted)" />
          <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-muted)' }}>Filter by:</span>
          <div style={{ display: 'flex', gap: '8px' }}>
            {['all', 'pending', 'approved', 'rejected'].map(s => (
              <button
                key={s}
                onClick={() => setFilterStatus(s)}
                style={{
                  padding: '6px 14px', borderRadius: '6px', fontSize: '12px', fontWeight: '600',
                  backgroundColor: filterStatus === s ? 'var(--primary-color)' : 'var(--bg-color)',
                  color: filterStatus === s ? 'white' : 'var(--text-muted)',
                  border: '1px solid ' + (filterStatus === s ? 'var(--primary-color)' : 'var(--border-color)'),
                  textTransform: 'capitalize'
                }}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
        <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
          {leaves.length} request{leaves.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Leave Requests Table */}
      <div style={{
        backgroundColor: 'var(--surface-color)', borderRadius: '12px',
        border: '1px solid var(--border-color)', overflow: 'hidden'
      }}>
        {loading ? (
          <div style={{ padding: '60px', textAlign: 'center' }}>
            <div style={{ fontSize: '32px', marginBottom: '12px' }}>⏳</div>
            <p style={{ color: 'var(--text-muted)' }}>Loading leave requests...</p>
          </div>
        ) : leaves.length === 0 ? (
          <div style={{ padding: '60px', textAlign: 'center' }}>
            <div style={{ fontSize: '32px', marginBottom: '12px' }}>📋</div>
            <h3 style={{ margin: '0 0 4px' }}>No Leave Requests</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
              {filterStatus !== 'all' ? 'No requests with this filter.' : 'Click "New Leave Request" to get started.'}
            </p>
          </div>
        ) : (
          <div>
            {/* Table Header */}
            <div style={{
              display: 'grid', gridTemplateColumns: '2fr 1.5fr 1fr 1fr 1fr 0.8fr',
              padding: '12px 20px', backgroundColor: 'var(--bg-color)',
              borderBottom: '1px solid var(--border-color)',
              fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)',
              textTransform: 'uppercase', letterSpacing: '0.5px'
            }}>
              <span>Employee</span>
              <span>Leave Period</span>
              <span>Type</span>
              <span>Status</span>
              <span>Approved By</span>
              <span>Actions</span>
            </div>
            {/* Table Rows */}
            {leaves.map((leave) => (
              <div key={leave.id} style={{
                display: 'grid', gridTemplateColumns: '2fr 1.5fr 1fr 1fr 1fr 0.8fr',
                padding: '14px 20px', borderBottom: '1px solid var(--border-color)',
                alignItems: 'center', fontSize: '14px',
                backgroundColor: leave.status === 'pending' ? 'rgba(245,158,11,0.02)' : 'transparent',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{
                    width: '36px', height: '36px', borderRadius: '50%',
                    background: 'linear-gradient(135deg, var(--primary-color), var(--primary-light))',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: 'white', fontSize: '14px', fontWeight: 'bold'
                  }}>
                    {leave.employeeName.charAt(0)}
                  </div>
                  <div>
                    <div style={{ fontWeight: '600' }}>{leave.employeeName}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>ID #{leave.employeeId}</div>
                  </div>
                </div>
                <div>
                  <div style={{ fontWeight: '500' }}>{formatDate(leave.startDate)}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>to {formatDate(leave.endDate)}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>{leaveTypeIcons[leave.leaveType] || '📄'}</span>
                  <span style={{ fontSize: '13px' }}>{leave.leaveType.replace(' Leave', '')}</span>
                </div>
                <div>{getStatusBadge(leave.status)}</div>
                <div style={{ fontSize: '13px', color: leave.approvedBy ? 'var(--text-color)' : 'var(--text-muted)' }}>
                  {leave.approvedBy || '—'}
                </div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  {leave.status === 'pending' && (
                    <>
                      <button
                        onClick={() => handleStatusUpdate(leave.id, 'approved')}
                        disabled={processing === leave.id}
                        style={{
                          padding: '6px 10px', borderRadius: '6px', fontSize: '12px',
                          backgroundColor: 'rgba(16,185,129,0.1)', color: 'var(--success)',
                          border: '1px solid rgba(16,185,129,0.3)', cursor: 'pointer'
                        }}
                        title="Approve"
                      >
                        <Check size={14} />
                      </button>
                      <button
                        onClick={() => handleStatusUpdate(leave.id, 'rejected')}
                        disabled={processing === leave.id}
                        style={{
                          padding: '6px 10px', borderRadius: '6px', fontSize: '12px',
                          backgroundColor: 'rgba(239,68,68,0.1)', color: 'var(--error)',
                          border: '1px solid rgba(239,68,68,0.3)', cursor: 'pointer'
                        }}
                        title="Reject"
                      >
                        <XIcon size={14} />
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => handleDelete(leave.id)}
                    disabled={processing === leave.id}
                    style={{
                      padding: '6px 10px', borderRadius: '6px', fontSize: '12px',
                      backgroundColor: 'rgba(239,68,68,0.1)', color: 'var(--error)',
                      border: '1px solid rgba(239,68,68,0.3)', cursor: 'pointer'
                    }}
                    title="Delete"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Reason Modal for hovered items */}
      {leaves.filter(l => l.reason).length > 0 && (
        <div style={{ marginTop: '24px', backgroundColor: 'var(--surface-color)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
          <h3 style={{ margin: '0 0 16px', fontSize: '14px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertCircle size={16} color="var(--text-muted)" /> Leave Reasons
          </h3>
          <div style={{ display: 'grid', gap: '10px' }}>
            {leaves.filter(l => l.reason).map(l => (
              <div key={l.id} style={{
                display: 'flex', gap: '12px', padding: '12px 16px',
                backgroundColor: 'var(--bg-color)', borderRadius: '8px',
                borderLeft: `3px solid ${statusColors[l.status]?.text || 'var(--text-muted)'}`
              }}>
                <div style={{ fontWeight: '600', minWidth: '120px', fontSize: '13px' }}>{l.employeeName}</div>
                <div style={{ fontSize: '13px', color: 'var(--text-muted)', flex: 1 }}>{l.reason}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const StatCard: React.FC<{ icon: React.ReactNode; label: string; value: string; color: string; bgColor: string }> = ({ icon, label, value, color, bgColor }) => (
  <div style={{
    backgroundColor: 'var(--surface-color)', padding: '20px',
    borderRadius: '12px', border: '1px solid var(--border-color)',
    display: 'flex', alignItems: 'center', gap: '16px'
  }}>
    <div style={{
      width: '48px', height: '48px', borderRadius: '12px',
      backgroundColor: bgColor, display: 'flex', alignItems: 'center',
      justifyContent: 'center', color
    }}>
      {icon}
    </div>
    <div>
      <div style={{ fontSize: '24px', fontWeight: 'bold', color }}>{value}</div>
      <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{label}</div>
    </div>
  </div>
);
