import { Button } from '@/components/ui/button';
import { Trophy, ClipboardCheck, BarChart, FileText } from 'lucide-react';

export const StudentExams = () => {
  return (
    <div className="p-6 md:p-10 bg-gradient-to-br from-gray-50 via-blue-50 to-indigo-50 min-h-full flex items-center justify-center">
      <div className="max-w-3xl mx-auto text-center">
        
        {/* Visual Element */}
        <div className="relative w-48 h-48 mx-auto mb-8 flex items-center justify-center">
          {/* Background shapes */}
          <div className="absolute w-full h-full bg-primary/5 rounded-full animate-pulse"></div>
          <div className="absolute w-3/4 h-3/4 bg-primary/10 rounded-full animate-pulse delay-200"></div>
          
          {/* Central Icon */}
          <div className="relative bg-primary text-primary-foreground p-6 rounded-full shadow-lg">
            <Trophy className="h-16 w-16" />
          </div>

          {/* Floating Icons */}
          <div className="absolute top-0 left-0 bg-white p-2 rounded-full shadow-md animate-bounce">
            <ClipboardCheck className="h-6 w-6 text-green-500" />
          </div>
          <div className="absolute top-8 right-0 bg-white p-2 rounded-full shadow-md animate-bounce" style={{ animationDelay: '0.2s' }}>
            <BarChart className="h-6 w-6 text-yellow-500" />
          </div>
          <div className="absolute bottom-0 left-8 bg-white p-2 rounded-full shadow-md animate-bounce" style={{ animationDelay: '0.4s' }}>
            <FileText className="h-6 w-6 text-red-500" />
          </div>
        </div>

        <h1 className="text-4xl md:text-5xl font-bold text-gray-800">
          Advanced Testing Platform is Coming Soon
        </h1>

        <p className="mt-4 text-lg text-gray-600 max-w-xl mx-auto">
          We're putting the final touches on our new exams module. Get ready for comprehensive mock tests, performance analytics, and personalized feedback to supercharge your preparation.
        </p>

        <div className="mt-8">
            <Button size="lg" disabled>
                Launching Soon...
            </Button>
        </div>
        
      </div>
    </div>
  );
};
