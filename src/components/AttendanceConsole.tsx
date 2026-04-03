import React, { useEffect, useState, useRef } from 'react';
import { listen } from '@tauri-apps/api/event';

export const AttendanceConsole: React.FC = () => {
  const [logs, setLogs] = useState<string[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unlisten = listen<string>('console-log', (event) => {
      setLogs((prev) => [...prev, event.payload]);
    });
    return () => {
      unlisten.then(fn => fn());
    };
  }, []);

  useEffect(() => {
    if (endRef.current) {
      endRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, isExpanded]);

  return (
    <div style={styles.container(isExpanded)}>
      <div style={styles.header} onClick={() => setIsExpanded(!isExpanded)}>
        <strong>Terminal Console (Live Sync)</strong>
        <span>{isExpanded ? '▼' : '▲'}</span>
      </div>
      {isExpanded && (
        <div style={styles.consoleBody}>
          {logs.length === 0 ? (
           <div style={{ color: '#9ca3af' }}>Waiting for logs...</div>
          ) : (
            logs.map((log, i) => <div key={i} style={styles.logLine}>{log}</div>)
          )}
          <div ref={endRef} />
        </div>
      )}
    </div>
  );
};

const styles = {
  container: (expanded: boolean) => ({
    position: 'fixed' as const,
    bottom: 0,
    left: '250px', // width of sidebar
    right: 0,
    backgroundColor: '#0f172a',
    color: '#38bdf8',
    fontFamily: 'monospace',
    borderTopLeftRadius: '8px',
    borderTopRightRadius: '8px',
    overflow: 'hidden',
    boxShadow: '0 -4px 6px -1px rgba(0, 0, 0, 0.1)',
    zIndex: 50,
  }),
  header: {
    padding: '8px 16px',
    backgroundColor: '#1e293b',
    cursor: 'pointer',
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '12px',
    color: '#94a3b8'
  },
  consoleBody: {
    height: '150px',
    overflowY: 'auto' as const,
    padding: '8px 16px',
    fontSize: '12px',
  },
  logLine: {
    marginBottom: '4px',
  }
};
