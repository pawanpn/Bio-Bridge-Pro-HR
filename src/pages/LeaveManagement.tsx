import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import {
  Check,
  X as XIcon,
  Plus,
  Trash2,
  Clock,
  AlertCircle,
  Filter,
  CalendarDays,
  UserRound,
  Eye,
  ShieldCheck,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { BsDatePicker } from '@/components/BsDatePicker';
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
import { useAuth } from '@/context/AuthContext';
import { usePermission } from '@/hooks/usePermission';
import { formatDualDate, formatDualDateTime } from '@/lib/dateUtils';

interface LeaveRequest {
  id: number;
  employeeId: number;
  employeeName: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  totalDays?: number;
  holidayDays?: number;
  status: string;
  reason?: string | null;
  approvedBy?: string | null;
  approvedAt?: string | null;
  approvalRemarks?: string | null;
  rejectionReason?: string | null;
  appliedAt?: string | null;
}

interface LeaveStats {
  pending: number;
  approvedToday: number;
  currentlyOnLeave: number;
}

interface EmployeeOption {
  id: number;
  employee_code?: string;
  name: string;
  department?: string;
}

const DEFAULT_LEAVE_TYPES = [
  'Sick Leave',
  'Casual Leave',
  'Earned Leave',
  'Maternity Leave',
  'Paternity Leave',
];

const leaveTypeIcons: Record<string, string> = {
  'Sick Leave': '🤒',
  'Casual Leave': '🏖️',
  'Earned Leave': '💼',
  'Maternity Leave': '👶',
  'Paternity Leave': '👨‍👶',
  'Emergency Leave': '🚨',
};

const normalizeStatus = (value: string) => value.trim().toLowerCase();

const formatDate = (dateStr: string) => {
  return formatDualDate(dateStr);
};

const formatDateTime = (value?: string | null) => formatDualDateTime(value);

const getInitial = (value?: string | null) => value?.trim()?.charAt(0) || '?';

export const LeaveManagement: React.FC = () => {
  const { user } = useAuth();
  const { hasAnyPermission, loading: permissionLoading } = usePermission(user?.id);

  const canViewLeaves = hasAnyPermission(['view_leaves', 'apply_leave', 'approve_leave']);
  const canApplyLeave = hasAnyPermission(['apply_leave']);
  const canApproveLeave = hasAnyPermission(['approve_leave']);
  const isHrAdmin = ['SUPER_ADMIN', 'ADMIN'].includes(user?.role || '');

  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [stats, setStats] = useState<LeaveStats>({ pending: 0, approvedToday: 0, currentlyOnLeave: 0 });
  const [leaveTypes, setLeaveTypes] = useState<string[]>(DEFAULT_LEAVE_TYPES);
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [currentEmployeeId, setCurrentEmployeeId] = useState<number | null>(null);
  const [filterStatus, setFilterStatus] = useState('all');
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [processing, setProcessing] = useState<number | null>(null);
  const [selectedLeave, setSelectedLeave] = useState<LeaveRequest | null>(null);
  const [selectedAction, setSelectedAction] = useState<'approved' | 'rejected' | null>(null);
  const [selectedRemarks, setSelectedRemarks] = useState('');
  const [isEditingLeave, setIsEditingLeave] = useState(false);
  const [editFormData, setEditFormData] = useState({
    leaveType: DEFAULT_LEAVE_TYPES[1],
    startDate: '',
    endDate: '',
    reason: '',
  });
  const [formData, setFormData] = useState({
    employeeId: '',
    leaveType: DEFAULT_LEAVE_TYPES[1],
    startDate: '',
    endDate: '',
    reason: '',
  });

  const isAuthorized = useMemo(() => canViewLeaves || canApplyLeave || canApproveLeave, [canViewLeaves, canApplyLeave, canApproveLeave]);

  const fetchData = useCallback(async () => {
    if (!isAuthorized || permissionLoading) return;

    setLoading(true);
    try {
      const [statsData, typesData, empsData] = await Promise.all([
        invoke<LeaveStats>('get_leave_stats'),
        invoke<string[]>('get_leave_types'),
        invoke<EmployeeOption[]>('list_employees_for_select'),
      ]);

      setStats(statsData);
      setLeaveTypes(typesData?.length ? typesData : DEFAULT_LEAVE_TYPES);
      setEmployees(empsData || []);

      const matchingEmployee = empsData?.find((employee) => {
        const userKey = (user?.username || '').trim().toLowerCase();
        const employeeCode = (employee.employee_code || '').trim().toLowerCase();
        const employeeName = (employee.name || '').trim().toLowerCase();
        return userKey && (employeeCode === userKey || employeeName === userKey);
      }) || null;

      const resolvedEmployeeId = matchingEmployee?.id ?? null;
      setCurrentEmployeeId(resolvedEmployeeId);

      const canSeeEveryone = canApproveLeave || isHrAdmin;
      const leaveResponse = await invoke<any>('list_leave_requests', {
        request: {
          employeeId: canSeeEveryone ? undefined : resolvedEmployeeId ?? undefined,
          status: filterStatus === 'all' ? undefined : filterStatus,
          currentUserRole: user?.role,
        },
      });

      const rows = Array.isArray(leaveResponse) ? leaveResponse : (leaveResponse?.data || []);
      setLeaves(rows);

      if (!canSeeEveryone && resolvedEmployeeId && !formData.employeeId) {
        setFormData((prev) => ({ ...prev, employeeId: String(resolvedEmployeeId) }));
      }
    } catch (e) {
      console.error('Failed to load leave data:', e);
    } finally {
      setLoading(false);
    }
  }, [
    canApproveLeave,
    canApplyLeave,
    filterStatus,
    isAuthorized,
    isHrAdmin,
    permissionLoading,
    user?.role,
    user?.username,
  ]);

  useEffect(() => {
    fetchData();
    const handleDataSynced = () => fetchData();
    window.addEventListener('data-synced', handleDataSynced);
    return () => window.removeEventListener('data-synced', handleDataSynced);
  }, [fetchData]);

  useEffect(() => {
    if (currentEmployeeId && !canApproveLeave) {
      setFormData((prev) => ({ ...prev, employeeId: String(currentEmployeeId) }));
    }
  }, [canApproveLeave, currentEmployeeId]);

  const getStatusBadge = (status: string) => {
    const normalized = normalizeStatus(status);
    const variantMap: Record<string, 'default' | 'success' | 'destructive' | 'warning'> = {
      pending: 'warning',
      approved: 'success',
      rejected: 'destructive',
    };

    return (
      <Badge variant={variantMap[normalized] || 'default'} className="capitalize">
        {normalized}
      </Badge>
    );
  };

  const getLeaveTypeIcon = (type: string) => leaveTypeIcons[type] || '📄';

  const refreshAfterAction = async () => {
    await fetchData();
  };

  const canDeleteSelected = selectedLeave
    ? canApproveLeave || isHrAdmin || (canApplyLeave && currentEmployeeId === selectedLeave.employeeId)
    : false;

  const handleAddLeave = async () => {
    const employeeId = parseInt(formData.employeeId, 10);

    if (Number.isNaN(employeeId) || !formData.startDate || !formData.endDate) {
      alert('Please fill in all required fields');
      return;
    }

    if (!canApplyLeave && !canApproveLeave) {
      alert("You don't have permission to apply leave.");
      return;
    }

    if (!canApproveLeave && currentEmployeeId && employeeId !== currentEmployeeId) {
      alert('You can only apply leave for your own employee record.');
      return;
    }

    try {
      await invoke('add_leave_request', {
        request: {
          employeeId: employeeId,
          leaveType: formData.leaveType,
          startDate: formData.startDate,
          endDate: formData.endDate,
          reason: formData.reason || null,
          appliedBy: user?.username || user?.email || null,
        },
      });

      setShowForm(false);
      setFormData({
        employeeId: currentEmployeeId ? String(currentEmployeeId) : '',
        leaveType: leaveTypes[0] || DEFAULT_LEAVE_TYPES[1],
        startDate: '',
        endDate: '',
        reason: '',
      });
      await refreshAfterAction();
    } catch (e) {
      alert('Failed to add leave request: ' + e);
    }
  };

  const openLeavePreview = (leave: LeaveRequest) => {
    setSelectedLeave(leave);
    setSelectedAction(null);
    setSelectedRemarks('');
    setIsEditingLeave(false);
    setEditFormData({
      leaveType: leave.leaveType || DEFAULT_LEAVE_TYPES[1],
      startDate: leave.startDate || '',
      endDate: leave.endDate || '',
      reason: leave.reason || '',
    });
  };

  const closeLeavePreview = () => {
    setSelectedLeave(null);
    setSelectedAction(null);
    setSelectedRemarks('');
    setIsEditingLeave(false);
    setEditFormData({
      leaveType: DEFAULT_LEAVE_TYPES[1],
      startDate: '',
      endDate: '',
      reason: '',
    });
  };

  const handleSaveLeaveEdit = async () => {
    if (!selectedLeave || !isHrAdmin) {
      alert('Only HR admin can edit leave requests.');
      return;
    }

    if (!editFormData.startDate || !editFormData.endDate) {
      alert('Please fill in both start and end dates.');
      return;
    }

    setProcessing(selectedLeave.id);
    try {
      await invoke('update_leave_request', {
        request: {
          leaveRequestId: selectedLeave.id,
          leaveType: editFormData.leaveType,
          startDate: editFormData.startDate,
          endDate: editFormData.endDate,
          reason: editFormData.reason || null,
          actorRole: user?.role,
        },
      });
      closeLeavePreview();
      await refreshAfterAction();
    } catch (e) {
      alert('Failed to update leave request: ' + e);
    } finally {
      setProcessing(null);
    }
  };

  const handleConfirmStatusUpdate = async () => {
    if (!canApproveLeave || !selectedLeave || !selectedAction) {
      alert('Only HR admin can approve or reject leave requests.');
      return;
    }

    setProcessing(selectedLeave.id);
    try {
      await invoke('update_leave_status', {
        request: {
          leaveRequestId: selectedLeave.id,
          status: selectedAction,
          approvedBy: user?.username || user?.full_name || user?.email || 'HR Admin',
          approvalRemarks: selectedRemarks || null,
          actorRole: user?.role,
        },
      });
      closeLeavePreview();
      await refreshAfterAction();
    } catch (e) {
      alert('Failed to update leave status: ' + e);
    } finally {
      setProcessing(null);
    }
  };

  const handleDelete = async (leaveId: number) => {
    const leave = leaves.find((item) => item.id === leaveId);
    const isOwnLeave = leave?.employeeId === currentEmployeeId;
    const isAdminDelete = canApproveLeave || isHrAdmin;

    if (!isAdminDelete && !isOwnLeave) {
      alert('You can only delete your own pending leave request.');
      return;
    }

    if (!confirm('Are you sure you want to delete this leave request?')) return;

    try {
      await invoke('delete_leave_request', {
        request: {
          leaveRequestId: leaveId,
          actorRole: user?.role,
          actorEmployeeId: currentEmployeeId,
        },
      });
      if (selectedLeave?.id === leaveId) {
        closeLeavePreview();
      }
      await refreshAfterAction();
    } catch (e) {
      alert('Failed to delete leave request: ' + e);
    }
  };

  if (permissionLoading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[50vh]">
        <div className="text-sm text-muted-foreground">Loading permissions...</div>
      </div>
    );
  }

  if (!isAuthorized) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="p-8 text-center space-y-3">
            <ShieldCheck className="mx-auto h-10 w-10 text-muted-foreground" />
            <h2 className="text-lg font-semibold">Leave module access denied</h2>
            <p className="text-sm text-muted-foreground">
              Your role does not have leave permissions configured.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">Leave Management</h1>
          <p className="text-sm text-muted-foreground">
            Employees can apply for their own leave. Only HR admin can approve or reject requests.
          </p>
          <p className="text-xs text-muted-foreground">
            Holiday dates inside the leave range are excluded from the total leave days.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline" className="gap-1">
            <UserRound className="h-3.5 w-3.5" />
            {user?.role || 'UNKNOWN'}
          </Badge>
          <Button
            onClick={() => setShowForm(true)}
            disabled={!canApplyLeave && !canApproveLeave}
          >
            <Plus className="h-4 w-4" /> New Leave Request
          </Button>
        </div>
      </div>

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

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="flex items-center gap-3 flex-wrap">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium text-muted-foreground">Filter by:</span>
              <div className="flex gap-2 flex-wrap">
                {['all', 'pending', 'approved', 'rejected'].map((status) => (
                  <Button
                    key={status}
                    variant={filterStatus === status ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setFilterStatus(status)}
                    className="text-xs capitalize"
                  >
                    {status}
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

      <Card>
        {loading ? (
          <CardContent className="flex flex-col items-center justify-center py-16 gap-3">
            <div className="text-4xl">⏳</div>
            <p className="text-sm text-muted-foreground">Loading leave requests...</p>
          </CardContent>
        ) : leaves.length === 0 ? (
          <CardContent className="flex flex-col items-center justify-center py-16 gap-2">
            <div className="text-4xl">📋</div>
            <h3 className="text-lg font-semibold">No Leave Requests</h3>
            <p className="text-sm text-muted-foreground">
              {filterStatus !== 'all' ? 'No requests with this filter.' : 'Click "New Leave Request" to get started.'}
            </p>
          </CardContent>
        ) : (
          <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Leave Period</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Total Days</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Applied At</TableHead>
                <TableHead>Reviewed By</TableHead>
                <TableHead>Reviewed On</TableHead>
                <TableHead>Remarks</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {leaves.map((leave) => {
                const normalizedStatus = normalizeStatus(leave.status);
                const isOwnRequest = currentEmployeeId === leave.employeeId;
                const canManageRow = canApproveLeave || isHrAdmin || (canApplyLeave && isOwnRequest);

                return (
                  <TableRow
                    key={leave.id}
                    className={normalizedStatus === 'pending' ? 'bg-yellow-500/5' : ''}
                  >
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-sm">
                          {getInitial(leave.employeeName)}
                        </div>
                        <div>
                          <div className="font-medium">{leave.employeeName}</div>
                          <div className="text-xs text-muted-foreground">ID #{leave.employeeId}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{formatDate(leave.startDate)}</div>
                      <div className="text-xs text-muted-foreground">
                        to {formatDate(leave.endDate)}
                        {typeof leave.totalDays === 'number' ? ` • ${leave.totalDays} day(s)` : ''}
                        {typeof leave.holidayDays === 'number' && leave.holidayDays > 0 ? ` • ${leave.holidayDays} holiday(s) excluded` : ''}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span>{getLeaveTypeIcon(leave.leaveType)}</span>
                        <span className="text-sm">{leave.leaveType}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="font-semibold">{typeof leave.totalDays === 'number' ? leave.totalDays : '—'}</div>
                    </TableCell>
                    <TableCell>{getStatusBadge(leave.status)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDateTime(leave.appliedAt)}
                    </TableCell>
                    <TableCell className={leave.approvedBy ? '' : 'text-muted-foreground'}>
                      <div>{leave.approvedBy || '—'}</div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDateTime(leave.approvedAt)}
                    </TableCell>
                    <TableCell className="max-w-xs">
                      <div className="text-xs text-muted-foreground truncate">
                        {leave.approvalRemarks || leave.rejectionReason || '—'}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 px-3"
                          onClick={() => openLeavePreview(leave)}
                          title="Open details"
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          Action
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          </div>
        )}
      </Card>

      {leaves.filter((leave) => leave.reason).length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-muted-foreground" /> Leave Reasons
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {leaves
                .filter((leave) => leave.reason)
                .map((leave) => {
                  const borderColorMap: Record<string, string> = {
                    pending: 'border-yellow-500',
                    approved: 'border-green-500',
                    rejected: 'border-red-500',
                  };

                  return (
                    <div
                      key={leave.id}
                      className={`flex gap-3 p-4 rounded-lg bg-muted border-l-4 ${borderColorMap[normalizeStatus(leave.status)] || 'border-muted-foreground'}`}
                    >
                      <div className="font-semibold text-sm min-w-[120px]">{leave.employeeName}</div>
                      <div className="text-sm text-muted-foreground flex-1">{leave.reason}</div>
                    </div>
                  );
                })}
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5 text-primary" /> New Leave Request
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="employee">Employee *</Label>
                <Select
                  id="employee"
                  value={formData.employeeId}
                  disabled={!canApproveLeave && !!currentEmployeeId}
                  onChange={(e) => setFormData({ ...formData, employeeId: e.target.value })}
                >
                  <option value="">Select Employee</option>
                  {employees.map((employee) => (
                    <option key={employee.id} value={employee.id}>
                      {employee.name}
                      {employee.employee_code ? ` (${employee.employee_code})` : ''}
                    </option>
                  ))}
                </Select>
                {!canApproveLeave && (
                  <p className="text-xs text-muted-foreground">
                    Self-service leave is locked to your employee account.
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="leaveType">Leave Type *</Label>
                <Select
                  id="leaveType"
                  value={formData.leaveType}
                  onChange={(e) => setFormData({ ...formData, leaveType: e.target.value })}
                >
                  {(leaveTypes.length ? leaveTypes : DEFAULT_LEAVE_TYPES).map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="startDate">Start Date *</Label>
                <BsDatePicker value={formData.startDate} onChange={(date) => setFormData({ ...formData, startDate: date })} className="w-full" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endDate">End Date *</Label>
                <BsDatePicker value={formData.endDate} onChange={(date) => setFormData({ ...formData, endDate: date })} className="w-full" />
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

      {selectedLeave && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/20"
            onClick={closeLeavePreview}
          />
          <aside className="fixed right-0 top-0 z-50 h-full w-full max-w-md border-l bg-background shadow-2xl flex flex-col">
            <div className="flex items-center justify-between border-b px-4 py-4">
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground">Leave Preview</p>
                <h3 className="text-lg font-semibold">{selectedLeave.employeeName}</h3>
              </div>
              <div className="flex items-center gap-2">
                {isHrAdmin && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsEditingLeave((prev) => !prev)}
                  >
                    {isEditingLeave ? 'View' : 'Edit'}
                  </Button>
                )}
                <Button variant="ghost" size="sm" onClick={closeLeavePreview}>
                  <XIcon className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {isEditingLeave && (
                <Card>
                  <CardContent className="p-4 space-y-4">
                    <div className="text-sm font-semibold">Edit Leave Details</div>
                    <div className="space-y-2">
                      <Label htmlFor="editLeaveType">Leave Type</Label>
                      <Select
                        id="editLeaveType"
                        value={editFormData.leaveType}
                        onChange={(e) => setEditFormData((prev) => ({ ...prev, leaveType: e.target.value }))}
                      >
                        {(leaveTypes.length ? leaveTypes : DEFAULT_LEAVE_TYPES).map((type) => (
                          <option key={type} value={type}>
                            {type}
                          </option>
                        ))}
                      </Select>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label htmlFor="editStartDate">Start Date</Label>
                        <BsDatePicker value={editFormData.startDate} onChange={(date) => setEditFormData((prev) => ({ ...prev, startDate: date }))} className="w-full" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="editEndDate">End Date</Label>
                        <BsDatePicker value={editFormData.endDate} onChange={(date) => setEditFormData((prev) => ({ ...prev, endDate: date }))} className="w-full" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="editReason">Reason</Label>
                      <textarea
                        id="editReason"
                        className="flex min-h-[90px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                        value={editFormData.reason}
                        onChange={(e) => setEditFormData((prev) => ({ ...prev, reason: e.target.value }))}
                        placeholder="Update leave reason..."
                        rows={4}
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button className="flex-1" onClick={handleSaveLeaveEdit} disabled={processing === selectedLeave.id}>
                        Save Changes
                      </Button>
                      <Button
                        variant="outline"
                        className="flex-1"
                        onClick={() => setIsEditingLeave(false)}
                      >
                        Cancel Edit
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}
              <Card>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm text-muted-foreground">Employee</div>
                      <div className="font-semibold">{selectedLeave.employeeName}</div>
                    </div>
                    {getStatusBadge(selectedLeave.status)}
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <div className="text-muted-foreground">Leave Type</div>
                      <div className="font-medium">{selectedLeave.leaveType}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Total Days</div>
                      <div className="font-medium">
                        {typeof selectedLeave.totalDays === 'number' ? selectedLeave.totalDays : '—'}
                        {typeof selectedLeave.holidayDays === 'number' && selectedLeave.holidayDays > 0
                          ? ` (${selectedLeave.holidayDays} holiday(s) excluded)`
                          : ''}
                      </div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">From</div>
                      <div className="font-medium">{formatDate(selectedLeave.startDate)}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">To</div>
                      <div className="font-medium">{formatDate(selectedLeave.endDate)}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Applied At</div>
                      <div className="font-medium">{formatDateTime(selectedLeave.appliedAt)}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Reviewed At</div>
                      <div className="font-medium">{formatDateTime(selectedLeave.approvedAt)}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4 space-y-3">
                  <div className="text-sm font-semibold">Reason</div>
                  <div className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {selectedLeave.reason || 'No reason provided.'}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4 space-y-3">
                  <div className="text-sm font-semibold">Review Details</div>
                  <div className="grid grid-cols-1 gap-3 text-sm">
                    <div>
                      <div className="text-muted-foreground">Reviewed By</div>
                      <div className="font-medium">{selectedLeave.approvedBy || '—'}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Remarks</div>
                      <div className="font-medium whitespace-pre-wrap">
                        {selectedLeave.approvalRemarks || selectedLeave.rejectionReason || '—'}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {canApproveLeave && normalizeStatus(selectedLeave.status) === 'pending' && (
                <Card>
                  <CardContent className="p-4 space-y-3">
                    <div className="text-sm font-semibold">Approve / Reject</div>
                    <div className="flex gap-2">
                      <Button
                        className="flex-1"
                        variant={selectedAction === 'approved' ? 'default' : 'outline'}
                        onClick={() => setSelectedAction('approved')}
                      >
                        Approve
                      </Button>
                      <Button
                        className="flex-1"
                        variant={selectedAction === 'rejected' ? 'destructive' : 'outline'}
                        onClick={() => setSelectedAction('rejected')}
                      >
                        Reject
                      </Button>
                    </div>

                    {selectedAction && (
                      <div className="space-y-2">
                        <Label htmlFor="previewRemarks">Remarks</Label>
                        <textarea
                          id="previewRemarks"
                          className="flex min-h-[90px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                          value={selectedRemarks}
                          onChange={(e) => setSelectedRemarks(e.target.value)}
                          placeholder={selectedAction === 'approved' ? 'Approval remarks...' : 'Rejection reason / remarks...'}
                          rows={4}
                        />
                        <Button
                          className="w-full"
                          onClick={handleConfirmStatusUpdate}
                          disabled={processing === selectedLeave.id}
                        >
                          {selectedAction === 'approved' ? 'Confirm Approval' : 'Confirm Rejection'}
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {canDeleteSelected && (
                <Button
                  variant="outline"
                  className="w-full text-red-600 border-red-600/30 hover:bg-red-600/10"
                  onClick={() => handleDelete(selectedLeave.id)}
                  disabled={processing === selectedLeave.id}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Leave Request
                </Button>
              )}
            </div>
          </aside>
        </>
      )}
    </div>
  );
};
