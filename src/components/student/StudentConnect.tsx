import { useState } from 'react';
import { Search, ChevronRight, ChevronDown, Mail, Video, Clock, FileText, HelpCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { StudentAnnouncements } from './StudentAnnouncements';
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
  const [activeTab, setActiveTab] = useState<'help' | 'notice'>('help');
  const [searchQuery, setSearchQuery] = useState('');

  // FAQs Data based on your design + previous useful context
  const faqs = [
    {
      id: "item-1",
      question: "Where can I find notes and PYQs?",
      answer: "You can find all study materials under the **Study Material** section of your specific batch. Previous Year Questions (PYQs) are usually located in the 'Resources' tab of each subject."
    },
    {
      id: "item-2",
      question: "How do I join live classes?",
      answer: "Navigate to your Dashboard. When a class is about to start (usually 5-10 mins prior), a 'Join Now' button will appear on the class card. Simply click that to enter the virtual classroom."
    },
    {
      id: "item-3",
      question: "Is offline viewing possible?",
      answer: "Yes, on the mobile app, you can download recordings and watch them later without an internet connection. Web portal currently supports streaming only."
    },
    {
      id: "item-4",
      question: "How to update my profile details?",
      answer: "Go to Settings > Profile in the sidebar. There you can update your phone number, email address, and profile picture. Some details like Name may require Admin approval."
    },
    {
      id: "item-5",
      question: "My FastTrack batch is not showing up.",
      answer: "This usually happens if the payment is still being processed or cache is old. Please wait 30 minutes, or try logging out and logging back in to refresh your library."
    }
  ];

  const filteredFaqs = faqs.filter(f => 
    f.question.toLowerCase().includes(searchQuery.toLowerCase()) || 
    f.answer.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="max-w-[850px] mx-auto p-4 md:p-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* --- Top Navigation & Search --- */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
        
        {/* Tabs */}
        <div className="bg-slate-100 p-1 rounded-xl inline-flex self-start">
          <button
            onClick={() => setActiveTab('help')}
            className={cn(
              "px-5 py-2 rounded-lg text-sm font-medium transition-all duration-200",
              activeTab === 'help' 
                ? "bg-white text-indigo-600 shadow-sm" 
                : "text-slate-500 hover:text-slate-700 bg-transparent"
            )}
          >
            Help Centre
          </button>
          <button
            onClick={() => setActiveTab('notice')}
            className={cn(
              "px-5 py-2 rounded-lg text-sm font-medium transition-all duration-200",
              activeTab === 'notice' 
                ? "bg-white text-indigo-600 shadow-sm" 
                : "text-slate-500 hover:text-slate-700 bg-transparent"
            )}
          >
            Notice Board
          </button>
        </div>

        {/* Search Box */}
        <div className="relative w-full md:max-w-[300px]">
          <input
            type="text"
            placeholder="Type your query here..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-4 pr-10 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 transition-all placeholder:text-slate-400"
          />
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        </div>
      </div>

      {/* --- Content Area --- */}
      {activeTab === 'help' ? (
        <div className="space-y-8">
          
          {/* Headline */}
          <h1 className="text-2xl md:text-3xl font-bold text-slate-800 tracking-tight">
            Tell us how we can help 👋
          </h1>

          {/* FAQ Accordion */}
          <div className="space-y-3">
            <Accordion type="single" collapsible className="w-full space-y-3">
              {filteredFaqs.map((faq) => (
                <AccordionItem 
                  key={faq.id} 
                  value={faq.id} 
                  className="border-none rounded-xl bg-[#f5f8ff] overflow-hidden data-[state=open]:bg-[#edf2ff] transition-colors duration-200"
                >
                  <AccordionTrigger className="px-6 py-4 hover:no-underline text-[15px] font-medium text-slate-700 hover:text-slate-900">
                    {faq.question}
                  </AccordionTrigger>
                  <AccordionContent className="px-6 pb-5 pt-0 text-slate-500 text-sm leading-relaxed">
                    {faq.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
            
            {filteredFaqs.length === 0 && (
              <p className="text-center text-slate-400 py-8">No results found for "{searchQuery}"</p>
            )}
          </div>

          {/* Show More Button (Mock) */}
          {filteredFaqs.length > 0 && (
            <button className="w-full flex items-center justify-center gap-2 text-indigo-600 font-semibold text-sm hover:text-indigo-700 transition-colors py-2">
              Show More <ChevronDown className="w-4 h-4" />
            </button>
          )}

          {/* Support Card */}
          <div className="mt-8 bg-gradient-to-br from-white to-[#f9faff] rounded-xl border border-slate-200 p-6 md:p-8 flex flex-col-reverse md:flex-row items-center justify-between gap-6 shadow-[0_4px_12px_rgba(0,0,0,0.03)]">
            <div className="flex-1 text-center md:text-left space-y-4">
              <div>
                <h2 className="text-lg font-bold text-slate-800">Need help?</h2>
                <p className="text-slate-500 text-sm mt-1">Get in touch and we will be happy to help you.</p>
              </div>
              
              {onOpenSupportDrawer && (
                <button 
                  onClick={onOpenSupportDrawer}
                  className="inline-flex items-center gap-2 bg-indigo-600 text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-indigo-700 active:scale-95 transition-all shadow-sm"
                >
                  <Mail className="w-4 h-4" />
                  Contact Us
                </button>
              )}
            </div>
            
            {/* Illustration */}
            <div className="shrink-0">
               <img 
                 src="https://illustrations.popsy.co/blue/customer-support.svg" 
                 alt="Customer Support" 
                 className="w-32 md:w-40 h-auto opacity-90 drop-shadow-sm"
                 loading="lazy"
               />
            </div>
          </div>

        </div>
      ) : (
        /* --- Notice Board Tab Content --- */
        <div className="animate-in fade-in duration-300">
           <StudentAnnouncements />
        </div>
      )}

    </div>
  );
};
