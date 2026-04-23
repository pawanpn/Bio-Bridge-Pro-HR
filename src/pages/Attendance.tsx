import React, { useState, useEffect } from "react";
import { supabase } from "@/config/supabase";

interface Log {
  id: number;
  employee_id: number;
  timestamp: string;
  type: string;
}

export default function Attendance() {
  const [logs, setLogs] = useState<Log[]>([]);

  useEffect(() => {
    const channel = supabase.channel('biobridge_realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'attendance_logs' }, 
      (payload) => {
        setLogs(prev => [payload.new as Log, ...prev]);
      }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  return (
    <div className="p-8 bg-[#f8fafc] min-h-screen">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-800">Attendance Console</h1>
          <p className="text-slate-500">Real-time biometric monitoring active</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-slate-50 border-b border-slate-100">
            <tr>
              <th className="p-5 text-slate-600 font-bold uppercase text-xs">Employee ID</th>
              <th className="p-5 text-slate-600 font-bold uppercase text-xs">Punch Time</th>
              <th className="p-5 text-slate-600 font-bold uppercase text-xs">Type</th>
              <th className="p-5 text-slate-600 font-bold uppercase text-xs">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {logs.length === 0 ? (
              <tr><td colSpan={4} className="p-10 text-center text-slate-400">Waiting for biometric data...</td></tr>
            ) : (
              logs.map(log => (
                <tr key={log.id} className="hover:bg-blue-50/30 transition">
                  <td className="p-5 font-medium text-slate-700">#{log.employee_id}</td>
                  <td className="p-5 text-slate-600">{new Date(log.timestamp).toLocaleString()}</td>
                  <td className="p-5"><span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-bold">{log.type || 'Check-In'}</span></td>
                  <td className="p-5"><span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-bold">Verified</span></td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
