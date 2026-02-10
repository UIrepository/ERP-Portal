import { useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { toast } from 'sonner';

export const useYoutubeStream = () => {
  const [isStreaming, setIsStreaming] = useState(false);
  const [isStartingStream, setIsStartingStream] = useState(false);
  
  // Store the Broadcast ID so we can stop it later
  const broadcastIdRef = useRef<string | null>(null);

  /**
   * Creates a YouTube Broadcast via Edge Function and saves the link to the database.
   */
  const startStream = async (batch: string, subject: string) => {
    if (isStartingStream || isStreaming) return null;

    setIsStartingStream(true);
    toast.info("Initializing YouTube Live Stream...");

    try {
      // 1. Call Edge Function to create YouTube Broadcast
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

      console.log("Stream created:", streamData.videoUrl);
      
      // SAVE THE ID FOR STOPPING LATER
      broadcastIdRef.current = streamData.videoId;

      // 2. Save Recording Link to DB Immediately
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
        toast.success("Live Stream Started! Link saved to Recordings.");
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

  /**
   * Stops the YouTube Broadcast via Edge Function.
   */
  const stopStream = async () => {
    if (!broadcastIdRef.current) {
        console.warn("No active broadcast ID to stop.");
        // If we don't have an ID, just reset the UI
        setIsStreaming(false);
        return;
    }

    const toastId = toast.loading("Stopping Recording...");

    try {
      const { error } = await supabase.functions.invoke('stop-youtube-stream', {
        body: { broadcastId: broadcastIdRef.current }
      });

      if (error) throw error;

      toast.success("Recording Stopped Successfully!", { id: toastId });
      setIsStreaming(false);
      broadcastIdRef.current = null;
    } catch (error: any) {
      console.error("Stop Stream Error:", error);
      toast.error("Failed to stop stream automatically. Please check YouTube Studio.", { id: toastId });
      // Reset UI anyway so the button doesn't get stuck
      setIsStreaming(false);
    }
  };

  return {
    startStream,
    stopStream, // <--- Exported now
    isStreaming,
    isStartingStream
  };
};
