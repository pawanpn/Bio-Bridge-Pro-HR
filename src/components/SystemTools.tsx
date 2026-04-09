import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Database, Cloud, CheckCircle, AlertCircle, Loader2, RefreshCw } from 'lucide-react';
import { seedDatabase, SeedResult } from '@/services/seedData';
import { rebuildLocalFromCloud, RebuildStats } from '@/services/rebuildFromCloud';

export const SystemTools: React.FC = () => {
  const [seeding, setSeeding] = useState(false);
  const [rebuilding, setRebuilding] = useState(false);
  const [seedResults, setSeedResults] = useState<SeedResult[] | null>(null);
  const [rebuildStats, setRebuildStats] = useState<RebuildStats | null>(null);

  const handleSeed = async () => {
    setSeeding(true);
    setSeedResults(null);
    try {
      const results = await seedDatabase();
      setSeedResults(results);
    } catch (error) {
      console.error('Seed failed:', error);
    } finally {
      setSeeding(false);
    }
  };

  const handleRebuild = async () => {
    if (!confirm('This will replace ALL local data with cloud data. Continue?')) return;
    
    setRebuilding(true);
    setRebuildStats(null);
    try {
      const stats = await rebuildLocalFromCloud();
      setRebuildStats(stats);
    } catch (error) {
      console.error('Rebuild failed:', error);
    } finally {
      setRebuilding(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Seed Database */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Database className="w-5 h-5" />
                Seed Database
              </CardTitle>
              <CardDescription>
                Populate all modules with dummy test data (5 records each)
              </CardDescription>
            </div>
            <Button
              onClick={handleSeed}
              disabled={seeding}
              className="gap-2"
            >
              {seeding ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Seeding...
                </>
              ) : (
                <>
                  <Database className="w-4 h-4" />
                  Seed Now
                </>
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {seedResults && (
            <div className="space-y-3">
              <h4 className="font-semibold">Seed Results:</h4>
              <div className="grid grid-cols-2 gap-3">
                {seedResults.map((result) => (
                  <div key={result.module} className="flex items-center justify-between p-3 border rounded-lg">
                    <span className="text-sm font-medium">{result.module}</span>
                    <div className="flex items-center gap-2">
                      <Badge variant={result.recordsCreated > 0 ? 'default' : 'destructive'}>
                        {result.recordsCreated} records
                      </Badge>
                      {result.recordsCreated > 0 ? (
                        <CheckCircle className="w-4 h-4 text-green-500" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-red-500" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Initial Sync / Rebuild from Cloud */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Cloud className="w-5 h-5" />
                Initial Sync (Rebuild from Cloud)
              </CardTitle>
              <CardDescription>
                Fetch ALL data from Supabase and rebuild local database from scratch
              </CardDescription>
            </div>
            <Button
              onClick={handleRebuild}
              disabled={rebuilding}
              variant="outline"
              className="gap-2"
            >
              {rebuilding ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Syncing...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4" />
                  Initial Sync
                </>
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {rebuildStats && (
            <div className="space-y-3">
              <h4 className="font-semibold">Sync Results:</h4>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Employees', count: rebuildStats.employees },
                  { label: 'Attendance', count: rebuildStats.attendance },
                  { label: 'Leave Requests', count: rebuildStats.leaveRequests },
                  { label: 'Items', count: rebuildStats.items },
                  { label: 'Branches', count: rebuildStats.branches },
                  { label: 'Gates', count: rebuildStats.gates },
                  { label: 'Devices', count: rebuildStats.devices },
                ].map((item) => (
                  <div key={item.label} className="flex items-center justify-between p-3 border rounded-lg">
                    <span className="text-sm">{item.label}</span>
                    <Badge variant="secondary">{item.count}</Badge>
                  </div>
                ))}
              </div>
              {rebuildStats.errors.length > 0 && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-700 font-medium">Errors:</p>
                  <ul className="text-xs text-red-600 mt-1">
                    {rebuildStats.errors.map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
