import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { NameConfirmDialog } from './NameConfirmDialog';

// Ask each user to confirm their name once a month. The timer is PER USER,
// starting from their own last selection (Confirm or Keep) — not a global clock.
// A user who has never confirmed sees it on their next visit.
const MONTH_MS = 30 * 24 * 60 * 60 * 1000;

export const NameConfirmGate = () => {
  const { profile, user, refreshProfile } = useAuth();
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);

  const storageKey = user?.id ? `ui_name_confirm_${user.id}` : null;

  useEffect(() => {
    if (!profile?.name || !storageKey) return;
    let last = 0;
    try { last = Number(localStorage.getItem(storageKey) || 0); } catch { /* ignore */ }
    if (!last || Date.now() - last >= MONTH_MS) setShow(true);
  }, [profile?.name, storageKey]);

  const markConfirmed = () => {
    try { if (storageKey) localStorage.setItem(storageKey, String(Date.now())); } catch { /* ignore */ }
  };

  const handleConfirm = async (newName: string) => {
    const trimmed = newName.trim();
    if (!trimmed || !profile?.user_id) return;

    if (trimmed !== (profile.name || '')) {
      setBusy(true);
      try {
        const { error } = await supabase.from('profiles').update({ name: trimmed }).eq('user_id', profile.user_id);
        if (error) throw error;
        await refreshProfile();
        toast({ title: 'Name updated', description: `Your name is now “${trimmed}”.` });
      } catch (e) {
        setBusy(false);
        toast({ title: 'Could not update name', description: e instanceof Error ? e.message : 'Please try again.', variant: 'destructive' });
        return; // keep the dialog open so they can retry
      }
      setBusy(false);
    }

    markConfirmed();
    setShow(false);
  };

  const handleKeep = () => {
    markConfirmed();
    setShow(false);
  };

  if (!show || !profile?.name) return null;

  return (
    <NameConfirmDialog
      currentName={profile.name}
      onConfirm={handleConfirm}
      onKeepSame={handleKeep}
      busy={busy}
    />
  );
};
