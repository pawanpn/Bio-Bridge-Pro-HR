// ============================================================
// Bio-Bridge Pro HR — Sync Status Bar
// Add to MainLayout header. Shows offline/online, pending
// sync count, last sync time, and error indicator.
// ============================================================

import { useState, useEffect, useCallback } from "react";
import api from "../services/api";
import { relativeTime } from "../utils/date";
import type { SyncStats } from "../types";

export function SyncStatusBar() {
  const [stats, setStats] = useState<SyncStats | null>(null);
  const [isSyncing, setSyncing] = useState(false);
  const [isOnline, setOnline] = useState(navigator.onLine);

  // Poll sync stats every 30s
  const loadStats = useCallback(async () => {
    try {
      const s = await api.sync.get_stats();
      setStats(s);
    } catch {
      // Silently ignore — stats are informational
    }
  }, []);

  useEffect(() => {
    loadStats();
    const interval = setInterval(loadStats, 30_000);
    return () => clearInterval(interval);
  }, [loadStats]);

  // Track network status
  useEffect(() => {
    const setOn = () => setOnline(true);
    const setOff = () => setOnline(false);
    window.addEventListener("online", setOn);
    window.addEventListener("offline", setOff);
    return () => {
      window.removeEventListener("online", setOn);
      window.removeEventListener("offline", setOff);
    };
  }, []);

  // Auto-sync when coming back online
  useEffect(() => {
    if (isOnline && stats && stats.pending_count > 0) {
      handleSync();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnline]);

  const handleSync = async () => {
    if (isSyncing || !isOnline) return;
    setSyncing(true);
    try {
      const updated = await api.sync.push();
      setStats(updated);
    } catch {
      // Error handled silently; stats will show failed count
    } finally {
      setSyncing(false);
    }
  };

  const statusColor = !isOnline
    ? "#888780"
    : stats?.failed_count
    ? "#E24B4A"
    : stats?.pending_count
    ? "#EF9F27"
    : "#639922";

  const statusLabel = !isOnline
    ? "Offline"
    : isSyncing
    ? "Syncing…"
    : stats?.failed_count
    ? `${stats.failed_count} failed`
    : stats?.pending_count
    ? `${stats.pending_count} pending`
    : "Synced";

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "8px",
        fontSize: "12px",
        color: "var(--color-text-secondary)",
        padding: "4px 10px",
        border: "0.5px solid var(--color-border-tertiary)",
        borderRadius: "var(--border-radius-md)",
        background: "var(--color-background-secondary)",
        cursor: isOnline && stats?.pending_count ? "pointer" : "default",
        userSelect: "none",
        flexShrink: 0,
      }}
      onClick={handleSync}
      title={
        stats?.last_sync_at
          ? `Last synced: ${relativeTime(stats.last_sync_at)}`
          : "Never synced"
      }
    >
      {/* Status dot */}
      <span
        style={{
          width: "6px",
          height: "6px",
          borderRadius: "50%",
          background: statusColor,
          flexShrink: 0,
          animation: isSyncing ? "pulse 1s infinite" : "none",
        }}
      />
      <span style={{ color: statusColor, fontWeight: 500 }}>{statusLabel}</span>
      {stats?.last_sync_at && (
        <span style={{ color: "var(--color-text-secondary)" }}>
          · {relativeTime(stats.last_sync_at)}
        </span>
      )}
      {isOnline && stats?.pending_count && stats.pending_count > 0 && (
        <span
          style={{
            marginLeft: "2px",
            background: "#FAEEDA",
            color: "#854F0B",
            padding: "1px 6px",
            borderRadius: "10px",
            fontSize: "11px",
          }}
        >
          Sync now
        </span>
      )}
      <style>{`@keyframes pulse { 0%,100% { opacity:1 } 50% { opacity:0.3 } }`}</style>
    </div>
  );
}

export default SyncStatusBar;
