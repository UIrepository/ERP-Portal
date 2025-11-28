import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle } from 'lucide-react';

export const StudentExtraClasses = () => {
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
            The Extra Classes feature has been deprecated. All class information is now available in the Schedule section.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};
