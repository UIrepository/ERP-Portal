import { Button } from '@/components/ui/button';

export const StudentExams = () => {
  return (
    <div className="p-6 md:p-10 bg-gradient-to-br from-gray-50 via-blue-50 to-indigo-50 min-h-full flex items-center justify-center">
      <div className="max-w-3xl mx-auto text-center">
        
        <img src="/art/state-coming-soon.png" alt="" aria-hidden width={260} height={260} draggable={false} className="mx-auto mb-6 object-contain" />

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
