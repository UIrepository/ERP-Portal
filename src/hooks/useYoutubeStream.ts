import { useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { toast } from 'sonner';

export const useYoutubeStream = () => {
  const [isStreaming, setIsStreaming] = useState(false);
  const [isStartingStream, setIsStartingStream] = useState(false);
  
  // Store ID in ref so it persists without re-renders
  const broadcastIdRef = useRef<string | null>(null);

  const startStream = async (batch: string, subject: string) => {
    if (isStartingStream || isStreaming) return null;

    setIsStartingStream(true);
    toast.info("Initializing YouTube Live Stream...");

    try {
      const { data: streamData, error: funcError } = await supabase.functions.invoke('create-youtube-stream', {
        body: {
          title: `${subject} - ${batch} (${format(new Date(), 'dd MMM')})`,
          description: `Live class for ${batch}. Subject: ${subject}.`
        }
      });

      if (funcError || !streamData?.streamKey) {
        console.error("Edge Function Error:", funcError);
        throw new Error(funcError?.message || "Failed to generate stream keys");
      }

      // Capture the ID for stopping later
      broadcastIdRef.current = streamData.videoId;

      const { error: dbError } = await supabase.from('recordings').insert({
        batch: batch,
        subject: subject,
        topic: `${subject} Class - ${format(new Date(), 'MMM dd, yyyy')}`,
        date: new Date().toISOString(),
        embed_link: streamData.embedLink 
      });

      if (dbError) {
        console.error("Failed to save recording link:", dbError);
        toast.error("Stream started but failed to save link to database.");
      } else {
        toast.success("Live Stream Started!");
      }

      setIsStreaming(true);
      
      return {
        streamKey: streamData.streamKey as string,
        broadcastId: streamData.videoId as string
      };

    } catch (error: any) {
      console.error("Streaming Error:", error);
      toast.error(`Failed to go live: ${error.message}`);
      return null;
    } finally {
      setIsStartingStream(false);
    }
  };

  const stopStream = async () => {
    if (!broadcastIdRef.current) {
        console.warn("No active broadcast ID to stop.");
        // Even if we don't have ID, we reset UI state
        setIsStreaming(false);
        return;
    }

    const toastId = toast.loading("Ending YouTube Stream...");

    try {
      const { error } = await supabase.functions.invoke('stop-youtube-stream', {
        body: { broadcastId: broadcastIdRef.current }
      });

      if (error) throw error;

      toast.success("Stream Ended Successfully!", { id: toastId });
      setIsStreaming(false);
      broadcastIdRef.current = null;
    } catch (error: any) {
      console.error("Stop Stream Error:", error);
      toast.error("Failed to end stream. Check YouTube Studio.", { id: toastId });
      // We still set streaming to false so UI unlocks
      setIsStreaming(false);
    }
  };

  return {
    startStream,
    stopStream,
    isStreaming,
    isStartingStream
  };
};
