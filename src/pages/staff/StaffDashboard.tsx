import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CalendarCheck2, Clock3, ClipboardList } from 'lucide-react';

export const StaffDashboard: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="rounded-3xl bg-gradient-to-r from-teal-600 via-cyan-600 to-sky-700 p-6 text-white shadow-xl">
        <Badge className="mb-3 bg-white/15 text-white hover:bg-white/15">Staff self-service</Badge>
        <h1 className="text-3xl font-bold">Your attendance and leave overview</h1>
        <p className="mt-2 max-w-2xl text-sm text-white/80">
          This portal is optimized for mobile and web usage with only personal data, attendance logging, and leave
          requests exposed.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Attendance</CardTitle>
            <Clock3 className="h-5 w-5 text-slate-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">Check in/out</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Leaves</CardTitle>
            <CalendarCheck2 className="h-5 w-5 text-slate-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">Apply and track</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Logs</CardTitle>
            <ClipboardList className="h-5 w-5 text-slate-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">Personal records</div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

