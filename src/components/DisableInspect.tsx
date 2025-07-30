import { useEffect } from 'react';

export const DisableInspect = () => {
  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      // Disable F12
      if (e.key === 'F12') {
        e.preventDefault();
      }
      // Disable Ctrl+Shift+I
      if (e.ctrlKey && e.shiftKey && e.key === 'I') {
        e.preventDefault();
      }
      // Disable Ctrl+Shift+C
      if (e.ctrlKey && e.shiftKey && e.key === 'C') {
        e.preventDefault();
      }
      // Disable Ctrl+Shift+J
      if (e.ctrlKey && e.shiftKey && e.key === 'J') {
        e.preventDefault();
      }
      // Disable Ctrl+U
      if (e.ctrlKey && e.key === 'U') {
        e.preventDefault();
      }
    };

    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  return null;
};
