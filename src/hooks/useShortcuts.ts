import { useEffect } from 'react';

export const useShortcuts = () => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 's') {
        e.preventDefault();
        console.log('Shortcut: Save triggered');
        // trigger save logic
      } else if (e.ctrlKey && e.key === 'd') {
        e.preventDefault();
        console.log('Shortcut: Delete triggered');
        // trigger delete logic
      } else if (e.altKey && e.key === 'g') {
        e.preventDefault();
        console.log('Shortcut: Generate Report triggered');
        // prompt report window
      } else if (e.altKey && e.key === 'm') {
        e.preventDefault();
        console.log('Shortcut: Masters triggered');
        // navigate to masters
      } else if (e.altKey && e.key === 's') {
        e.preventDefault();
        console.log('Shortcut: Settings triggered');
        // navigate to settings
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);
};
