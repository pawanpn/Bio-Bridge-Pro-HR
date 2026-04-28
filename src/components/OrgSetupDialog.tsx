import React, { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { addBranch } from '@/services/masterService';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Trash2 } from 'lucide-react';

interface OrgSetupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  branches: any[];
  departments: any[];
  designations: any[];
  onRefresh: () => void;
  organizationId?: number | string;
}

export const OrgSetupDialog: React.FC<OrgSetupDialogProps> = ({ open, onOpenChange, branches, departments, designations, onRefresh, organizationId }) => {
  const [activeTab, setActiveTab] = useState<'branches'|'departments'|'designations'>('branches');
  const [newName, setNewName] = useState('');
  const [selectedBranchId, setSelectedBranchId] = useState('');

  const handleAdd = async () => {
    if(!newName.trim()) return;
    try {
      if(activeTab === 'branches') {
        const orgId = organizationId || 1;
        await addBranch(newName, null, Number(orgId));
      } else if (activeTab === 'departments') {
         await invoke('create_department', { name: newName, branchId: selectedBranchId ? parseInt(selectedBranchId) : null });
      } else {
         await invoke('create_designation', { name: newName, branchId: selectedBranchId ? parseInt(selectedBranchId) : null });
      }
      setNewName('');
      onRefresh();
    } catch(err) {
      alert('Failed to add: ' + err);
    }
  };

  const handleDelete = async (id: number) => {
    if(!confirm('Are you sure you want to delete this specific entity?')) return;
    try {
      if(activeTab === 'branches') {
         await invoke('delete_branch', { id });
      } else if (activeTab === 'departments') {
         await invoke('delete_department', { id });
      } else {
         await invoke('delete_designation', { id });
      }
      onRefresh();
    } catch(err) {
      alert('Failed to delete: ' + err);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Organization Structure Setup</DialogTitle>
        </DialogHeader>
        <div className="flex border-b border-border mt-4">
          {['branches', 'departments', 'designations'].map(tab => (
            <button
               key={tab}
               className={`px-4 py-2 text-sm font-semibold capitalize ${activeTab === tab ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground hover:text-foreground'}`}
               onClick={() => setActiveTab(tab as any)}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto py-4 space-y-4">
           <div className="flex gap-2 p-4 bg-muted/30 rounded-lg">
             <Input 
               placeholder={`New ${activeTab.replace(/s$/, '')} name...`} 
               value={newName}
               onChange={(e) => setNewName(e.target.value)}
             />
             {activeTab !== 'branches' && (
                <select 
                   value={selectedBranchId}
                   onChange={e => setSelectedBranchId(e.target.value)}
                   className="h-10 px-3 rounded-md border border-input bg-background"
                >
                  <option value="">Global (All Branches)</option>
                  {branches.map(b => (
                     <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
             )}
             <Button onClick={handleAdd}>
               <Plus className="w-4 h-4 mr-2"/>
               Add
             </Button>
           </div>

           <div className="border rounded-md divide-y">
              {activeTab === 'branches' && branches.map(b => (
                <div key={b.id} className="flex items-center justify-between p-3 hover:bg-muted/50">
                  <span className="font-medium">{b.name}</span>
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(b.id)}>
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              ))}
              {activeTab === 'departments' && departments.map(d => (
                <div key={d.id} className="flex items-center justify-between p-3 hover:bg-muted/50">
                  <div className="flex flex-col">
                     <span className="font-medium">{d.name}</span>
                     <span className="text-xs text-muted-foreground">{d.branch_id ? `Branch: ${branches.find(b => b.id === d.branch_id)?.name}` : 'Global'}</span>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(d.id)}>
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              ))}
              {activeTab === 'designations' && designations.map(d => (
                <div key={d.id} className="flex items-center justify-between p-3 hover:bg-muted/50">
                  <div className="flex flex-col">
                     <span className="font-medium">{d.name}</span>
                     <span className="text-xs text-muted-foreground">{d.branch_id ? `Branch: ${branches.find(b => b.id === d.branch_id)?.name}` : 'Global'}</span>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(d.id)}>
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              ))}
           </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
