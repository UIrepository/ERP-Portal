import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { RichTextArea } from '@/components/ui/rich-text-area';
import { toast } from '@/hooks/use-toast';
import { Megaphone, Send, Users, Book, Loader2, Plus, X, ImagePlus } from 'lucide-react';
import { Combobox } from '@/components/ui/combobox';
import { uploadImageToCloudinary } from '@/lib/cloudinary';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';

// New interface for defining a target combination of batch and subject
interface TargetCombination {
  batch: string | null;
  subject: string | null;
}

interface AnnouncementPayload {
  title: string;
  message: string;
  image_url: string | null;
  target_batch: string | null;
  target_subject: string | null;
  created_by: string | null;
  is_active: boolean;
  target_role: 'student';
}

// Draft persists across tab switches (leaving the tab unmounts this component,
// which would otherwise wipe the typed announcement).
const DRAFT_KEY = 'ui-draft-student-announcement';
const loadDraft = (): { title?: string; message?: string; targets?: TargetCombination[]; imageUrl?: string | null } => {
  try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}'); } catch { return {}; }
};

export const AdminCreateAnnouncement = () => {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [draft] = useState(loadDraft);
  const [title, setTitle] = useState(draft.title || '');
  const [message, setMessage] = useState(draft.message || '');
  // Optional single image, hosted on Cloudinary. Pushed with the notification
  // and shown in-app; deliberately NOT attached to the email (text only there).
  const [imageUrl, setImageUrl] = useState<string | null>(draft.imageUrl || null);
  const [imageUploading, setImageUploading] = useState(false);
  // State to hold multiple target combinations
  const [targets, setTargets] = useState<TargetCombination[]>(draft.targets || []);
  // State for the current selection in the dropdowns
  const [currentBatch, setCurrentBatch] = useState<string | null>(null);
  const [currentSubject, setCurrentSubject] = useState<string | null>(null);

  // Save the draft whenever the composed content changes; clear it once empty.
  useEffect(() => {
    if (!title && !message && targets.length === 0 && !imageUrl) {
      localStorage.removeItem(DRAFT_KEY);
      return;
    }
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ title, message, targets, imageUrl }));
  }, [title, message, targets, imageUrl]);

  const handleImagePick = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast({ title: 'Not an image', description: 'Please choose an image file.', variant: 'destructive' });
      return;
    }
    setImageUploading(true);
    try {
      const url = await uploadImageToCloudinary(file, 'announcements');
      setImageUrl(url);
    } catch {
      toast({ title: 'Upload failed', description: 'Could not upload the image. Try again.', variant: 'destructive' });
    } finally {
      setImageUploading(false);
    }
  };

  const sendAnnouncementPush = async (announcement: AnnouncementPayload) => {
    const { error } = await supabase.functions.invoke('send-push', {
      body: {
        title: announcement.title,
        body: announcement.message,
        image: announcement.image_url ?? undefined,
        all_students: !announcement.target_batch && !announcement.target_subject,
        batch: announcement.target_batch ?? undefined,
        subject: announcement.target_subject ?? undefined,
      },
    });

    if (error) {
      console.warn('Announcement push failed:', error);
      return false;
    }

    return true;
  };

  // Announcements go out on both channels: push (above) and email to the Google
  // Groups for the same batch/subject, so students who miss the push still get it.
  const sendAnnouncementEmail = async (announcement: AnnouncementPayload) => {
    const { error } = await supabase.functions.invoke('send-announcement-email', {
      body: {
        title: announcement.title,
        message: announcement.message,
        all_students: !announcement.target_batch && !announcement.target_subject,
        batch: announcement.target_batch ?? undefined,
        subject: announcement.target_subject ?? undefined,
      },
    });

    if (error) {
      console.warn('Announcement email failed:', error);
      return false;
    }

    return true;
  };

  // Fetch all enrollments to understand batch-subject relationships
  const { data: enrollments = [] } = useQuery({
    queryKey: ['all-enrollments-for-announcements'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_distinct_enrollment_options');
      if (error) {
        console.error('Error fetching enrollment options:', error);
        return [];
      }
      return data || [];
    }
  });

  // Memoized derivation of unique batches and subjects based on enrollments
  const { allBatches, subjectsForSelectedBatch } = useMemo(() => {
    const uniqueBatches = Array.from(new Set(enrollments.map(e => e.batch_name))).sort();
    let subjectsForBatch: string[] = [];
    if (currentBatch) {
      subjectsForBatch = Array.from(
        new Set(enrollments.filter(e => e.batch_name === currentBatch).map(e => e.subject_name))
      ).sort();
    } else {
        // If no batch is selected, show all unique subjects across all batches.
        subjectsForBatch = Array.from(new Set(enrollments.map(e => e.subject_name))).sort()
    }
    return { allBatches: uniqueBatches, subjectsForSelectedBatch: subjectsForBatch };
  }, [enrollments, currentBatch]);


  const createAnnouncementMutation = useMutation({
    mutationFn: async (announcementData: AnnouncementPayload[]) => {
      const { error } = await supabase.from('notifications').insert(announcementData);
      if (error) throw error;

      await Promise.all(
        announcementData.flatMap((announcement) => [
          sendAnnouncementPush(announcement),
          sendAnnouncementEmail(announcement),
        ]),
      );
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Announcement sent — push and email delivery has started." });
      setTitle('');
      setMessage('');
      setImageUrl(null);
      setTargets([]);
      setCurrentBatch(null);
      setCurrentSubject(null);
      localStorage.removeItem(DRAFT_KEY);
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : 'Unknown error';
      toast({ title: "Error", description: `Failed to send announcement: ${message}`, variant: "destructive" });
    },
  });

  // Adds the currently selected combination to the list of targets
  const handleAddTarget = () => {
    if (!currentBatch && !currentSubject) {
      toast({ title: "Info", description: "Select a batch and/or a subject to add a target.", variant: "default" });
      return;
    }
    const newTarget = { batch: currentBatch, subject: currentSubject };
    // Avoid adding duplicate targets
    if (!targets.some(t => t.batch === newTarget.batch && t.subject === newTarget.subject)) {
      setTargets([...targets, newTarget]);
      setCurrentBatch(null)
      setCurrentSubject(null)
    } else {
        toast({title: "Duplicate Target", description: "This batch/subject combination has already been added.", variant: "default"})
    }
  };

    // Removes a target from the list
  const handleRemoveTarget = (index: number) => {
    setTargets(targets.filter((_, i) => i !== index));
  };


  const handleSendAnnouncement = () => {
    if (!title.trim() || !message.trim()) {
      toast({ title: "Error", description: "Title and message are required.", variant: "destructive" });
      return;
    }

    let announcementsToSend: AnnouncementPayload[] = [];
    // If no specific targets, send a single global announcement.
    if (targets.length === 0) {
        announcementsToSend.push({
            title,
            message,
            image_url: imageUrl,
            target_batch: null,
            target_subject: null,
            created_by: profile?.user_id,
            is_active: true,
            target_role: 'student'
        })
    } else {
        // Otherwise, create an announcement for each target combination
        announcementsToSend = targets.map(target => ({
             title,
            message,
            image_url: imageUrl,
            target_batch: target.batch,
            target_subject: target.subject,
            created_by: profile?.user_id,
            is_active: true,
            target_role: 'student'
        }))
    }

    createAnnouncementMutation.mutate(announcementsToSend);
  };

  return (
    <div className="p-4 md:p-6 space-y-8 bg-slate-50 min-h-full animate-fade-in-up">
        <div className="flex flex-col space-y-1">
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-800 tracking-tight">Broadcast Center</h1>
            <p className="text-slate-500">Compose and dispatch announcements to your students.</p>
        </div>
      
      <div className="space-y-8">
        {/* Step 1: Compose Message */}
        <Card className="shadow-lg rounded-2xl border-slate-200">
            <CardHeader>
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                        <Megaphone className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                        <CardTitle>Compose Message</CardTitle>
                        <CardDescription>Craft the title and content of your announcement.</CardDescription>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="space-y-6 pt-2">
                <div className="space-y-2">
                    <label className="font-medium text-slate-700">Title</label>
                    <Input 
                    placeholder="E.g., Important Update: Physics Extra Class" 
                    value={title} 
                    onChange={(e) => setTitle(e.target.value)}
                    className="text-base"
                    />
                </div>
                <div className="space-y-2">
                    <label className="font-medium text-slate-700">Message</label>
                    <RichTextArea
                    value={message}
                    onChange={setMessage}
                    rows={6}
                    placeholder="Enter the full announcement details… Use the toolbar or Ctrl+B / Ctrl+I for bold, italics, and bullets."
                    />
                </div>

                {/* Optional single image. Sent with the push + shown in-app; the
                    email stays text only. The preview frame follows the image's
                    own aspect ratio (no forced crop). */}
                <div className="space-y-2">
                    <label className="font-medium text-slate-700">Image <span className="font-normal text-slate-400">(optional — one image)</span></label>
                    {imageUrl ? (
                        <div className="relative inline-block max-w-full">
                            <img
                                src={imageUrl}
                                alt="Announcement"
                                className="max-h-72 w-auto max-w-full rounded-xl border border-slate-200 object-contain"
                            />
                            <button
                                type="button"
                                onClick={() => setImageUrl(null)}
                                title="Remove image"
                                className="absolute -top-2 -right-2 h-7 w-7 inline-flex items-center justify-center rounded-full bg-white border border-slate-200 text-slate-600 shadow hover:text-rose-600"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                    ) : (
                        <label className={`flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/60 px-4 py-8 text-center transition-colors ${imageUploading ? 'opacity-70' : 'cursor-pointer hover:border-primary/40 hover:bg-primary/5'}`}>
                            {imageUploading ? (
                                <><Loader2 className="h-6 w-6 text-primary animate-spin" /><span className="text-sm text-slate-500">Uploading…</span></>
                            ) : (
                                <><ImagePlus className="h-6 w-6 text-slate-400" /><span className="text-sm text-slate-500">Click to add an image</span><span className="text-xs text-slate-400">Shown in the app and in the push notification, not in the email.</span></>
                            )}
                            <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                disabled={imageUploading}
                                onChange={(e) => { void handleImagePick(e.target.files?.[0]); e.target.value = ''; }}
                            />
                        </label>
                    )}
                </div>
            </CardContent>
        </Card>

        {/* Step 2: Targeting */}
        <Card className="shadow-lg rounded-2xl border-slate-200">
            <CardHeader>
                <div className="flex items-center gap-4">
                     <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                        <Users className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                        <CardTitle>Target Audience</CardTitle>
                        <CardDescription>Select batches and subjects to target. Leave blank to send to all.</CardDescription>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="pt-2">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <label className="font-medium text-slate-700 flex items-center gap-2"><Users className="h-4 w-4"/> Batches</label>
                        <Combobox
                            options={allBatches}
                            selected={currentBatch ? [currentBatch] : []}
                            onChange={(batches) => setCurrentBatch(batches[0] || null)}
                            placeholder="All Batches"
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="font-medium text-slate-700 flex items-center gap-2"><Book className="h-4 w-4"/> Subjects</label>
                        <Combobox
                            options={subjectsForSelectedBatch}
                            selected={currentSubject ? [currentSubject] : []}
                            onChange={(subjects) => setCurrentSubject(subjects[0] || null)}
                            placeholder="All Subjects"
                        />
                    </div>
                </div>
                <div className="flex justify-end mt-4">
                    <Button onClick={handleAddTarget} size="sm">
                        <Plus className="h-4 w-4 mr-2"/>
                        Add Target Combination
                    </Button>
                </div>
                <Separator className="my-6"/>
                 <div>
                    <h4 className="font-medium text-slate-700 mb-3">Selected Targets:</h4>
                    <div className="flex flex-wrap gap-2">
                    {targets.length === 0 && <p className="text-sm text-slate-500">No specific targets added. Announcement will be sent to all students.</p>}
                    {targets.map((target, index) => (
                        <Badge key={index} variant="outline" className="text-base py-1 px-3">
                        {target.batch || 'All Batches'} / {target.subject || 'All Subjects'}
                        <button onClick={() => handleRemoveTarget(index)} className="ml-2 hover:text-red-500">
                            <X className="h-4 w-4"/>
                        </button>
                        </Badge>
                    ))}
                    </div>
                </div>
            </CardContent>
        </Card>

        {/* Step 3: Send */}
        <div className="flex justify-end">
          <Button 
            onClick={handleSendAnnouncement} 
            disabled={createAnnouncementMutation.isPending}
            className="w-full md:w-auto bg-primary hover:bg-primary/90 text-white font-semibold transition-all transform hover:scale-105 active:scale-95"
            size="lg"
          >
            {createAnnouncementMutation.isPending ? (
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            ) : (
                <Send className="mr-2 h-5 w-5" />
            )}
            {createAnnouncementMutation.isPending ? 'Sending...' : 'Send Announcement'}
          </Button>
        </div>
      </div>
    </div>
  );
};
