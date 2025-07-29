
import { Card, CardContent } from '@/components/ui/card';
import { BookOpen } from 'lucide-react';

export const StudentExams = () => {
  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="max-w-2xl mx-auto text-center">
        <h2 className="text-3xl font-bold text-gray-900 mb-8">Exams</h2>
        
        <Card>
          <CardContent className="p-12">
            <div className="mb-6">
              <BookOpen className="h-16 w-16 mx-auto text-gray-300" />
            </div>
            <h3 className="text-2xl font-bold text-gray-600 mb-4">
              COMING SOON
            </h3>
            <p className="text-gray-500">
              Exam scheduling and management features will be available soon.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
