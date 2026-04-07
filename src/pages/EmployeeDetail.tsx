import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { invoke } from '@tauri-apps/api/core';
import {
  ArrowLeft, Calendar, Clock, Fingerprint, ScanFace,
  ChevronLeft, ChevronRight, User, Building, Briefcase, Activity
} from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell } from 'recharts';

interface AttendanceLog {
  timestamp: string;
  method: string;
  source: string;
  deviceId: number;
}

interface EmployeeMonthlyData {
  employeeId: number;
  name: string;
  department: string;
  branch: string;
  status: string;
  year: number;
  month: number;
  daysPresent: number;
  totalPunches: number;
  lateDays: number;
  firstCheckIn: string;
  lastCheckOut: string;
  logs: AttendanceLog[];
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export const EmployeeDetail: React.FC = () => {
  const { employeeId } = useParams<{ employeeId: string }>();
  const navigate = useNavigate();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1); // 1-12
  const [data, setData] = useState<EmployeeMonthlyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [dailyChart, setDailyChart] = useState<{ day: string; punches: number }[]>([]);

  const fetchData = useCallback(async () => {
    if (!employeeId) return;
    setLoading(true);
    try {
      const result = await invoke<EmployeeMonthlyData>('get_employee_monthly_attendance', {
        employeeId: parseInt(employeeId),
        year,
        month,
      });
      setData(result);
      buildDailyChart(result);
    } catch (e) {
      console.error('Failed to load employee attendance:', e);
    } finally {
      setLoading(false);
    }
  }, [employeeId, year, month]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const buildDailyChart = (d: EmployeeMonthlyData) => {
    const daysInMonth = new Date(d.year, d.month, 0).getDate();
    const chartData: { day: string; punches: number; isPresent: boolean }[] = [];

    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${d.year}-${String(d.month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const dayLogs = d.logs.filter(l => l.timestamp.startsWith(dateStr));
      chartData.push({
        day: String(day),
        punches: dayLogs.length,
        isPresent: dayLogs.length > 0,
      });
    }
    setDailyChart(chartData);
  };

  const prevMonth = () => {
    if (month === 1) { setMonth(12); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  };

  const nextMonth = () => {
    if (month === 12) { setMonth(1); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  };

  const getDaysInMonth = () => new Date(year, month, 0).getDate();

  if (loading) {
    return (
      <div style={{ padding: '24px', textAlign: 'center', paddingTop: '100px' }}>
        <div style={{ fontSize: '40px', marginBottom: '16px' }}>⏳</div>
        <h3>Loading attendance history...</h3>
      </div>
    );
  }

  if (!data) {
    return (
      <div style={{ padding: '24px', textAlign: 'center', paddingTop: '100px' }}>
        <div style={{ fontSize: '40px', marginBottom: '16px' }}>⚠️</div>
        <h3>No data found for this employee.</h3>
        <button onClick={() => navigate('/dashboard')} style={{ marginTop: '16px' }}>← Back to Dashboard</button>
      </div>
    );
  }

  const workingDays = getDaysInMonth();
  const attendanceRate = workingDays > 0 ? ((data.daysPresent / workingDays) * 100).toFixed(1) : '0';

  // Group logs by date for the daily timeline
  const dailyGroups: Record<string, AttendanceLog[]> = {};
  data.logs.forEach(log => {
    const dateKey = log.timestamp.split(' ')[0];
    if (!dailyGroups[dateKey]) dailyGroups[dateKey] = [];
    dailyGroups[dateKey].push(log);
  });

  const sortedDates = Object.keys(dailyGroups).sort().reverse();

  return (
    <div style={{ padding: '24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
        <button
          onClick={() => navigate('/dashboard')}
          style={{
            background: 'var(--surface-color)', border: '1px solid var(--border-color)',
            borderRadius: '8px', width: '40px', height: '40px', display: 'flex',
            alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
            color: 'var(--text-color)', padding: 0
          }}
        >
          <ArrowLeft size={18} />
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{
            width: '56px', height: '56px', borderRadius: '50%',
            background: 'linear-gradient(135deg, var(--primary-color), var(--primary-light))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'white', fontSize: '24px', fontWeight: 'bold'
          }}>
            {data.name.charAt(0)}
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: '24px' }}>{data.name}</h1>
            <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Briefcase size={14} /> {data.department}</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Building size={14} /> {data.branch}</span>
              <span style={{
                padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 'bold',
                backgroundColor: data.status === 'active' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                color: data.status === 'active' ? 'var(--success)' : 'var(--error)'
              }}>
                {data.status.toUpperCase()}
              </span>
            </p>
          </div>
        </div>
      </div>

      {/* Month Navigation */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: '24px', padding: '16px 24px',
        backgroundColor: 'var(--surface-color)', borderRadius: '12px',
        border: '1px solid var(--border-color)'
      }}>
        <button onClick={prevMonth} style={{
          background: 'var(--bg-color)', border: '1px solid var(--border-color)',
          borderRadius: '8px', padding: '8px 12px', cursor: 'pointer', color: 'var(--text-color)'
        }}>
          <ChevronLeft size={18} />
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Calendar size={20} color="var(--primary-color)" />
          <h2 style={{ margin: 0, fontSize: '20px' }}>{MONTH_NAMES[month - 1]} {year}</h2>
        </div>
        <button onClick={nextMonth} style={{
          background: 'var(--bg-color)', border: '1px solid var(--border-color)',
          borderRadius: '8px', padding: '8px 12px', cursor: 'pointer', color: 'var(--text-color)'
        }}>
          <ChevronRight size={18} />
        </button>
      </div>

      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '32px' }}>
        <SummaryCard
          icon={<Activity size={24} />}
          label="Attendance Rate"
          value={`${attendanceRate}%`}
          color="var(--success)"
          bgColor="rgba(16,185,129,0.1)"
        />
        <SummaryCard
          icon={<Calendar size={24} />}
          label="Days Present"
          value={`${data.daysPresent} / ${workingDays}`}
          color="var(--primary-color)"
          bgColor="rgba(26,35,126,0.1)"
        />
        <SummaryCard
          icon={<Clock size={24} />}
          label="Late Days"
          value={String(data.lateDays)}
          color="var(--warning)"
          bgColor="rgba(245,158,11,0.1)"
        />
        <SummaryCard
          icon={<Fingerprint size={24} />}
          label="Total Punches"
          value={String(data.totalPunches)}
          color="var(--accent-color)"
          bgColor="rgba(0,188,212,0.1)"
        />
      </div>

      {/* Daily Attendance Chart */}
      <div style={{
        backgroundColor: 'var(--surface-color)', padding: '24px',
        borderRadius: '12px', border: '1px solid var(--border-color)', marginBottom: '32px'
      }}>
        <h3 style={{ margin: '0 0 16px', fontSize: '14px', fontWeight: 700 }}>Daily Attendance Heatmap</h3>
        <div style={{ height: '180px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={dailyChart}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
              <XAxis dataKey="day" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} allowDecimals={false} />
              <Tooltip
                contentStyle={{ borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--surface-color)' }}
                itemStyle={{ color: 'var(--text-color)', fontWeight: 'bold' }}
              />
              <Bar dataKey="punches" radius={[3, 3, 0, 0]}>
                {dailyChart.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.isPresent ? '#10b981' : '#f3f4f6'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Attendance Timeline */}
      <div style={{
        backgroundColor: 'var(--surface-color)', padding: '24px',
        borderRadius: '12px', border: '1px solid var(--border-color)'
      }}>
        <h3 style={{ margin: '0 0 20px', fontSize: '14px', fontWeight: 700 }}>Attendance Timeline</h3>
        {sortedDates.length === 0 ? (
          <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '40px 0' }}>
            No attendance records for this month.
          </p>
        ) : (
          <div style={{ display: 'grid', gap: '12px' }}>
            {sortedDates.map(date => {
              const dayLogs = dailyGroups[date];
              const firstLog = dayLogs[0];
              const lastLog = dayLogs[dayLogs.length - 1];
              const firstTime = firstLog.timestamp.length >= 16 ? firstLog.timestamp.slice(11, 16) : '--:--';
              const lastTime = lastLog.timestamp.length >= 16 ? lastLog.timestamp.slice(11, 16) : '--:--';
              const isLate = firstTime > '09:15';

              return (
                <div key={date} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '12px 16px', backgroundColor: 'var(--bg-color)',
                  borderRadius: '8px', borderLeft: `4px solid ${isLate ? 'var(--warning)' : 'var(--success)'}`
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{
                      width: '44px', height: '44px', borderRadius: '8px',
                      backgroundColor: isLate ? 'rgba(245,158,11,0.1)' : 'rgba(16,185,129,0.1)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontWeight: 'bold', fontSize: '14px',
                      color: isLate ? 'var(--warning)' : 'var(--success)'
                    }}>
                      {date.slice(8)}
                    </div>
                    <div>
                      <div style={{ fontWeight: '600', fontSize: '14px' }}>
                        {isLate ? (
                          <span style={{ color: 'var(--warning)' }}>Late</span>
                        ) : (
                          <span style={{ color: 'var(--success)' }}>On Time</span>
                        )}
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', gap: '12px' }}>
                        <span>In: {firstTime}</span>
                        <span>Out: {lastTime}</span>
                        {dayLogs.length > 2 && <span>({dayLogs.length} punches)</span>}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    {dayLogs.map((log, idx) => {
                      const isFace = log.method.toUpperCase().includes('FACE') || log.method === '1';
                      return (
                        <div key={idx} title={`${log.method} via ${log.source}`} style={{
                          width: '28px', height: '28px', borderRadius: '50%',
                          backgroundColor: isFace ? 'rgba(59,130,246,0.1)' : 'rgba(16,185,129,0.1)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          color: isFace ? '#3b82f6' : 'var(--success)'
                        }}>
                          {isFace ? <ScanFace size={14} /> : <Fingerprint size={14} />}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

const SummaryCard: React.FC<{ icon: React.ReactNode; label: string; value: string; color: string; bgColor: string }> = ({ icon, label, value, color, bgColor }) => (
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
