import { Wrench } from 'lucide-react';

interface MaintenancePageProps {
  message?: string;
}

export const MaintenancePage = ({ message }: MaintenancePageProps) => {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="flex justify-center">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
            <Wrench className="w-8 h-8 text-muted-foreground" />
          </div>
        </div>
        
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold text-foreground tracking-tight" style={{ fontFamily: 'Inter, sans-serif' }}>
            Under Maintenance
          </h1>
          <p className="text-muted-foreground text-sm leading-relaxed" style={{ fontFamily: 'Inter, sans-serif' }}>
            {message || 'We are currently performing scheduled maintenance. Please check back soon.'}
          </p>
        </div>

        <div className="pt-4">
          <div className="inline-flex items-center gap-2 text-xs text-muted-foreground">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            <span style={{ fontFamily: 'Inter, sans-serif' }}>Maintenance in progress</span>
          </div>
        </div>
      </div>
    </div>
  );
};
