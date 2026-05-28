// ============================================================
// useRealtimeAttendance — Supabase Realtime Hook
// 
// Architecture:
//   Thumb Press → ZKTeco Device (TCP:4370)
//       ↓ Tauri Desktop (Rust) pulls logs every N seconds
//       ↓ Saves to Supabase attendance_logs table  
//       ↓ Supabase Realtime fires event
//       ↓ THIS HOOK picks it up → UI auto-updates
//       ↓ Browser notification shown
//
// In browser mode: polls Supabase every 10s
// In Tauri mode: listens to Tauri events + Supabase realtime
// ============================================================
import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/config/supabase';

export interface AttendanceLog {
  id: number;
  employee_id: number;
  timestamp: string;
  device_id: number | null;
  sync_status: string;
  organization_id: number;
  employee_name?: string;
  employee_code?: string;
}

interface UseRealtimeAttendanceOptions {
  date?: string;
  branchId?: number;
  enabled?: boolean;
  onNewLog?: (log: AttendanceLog) => void;
}

export function useRealtimeAttendance(options: UseRealtimeAttendanceOptions = {}) {
  const { date = new Date().toISOString().split('T')[0], branchId, enabled = true, onNewLog } = options;
  const [logs, setLogs] = useState<AttendanceLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const channelRef = useRef<any>(null);

  const fetchLogs = useCallback(async () => {
    try {
      const start = `${date}T00:00:00`;
      const end = `${date}T23:59:59`;

      const { data: logsData } = await supabase
        .from('attendance_logs')
        .select('*')
        .gte('timestamp', start)
        .lte('timestamp', end)
        .order('timestamp', { ascending: false });

      // Enrich with employee names
      const { data: emps } = await supabase
        .from('employees')
        .select('id, first_name, last_name, employee_code');

      const enriched = (logsData || []).map((log: any) => {
        const emp = (emps || []).find((e: any) => e.id === log.employee_id);
        return {
          ...log,
          employee_name: emp ? `${emp.first_name} ${emp.last_name}` : `Employee #${log.employee_id}`,
          employee_code: emp?.employee_code,
        };
      });

      setLogs(enriched);
      setLastUpdated(new Date());
    } catch (err) {
      console.error('Failed to fetch attendance logs:', err);
    } finally {
      setLoading(false);
    }
  }, [date, branchId]);

  // Subscribe to Supabase Realtime
  useEffect(() => {
    if (!enabled) return;

    fetchLogs();

    // Supabase Realtime subscription
    const channel = supabase
      .channel('attendance_realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'attendance_logs',
        },
        async (payload: any) => {
          console.log('New attendance log received:', payload);
          const newLog = payload.new as AttendanceLog;

          // Get employee name for the new log
          const { data: emp } = await supabase
            .from('employees')
            .select('first_name, last_name, employee_code')
            .eq('id', newLog.employee_id)
            .single();

          const enrichedLog: AttendanceLog = {
            ...newLog,
            employee_name: emp ? `${emp.first_name} ${emp.last_name}` : `Employee #${newLog.employee_id}`,
            employee_code: emp?.employee_code,
          };

          // Add to top of list if same date
          const logDate = new Date(newLog.timestamp).toISOString().split('T')[0];
          if (logDate === date) {
            setLogs(prev => [enrichedLog, ...prev]);
            setLastUpdated(new Date());
          }

          // Callback for notifications
          onNewLog?.(enrichedLog);

          // Browser notification
          showBrowserNotification(enrichedLog);
        }
      )
      .subscribe();

    channelRef.current = channel;

    // Polling fallback — every 30s
    const interval = setInterval(fetchLogs, 30_000);

    return () => {
      channel.unsubscribe();
      clearInterval(interval);
    };
  }, [date, branchId, enabled, fetchLogs]);

  return { logs, loading, lastUpdated, refresh: fetchLogs };
}

// ─── Browser Notification ─────────────────────────────────────

export async function requestNotificationPermission() {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  const result = await Notification.requestPermission();
  return result === 'granted';
}

function showBrowserNotification(log: AttendanceLog) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;

  const time = new Date(log.timestamp).toLocaleTimeString('en-US', {
    hour: '2-digit', minute: '2-digit', hour12: true
  });

  new Notification('Attendance Recorded', {
    body: `${log.employee_name} (${log.employee_code || 'N/A'}) — ${time}`,
    icon: '/favicon.ico',
    tag: `attendance-${log.id}`,
    silent: false,
  });
}

// ─── Supabase notification saver ──────────────────────────────

export async function saveAttendanceNotification(log: AttendanceLog, userId: string) {
  try {
    await supabase.from('notifications').insert({
      user_id: userId,
      type: 'attendance_alert',
      title: 'Attendance Recorded',
      body: `${log.employee_name} punched in at ${new Date(log.timestamp).toLocaleTimeString()}`,
      is_read: false,
    });
  } catch (err) {
    console.error('Failed to save notification:', err);
  }
}
