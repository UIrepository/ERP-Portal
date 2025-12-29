import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Calendar } from 'lucide-react';

// This component will be functional after the extra_classes table is created
// For now, we show a placeholder

export const StudentExtraClasses = () => {
  const { profile } = useAuth();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Extra Classes</h2>
        <div className="flex gap-2">
          <Badge variant="outline">Batch: {profile?.batch?.[0] || 'N/A'}</Badge>
          <Badge variant="outline">Subjects: {profile?.subjects?.join(', ') || 'N/A'}</Badge>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Calendar className="mr-2 h-5 w-5" />
            Extra Classes
          </CardTitle>
        </CardHeader>
        <CardContent className="p-8 text-center">
          <Plus className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">No extra classes scheduled</p>
          <p className="text-sm text-muted-foreground mt-2">
            Extra classes will appear here when scheduled by teachers.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};
