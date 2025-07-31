// uirepository/teachgrid-hub/teachgrid-hub-a2a6dc8225a9586a6aa866242682dcb8e0da0c87/src/components/admin/AdminDashboard.tsx
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { EnrollmentAnalytics } from './EnrollmentAnalytics';
import { ScheduleManagement } from './ScheduleManagement';
import { AdminMeetingManager } from './AdminMeetingManager';

interface AdminDashboardProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export const AdminDashboard = ({ activeTab, onTabChange }: AdminDashboardProps) => {
  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-6">Admin Dashboard</h1>
      <Tabs value={activeTab} onTabChange={onTabChange} className="w-full">
        <TabsList className="grid w-full grid-cols-3 h-auto flex-wrap">
          <TabsTrigger value="enrollment-analytics">Enrollment Analytics</TabsTrigger>
          <TabsTrigger value="schedules">Schedules</TabsTrigger>
          <TabsTrigger value="meeting-manager">Meeting Links</TabsTrigger>
        </TabsList>

        <TabsContent value="enrollment-analytics" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Enrollment Analytics</CardTitle>
              <CardDescription>Overview of student enrollments and progress.</CardDescription>
            </CardHeader>
            <CardContent>
              <EnrollmentAnalytics />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="schedules" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Schedules</CardTitle>
              <CardDescription>View all class schedules.</CardDescription>
            </CardHeader>
            <CardContent>
              <ScheduleManagement />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="meeting-manager" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Meeting Links</CardTitle>
              <CardDescription>Manage and view meeting links for classes.</CardDescription>
            </CardHeader>
            <CardContent>
              <AdminMeetingManager />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};
