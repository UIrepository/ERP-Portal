import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface MaintenanceSettings {
  is_maintenance_mode: boolean;
  maintenance_message: string | null;
}

export const useMaintenanceMode = (userEmail: string | undefined) => {
  // Fetch maintenance settings
  const { data: settings, isLoading: settingsLoading } = useQuery({
    queryKey: ['maintenance-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('maintenance_settings')
        .select('is_maintenance_mode, maintenance_message')
        .maybeSingle(); // <--- CHANGED from .single() to .maybeSingle()

      if (error) {
        console.error("Error fetching maintenance settings:", error);
        // Return default values on error to prevent infinite loading
        return { is_maintenance_mode: false, maintenance_message: null };
      }
      
      // If table is empty, return default
      return data ?? { is_maintenance_mode: false, maintenance_message: null };
    },
    staleTime: 30000, 
    retry: 1, // Only retry once to fail fast if there's an issue
  });

  // Check if user is verified for maintenance access
  const { data: isVerified, isLoading: verifiedLoading } = useQuery({
    queryKey: ['maintenance-verified', userEmail],
    queryFn: async () => {
      if (!userEmail) return false;

      const { data, error } = await supabase
        .from('verified_maintenance_users')
        .select('email')
        .eq('email', userEmail)
        .maybeSingle();

      if (error) return false;
      return !!data;
    },
    enabled: !!userEmail && !!settings?.is_maintenance_mode,
    staleTime: 60000, 
  });

  const isMaintenanceMode = settings?.is_maintenance_mode ?? false;
  const maintenanceMessage = settings?.maintenance_message ?? '';
  const canAccessDuringMaintenance = isVerified ?? false;

  const shouldShowMaintenance = isMaintenanceMode && !canAccessDuringMaintenance;

  // Logic Check: If we are NOT in maintenance mode, we shouldn't wait for 'verifiedLoading'
  const isLoading = settingsLoading || (isMaintenanceMode && verifiedLoading);

  return {
    isMaintenanceMode,
    maintenanceMessage,
    canAccessDuringMaintenance,
    shouldShowMaintenance,
    isLoading,
  };
};
