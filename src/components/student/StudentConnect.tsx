import { useState } from 'react';
import { Search, Mail, Video, Clock, FileText, HelpCircle, BookOpen, Calendar } from 'lucide-react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

interface StudentConnectProps {
  onOpenSupportDrawer?: () => void;
}

export const StudentConnect = ({ onOpenSupportDrawer }: StudentConnectProps) => {
  const [searchQuery, setSearchQuery] = useState('');

  // FAQs Data - Tailored specifically to ERP Portal needs
  const faqs = [
    {
      id: "item-1",
      question: "How do I join my live class?",
      answer: "Navigate to your **Dashboard** or **Schedule** tab. When a class is live (usually 5-10 minutes before start time), a 'Join Now' button will appear on the class card. Click it to enter the classroom.",
      icon: Video
    },
    {
      id: "item-2",
      question: "Where can I view class recordings?",
      answer: "Go to the **Recordings** tab inside your specific Batch or Subject view. Recordings are typically uploaded within 24 hours of the live session. You can filter them by subject and date.",
      icon: Clock
    },
    {
      id: "item-3",
      question: "Where can I find notes and assignments (DPP)?",
      answer: "Study materials, including PDF notes and Daily Practice Problems (DPP), are located in the **Study Material** or **Resources** section of each subject. You can download them for offline use.",
      icon: BookOpen
    },
    {
      id: "item-4",
      question: "How do I submit an assignment?",
      answer: "Go to the specific assignment in the **DPP/Assignments** tab. Click on the task, and use the 'Upload Solution' button to attach your work (PDF or Image).",
      icon: FileText
    },
    {
      id: "item-5",
      question: "My attendance is not updating?",
      answer: "Attendance is marked automatically when you stay in a live class for more than 15 minutes. It may take up to 2 hours after the class ends for the system to reflect your attendance.",
      icon: Calendar
    }
  ];

  const filteredFaqs = faqs.filter(f => 
    f.question.toLowerCase().includes(searchQuery.toLowerCase()) || 
    f.answer.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="max-w-[850px] mx-auto p-6 md:p-8 animate-in fade-in slide-in-from-bottom-4 duration-500 font-sans">
      
      {/* --- Header & Search --- */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
        <div>
           <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">
            Help Centre
          </h1>
          <p className="text-slate-500 mt-2">
            Frequently asked questions and support.
          </p>
        </div>

        {/* Search Box */}
        <div className="relative w-full md:max-w-[320px]">
          <input
            type="text"
            placeholder="Search for help..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm shadow-sm focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 transition-all placeholder:text-slate-400"
          />
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        </div>
      </div>

      {/* --- Content Area --- */}
      <div className="space-y-8">
        
        {/* FAQ Accordion */}
        <div className="space-y-3">
          <Accordion type="single" collapsible className="w-full space-y-3">
            {filteredFaqs.map((faq) => (
              <AccordionItem 
                key={faq.id} 
                value={faq.id} 
                className="border-none rounded-xl bg-[#f8fafc] border border-slate-100 overflow-hidden data-[state=open]:bg-[#f0f4ff] data-[state=open]:border-indigo-100 transition-all duration-200 shadow-sm"
              >
                <AccordionTrigger className="px-6 py-4 hover:no-underline text-[15px] font-medium text-slate-700 hover:text-slate-900 group">
                  <div className="flex items-center gap-3 text-left">
                    <div className="p-1.5 rounded-md bg-white shadow-sm text-indigo-500 group-hover:text-indigo-600 transition-colors">
                      <faq.icon className="w-4 h-4" />
                    </div>
                    {faq.question}
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-6 pb-5 pt-0 pl-[3.25rem] text-slate-600 text-sm leading-relaxed">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
          
          {filteredFaqs.length === 0 && (
            <div className="text-center py-12 bg-slate-50 rounded-xl border border-dashed border-slate-200">
              <HelpCircle className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-slate-500 font-medium">No results found for "{searchQuery}"</p>
              <p className="text-slate-400 text-sm">Try searching for "class", "recording", or "notes".</p>
            </div>
          )}
        </div>

        {/* Support Card */}
        <div className="mt-8 bg-gradient-to-br from-white to-[#f9faff] rounded-2xl border border-slate-200 p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-8 shadow-[0_4px_20px_rgba(0,0,0,0.02)] relative overflow-hidden">
          {/* Decorative background element */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-50 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 opacity-50 pointer-events-none" />

          <div className="flex-1 text-center md:text-left space-y-4 relative z-10">
            <div>
              <h2 className="text-xl font-bold text-slate-900">Still need help?</h2>
              <p className="text-slate-500 text-sm mt-1.5 leading-relaxed max-w-md">
                Can't find the answer you're looking for? Chat with our support team directly.
              </p>
            </div>
            
            {onOpenSupportDrawer && (
              <button 
                onClick={onOpenSupportDrawer}
                className="inline-flex items-center gap-2.5 bg-indigo-600 text-white px-6 py-3 rounded-xl text-sm font-semibold hover:bg-indigo-700 active:scale-95 transition-all shadow-lg shadow-indigo-200"
              >
                <Mail className="w-4 h-4" />
                Contact Support
              </button>
            )}
          </div>
          
          {/* Illustration */}
          <div className="shrink-0 relative z-10">
             <img 
               src="https://illustrations.popsy.co/blue/customer-support.svg" 
               alt="Customer Support" 
               className="w-40 md:w-48 h-auto drop-shadow-sm transform hover:scale-105 transition-transform duration-500"
               loading="lazy"
             />
          </div>
        </div>

      </div>
    </div>
  );
};
