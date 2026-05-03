import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Users, Monitor, ArrowRight, Trash2, CheckCircle, Loader2, Building2 } from 'lucide-react';

interface BranchMigrationWizardProps {
  open: boolean;
  branch: { id: number; name: string } | null;
  branches: any[];
  onClose: () => void;
  onDeleted: () => void;
}

type Step = 'loading' | 'summary' | 'migrate' | 'confirm' | 'done';

export const BranchMigrationWizard: React.FC<BranchMigrationWizardProps> = ({
  open, branch, branches, onClose, onDeleted
}) => {
  const [step, setStep] = useState<Step>('loading');
  const [summary, setSummary] = useState<any>(null);
  const [targetBranchIdForEmployees, setTargetBranchIdForEmployees] = useState<string>('');
  const [targetBranchIdForDevices, setTargetBranchIdForDevices] = useState<string>('');
  const [migrateEmployees, setMigrateEmployees] = useState(true);
  const [migrateDevices, setMigrateDevices] = useState(true);
  const [migrationResult, setMigrationResult] = useState<any>(null);
  const [working, setWorking] = useState(false);
  const [finalSummary, setFinalSummary] = useState<any>(null);

  const otherBranches = branches.filter(b => b.id !== branch?.id);

  useEffect(() => {
    if (open && branch) {
      setStep('loading');
      setSummary(null);
      setMigrationResult(null);
      setTargetBranchIdForEmployees('');
      setTargetBranchIdForDevices('');
      setWorking(false);
      loadSummary();
    }
  }, [open, branch]);

  const loadSummary = async () => {
    if (!branch) return;
    try {
      const data = await invoke<any>('get_branch_summary', { id: branch.id });
      setSummary(data);
      setStep(data.is_empty ? 'confirm' : 'summary');
    } catch (e) {
      console.error(e);
      setStep('summary');
    }
  };

  const handleMigrate = async () => {
    if (!branch) return;
    setWorking(true);
    try {
      const toEmpBranch = targetBranchIdForEmployees ? parseInt(targetBranchIdForEmployees) : null;
      const toDevBranch = targetBranchIdForDevices ? parseInt(targetBranchIdForDevices) : null;

      // If both targets are the same, do in one call
      const result = await invoke<any>('migrate_branch_data', {
        fromBranchId: branch.id,
        toBranchId: toEmpBranch ?? toDevBranch,
        migrateEmployees,
        migrateDevices,
      });
      setMigrationResult(result);
      // Reload summary to check if now empty
      const newSummary = await invoke<any>('get_branch_summary', { id: branch.id });
      setFinalSummary(newSummary);
      setStep('confirm');
    } catch (e) {
      alert('Migration failed: ' + e);
    } finally {
      setWorking(false);
    }
  };

  const handleFinalDelete = async () => {
    if (!branch) return;
    setWorking(true);
    try {
      await invoke('delete_branch', { id: branch.id });
      setStep('done');
      setTimeout(() => {
        onDeleted();
        onClose();
      }, 1500);
    } catch (e) {
      alert('Delete failed: ' + e);
      setWorking(false);
    }
  };

  if (!branch) return null;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen && !working) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-primary" />
            Delete Branch: {branch.name}
          </DialogTitle>
          <DialogDescription>
            Follow the steps below to safely remove this branch.
          </DialogDescription>
        </DialogHeader>

        {/* Step Indicators */}
        <div className="flex items-center gap-1 py-2">
          {['Summary', 'Migrate', 'Confirm'].map((label, i) => {
            const stepIndex = step === 'loading' ? -1 : step === 'summary' ? 0 : step === 'migrate' ? 1 : 2;
            const active = stepIndex === i;
            const done = stepIndex > i;
            return (
              <React.Fragment key={label}>
                <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
                  done ? 'bg-green-100 text-green-700' :
                  active ? 'bg-primary text-primary-foreground' :
                  'bg-muted text-muted-foreground'
                }`}>
                  {done ? <CheckCircle className="w-3 h-3" /> : null}
                  {label}
                </div>
                {i < 2 && <div className="flex-1 h-px bg-border" />}
              </React.Fragment>
            );
          })}
        </div>

        <div className="flex-1 overflow-y-auto py-2">

          {/* LOADING */}
          {step === 'loading' && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <span className="ml-3 text-muted-foreground">Analyzing branch data...</span>
            </div>
          )}

          {/* STEP 1: SUMMARY */}
          {step === 'summary' && summary && (
            <div className="space-y-4">
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg flex gap-3">
                <AlertTriangle className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-amber-800">This branch contains active data</p>
                  <p className="text-sm text-amber-700 mt-1">
                    You must migrate or unassign all employees and devices before this branch can be deleted.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="p-4 border rounded-lg text-center">
                  <Users className="w-6 h-6 mx-auto mb-1 text-blue-500" />
                  <div className="text-2xl font-bold text-blue-600">{summary.employee_count}</div>
                  <div className="text-xs text-muted-foreground">Employees</div>
                </div>
                <div className="p-4 border rounded-lg text-center">
                  <Monitor className="w-6 h-6 mx-auto mb-1 text-purple-500" />
                  <div className="text-2xl font-bold text-purple-600">{summary.device_count}</div>
                  <div className="text-xs text-muted-foreground">Devices</div>
                </div>
                <div className="p-4 border rounded-lg text-center">
                  <Building2 className="w-6 h-6 mx-auto mb-1 text-green-500" />
                  <div className="text-2xl font-bold text-green-600">{summary.gate_count}</div>
                  <div className="text-xs text-muted-foreground">Gates</div>
                </div>
              </div>

              {summary.employees.length > 0 && (
                <div>
                  <p className="text-sm font-semibold mb-2">Employees in this branch:</p>
                  <div className="max-h-36 overflow-y-auto border rounded-md divide-y text-sm">
                    {summary.employees.map((e: any) => (
                      <div key={e.id} className="px-3 py-2 flex justify-between">
                        <span className="font-medium">{e.name}</span>
                        <span className="text-muted-foreground">{e.employee_code || `#${e.id}`}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {summary.devices.length > 0 && (
                <div>
                  <p className="text-sm font-semibold mb-2">Devices in this branch:</p>
                  <div className="max-h-28 overflow-y-auto border rounded-md divide-y text-sm">
                    {summary.devices.map((d: any) => (
                      <div key={d.id} className="px-3 py-2 flex justify-between">
                        <span className="font-medium">{d.name}</span>
                        <span className="text-muted-foreground">{d.brand} · {d.ip}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={onClose}>Cancel</Button>
                <Button onClick={() => setStep('migrate')}>
                  Proceed to Migrate <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </div>
          )}

          {/* STEP 2: MIGRATE */}
          {step === 'migrate' && summary && (
            <div className="space-y-5">
              <p className="text-sm text-muted-foreground">
                Select a destination branch for employees and devices. Choose <strong>"Unassign"</strong> to remove the assignment without moving them.
              </p>

              {/* Employees */}
              {summary.employee_count > 0 && (
                <div className="p-4 border rounded-lg space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-blue-500" />
                      <span className="font-semibold">{summary.employee_count} Employees</span>
                    </div>
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <input type="checkbox" checked={migrateEmployees} onChange={e => setMigrateEmployees(e.target.checked)} className="rounded" />
                      Migrate
                    </label>
                  </div>
                  {migrateEmployees && (
                    <div>
                      <label className="text-xs text-muted-foreground">Move to Branch:</label>
                      <select
                        value={targetBranchIdForEmployees}
                        onChange={e => setTargetBranchIdForEmployees(e.target.value)}
                        className="w-full mt-1 h-10 px-3 rounded-md border border-input bg-background text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                      >
                        <option value="">Unassign (No Branch)</option>
                        {otherBranches.map(b => (
                          <option key={b.id} value={b.id}>{b.name}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              )}

              {/* Devices */}
              {summary.device_count > 0 && (
                <div className="p-4 border rounded-lg space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Monitor className="w-4 h-4 text-purple-500" />
                      <span className="font-semibold">{summary.device_count} Devices</span>
                    </div>
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <input type="checkbox" checked={migrateDevices} onChange={e => setMigrateDevices(e.target.checked)} className="rounded" />
                      Migrate
                    </label>
                  </div>
                  {migrateDevices && (
                    <div>
                      <label className="text-xs text-muted-foreground">Move to Branch:</label>
                      <select
                        value={targetBranchIdForDevices}
                        onChange={e => setTargetBranchIdForDevices(e.target.value)}
                        className="w-full mt-1 h-10 px-3 rounded-md border border-input bg-background text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                      >
                        <option value="">Unassign (No Branch)</option>
                        {otherBranches.map(b => (
                          <option key={b.id} value={b.id}>{b.name}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              )}

              <div className="flex justify-between pt-2">
                <Button variant="outline" onClick={() => setStep('summary')}>← Back</Button>
                <Button onClick={handleMigrate} disabled={working}>
                  {working ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ArrowRight className="w-4 h-4 mr-2" />}
                  {working ? 'Migrating...' : 'Apply Migration'}
                </Button>
              </div>
            </div>
          )}

          {/* STEP 3: CONFIRM DELETE */}
          {step === 'confirm' && (
            <div className="space-y-4">
              {migrationResult && (
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg flex gap-3">
                  <CheckCircle className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
                  <div className="text-sm text-green-800">
                    Migration complete — {migrationResult.employees_moved} employees and {migrationResult.devices_moved} devices moved.
                  </div>
                </div>
              )}

              {(finalSummary || summary)?.is_empty ? (
                <>
                  <div className="p-5 bg-red-50 border-2 border-red-200 rounded-lg space-y-3">
                    <div className="flex items-center gap-2 text-red-700 font-bold text-lg">
                      <Trash2 className="w-5 h-5" />
                      Permanently Delete "{branch.name}"
                    </div>
                    <p className="text-sm text-red-700">
                      This branch is now empty. This action is <strong>irreversible</strong>. All gates and attendance logs for this branch will be permanently deleted.
                    </p>
                    <p className="text-xs font-mono bg-red-100 px-3 py-2 rounded border border-red-300 text-red-800">
                      ⚠ This will delete: gates, attendance history, and the branch record itself.
                    </p>
                  </div>
                  <div className="flex justify-between">
                    <Button variant="outline" onClick={onClose}>Cancel — Keep Branch</Button>
                    <Button variant="destructive" onClick={handleFinalDelete} disabled={working}>
                      {working ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
                      {working ? 'Deleting...' : 'Permanently Delete Branch'}
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <div className="p-4 bg-amber-50 border border-amber-300 rounded-lg">
                    <p className="text-sm font-semibold text-amber-800">Branch still has data</p>
                    <p className="text-sm text-amber-700 mt-1">
                      Employees: {(finalSummary || summary)?.employee_count} · Devices: {(finalSummary || summary)?.device_count}
                    </p>
                    <p className="text-xs text-amber-600 mt-2">You must migrate all employees and devices before deletion.</p>
                  </div>
                  <div className="flex justify-between">
                    <Button variant="outline" onClick={() => setStep('migrate')}>← Go Back to Migrate</Button>
                    <Button variant="outline" onClick={onClose}>Cancel</Button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* DONE */}
          {step === 'done' && (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <CheckCircle className="w-12 h-12 text-green-500" />
              <p className="text-lg font-semibold text-green-700">Branch Deleted Successfully</p>
              <p className="text-sm text-muted-foreground">Refreshing data...</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
