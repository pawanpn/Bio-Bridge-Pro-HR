import React from 'react';
import { ExternalLink, MonitorSmartphone, Shield, Globe2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Login } from './Login';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

const PreviewPanel: React.FC<{
  title: string;
  subtitle: string;
  portal: 'provider' | 'admin';
  accent: string;
}> = ({ title, subtitle, portal, accent }) => {
  return (
    <Card className="overflow-hidden border-0 shadow-2xl bg-white/90 backdrop-blur">
      <CardHeader className={`border-b ${accent} text-white`}>
        <CardTitle className="text-2xl">{title}</CardTitle>
        <CardDescription className="text-white/80">{subtitle}</CardDescription>
      </CardHeader>
      <CardContent className="p-4">
        <Login portal={portal} embedded />
      </CardContent>
    </Card>
  );
};

export const PortalPreview: React.FC = () => {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(37,99,235,0.20),_transparent_35%),radial-gradient(circle_at_bottom_right,_rgba(16,185,129,0.18),_transparent_32%),linear-gradient(180deg,_#020617,_#0f172a)] p-4 text-white">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-col gap-4 rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur md:flex-row md:items-center md:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-[0.32em] text-sky-200/80">
              <Globe2 size={14} />
              Preview Mode
            </div>
            <h1 className="text-3xl font-bold">Two separate websites, one codebase</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-300">
              Browser is previewed as the Provider portal. Desktop is previewed as the Client portal. Use this page to compare both login experiences side by side.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button asChild className="bg-white text-slate-950 hover:bg-slate-200">
              <Link to="/provider/login">
                <Shield size={16} />
                Open Provider
              </Link>
            </Button>
            <Button asChild variant="outline" className="border-white/20 bg-transparent text-white hover:bg-white/10">
              <Link to="/admin/login">
                <MonitorSmartphone size={16} />
                Open Client
              </Link>
            </Button>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-2">
          <PreviewPanel
            title="Provider Website"
            subtitle="Browser-first admin shell for SaaS / license / organization control."
            portal="provider"
            accent="bg-gradient-to-r from-sky-600 to-cyan-600"
          />
          <PreviewPanel
            title="Client Website"
            subtitle="Desktop-first HR shell for attendance, gates, and employees."
            portal="admin"
            accent="bg-gradient-to-r from-emerald-600 to-teal-600"
          />
        </div>
      </div>
    </div>
  );
};
