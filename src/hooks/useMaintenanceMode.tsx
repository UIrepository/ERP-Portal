import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useSharedFlags } from '@/hooks/useSharedFlags';

export const useMaintenanceMode = (userEmail: string | undefined) => {
  // Maintenance flag rides the shared (Vercel-edge-cached) flags feed instead
  // of every client polling maintenance_settings directly.
  const { data: flags, isLoading: settingsLoading } = useSharedFlags();
  const settings = flags?.maintenance;

  // Check if user is verified for maintenance access.
  // Compare case-insensitively — auth emails and stored emails can drift in case.
  const normalizedEmail = userEmail?.trim().toLowerCase();
  const { data: isVerified, isLoading: verifiedLoading } = useQuery({
    queryKey: ['maintenance-verified', normalizedEmail],
    queryFn: async () => {
      if (!normalizedEmail) return false;

      const { data, error } = await supabase
        .from('verified_maintenance_users')
        .select('email')
        .ilike('email', normalizedEmail)
        .maybeSingle();

      if (error) {
        console.error('verified_maintenance_users lookup failed:', error);
        return false;
      }
      return !!data;
    },
    enabled: !!normalizedEmail && !!settings?.is_maintenance_mode,
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
