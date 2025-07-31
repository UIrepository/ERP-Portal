// uirepository/teachgrid-hub/teachgrid-hub-d9688224fef19a4774d713506784003cfd24ff67/src/components/admin/AdminDashboard.tsx
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { EnrollmentAnalytics } from './EnrollmentAnalytics';
import { UserManagement } from './UserManagement';
import { CourseManagement } from './CourseManagement';
import { ContentManagement } from './ContentManagement';
import { CommunicationTools } from './CommunicationTools';
import { SystemSettings } from './SystemSettings';

interface AdminDashboardProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export const AdminDashboard = ({ activeTab, onTabChange }: AdminDashboardProps) => {
  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-6">Admin Dashboard</h1>
      <Tabs value={activeTab} onValueChange={onTabChange} className="w-full">
        <TabsList className="grid w-full grid-cols-5 md:grid-cols-7 lg:grid-cols-9 h-auto flex-wrap">
          <TabsTrigger value="enrollment-analytics">Enrollment Analytics</TabsTrigger>
          <TabsTrigger value="user-management">User Management</TabsTrigger>
          <TabsTrigger value="course-management">Course Management</TabsTrigger>
          <TabsTrigger value="content-management">Content Management</TabsTrigger>
          <TabsTrigger value="communication-tools">Communication Tools</TabsTrigger>
          <TabsTrigger value="system-settings">System Settings</TabsTrigger>
          {/* Removed Teacher Analytics and Monitoring TBAS */}
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

        <TabsContent value="user-management" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>User Management</CardTitle>
              <CardDescription>Manage user accounts, roles, and permissions.</CardDescription>
            </CardHeader>
            <CardContent>
              <UserManagement />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="course-management" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Course Management</CardTitle>
              <CardDescription>Create, edit, and manage courses and batches.</CardDescription>
            </CardHeader>
            <CardContent>
              <CourseManagement />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="content-management" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Content Management</CardTitle>
              <CardDescription>Manage lectures, notes, exams, and other learning materials.</CardDescription>
            </CardHeader>
            <CardContent>
              <ContentManagement />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="communication-tools" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Communication Tools</CardTitle>
              <CardDescription>Manage announcements, notifications, and student communication.</CardDescription>
            </CardHeader>
            <CardContent>
              <CommunicationTools />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Removed content for Teacher Analytics and Monitoring TBAS */}

        <TabsContent value="system-settings" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>System Settings</CardTitle>
              <CardDescription>Configure application-wide settings.</CardDescription>
            </CardHeader>
            <CardContent>
              <SystemSettings />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};
