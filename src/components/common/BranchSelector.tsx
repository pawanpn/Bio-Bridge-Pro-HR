// ============================================================
// Shared BranchSelector — use this everywhere
// Usage: <BranchSelector value={branchId} onChange={setBranchId} />
// ============================================================
import React, { useState, useEffect } from 'react';
import { supabase } from '@/config/supabase';

interface Branch {
  id: number;
  name: string;
  org_id?: number;
  organization_id?: number;
}

interface BranchSelectorProps {
  value?: number | string;
  onChange: (id: number | undefined, branch?: Branch) => void;
  includeAll?: boolean;
  allLabel?: string;
  style?: React.CSSProperties;
  className?: string;
  size?: 'sm' | 'md';
}

// Global cache — fetch branches once, share everywhere
let branchCache: Branch[] = [];
let branchCacheTime = 0;
const CACHE_TTL = 60_000; // 1 minute

export async function fetchBranches(): Promise<Branch[]> {
  if (branchCache.length > 0 && Date.now() - branchCacheTime < CACHE_TTL) {
    return branchCache;
  }
  const { data } = await supabase.from('branches').select('*').order('name');
  branchCache = data || [];
  branchCacheTime = Date.now();
  return branchCache;
}

export function invalidateBranchCache() {
  branchCache = [];
  branchCacheTime = 0;
}

export const BranchSelector: React.FC<BranchSelectorProps> = ({
  value,
  onChange,
  includeAll = true,
  allLabel = 'All Branches',
  style,
  className,
  size = 'md',
}) => {
  const [branches, setBranches] = useState<Branch[]>(branchCache);
  const [loading, setLoading] = useState(branchCache.length === 0);

  useEffect(() => {
    fetchBranches().then(data => {
      setBranches(data);
      setLoading(false);
    });
  }, []);

  const padding = size === 'sm' ? '5px 10px' : '8px 12px';
  const fontSize = size === 'sm' ? 13 : 14;

  return (
    <select
      value={value ?? ''}
      onChange={e => {
        const id = e.target.value ? Number(e.target.value) : undefined;
        const branch = branches.find(b => b.id === id);
        onChange(id, branch);
      }}
      disabled={loading}
      className={className}
      style={{
        padding,
        fontSize,
        borderRadius: 6,
        border: '1px solid var(--border-color, #e2e8f0)',
        backgroundColor: 'var(--bg-color, #fff)',
        color: 'var(--text-color, #1e293b)',
        outline: 'none',
        cursor: 'pointer',
        minWidth: 140,
        ...style,
      }}
    >
      {includeAll && <option value="">{loading ? 'Loading...' : allLabel}</option>}
      {branches.map(b => (
        <option key={b.id} value={b.id}>{b.name}</option>
      ))}
    </select>
  );
};

export default BranchSelector;
