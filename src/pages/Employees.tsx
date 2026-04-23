import React, { useState, useEffect } from "react";
import { supabase } from "@/config/supabase";
import { Users, Building2 } from "lucide-react";

interface Employee {
  id: number;
  name: string;
  designation: string;
  department: string;
}

export default function Employees() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const loadData = async () => {
    const { data } = await supabase.from("employees").select("*").order("created_at", { ascending: false });
    if (data) setEmployees(data as Employee[]);
  };

  useEffect(() => { loadData(); }, []);

  return (
    <div className="p-8 bg-[#F8F9FD] min-h-screen">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-black text-[#2B3674]">BioTime Employees</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {employees.map(emp => (
          <div key={emp.id} className="bg-white p-6 rounded-[24px] shadow-sm border hover:shadow-md transition">
            <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 mb-4">
              <Users size={28} />
            </div>
            <h3 className="text-xl font-bold text-[#2B3674]">{emp.name}</h3>
            <p className="text-indigo-500 font-bold text-xs uppercase">{emp.designation || 'Staff'}</p>
            <div className="mt-4 pt-4 border-t flex items-center gap-2 text-gray-500 text-sm">
              <Building2 size={14} /> {emp.department || 'Operations'}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
