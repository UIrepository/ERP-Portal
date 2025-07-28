
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Users, BookOpen, Video, MessageSquare } from 'lucide-react';

export const AnalyticsDashboard = () => {
  const { data: analyticsData } = useQuery({
    queryKey: ['analytics-summary'],
    queryFn: async () => {
      // Get user count by role
      const { data: usersByRole } = await supabase
        .from('profiles')
        .select('role')
        .eq('is_active', true);

      // Get content stats
      const { data: notes } = await supabase
        .from('notes')
        .select('subject, batch');

      const { data: recordings } = await supabase
        .from('recordings')
        .select('subject, batch');

      const { data: feedback } = await supabase
        .from('feedback')
        .select('subject, batch');

      const { data: extraClasses } = await supabase
        .from('extra_classes')
        .select('subject, batch');

      // Process user data by role
      const roleCount = usersByRole?.reduce((acc: any, user: any) => {
        acc[user.role] = (acc[user.role] || 0) + 1;
        return acc;
      }, {}) || {};

      // Process content by subject
      const subjectStats: Record<string, any> = {};
      
      notes?.forEach((note: any) => {
        if (!subjectStats[note.subject]) {
          subjectStats[note.subject] = { notes: 0, recordings: 0, feedback: 0, extraClasses: 0 };
        }
        subjectStats[note.subject].notes++;
      });

      recordings?.forEach((recording: any) => {
        if (!subjectStats[recording.subject]) {
          subjectStats[recording.subject] = { notes: 0, recordings: 0, feedback: 0, extraClasses: 0 };
        }
        subjectStats[recording.subject].recordings++;
      });

      feedback?.forEach((fb: any) => {
        if (!subjectStats[fb.subject]) {
          subjectStats[fb.subject] = { notes: 0, recordings: 0, feedback: 0, extraClasses: 0 };
        }
        subjectStats[fb.subject].feedback++;
      });

      extraClasses?.forEach((ec: any) => {
        if (!subjectStats[ec.subject]) {
          subjectStats[ec.subject] = { notes: 0, recordings: 0, feedback: 0, extraClasses: 0 };
        }
        subjectStats[ec.subject].extraClasses++;
      });

      return {
        usersByRole: Object.entries(roleCount).map(([role, count]) => ({
          role,
          count
        })),
        subjectStats: Object.entries(subjectStats).map(([subject, stats]) => ({
          subject,
          ...stats
        })),
        totalUsers: usersByRole?.length || 0,
        totalNotes: notes?.length || 0,
        totalRecordings: recordings?.length || 0,
        totalFeedback: feedback?.length || 0,
        totalExtraClasses: extraClasses?.length || 0
      };
    },
  });

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042'];

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Analytics Dashboard</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center">
              <Users className="h-8 w-8 text-primary" />
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Total Users</p>
                <p className="text-2xl font-bold">{analyticsData?.totalUsers || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center">
              <BookOpen className="h-8 w-8 text-primary" />
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Total Notes</p>
                <p className="text-2xl font-bold">{analyticsData?.totalNotes || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center">
              <Video className="h-8 w-8 text-primary" />
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Total Recordings</p>
                <p className="text-2xl font-bold">{analyticsData?.totalRecordings || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center">
              <MessageSquare className="h-8 w-8 text-primary" />
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Total Feedback</p>
                <p className="text-2xl font-bold">{analyticsData?.totalFeedback || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center">
              <Users className="h-8 w-8 text-primary" />
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Extra Classes</p>
                <p className="text-2xl font-bold">{analyticsData?.totalExtraClasses || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Users by Role</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={analyticsData?.usersByRole || []}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ role, count }) => `${role}: ${count}`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="count"
                >
                  {analyticsData?.usersByRole?.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Content by Subject</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={analyticsData?.subjectStats || []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="subject" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="notes" fill="#0088FE" name="Notes" />
                <Bar dataKey="recordings" fill="#00C49F" name="Recordings" />
                <Bar dataKey="feedback" fill="#FFBB28" name="Feedback" />
                <Bar dataKey="extraClasses" fill="#FF8042" name="Extra Classes" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
