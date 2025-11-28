import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle } from 'lucide-react';

export const AdminTeacherManager = () => {
  return (
    <div className="p-6 space-y-6">
      <Card className="border-yellow-200 bg-yellow-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-yellow-800">
            <AlertTriangle className="h-5 w-5" />
            Feature Unavailable
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-yellow-700">
            The Teacher Manager feature has been deprecated. This system now uses a student-admin model only.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};
