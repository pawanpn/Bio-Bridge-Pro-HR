import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { invoke } from '@tauri-apps/api/core';
import {
  ArrowLeft, Mail, Phone, MapPin, Briefcase, Building,
  Calendar, Clock, Fingerprint, Shield, Smartphone,
  MessageSquare, CreditCard, User, FileText, IdCard,
  Car, AlertCircle, CheckCircle, Globe, Home, Key,
  ChevronLeft, ChevronRight, ScanFace, Activity, Hash,
  Info
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell } from 'recharts';

interface EmployeeProfile {
  id: number;
  employee_code: string;
  first_name: string;
  middle_name?: string;
  last_name: string;
  full_name: string;
  date_of_birth?: string;
  gender?: string;
  marital_status?: string;
  nationality?: string;
  religion?: string;
  city?: string;
  postcode?: string;
  local_name?: string;
  personal_email?: string;
  personal_phone?: string;
  contact_tel?: string;
  office_tel?: string;
  current_address?: string;
  permanent_address?: string;
  citizenship_number?: string;
  pan_number?: string;
  passport_no?: string;
  national_id?: string;
  department_name?: string;
  designation_name?: string;
  branch_name?: string;
  date_of_joining?: string;
  employment_type?: string;
  employment_status?: string;
  bank_name?: string;
  account_number?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  emergency_contact_relation?: string;
  verification_mode?: string;
  device_privilege?: string;
  device_password?: string;
  card_no?: string;
  biometric_id?: number;
  enable_attendance?: boolean;
  enable_holiday?: boolean;
  outdoor_management?: boolean;
  shift_start_time?: string;
  shift_end_time?: string;
  enable_self_service?: boolean;
  enable_mobile_access?: boolean;
  mobile_punch?: boolean;
  app_role?: string;
  workflow_role?: string;
  whatsapp_alert?: boolean;
  whatsapp_exception?: boolean;
  whatsapp_punch?: boolean;
  supervisor_mobile?: string;
  motorcycle_license?: string;
  automobile_license?: string;
  created_at?: string;
  updated_at?: string;
}

interface AttendanceLog {
  timestamp: string;
  method: string;
  source: string;
  deviceId: number;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const FieldRow: React.FC<{ icon: React.ReactNode; label: string; value?: string | number | null; isBoolean?: boolean }> = ({ icon, label, value, isBoolean }) => {
  const hasValue = value !== undefined && value !== null && value !== '';
  const display = isBoolean ? (value ? 'Yes' : 'No') : (hasValue ? String(value) : '—');
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-border/40 last:border-0">
      <span className="text-muted-foreground flex-shrink-0">{icon}</span>
      <span className="text-sm font-medium min-w-[140px] text-muted-foreground">{label}</span>
      <span className={`text-sm flex-1 ${hasValue ? 'text-foreground font-medium' : 'text-muted-foreground/50 italic'}`}>{display}</span>
      {hasValue && !isBoolean && <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-[10px] px-1.5">SET</Badge>}
      {!hasValue && !isBoolean && <Badge variant="outline" className="bg-gray-50 text-gray-400 border-gray-200 text-[10px] px-1.5">EMPTY</Badge>}
    </div>
  );
};

const Section: React.FC<{ title: string; icon: React.ReactNode; children: React.ReactNode }> = ({ title, icon, children }) => (
  <Card className="shadow-sm">
    <CardHeader className="pb-2">
      <CardTitle className="text-base flex items-center gap-2">
        <span className="text-primary">{icon}</span>
        {title}
      </CardTitle>
    </CardHeader>
    <CardContent className="pt-0">
      {children}
    </CardContent>
  </Card>
);

export const EmployeeDetail: React.FC = () => {
  const { employeeId } = useParams<{ employeeId: string }>();
  const navigate = useNavigate();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [profile, setProfile] = useState<EmployeeProfile | null>(null);
  const [attendance, setAttendance] = useState<{ daysPresent: number; totalPunches: number; lateDays: number; logs: AttendanceLog[] } | null>(null);
  const [dailyChart, setDailyChart] = useState<{ day: string; punches: number; isPresent: boolean }[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'profile' | 'attendance'>('profile');

  useEffect(() => {
    if (!employeeId) return;
    setLoading(true);
    const id = parseInt(employeeId);

    Promise.all([
      invoke<any>('get_employee', { employeeId: id }).then(r => r?.data),
      invoke<any>('get_employee_monthly_attendance', { employeeId: id, year, month }).catch(() => null),
    ]).then(([emp, att]) => {
      setProfile(emp || null);
      if (att) {
        setAttendance({ daysPresent: att.daysPresent, totalPunches: att.totalPunches, lateDays: att.lateDays, logs: att.logs });
        const daysInMonth = new Date(year, month, 0).getDate();
        const chartData: { day: string; punches: number; isPresent: boolean }[] = [];
        for (let d = 1; d <= daysInMonth; d++) {
          const ds = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
          const dayLogs = (att.logs || []).filter((l: AttendanceLog) => l.timestamp.startsWith(ds));
          chartData.push({ day: String(d), punches: dayLogs.length, isPresent: dayLogs.length > 0 });
        }
        setDailyChart(chartData);
      }
    }).catch(console.error).finally(() => setLoading(false));
  }, [employeeId, year, month]);

  const prevMonth = () => {
    if (month === 1) { setMonth(12); setYear(y => y - 1); } else setMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (month === 12) { setMonth(1); setYear(y => y + 1); } else setMonth(m => m + 1);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen text-muted-foreground">
        <div className="text-center">
          <div className="text-4xl mb-4 animate-bounce">⏳</div>
          <p className="text-lg">Loading employee details...</p>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="p-8 text-center">
        <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
        <h2 className="text-xl font-bold mb-2">Employee Not Found</h2>
        <Button variant="outline" onClick={() => navigate(-1)}>← Go Back</Button>
      </div>
    );
  }

  const workingDays = new Date(year, month, 0).getDate();
  const daysPresent = attendance?.daysPresent ?? 0;
  const attendanceRate = workingDays > 0 ? ((daysPresent / workingDays) * 100).toFixed(1) : '0';

  const dailyGroups: Record<string, AttendanceLog[]> = {};
  (attendance?.logs || []).forEach(log => {
    const dk = log.timestamp.split(' ')[0];
    if (!dailyGroups[dk]) dailyGroups[dk] = [];
    dailyGroups[dk].push(log);
  });
  const sortedDates = Object.keys(dailyGroups).sort().reverse();

  const verificationLabel = (mode?: string) => {
    switch (mode) {
      case 'FP': return 'Fingerprint';
      case 'Face': return 'Face';
      case 'PW': return 'Password';
      case 'RF': return 'RFID Card';
      case 'FP/PW/RF': return 'Fingerprint / Password / Card';
      case 'Face/FP/PW': return 'Face / Fingerprint / Password';
      default: return mode || '—';
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex items-center gap-4 flex-1">
          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center text-white text-2xl font-bold flex-shrink-0">
            {profile.first_name?.charAt(0) || '?'}
          </div>
          <div>
            <h1 className="text-2xl font-bold">{profile.full_name}</h1>
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <span className="flex items-center gap-1"><Hash className="w-3.5 h-3.5" /> {profile.employee_code}</span>
              {profile.department_name && <span className="flex items-center gap-1"><Briefcase className="w-3.5 h-3.5" /> {profile.department_name}</span>}
              {profile.branch_name && <span className="flex items-center gap-1"><Building className="w-3.5 h-3.5" /> {profile.branch_name}</span>}
              <Badge variant={profile.employment_status === 'Active' ? 'default' : 'secondary'} className="text-[11px]">
                {profile.employment_status}
              </Badge>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant={tab === 'profile' ? 'default' : 'outline'} size="sm" onClick={() => setTab('profile')}>
            <User className="w-4 h-4 mr-1" /> Profile
          </Button>
          <Button variant={tab === 'attendance' ? 'default' : 'outline'} size="sm" onClick={() => setTab('attendance')}>
            <Calendar className="w-4 h-4 mr-1" /> Attendance
          </Button>
        </div>
      </div>

      {tab === 'attendance' && (
        <>
          {/* Month Navigation */}
          <div className="flex items-center justify-between mb-6 p-4 rounded-xl bg-card border">
            <Button variant="ghost" size="icon" onClick={prevMonth}><ChevronLeft className="w-5 h-5" /></Button>
            <div className="flex items-center gap-3">
              <Calendar className="w-5 h-5 text-primary" />
              <span className="text-lg font-semibold">{MONTH_NAMES[month - 1]} {year}</span>
            </div>
            <Button variant="ghost" size="icon" onClick={nextMonth}><ChevronRight className="w-5 h-5" /></Button>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <Card className="shadow-sm">
              <CardContent className="p-5 flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center text-green-600"><Activity className="w-6 h-6" /></div>
                <div><div className="text-2xl font-bold text-green-600">{attendanceRate}%</div><div className="text-xs text-muted-foreground">Attendance Rate</div></div>
              </CardContent>
            </Card>
            <Card className="shadow-sm">
              <CardContent className="p-5 flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center text-blue-600"><Calendar className="w-6 h-6" /></div>
                <div><div className="text-2xl font-bold text-blue-600">{daysPresent} / {workingDays}</div><div className="text-xs text-muted-foreground">Days Present</div></div>
              </CardContent>
            </Card>
            <Card className="shadow-sm">
              <CardContent className="p-5 flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center text-amber-600"><Clock className="w-6 h-6" /></div>
                <div><div className="text-2xl font-bold text-amber-600">{attendance?.lateDays ?? 0}</div><div className="text-xs text-muted-foreground">Late Days</div></div>
              </CardContent>
            </Card>
            <Card className="shadow-sm">
              <CardContent className="p-5 flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-cyan-100 flex items-center justify-center text-cyan-600"><Fingerprint className="w-6 h-6" /></div>
                <div><div className="text-2xl font-bold text-cyan-600">{attendance?.totalPunches ?? 0}</div><div className="text-xs text-muted-foreground">Total Punches</div></div>
              </CardContent>
            </Card>
          </div>

          {/* Chart */}
          <Card className="shadow-sm mb-6">
            <CardHeader><CardTitle className="text-base">Daily Attendance</CardTitle></CardHeader>
            <CardContent>
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dailyChart}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="day" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                    <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                    <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid var(--border)' }} />
                    <Bar dataKey="punches" radius={[3, 3, 0, 0]}>
                      {dailyChart.map((entry, idx) => (
                        <Cell key={idx} fill={entry.isPresent ? '#10b981' : '#e5e7eb'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Timeline */}
          <Card className="shadow-sm">
            <CardHeader><CardTitle className="text-base">Attendance Timeline</CardTitle></CardHeader>
            <CardContent>
              {sortedDates.length === 0 ? (
                <p className="text-center text-muted-foreground py-10">No attendance records this month.</p>
              ) : (
                <div className="space-y-3">
                  {sortedDates.map(date => {
                    const dayLogs = dailyGroups[date];
                    const firstTime = dayLogs[0].timestamp.length >= 16 ? dayLogs[0].timestamp.slice(11, 16) : '--:--';
                    const lastTime = dayLogs[dayLogs.length - 1].timestamp.length >= 16 ? dayLogs[dayLogs.length - 1].timestamp.slice(11, 16) : '--:--';
                    const isLate = firstTime > '09:15';
                    return (
                      <div key={date} className={`flex items-center justify-between p-3 rounded-lg border-l-4 ${isLate ? 'border-l-amber-500 bg-amber-50/30' : 'border-l-green-500 bg-green-50/30'}`}>
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold text-sm ${isLate ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>
                            {date.slice(8)}
                          </div>
                          <div>
                            <div className={`text-sm font-semibold ${isLate ? 'text-amber-700' : 'text-green-700'}`}>{isLate ? 'Late' : 'On Time'}</div>
                            <div className="text-xs text-muted-foreground">In: {firstTime} · Out: {lastTime}{dayLogs.length > 2 ? ` (${dayLogs.length} punches)` : ''}</div>
                          </div>
                        </div>
                        <div className="flex gap-1.5">
                          {dayLogs.map((log, idx) => {
                            const isFace = log.method.toUpperCase().includes('FACE') || log.method === '1';
                            return (
                              <div key={idx} title={`${log.method} via ${log.source}`} className={`w-7 h-7 rounded-full flex items-center justify-center ${isFace ? 'bg-blue-100 text-blue-600' : 'bg-green-100 text-green-600'}`}>
                                {isFace ? <ScanFace className="w-3.5 h-3.5" /> : <Fingerprint className="w-3.5 h-3.5" />}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {tab === 'profile' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Personal Information */}
          <Section title="Personal Information" icon={<User className="w-5 h-5" />}>
            <FieldRow icon={<User className="w-4 h-4" />} label="Full Name" value={profile.full_name} />
            <FieldRow icon={<Hash className="w-4 h-4" />} label="Employee Code" value={profile.employee_code} />
            <FieldRow icon={<Calendar className="w-4 h-4" />} label="Date of Birth" value={profile.date_of_birth} />
            <FieldRow icon={<User className="w-4 h-4" />} label="Gender" value={profile.gender} />
            <FieldRow icon={<User className="w-4 h-4" />} label="Marital Status" value={profile.marital_status} />
            <FieldRow icon={<Globe className="w-4 h-4" />} label="Nationality" value={profile.nationality} />
            <FieldRow icon={<Info className="w-4 h-4" />} label="Religion" value={profile.religion} />
            <FieldRow icon={<MapPin className="w-4 h-4" />} label="City" value={profile.city} />
            <FieldRow icon={<MapPin className="w-4 h-4" />} label="Postcode" value={profile.postcode} />
            <FieldRow icon={<User className="w-4 h-4" />} label="Local Name" value={profile.local_name} />
          </Section>

          {/* Contact Information */}
          <Section title="Contact Information" icon={<Phone className="w-5 h-5" />}>
            <FieldRow icon={<Mail className="w-4 h-4" />} label="Personal Email" value={profile.personal_email} />
            <FieldRow icon={<Phone className="w-4 h-4" />} label="Personal Phone" value={profile.personal_phone} />
            <FieldRow icon={<Phone className="w-4 h-4" />} label="Contact Tel" value={profile.contact_tel} />
            <FieldRow icon={<Phone className="w-4 h-4" />} label="Office Tel" value={profile.office_tel} />
            <FieldRow icon={<Home className="w-4 h-4" />} label="Current Address" value={profile.current_address} />
            <FieldRow icon={<MapPin className="w-4 h-4" />} label="Permanent Address" value={profile.permanent_address} />
          </Section>

          {/* Identification */}
          <Section title="Identification" icon={<IdCard className="w-5 h-5" />}>
            <FieldRow icon={<IdCard className="w-4 h-4" />} label="Citizenship No." value={profile.citizenship_number} />
            <FieldRow icon={<FileText className="w-4 h-4" />} label="PAN Number" value={profile.pan_number} />
            <FieldRow icon={<FileText className="w-4 h-4" />} label="Passport No." value={profile.passport_no} />
            <FieldRow icon={<IdCard className="w-4 h-4" />} label="National ID" value={profile.national_id} />
            <FieldRow icon={<Car className="w-4 h-4" />} label="Motorcycle License" value={profile.motorcycle_license} />
            <FieldRow icon={<Car className="w-4 h-4" />} label="Automobile License" value={profile.automobile_license} />
          </Section>

          {/* Employment */}
          <Section title="Employment" icon={<Briefcase className="w-5 h-5" />}>
            <FieldRow icon={<Building className="w-4 h-4" />} label="Branch" value={profile.branch_name} />
            <FieldRow icon={<Briefcase className="w-4 h-4" />} label="Department" value={profile.department_name} />
            <FieldRow icon={<Briefcase className="w-4 h-4" />} label="Designation" value={profile.designation_name} />
            <FieldRow icon={<Calendar className="w-4 h-4" />} label="Date of Joining" value={profile.date_of_joining} />
            <FieldRow icon={<Info className="w-4 h-4" />} label="Employment Type" value={profile.employment_type} />
            <FieldRow icon={<Info className="w-4 h-4" />} label="Status" value={profile.employment_status} />
            <FieldRow icon={<Info className="w-4 h-4" />} label="Workflow Role" value={profile.workflow_role} />
          </Section>

          {/* Bank Details */}
          <Section title="Bank Details" icon={<CreditCard className="w-5 h-5" />}>
            <FieldRow icon={<Building className="w-4 h-4" />} label="Bank Name" value={profile.bank_name} />
            <FieldRow icon={<CreditCard className="w-4 h-4" />} label="Account Number" value={profile.account_number} />
          </Section>

          {/* Emergency Contact */}
          <Section title="Emergency Contact" icon={<AlertCircle className="w-5 h-5" />}>
            <FieldRow icon={<User className="w-4 h-4" />} label="Contact Name" value={profile.emergency_contact_name} />
            <FieldRow icon={<Phone className="w-4 h-4" />} label="Contact Phone" value={profile.emergency_contact_phone} />
            <FieldRow icon={<User className="w-4 h-4" />} label="Relation" value={profile.emergency_contact_relation} />
          </Section>

          {/* Device Settings */}
          <Section title="Device Settings" icon={<Fingerprint className="w-5 h-5" />}>
            <FieldRow icon={<Fingerprint className="w-4 h-4" />} label="Verification Mode" value={verificationLabel(profile.verification_mode)} />
            <FieldRow icon={<Shield className="w-4 h-4" />} label="Device Privilege" value={profile.device_privilege} />
            <FieldRow icon={<Key className="w-4 h-4" />} label="Device Password" value={profile.device_password} />
            <FieldRow icon={<CreditCard className="w-4 h-4" />} label="Card No" value={profile.card_no} />
            <FieldRow icon={<Hash className="w-4 h-4" />} label="Biometric ID" value={profile.biometric_id} />
          </Section>

          {/* Attendance Config */}
          <Section title="Attendance Settings" icon={<Clock className="w-5 h-5" />}>
            <FieldRow icon={<Calendar className="w-4 h-4" />} label="Enable Attendance" value={profile.enable_attendance} isBoolean />
            <FieldRow icon={<Calendar className="w-4 h-4" />} label="Enable Holiday" value={profile.enable_holiday} isBoolean />
            <FieldRow icon={<MapPin className="w-4 h-4" />} label="Outdoor Mgmt" value={profile.outdoor_management} isBoolean />
            <FieldRow icon={<Clock className="w-4 h-4" />} label="Shift Start" value={profile.shift_start_time} />
            <FieldRow icon={<Clock className="w-4 h-4" />} label="Shift End" value={profile.shift_end_time} />
          </Section>

          {/* Mobile & WhatsApp */}
          <Section title="Mobile & Notifications" icon={<Smartphone className="w-5 h-5" />}>
            <FieldRow icon={<Smartphone className="w-4 h-4" />} label="Self Service" value={profile.enable_self_service} isBoolean />
            <FieldRow icon={<Smartphone className="w-4 h-4" />} label="Mobile Access" value={profile.enable_mobile_access} isBoolean />
            <FieldRow icon={<Smartphone className="w-4 h-4" />} label="Mobile Punch" value={profile.mobile_punch} isBoolean />
            <FieldRow icon={<User className="w-4 h-4" />} label="App Role" value={profile.app_role} />
            <FieldRow icon={<MessageSquare className="w-4 h-4" />} label="WhatsApp Alert" value={profile.whatsapp_alert} isBoolean />
            <FieldRow icon={<MessageSquare className="w-4 h-4" />} label="WhatsApp Exception" value={profile.whatsapp_exception} isBoolean />
            <FieldRow icon={<MessageSquare className="w-4 h-4" />} label="WhatsApp Punch" value={profile.whatsapp_punch} isBoolean />
            <FieldRow icon={<Phone className="w-4 h-4" />} label="Supervisor Mobile" value={profile.supervisor_mobile} />
          </Section>

          {/* Timestamps */}
          <Section title="Record Info" icon={<Clock className="w-5 h-5" />}>
            <FieldRow icon={<Calendar className="w-4 h-4" />} label="Created At" value={profile.created_at} />
            <FieldRow icon={<Clock className="w-4 h-4" />} label="Last Updated" value={profile.updated_at} />
          </Section>
        </div>
      )}
    </div>
  );
};
