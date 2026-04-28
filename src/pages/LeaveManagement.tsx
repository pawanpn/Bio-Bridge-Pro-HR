import React, { useEffect, useState, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useAuth } from '../context/AuthContext';
import {
  Check, X as XIcon, Plus, Trash2,
  Clock, AlertCircle, Filter, CalendarDays
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';

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

const leaveTypeIcons: Record<string, string> = {
  'Sick Leave': '🤒',
  'Casual Leave': '🏖️',
  'Paid Leave': '💰',
  'Maternity Leave': '👶',
  'Paternity Leave': '👨‍',
  'Emergency Leave': '🚨',
};

export const LeaveManagement: React.FC = () => {
  const { user } = useAuth();
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
        invoke<LeaveRequest[]>('list_leave_requests', { status: filterStatus, organizationId: user?.organization_id }),
        invoke<LeaveStats>('get_leave_stats'),
        invoke<string[]>('get_leave_types'),
        invoke<{ id: number; name: string }[]>('list_employees', { organizationId: user?.organization_id }),
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
    const handleDataSynced = () => fetchData();
    window.addEventListener('data-synced', handleDataSynced);
    return () => window.removeEventListener('data-synced', handleDataSynced);
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
    const variantMap: Record<string, 'default' | 'success' | 'destructive' | 'warning'> = {
      pending: 'warning',
      approved: 'success',
      rejected: 'destructive',
    };
    return (
      <Badge variant={variantMap[status] || 'default'} className="capitalize">
        {status}
      </Badge>
    );
  };

  const getLeaveTypeIcon = (type: string) => {
    return leaveTypeIcons[type] || '\ud83d\udcc4';
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Leave Management</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage employee leave requests, approvals, and records
          </p>
        </div>
        <Button onClick={() => setShowForm(!showForm)}>
          <Plus className="h-4 w-4" /> New Leave Request
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-6 flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-yellow-500/10 flex items-center justify-center text-yellow-500">
              <Clock className="h-6 w-6" />
            </div>
            <div>
              <div className="text-2xl font-bold text-yellow-500">{stats.pending}</div>
              <div className="text-sm text-muted-foreground">Pending Requests</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-green-500/10 flex items-center justify-center text-green-500">
              <Check className="h-6 w-6" />
            </div>
            <div>
              <div className="text-2xl font-bold text-green-500">{stats.approvedToday}</div>
              <div className="text-sm text-muted-foreground">Approved Today</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
              <CalendarDays className="h-6 w-6" />
            </div>
            <div>
              <div className="text-2xl font-bold text-primary">{stats.currentlyOnLeave}</div>
              <div className="text-sm text-muted-foreground">Currently On Leave</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* New Leave Form Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5 text-primary" /> New Leave Request
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="employee">Employee *</Label>
                <Select
                  id="employee"
                  value={formData.employeeId}
                  onChange={(e) => setFormData({ ...formData, employeeId: e.target.value })}
                >
                  <option value="">Select Employee</option>
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id}>{emp.name}</option>
                  ))}
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="leaveType">Leave Type *</Label>
                <Select
                  id="leaveType"
                  value={formData.leaveType}
                  onChange={(e) => setFormData({ ...formData, leaveType: e.target.value })}
                >
                  {leaveTypes.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="startDate">Start Date *</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={formData.startDate}
                  onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endDate">End Date *</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={formData.endDate}
                  onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="reason">Reason (Optional)</Label>
              <textarea
                id="reason"
                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                value={formData.reason}
                onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                placeholder="Enter reason for leave..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddLeave}>Submit Request</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Filter Bar */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="flex items-center gap-3 flex-wrap">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium text-muted-foreground">Filter by:</span>
              <div className="flex gap-2">
                {['all', 'pending', 'approved', 'rejected'].map(s => (
                  <Button
                    key={s}
                    variant={filterStatus === s ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setFilterStatus(s)}
                    className="text-xs capitalize"
                  >
                    {s}
                  </Button>
                ))}
              </div>
            </div>
            <span className="text-sm text-muted-foreground">
              {leaves.length} request{leaves.length !== 1 ? 's' : ''}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Leave Requests Table */}
      <Card>
        {loading ? (
          <CardContent className="flex flex-col items-center justify-center py-16 gap-3">
            <div className="text-4xl">\u23f3</div>
            <p className="text-sm text-muted-foreground">Loading leave requests...</p>
          </CardContent>
        ) : leaves.length === 0 ? (
          <CardContent className="flex flex-col items-center justify-center py-16 gap-2">
            <div className="text-4xl">\ud83d\udccb</div>
            <h3 className="text-lg font-semibold">No Leave Requests</h3>
            <p className="text-sm text-muted-foreground">
              {filterStatus !== 'all' ? 'No requests with this filter.' : 'Click "New Leave Request" to get started.'}
            </p>
          </CardContent>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Leave Period</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Approved By</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {leaves.map((leave) => (
                <TableRow
                  key={leave.id}
                  className={leave.status === 'pending' ? 'bg-yellow-500/5' : ''}
                >
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-sm">
                        {leave.employeeName.charAt(0)}
                      </div>
                      <div>
                        <div className="font-medium">{leave.employeeName}</div>
                        <div className="text-xs text-muted-foreground">ID #{leave.employeeId}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{formatDate(leave.startDate)}</div>
                    <div className="text-xs text-muted-foreground">to {formatDate(leave.endDate)}</div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span>{getLeaveTypeIcon(leave.leaveType)}</span>
                      <span className="text-sm">{leave.leaveType.replace(' Leave', '')}</span>
                    </div>
                  </TableCell>
                  <TableCell>{getStatusBadge(leave.status)}</TableCell>
                  <TableCell className={leave.approvedBy ? '' : 'text-muted-foreground'}>
                    {leave.approvedBy || '\u2014'}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      {leave.status === 'pending' && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-green-600 border-green-600/30 hover:bg-green-600/10 h-8 w-8 p-0"
                            onClick={() => handleStatusUpdate(leave.id, 'approved')}
                            disabled={processing === leave.id}
                            title="Approve"
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-red-600 border-red-600/30 hover:bg-red-600/10 h-8 w-8 p-0"
                            onClick={() => handleStatusUpdate(leave.id, 'rejected')}
                            disabled={processing === leave.id}
                            title="Reject"
                          >
                            <XIcon className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-red-600 border-red-600/30 hover:bg-red-600/10 h-8 w-8 p-0"
                        onClick={() => handleDelete(leave.id)}
                        disabled={processing === leave.id}
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      {/* Leave Reasons Section */}
      {leaves.filter(l => l.reason).length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-muted-foreground" /> Leave Reasons
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {leaves.filter(l => l.reason).map(l => {
                const statusColorMap: Record<string, string> = {
                  pending: 'border-yellow-500',
                  approved: 'border-green-500',
                  rejected: 'border-red-500',
                };
                return (
                  <div
                    key={l.id}
                    className={`flex gap-3 p-4 rounded-lg bg-muted border-l-4 ${statusColorMap[l.status] || 'border-muted-foreground'}`}
                  >
                    <div className="font-semibold text-sm min-w-[120px]">{l.employeeName}</div>
                    <div className="text-sm text-muted-foreground flex-1">{l.reason}</div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
