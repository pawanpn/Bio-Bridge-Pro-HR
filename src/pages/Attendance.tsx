import React, { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

export default function Attendance() {
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState({ online: 0, total: 0 });

  useEffect(() => {
    // Real-time Cloud Logic: मेसिनमा औँठा लगाउने बित्तिकै यहाँ डेटा आउँछ
    const channel = supabase.channel('biobridge_realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'attendance_logs' }, 
      (payload) => {
        setLogs(prev => [payload.new, ...prev]);
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
        <div className="flex gap-4">
          <div className="bg-white p-4 rounded-xl shadow-sm border-l-4 border-green-500">
            <p className="text-xs text-slate-400 uppercase font-bold">Devices Online</p>
            <p className="text-2xl font-black text-slate-700">1 / 1</p>
          </div>
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
              <tr><td colSpan="4" className="p-10 text-center text-slate-400">Waiting for biometric data...</td></tr>
            ) : (
              logs.map(log => (
                <tr key={log.id} className="hover:bg-blue-50/30 transition">
                  <td className="p-5 font-medium text-slate-700">#{log.employee_id}</td>
                  <td className="p-5 text-slate-600">{new Date(log.timestamp).toLocaleString()}</td>
                  <td className="p-5"><span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-bold">{log.punch_type || 'Check-In'}</span></td>
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
