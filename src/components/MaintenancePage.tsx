import { GearsArt, StateScreen } from '@/components/StateScreens';

interface MaintenancePageProps {
  message?: string;
}

/**
 * Student-facing maintenance screen. All copy comes from the backend
 * (maintenance_settings.maintenance_message) — nothing about timing is
 * hardcoded here. Falls back to a neutral line only when the admin left the
 * message blank.
 */
export const MaintenancePage = ({ message }: MaintenancePageProps) => (
  <StateScreen
    art={<GearsArt />}
    title="Under maintenance"
    message={message?.trim() || 'We are performing scheduled maintenance. Please check back soon.'}
  />
);
