-- Table for storing doubts/questions related to a recording
CREATE TABLE public.doubts (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    recording_id UUID NOT NULL REFERENCES public.recordings(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    question_text TEXT NOT NULL,
    batch TEXT NOT NULL,
    subject TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Table for storing answers to a doubt
CREATE TABLE public.doubt_answers (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    doubt_id UUID NOT NULL REFERENCES public.doubts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    answer_text TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS for the new tables
ALTER TABLE public.doubts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.doubt_answers ENABLE ROW LEVEL SECURITY;

-- Add new tables to the realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.doubts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.doubt_answers;

-- RLS Policies for 'doubts' table
CREATE POLICY "Allow authenticated users to view all doubts"
ON public.doubts
FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to ask a doubt"
ON public.doubts
FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Users can only update their own doubts"
ON public.doubts
FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can only delete their own doubts"
ON public.doubts
FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for 'doubt_answers' table
CREATE POLICY "Allow authenticated users to view all answers"
ON public.doubt_answers
FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to answer a doubt"
ON public.doubt_answers
FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Users can only update their own answers"
ON public.doubt_answers
FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can only delete their own answers"
ON public.doubt_answers
FOR DELETE USING (auth.uid() = user_id);
