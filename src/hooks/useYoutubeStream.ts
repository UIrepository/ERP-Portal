import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { toast } from 'sonner';

export const useYoutubeStream = () => {
  const [isStreaming, setIsStreaming] = useState(false);
  const [isStartingStream, setIsStartingStream] = useState(false);

  /**
   * Creates a YouTube Broadcast via Edge Function and saves the link to the database.
   * Returns the streamKey on success, or null on failure.
   */
  const startStream = async (batch: string, subject: string) => {
    if (isStartingStream || isStreaming) return null;

    setIsStartingStream(true);
    toast.info("Initializing YouTube Live Stream...");

    try {
      // 1. Call Edge Function to create YouTube Broadcast
      // This keeps your API keys secure on the server side
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

      // 2. Save Recording Link to DB Immediately
      // This ensures students see the recording link even if the teacher disconnects
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
      return streamData.streamKey as string;

    } catch (error: any) {
      console.error("Streaming Error:", error);
      toast.error(`Failed to go live: ${error.message}`);
      return null;
    } finally {
      setIsStartingStream(false);
    }
  };

  return {
    startStream,
    isStreaming,
    isStartingStream
  };
};
