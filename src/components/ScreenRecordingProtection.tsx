import { useEffect, useState } from 'react';

export const ScreenRecordingProtection = ({ children }: { children: React.ReactNode }) => {
  const [isProtected, setIsProtected] = useState(false);

  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      // Disable F12, Ctrl+Shift+I, Ctrl+Shift+C, Ctrl+Shift+J, Ctrl+U
      if (
        e.key === 'F12' ||
        (e.ctrlKey && e.shiftKey && ['I', 'C', 'J'].includes(e.key)) ||
        (e.ctrlKey && e.key === 'U')
      ) {
        e.preventDefault();
      }
    };

    const handlePrintScreen = () => {
        setIsProtected(true);
        setTimeout(() => setIsProtected(false), 200);
    };

    window.addEventListener('beforeprint', handlePrintScreen);
    window.addEventListener('afterprint', () => setIsProtected(false));
    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('keydown', handleKeyDown);


    return () => {
      window.removeEventListener('beforeprint', handlePrintScreen);
      window.removeEventListener('afterprint', () => setIsProtected(false));
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  return (
    <div className={isProtected ? 'screen-recording-protection-active' : ''}>
      <div className="screen-recording-protection">
        {children}
      </div>
    </div>
  );
};
