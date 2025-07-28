
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/hooks/useAuth';
import { TeacherSchedule } from './teacher/TeacherSchedule';
import { TeacherExtraClasses } from './teacher/TeacherExtraClasses';
import { TeacherFeedback } from './teacher/TeacherFeedback';
import { TeacherBankDetails } from './teacher/TeacherBankDetails';
import { Calendar, Plus, MessageSquare, CreditCard, BookOpen, Video } from 'lucide-react';

export const TeacherDashboard = () => {
  const { profile } = useAuth();
  const [activeTab, setActiveTab] = useState('schedule');

  if (profile?.role !== 'teacher') {
    return (
      <div className="p-6 text-center">
        <h1 className="text-2xl font-bold text-destructive">Access Denied</h1>
        <p className="text-muted-foreground mt-2">You don't have permission to access this page.</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Teacher Dashboard</h1>
        <div className="text-sm text-muted-foreground">
          Welcome, {profile?.name} | Batch: {profile?.batch} | Subjects: {profile?.subjects?.join(', ')}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center">
              <Calendar className="h-8 w-8 text-primary" />
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">My Schedule</p>
                <p className="text-2xl font-bold">View Classes</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center">
              <Plus className="h-8 w-8 text-primary" />
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Extra Classes</p>
                <p className="text-2xl font-bold">Schedule</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center">
              <MessageSquare className="h-8 w-8 text-primary" />
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Student Feedback</p>
                <p className="text-2xl font-bold">View</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center">
              <CreditCard className="h-8 w-8 text-primary" />
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Bank Details</p>
                <p className="text-2xl font-bold">Update</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="schedule" className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Schedule
          </TabsTrigger>
          <TabsTrigger value="extra-classes" className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Extra Classes
          </TabsTrigger>
          <TabsTrigger value="feedback" className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            Feedback
          </TabsTrigger>
          <TabsTrigger value="bank-details" className="flex items-center gap-2">
            <CreditCard className="h-4 w-4" />
            Bank Details
          </TabsTrigger>
        </TabsList>

        <TabsContent value="schedule" className="mt-6">
          <TeacherSchedule />
        </TabsContent>

        <TabsContent value="extra-classes" className="mt-6">
          <TeacherExtraClasses />
        </TabsContent>

        <TabsContent value="feedback" className="mt-6">
          <TeacherFeedback />
        </TabsContent>

        <TabsContent value="bank-details" className="mt-6">
          <TeacherBankDetails />
        </TabsContent>
      </Tabs>
    </div>
  );
};
