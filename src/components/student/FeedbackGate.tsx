import { useState, useEffect, useMemo, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { FeedbackFormContent, FEEDBACK_QUESTIONS } from './StudentFeedback';
import { FeedbackSuccess } from './FeedbackSuccess';

interface Pending { batch: string; subject: string }
interface GateCfg { enabled: boolean; scope: 'everywhere' | 'active_batch' }

const emptyRatings = () => ({
  teacher_quality: 0,
  concept_clarity: 0,
  dpp_quality: 0,
  premium_content_usefulness: 0,
});

/**
 * Mandatory feedback gate. When an admin turns the gate on (see AdminFeedbackGate)
 * a targeted student is blocked from the portal until they submit feedback for
 * every targeted subject. Each submit shows a success beat, then chains to the
 * next subject. Scope 'active_batch' only enforces the batch the student is
 * currently in (localStorage `student-selected-batch`).
 */
export const FeedbackGate = () => {
  const { profile } = useAuth();
  const queryClient = useQueryClient();

  const { data: cfg } = useQuery<GateCfg>({
    queryKey: ['feedback-gate-cfg'],
    queryFn: async () => {
      const { data } = await supabase.from('feedback_gate').select('enabled, scope').eq('id', 1).maybeSingle();
      return (data || { enabled: false, scope: 'everywhere' }) as GateCfg;
    },
    refetchInterval: 120000,
  });

  const { data: pending = [], isLoading } = useQuery<Pending[]>({
    queryKey: ['my-pending-feedback-gate', profile?.user_id],
    enabled: !!profile?.user_id && !!cfg?.enabled,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_my_pending_feedback_gate');
      if (error) throw error;
      return (data || []) as Pending[];
    },
  });

  // Track the student's currently-selected batch (for scope 'active_batch').
  const [activeBatch, setActiveBatch] = useState<string | null>(
    typeof window !== 'undefined' ? localStorage.getItem('student-selected-batch') : null,
  );
  useEffect(() => {
    const sync = () => setActiveBatch(localStorage.getItem('student-selected-batch'));
    window.addEventListener('storage', sync);
    window.addEventListener('student-batch-changed', sync);
    return () => {
      window.removeEventListener('storage', sync);
      window.removeEventListener('student-batch-changed', sync);
    };
  }, []);

  const visiblePending = useMemo(() => {
    if (cfg?.scope === 'active_batch' && activeBatch) return pending.filter((p) => p.batch === activeBatch);
    return pending;
  }, [pending, cfg?.scope, activeBatch]);

  const current = visiblePending[0];

  const [ratings, setRatings] = useState(emptyRatings());
  const [comments, setComments] = useState('');
  const [phase, setPhase] = useState<'form' | 'success'>('form');
  const [completed, setCompleted] = useState(0);
  const [formError, setFormError] = useState<string | null>(null);
  const timerRef = useRef<number | null>(null);
  // Freeze the round size the first time we know it, so the "x of N" count
  // doesn't jump while the pending list refetches between subjects.
  const roundTotalRef = useRef(0);

  // Reset the form whenever we move to a new subject.
  const currentKey = current ? `${current.batch}::${current.subject}` : '';
  useEffect(() => {
    setRatings(emptyRatings());
    setComments('');
    setFormError(null);
  }, [currentKey]);

  // Clear the inline error as soon as all four are rated.
  useEffect(() => {
    if (formError && Object.values(ratings).every((r) => r > 0)) setFormError(null);
  }, [ratings, formError]);

  useEffect(() => () => { if (timerRef.current) window.clearTimeout(timerRef.current); }, []);

  const submit = useMutation({
    mutationFn: async () => {
      if (!current || !profile?.user_id) return;
      const { error } = await supabase.from('feedback').insert([{
        batch: current.batch,
        subject: current.subject,
        ...ratings,
        comments,
        submitted_by: profile.user_id,
      }]);
      if (error) throw error;
    },
    onSuccess: () => {
      const wasLast = visiblePending.length <= 1;
      setCompleted((c) => c + 1);
      setFormError(null);
      queryClient.invalidateQueries({ queryKey: ['my-pending-feedback-gate'] });
      queryClient.invalidateQueries({ queryKey: ['student-submitted-feedback'] });
      if (wasLast) {
        // Celebrate ONCE, after every subject is done — then unlock.
        setPhase('success');
        timerRef.current = window.setTimeout(() => setPhase('form'), 2100);
      } else {
        // More subjects remain — slide straight to the next one, no success beat.
        setRatings(emptyRatings());
        setComments('');
      }
    },
    // Never surface raw backend errors to the student.
    onError: () => setFormError('Sorry, that didn’t save. Please check your connection and try again.'),
  });

  const handleSubmit = () => {
    if (Object.values(ratings).some((r) => r === 0)) {
      setFormError('Please rate all four categories before continuing.');
      return;
    }
    setFormError(null);
    submit.mutate();
  };

  // Nothing to enforce → render nothing (portal stays unlocked).
  if (!cfg?.enabled) return null;
  if (isLoading) return null;
  if (visiblePending.length === 0 && phase !== 'success') return null;

  // Establish the round size once (completed so far + what's still pending), then keep it fixed.
  if (roundTotalRef.current === 0) roundTotalRef.current = completed + visiblePending.length;
  const total = Math.max(roundTotalRef.current, completed + visiblePending.length);
  const indexLabel = Math.min(completed + 1, total);

  return (
    <div className="fixed inset-0 z-[120] bg-slate-900/50 backdrop-blur-md flex items-center justify-center p-4">
      <div className="w-[75vw] max-w-[900px] max-h-[90vh] bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header — clean, like the feedback popup; no close (mandatory) */}
        <div className="px-8 pt-6 pb-5 border-b border-gray-100 shrink-0">
          {current && (
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-[22px] font-semibold tracking-tight text-gray-900">
                  Feedback for {current.subject}
                </h2>
                <p className="text-[14px] text-gray-500 mt-1">{current.batch.trim()}</p>
              </div>
              {total > 1 && (
                <span className="text-[12px] text-gray-400 tabular-nums shrink-0 mt-1">{indexLabel} of {total}</span>
              )}
            </div>
          )}
        </div>

        {phase === 'success' ? (
          <div className="flex-1 flex items-center justify-center">
            <FeedbackSuccess title="All feedback submitted!" subtitle="Thanks — unlocking the app." />
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto px-8 py-6">
              <FeedbackFormContent
                questions={FEEDBACK_QUESTIONS}
                ratings={ratings}
                setRatings={setRatings}
                comments={comments}
                setComments={setComments}
              />
            </div>
            <div className="px-8 py-5 border-t border-gray-100 shrink-0 flex items-center justify-between gap-4">
              {/* Inline error lives inside the modal, so it's always above the blur */}
              <span className="text-[13px] font-medium text-rose-600 min-h-[18px]">{formError}</span>
              <Button
                onClick={handleSubmit}
                disabled={submit.isPending}
                className="bg-black hover:bg-black/90 text-white px-6 shrink-0"
              >
                {submit.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : (visiblePending.length > 1 ? 'Submit & continue' : 'Submit & finish')}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
