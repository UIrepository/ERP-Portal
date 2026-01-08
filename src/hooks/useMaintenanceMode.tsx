import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface MaintenanceSettings {
  is_maintenance_mode: boolean;
  maintenance_message: string | null;
}

interface VerifiedUser {
  email: string;
}

export const useMaintenanceMode = (userEmail: string | undefined) => {
  // Fetch maintenance settings
  const { data: settings, isLoading: settingsLoading } = useQuery({
    queryKey: ['maintenance-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('maintenance_settings')
        .select('is_maintenance_mode, maintenance_message')
        .limit(1)
        .single();

      if (error) throw error;
      return data as MaintenanceSettings;
    },
    staleTime: 30000, // Cache for 30 seconds
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

      if (error) throw error;
      return !!data;
    },
    enabled: !!userEmail && !!settings?.is_maintenance_mode,
    staleTime: 60000, // Cache for 1 minute
  });

  const isMaintenanceMode = settings?.is_maintenance_mode ?? false;
  const maintenanceMessage = settings?.maintenance_message ?? '';
  const canAccessDuringMaintenance = isVerified ?? false;

  // User can access if:
  // 1. Maintenance mode is OFF, OR
  // 2. Maintenance mode is ON but user is in verified list
  const shouldShowMaintenance = isMaintenanceMode && !canAccessDuringMaintenance;

  return {
    isMaintenanceMode,
    maintenanceMessage,
    canAccessDuringMaintenance,
    shouldShowMaintenance,
    isLoading: settingsLoading || (isMaintenanceMode && verifiedLoading),
  };
};
