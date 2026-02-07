import { useState } from 'react';
import { Search, Mail } from 'lucide-react';
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

  // Helper to filter FAQs
  const filterFaqs = (faqs: any[]) => {
    if (!searchQuery) return faqs;
    return faqs.filter(f => 
      f.question.toLowerCase().includes(searchQuery.toLowerCase())
    );
  };

  const faqs = [
    {
      id: "item-1",
      question: "How do I attend live classes?",
      answer: "You can join live classes directly from your Dashboard or the Schedule tab when the class is live."
    },
    {
      id: "item-2",
      question: "When are recordings available?",
      answer: "Recordings are available just after the class ends."
    },
    {
      id: "item-3",
      question: "Where can I find DPPs?",
      answer: "DPPs and study materials are located in the Study Material section of your subject."
    },
    {
      id: "item-4",
      question: "Where can I check the schedule?",
      answer: "You can view your complete timetable in the Schedule tab."
    },
    {
      id: "item-5",
      question: "Where are announcements?",
      answer: "All important updates and notices are posted in the Announcement tab."
    },
    {
      id: "item-6",
      question: "How do I purchase more courses?",
      answer: (
        <span>
          To purchase more courses, please visit <a href="https://www.unknowniitians.com/courses/category/iitm-bs" target="_blank" rel="noopener noreferrer" className="text-indigo-600 font-medium hover:underline">Unknown IITians Courses (Click Here)</a>.
        </span>
      )
    },
    {
      id: "item-7",
      question: "Need technical support?",
      answer: (
        <span>
          For technical issues or anything else, please <button onClick={onOpenSupportDrawer} className="text-indigo-600 font-medium hover:underline">reach out to Admin</button> via chat support.
        </span>
      )
    }
  ];

  const filteredFaqs = filterFaqs(faqs);

  return (
    <div className="max-w-[850px] mx-auto p-4 md:p-8 animate-in fade-in slide-in-from-bottom-4 duration-500 font-sans">
      
      {/* --- Header & Search --- */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 md:gap-6 mb-6 md:mb-8">
        <div>
           <h1 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight">
            Help Centre
          </h1>
          <p className="text-slate-500 mt-1 text-xs md:text-sm">
            Find answers to common questions.
          </p>
        </div>

        {/* Search Box - Compact on mobile */}
        <div className="relative w-full md:max-w-[320px]">
          <input
            type="text"
            placeholder="Search questions..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 md:pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-xs md:text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all placeholder:text-slate-400"
          />
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 md:w-4 md:h-4 text-slate-400" />
        </div>
      </div>

      {/* --- Content Area --- */}
      <div className="space-y-6 md:space-y-8">
        
        {/* FAQ Accordion */}
        <div className="space-y-2">
          <Accordion type="single" collapsible className="w-full space-y-2">
            {filteredFaqs.map((faq) => (
              <AccordionItem 
                key={faq.id} 
                value={faq.id} 
                className="border rounded-lg bg-white px-1 border-slate-200 shadow-sm"
              >
                <AccordionTrigger className="px-3 md:px-4 py-3 md:py-4 hover:no-underline text-sm md:text-[15px] font-medium text-slate-800 hover:text-indigo-600 transition-colors text-left">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="px-3 md:px-4 pb-3 md:pb-4 pt-0 text-slate-600 text-xs md:text-sm leading-relaxed">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
          
          {filteredFaqs.length === 0 && (
            <div className="text-center py-6 md:py-8 bg-slate-50 rounded-lg border border-dashed border-slate-200">
              <p className="text-slate-500 text-xs md:text-sm">No results found for "{searchQuery}"</p>
            </div>
          )}
        </div>

        {/* Rich Support Card - Optimized for Mobile */}
        <div className="mt-6 md:mt-8 bg-gradient-to-br from-white to-[#f9faff] rounded-xl border border-slate-200 p-5 md:p-8 flex flex-col md:flex-row items-center justify-between gap-6 md:gap-8 shadow-[0_4px_20px_rgba(0,0,0,0.02)] relative overflow-hidden">
          {/* Decorative background element */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-50 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 opacity-50 pointer-events-none" />

          <div className="flex-1 text-center md:text-left space-y-3 md:space-y-4 relative z-10">
            <div>
              <h2 className="text-lg md:text-xl font-bold text-slate-900">Still need help?</h2>
              <p className="text-slate-500 text-xs md:text-sm mt-1 leading-relaxed max-w-md mx-auto md:mx-0">
                Can't find the answer you're looking for? Chat with our support team directly.
              </p>
            </div>
            
            {onOpenSupportDrawer && (
              <button 
                onClick={onOpenSupportDrawer}
                className="inline-flex items-center gap-2 bg-indigo-600 text-white px-5 py-2.5 md:px-6 md:py-3 rounded-lg md:rounded-xl text-xs md:text-sm font-semibold hover:bg-indigo-700 active:scale-95 transition-all shadow-lg shadow-indigo-200"
              >
                <Mail className="w-3.5 h-3.5 md:w-4 md:h-4" />
                Contact Support
              </button>
            )}
          </div>
          
          {/* Illustration - Scaled and Reordered for Mobile */}
          <div className="shrink-0 relative z-10 order-first md:order-last">
             <img 
               src="https://illustrations.popsy.co/blue/customer-support.svg" 
               alt="Customer Support" 
               className="w-32 h-32 md:w-48 md:h-auto drop-shadow-sm transform hover:scale-105 transition-transform duration-500"
               loading="lazy"
             />
          </div>
        </div>

      </div>
    </div>
  );
};
