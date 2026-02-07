import { HelpCircle, MessageCircle, FileText, Video, Clock, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface StudentConnectProps {
  onOpenSupportDrawer?: () => void;
}

export const StudentConnect = ({ onOpenSupportDrawer }: StudentConnectProps) => {
  return (
    <div className="space-y-8 p-6 max-w-4xl mx-auto animate-in fade-in duration-500">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row gap-6 items-start md:items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Help & Support</h1>
          <p className="text-slate-500 mt-2 text-lg">
            Find answers to common questions or connect with our support team.
          </p>
        </div>
        
        {/* Get Support Button */}
        {onOpenSupportDrawer && (
          <Button 
            onClick={onOpenSupportDrawer} 
            size="lg" 
            className="bg-slate-900 text-white hover:bg-slate-800 shadow-lg shadow-slate-200/50 gap-2 transition-all hover:scale-105 active:scale-95"
          >
            <MessageCircle className="h-5 w-5" />
            Contact Support
          </Button>
        )}
      </div>

      {/* FAQs Section */}
      <div className="grid gap-6">
        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <HelpCircle className="h-5 w-5 text-blue-600" />
              Frequently Asked Questions
            </CardTitle>
            <CardDescription>
              Quick answers to the most common queries about your classes and portal.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Accordion type="single" collapsible className="w-full">
              
              <AccordionItem value="item-1">
                <AccordionTrigger className="text-base font-medium text-slate-800 hover:no-underline">
                  <div className="flex items-center gap-3">
                    <Video className="h-4 w-4 text-slate-400" />
                    How do I join my live class?
                  </div>
                </AccordionTrigger>
                <AccordionContent className="text-slate-600 leading-relaxed pl-7 pb-4">
                  Navigate to your <strong>Dashboard</strong> or <strong>Schedule</strong> tab. When a class is live (usually 5 minutes before start time), a "Join Now" button will appear on the class card. Click it to enter the classroom.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-2">
                <AccordionTrigger className="text-base font-medium text-slate-800 hover:no-underline">
                  <div className="flex items-center gap-3">
                    <Clock className="h-4 w-4 text-slate-400" />
                    Where can I view class recordings?
                  </div>
                </AccordionTrigger>
                <AccordionContent className="text-slate-600 leading-relaxed pl-7 pb-4">
                  Go to the <strong>Recordings</strong> tab in your batch view. Recordings are typically uploaded within 24 hours of the live session completing. You can filter them by subject and date.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-3">
                <AccordionTrigger className="text-base font-medium text-slate-800 hover:no-underline">
                  <div className="flex items-center gap-3">
                    <FileText className="h-4 w-4 text-slate-400" />
                    How do I submit an assignment?
                  </div>
                </AccordionTrigger>
                <AccordionContent className="text-slate-600 leading-relaxed pl-7 pb-4">
                  Go to the specific subject, select the <strong>Assignments</strong> or <strong>DPP</strong> tab. Click on the pending assignment, and use the "Upload Solution" button to submit your work (PDF or Image format).
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-4">
                <AccordionTrigger className="text-base font-medium text-slate-800 hover:no-underline">
                  <div className="flex items-center gap-3">
                    <HelpCircle className="h-4 w-4 text-slate-400" />
                    My attendance isn't updating?
                  </div>
                </AccordionTrigger>
                <AccordionContent className="text-slate-600 leading-relaxed pl-7 pb-4">
                  Attendance is marked automatically when you stay in a live class for more than 15 minutes. Note that it may take up to 2 hours after the class ends for the system to update your attendance record.
                </AccordionContent>
              </AccordionItem>

            </Accordion>
          </CardContent>
        </Card>
      </div>

      {/* Still need help banner */}
      <div className="bg-blue-50 border border-blue-100 rounded-xl p-6 flex flex-col md:flex-row items-center justify-between gap-4">
        <div>
          <h3 className="font-semibold text-blue-900 text-lg">Still need help?</h3>
          <p className="text-blue-700 text-sm mt-1">
            Our support team is available Mon-Sat, 9 AM - 6 PM.
          </p>
        </div>
        {onOpenSupportDrawer && (
           <Button 
             variant="outline" 
             onClick={onOpenSupportDrawer}
             className="border-blue-200 text-blue-700 hover:bg-blue-100 hover:text-blue-800 bg-white"
           >
             Chat with Us
           </Button>
        )}
      </div>
    </div>
  );
};
