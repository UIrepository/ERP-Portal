import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { VariantProps, cva } from "class-variance-authority"
import { Menu } from "lucide-react"

import { useIsMobile } from "@/hooks/use-mobile"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

const SIDEBAR_COOKIE_NAME = "sidebar:state"
const SIDEBAR_COOKIE_MAX_AGE = 60 * 60 * 24 * 7
const SIDEBAR_WIDTH = "16rem"
const SIDEBAR_WIDTH_MOBILE = "18rem"
const SIDEBAR_WIDTH_ICON = "3rem"

type SidebarContextType = {
  state: "expanded" | "collapsed"
  open: boolean
  setOpen: (open: boolean) => void
  isMobile: boolean
  toggleSidebar: () => void
}

const SidebarContext = React.createContext<SidebarContextType | null>(null)

function useSidebar() {
  const context = React.useContext(SidebarContext)
  if (!context) {
    throw new Error("useSidebar must be used within a SidebarProvider.")
  }
  return context
}

const SidebarProvider = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div"> & {
    defaultOpen?: boolean
    open?: boolean
    onOpenChange?: (open: boolean) => void
  }
>(
  (
    {
      defaultOpen = true,
      open: openProp,
      onOpenChange: setOpenProp,
      className,
      children,
      ...props
    },
    ref
  ) => {
    const isMobile = useIsMobile()
    const [openState, setOpenState] = React.useState(defaultOpen)
    const open = openProp ?? openState
    const setOpen = setOpenProp ?? setOpenState

    const toggleSidebar = React.useCallback(() => {
      setOpen(!open)
      document.cookie = `${SIDEBAR_COOKIE_NAME}=${!open}; path=/; max-age=${SIDEBAR_COOKIE_MAX_AGE}`
    }, [open, setOpen])

    const state = open ? "expanded" : "collapsed"

    const contextValue = React.useMemo<SidebarContextType>(
      () => ({ state, open, setOpen, isMobile, toggleSidebar }),
      [state, open, setOpen, isMobile, toggleSidebar]
    )

    return (
      <SidebarContext.Provider value={contextValue}>
        <TooltipProvider delayDuration={0}>
          <div
            ref={ref}
            className={cn("flex min-h-screen", className)}
            {...props}
          >
            {children}
          </div>
        </TooltipProvider>
      </SidebarContext.Provider>
    )
  }
)
SidebarProvider.displayName = "SidebarProvider"

const Sidebar = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div">
>(({ className, children, ...props }, ref) => {
  const { isMobile, open, setOpen } = useSidebar()

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="left"
          className="w-[--sidebar-width-mobile] bg-sidebar p-0 text-sidebar-foreground"
          style={{ '--sidebar-width-mobile': SIDEBAR_WIDTH_MOBILE } as React.CSSProperties}
        >
          <div className="flex h-full flex-col">{children}</div>
        </SheetContent>
      </Sheet>
    )
  }

  return (
    <div
      ref={ref}
      className={cn(
        "hidden md:flex flex-col transition-[width] duration-300 ease-in-out",
        open ? "w-[--sidebar-width]" : "w-[--sidebar-width-icon]",
        className
      )}
      style={{
        '--sidebar-width': SIDEBAR_WIDTH,
        '--sidebar-width-icon': SIDEBAR_WIDTH_ICON,
      } as React.CSSProperties}
      {...props}
    >
      {children}
    </div>
  )
})
Sidebar.displayName = "Sidebar"

const SidebarTrigger = React.forwardRef<
  React.ElementRef<typeof Button>,
  React.ComponentProps<typeof Button>
>(({ className, ...props }, ref) => {
  const { isMobile, toggleSidebar } = useSidebar()

  if (!isMobile) {
    return null
  }

  return (
    <SheetTrigger asChild>
       <Button
        ref={ref}
        variant="ghost"
        size="icon"
        className={cn("h-8 w-8", className)}
        onClick={toggleSidebar}
        {...props}
      >
        <Menu />
        <span className="sr-only">Toggle Sidebar</span>
      </Button>
    </SheetTrigger>
  )
})
SidebarTrigger.displayName = "SidebarTrigger"

const SidebarHeader = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div">
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col gap-2 p-4", className)}
    {...props}
  />
))
SidebarHeader.displayName = "SidebarHeader"

const SidebarContent = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div">
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex min-h-0 flex-1 flex-col overflow-auto", className)}
    {...props}
  />
))
SidebarContent.displayName = "SidebarContent"

const SidebarMenu = React.forwardRef<
  HTMLUListElement,
  React.ComponentProps<"ul">
>(({ className, ...props }, ref) => (
  <ul
    ref={ref}
    className={cn("flex w-full flex-col gap-1 px-2", className)}
    {...props}
  />
))
SidebarMenu.displayName = "SidebarMenu"

const SidebarMenuItem = React.forwardRef<
  HTMLLIElement,
  React.ComponentProps<"li">
>(({ className, ...props }, ref) => (
  <li
    ref={ref}
    className={cn("group/menu-item relative", className)}
    {...props}
  />
))
SidebarMenuItem.displayName = "SidebarMenuItem"

const sidebarMenuButtonVariants = cva(
  "peer/menu-button flex w-full items-center gap-2 overflow-hidden rounded-md p-2 text-left text-sm outline-none ring-sidebar-ring transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 active:bg-sidebar-accent active:text-sidebar-accent-foreground disabled:pointer-events-none disabled:opacity-50 data-[active=true]:bg-sidebar-accent data-[active=true]:font-medium data-[active=true]:text-sidebar-accent-foreground",
  {
    variants: {
      variant: {
        default: "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

const SidebarMenuButton = React.forwardRef<
  HTMLButtonElement,
  React.ComponentProps<"button"> & {
    asChild?: boolean
    isActive?: boolean
  } & VariantProps<typeof sidebarMenuButtonVariants>
>(
  (
    {
      asChild = false,
      isActive = false,
      variant = "default",
      className,
      children,
      ...props
    },
    ref
  ) => {
    const { open } = useSidebar()
    const Comp = asChild ? Slot : "button"

    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Comp
            ref={ref}
            data-active={isActive}
            className={cn(sidebarMenuButtonVariants({ variant }), className)}
            {...props}
          >
            {children}
            <span className={cn("truncate", open ? "block" : "hidden")}>{props.title}</span>
          </Comp>
        </TooltipTrigger>
        {!open && (
          <TooltipContent side="right" align="center">
            {props.title}
          </TooltipContent>
        )}
      </Tooltip>
    )
  }
)
SidebarMenuButton.displayName = "SidebarMenuButton"

const SidebarFooter = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div">
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col gap-2 p-4 mt-auto", className)}
    {...props}
  />
))
SidebarFooter.displayName = "SidebarFooter"

export {
  SidebarProvider,
  Sidebar,
  SidebarTrigger,
  SidebarHeader,
  SidebarContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
  useSidebar,
}
```

---
### Step 4: Make the Schedule Component Responsive

The schedule grid is another component that needs to be responsive. We'll make it horizontally scrollable on smaller screens to prevent the layout from breaking.

**File to Edit:** `src/components/student/StudentSchedule.tsx`

**Action:** Replace the content of this file with the code below.

```tsx:src/components/student/StudentSchedule.tsx
import { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader } from '@/components/ui/card'; // Fixed import
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar, Clock, ExternalLink, Users } from 'lucide-react';
import { format, getDay } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';

interface Schedule {
  id: string;
  subject: string;
  batch: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  link?: string;
}

interface UserEnrollment {
    batch_name: string;
    subject_name: string;
}

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const ScheduleSkeleton = () => (
    <div className="space-y-6">
        {[...Array(3)].map((_, i) => (
            <Card key={i}>
                <CardHeader>
                    <Skeleton className="h-6 w-1/3" />
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex justify-between items-center">
                        <div className="space-y-2">
                            <Skeleton className="h-4 w-48" />
                            <Skeleton className="h-5 w-32" />
                        </div>
                        <Skeleton className="h-6 w-20" />
                    </div>
                </CardContent>
            </Card>
        ))}
    </div>
);

export const StudentSchedule = () => {
  const { profile } = useAuth();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [selectedBatchFilter, setSelectedBatchFilter] = useState<string>('all');

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const { data: userEnrollments, isLoading: isLoadingEnrollments } = useQuery<UserEnrollment[]>({
    queryKey: ['userEnrollments', profile?.user_id],
    queryFn: async () => {
        if (!profile?.user_id) return [];
        const { data, error } = await supabase
            .from('user_enrollments')
            .select('batch_name, subject_name')
            .eq('user_id', profile.user_id);
        if (error) {
            console.error("Error fetching user enrollments:", error);
            return [];
        }
        return data || [];
    },
    enabled: !!profile?.user_id
  });

  const availableBatches = useMemo(() => {
    return Array.from(new Set(userEnrollments?.map(e => e.batch_name) || [])).sort();
  }, [userEnrollments]);

  useEffect(() => {
    if (selectedBatchFilter !== 'all' && !availableBatches.includes(selectedBatchFilter)) {
        setSelectedBatchFilter('all');
    }
  }, [selectedBatchFilter, availableBatches]);

  const { data: schedules, isLoading: isLoadingSchedules } = useQuery<Schedule[]>({
    queryKey: ['student-schedule-direct', userEnrollments, selectedBatchFilter],
    queryFn: async (): Promise<Schedule[]> => {
        if (!userEnrollments || userEnrollments.length === 0) return [];
        let query = supabase.from('schedules').select('*');
        const batchesToFilter = selectedBatchFilter === 'all'
            ? Array.from(new Set(userEnrollments.map(e => e.batch_name)))
            : [selectedBatchFilter];
        if (batchesToFilter.length === 0) return [];
        query = query.in('batch', batchesToFilter);
        query = query.order('day_of_week').order('start_time');
        const { data, error } = await query;
        if (error) {
            console.error("Error fetching schedules directly:", error);
            throw error;
        }
        return data || [];
    },
    enabled: !!userEnrollments && userEnrollments.length > 0
  });

  const isLoading = isLoadingEnrollments || isLoadingSchedules;

  const timeSlots = useMemo(() => {
    const slots = new Set<string>();
    schedules?.forEach(s => {
        slots.add(s.start_time);
    });
    return Array.from(slots).sort();
  }, [schedules]);

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':');
    const date = new Date();
    date.setHours(parseInt(hours), parseInt(minutes));
    return format(date, 'h:mm a');
  };

  const today = getDay(currentTime);

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-6 gap-4">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">Class Schedule</h2>
          <p className="text-gray-600 mt-1">Your weekly class timetable</p>
        </div>
        <div className="text-left md:text-right">
            <p className="text-sm text-gray-500">{format(currentTime, 'PPPP')}</p>
            <p className="text-lg font-semibold text-gray-900">{format(currentTime, 'p')}</p>
        </div>
      </div>

      <div className="flex gap-4 mb-6">
        <Select value={selectedBatchFilter} onValueChange={setSelectedBatchFilter}>
          <SelectTrigger className="w-48 h-10 bg-white">
            <SelectValue placeholder="Filter by batch" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Batches</SelectItem>
            {availableBatches.map((batch) => (
              <SelectItem key={batch} value={batch}>{batch}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? <ScheduleSkeleton /> : (
      <div className="bg-white p-4 rounded-2xl shadow-lg overflow-x-auto">
          <div className="grid grid-cols-[auto_repeat(7,1fr)] min-w-[800px]">
              <div className="text-center font-semibold text-gray-500 py-2 sticky left-0 bg-white z-10">Time</div>
              {DAYS.map((day, index) => (
                  <div key={day} className={`text-center font-semibold py-2 ${index === today ? 'text-primary' : 'text-gray-500'}`}>
                      {day}
                  </div>
              ))}
          </div>
          <div className="relative min-w-[800px]">
              {timeSlots.map(time => (
                  <div key={time} className="grid grid-cols-[auto_repeat(7,1fr)] border-t">
                      <div className="text-center text-sm font-medium text-gray-700 py-4 px-2 border-r sticky left-0 bg-white z-10">{formatTime(time)}</div>
                      {DAYS.map((day, dayIndex) => {
                          const classInfo = schedules?.find(s => s.day_of_week === dayIndex && s.start_time === time);
                          return (
                              <div key={`${day}-${time}`} className={`p-2 border-r last:border-r-0 ${dayIndex === today ? 'bg-blue-50' : ''}`}>
                                  {classInfo && (
                                      <Card className="bg-white shadow-md hover:shadow-lg transition-shadow">
                                          <CardContent className="p-3">
                                              <p className="font-bold text-gray-800 text-sm">{classInfo.subject}</p>
                                              <Badge variant="secondary" className="mt-1">{classInfo.batch}</Badge>
                                              {classInfo.link && (
                                                  <Button size="sm" asChild className="w-full mt-2">
                                                      <a href={classInfo.link} target="_blank" rel="noopener noreferrer">
                                                          <ExternalLink className="h-4 w-4 mr-1" /> Join
                                                      </a>
                                                  </Button>
                                              )}
                                          </CardContent>
                                      </Card>
                                  )}
                              </div>
                          );
                      })}
                  </div>
              ))}
          </div>
      </div>
      )}
    </div>
  );
};
