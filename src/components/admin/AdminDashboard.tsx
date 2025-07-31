// uirepository/teachgrid-hub/teachgrid-hub-a2a6dc8225a9586a6aa866242682dcb8e0da0c87/src/components/admin/AdminDashboard.tsx
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { EnrollmentAnalytics } from './EnrollmentAnalytics';

interface AdminDashboardProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export const AdminDashboard = ({ activeTab, onTabChange }: AdminDashboardProps) => {
  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-6">Admin Dashboard</h1>
      <Tabs value={activeTab} onValueChange={onTabChange} className="w-full">
        <TabsList className="grid w-full grid-cols-1">
          <TabsTrigger value="enrollment-analytics">Enrollment Analytics</TabsTrigger>
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
      </Tabs>
    </div>
  );
};
