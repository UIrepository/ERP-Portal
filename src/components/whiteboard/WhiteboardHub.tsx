import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { Plus, Pencil, Trash2, ExternalLink, Loader2, PenLine, Eye, UserPlus, X, Link2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { openInternalRoute } from '@/hooks/useInstallApp';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  useMyWhiteboards, useAllWhiteboards, useWhiteboardMutations,
  useWhiteboardViewers, useWhiteboardViewerMutations,
  type WhiteboardFile, type WhiteboardShareRole,
} from '@/hooks/useWhiteboardFiles';

const lastEdited = (iso: string) => {
  try { return `Edited ${formatDistanceToNow(new Date(iso), { addSuffix: true })}`; } catch { return ''; }
};

function BoardCard({
  file, readOnly, onOpen, onRename, onDelete, onShare,
}: {
  file: WhiteboardFile;
  readOnly?: boolean;
  onOpen: () => void;
  onRename?: () => void;
  onDelete?: () => void;
  onShare?: () => void;
}) {
  return (
    <div className="group relative rounded-xl border border-slate-200 bg-white overflow-hidden hover:shadow-md transition-shadow">
      <button onClick={onOpen} className="block w-full text-left" title="Open in a new tab">
        <div className="aspect-[16/10] bg-slate-900 flex items-center justify-center overflow-hidden">
          {file.thumbnail_url ? (
            <img src={file.thumbnail_url} alt="" className="h-full w-full object-cover" loading="lazy" />
          ) : (
            <PenLine className="h-8 w-8 text-slate-600" />
          )}
        </div>
        <div className="p-3">
          <div className="text-sm font-semibold text-slate-900 truncate">{file.title}</div>
          <div className="text-[11px] text-slate-500 mt-0.5 truncate">
            {file.ownerName ? `${file.ownerName} · ` : ''}{lastEdited(file.updated_at)}
          </div>
        </div>
      </button>
      <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button onClick={onOpen} title={readOnly ? 'View' : 'Open'} className="h-7 w-7 inline-flex items-center justify-center rounded-md bg-white/90 border border-slate-200 text-slate-600 hover:bg-white shadow-sm">
          {readOnly ? <Eye className="h-3.5 w-3.5" /> : <ExternalLink className="h-3.5 w-3.5" />}
        </button>
        {onShare && (
          <button onClick={onShare} title="Share (view only)" className="h-7 w-7 inline-flex items-center justify-center rounded-md bg-white/90 border border-slate-200 text-slate-600 hover:bg-white shadow-sm">
            <UserPlus className="h-3.5 w-3.5" />
          </button>
        )}
        {!readOnly && onRename && (
          <button onClick={onRename} title="Rename" className="h-7 w-7 inline-flex items-center justify-center rounded-md bg-white/90 border border-slate-200 text-slate-600 hover:bg-white shadow-sm">
            <Pencil className="h-3.5 w-3.5" />
          </button>
        )}
        {!readOnly && onDelete && (
          <button onClick={onDelete} title="Delete" className="h-7 w-7 inline-flex items-center justify-center rounded-md bg-white/90 border border-slate-200 text-rose-600 hover:bg-rose-50 shadow-sm">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * Admin-only: grant read-only access to a board by email. The person signs in
 * with that Google account and opens the link — they can look, but tldraw is
 * read-only and RLS gives them SELECT only, so they can neither edit nor
 * re-share. Admins are the only role allowed to manage this list.
 */
function ShareDialog({ file, onClose }: { file: WhiteboardFile | null; onClose: () => void }) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<WhiteboardShareRole>('viewer');
  const { data: viewers = [], isLoading } = useWhiteboardViewers(file?.id ?? null);
  const { addViewer, removeViewer, setRole: changeRole } = useWhiteboardViewerMutations();

  const link = file ? `${window.location.origin}/whiteboard/file/${file.id}` : '';

  const submit = async () => {
    if (!file || !email.trim()) return;
    try {
      await addViewer.mutateAsync({ whiteboardId: file.id, email, role });
      setEmail('');
      toast.success(role === 'editor' ? 'Editor added' : 'Viewer added');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not add person');
    }
  };

  return (
    <Dialog open={!!file} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Share “{file?.title}”</DialogTitle>
          <DialogDescription>
            Choose what each person can do. Neither viewers nor editors can share this board with anyone else.
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-2">
          <Input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void submit(); } }}
            placeholder="name@example.com"
            type="email"
            autoFocus
          />
          <Select value={role} onValueChange={(v) => setRole(v as WhiteboardShareRole)}>
            <SelectTrigger className="w-[104px] shrink-0"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="viewer">Can view</SelectItem>
              <SelectItem value="editor">Can edit</SelectItem>
            </SelectContent>
          </Select>
          <Button
            onClick={submit}
            disabled={addViewer.isPending || !email.trim()}
            className="bg-fuchsia-600 hover:bg-fuchsia-700 text-white shrink-0"
          >
            {addViewer.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Add'}
          </Button>
        </div>

        <div className="mt-1 max-h-56 overflow-y-auto">
          {isLoading ? (
            <div className="py-6 text-center text-slate-400"><Loader2 className="h-4 w-4 animate-spin mx-auto" /></div>
          ) : viewers.length === 0 ? (
            <p className="py-4 text-center text-sm text-slate-500">No viewers yet.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {viewers.map((v) => (
                <li key={v.id} className="flex items-center justify-between gap-2 py-2">
                  <span className="text-sm text-slate-700 truncate">{v.email}</span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Select
                      value={v.role}
                      onValueChange={async (next) => {
                        if (!file || next === v.role) return;
                        try { await changeRole.mutateAsync({ id: v.id, role: next as WhiteboardShareRole, whiteboardId: file.id }); }
                        catch { toast.error('Could not change access'); }
                      }}
                    >
                      <SelectTrigger className="h-7 w-[104px] text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="viewer">Can view</SelectItem>
                        <SelectItem value="editor">Can edit</SelectItem>
                      </SelectContent>
                    </Select>
                    <button
                      title="Remove access"
                      onClick={async () => {
                        if (!file) return;
                        try { await removeViewer.mutateAsync({ id: v.id, whiteboardId: file.id }); }
                        catch { toast.error('Could not remove'); }
                      }}
                      className="h-6 w-6 inline-flex items-center justify-center rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <DialogFooter className="sm:justify-between gap-2">
          <Button
            variant="outline"
            onClick={() => { void navigator.clipboard.writeText(link); toast.success('Link copied'); }}
          >
            <Link2 className="h-4 w-4 mr-2" /> Copy link
          </Button>
          <Button variant="outline" onClick={onClose}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export const WhiteboardHub = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin' || profile?.role === 'super_admin';

  const { data: myFiles = [], isLoading } = useMyWhiteboards();
  const { data: allFiles = [] } = useAllWhiteboards(isAdmin);
  const { create, rename, remove } = useWhiteboardMutations();

  const [renaming, setRenaming] = useState<WhiteboardFile | null>(null);
  const [renameText, setRenameText] = useState('');
  const [deleting, setDeleting] = useState<WhiteboardFile | null>(null);
  const [sharing, setSharing] = useState<WhiteboardFile | null>(null);

  const open = (id: string) => openInternalRoute(`/whiteboard/file/${id}`, navigate);

  const handleNew = async () => {
    try {
      const file = await create.mutateAsync('Untitled whiteboard');
      open(file.id);
    } catch {
      toast.error('Could not create whiteboard');
    }
  };

  // Admin: other teachers' boards (exclude my own, shown above).
  const othersFiles = allFiles.filter((f) => f.owner_id !== profile?.user_id);

  return (
    <div className="p-3 sm:p-6 space-y-8 max-w-[1400px] mx-auto">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Whiteboard</h1>
          <p className="text-sm text-slate-500 mt-1">
            A free space to teach and sketch. Boards save to your history; export a PDF to your device anytime.
          </p>
        </div>
        <Button onClick={handleNew} disabled={create.isPending} className="bg-fuchsia-600 hover:bg-fuchsia-700 text-white">
          {create.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
          New whiteboard
        </Button>
      </div>

      <section>
        <h2 className="text-sm font-semibold text-slate-700 mb-3">My whiteboards</h2>
        {isLoading ? (
          <div className="flex items-center justify-center py-12 text-slate-400"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : myFiles.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 p-10 text-center text-slate-500">
            No whiteboards yet — click <span className="font-medium">New whiteboard</span> to start.
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {myFiles.map((f) => (
              <BoardCard
                key={f.id} file={f}
                onOpen={() => open(f.id)}
                onRename={() => { setRenaming(f); setRenameText(f.title); }}
                onDelete={() => setDeleting(f)}
                onShare={isAdmin ? () => setSharing(f) : undefined}
              />
            ))}
          </div>
        )}
      </section>

      {isAdmin && (
        <section>
          <h2 className="text-sm font-semibold text-slate-700 mb-3">All teachers' whiteboards</h2>
          {othersFiles.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-slate-500 text-sm">
              No teacher whiteboards yet.
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {othersFiles.map((f) => (
                <BoardCard key={f.id} file={f} readOnly onOpen={() => open(f.id)} onShare={() => setSharing(f)} />
              ))}
            </div>
          )}
        </section>
      )}

      {/* Share (view-only) — admins only */}
      {isAdmin && <ShareDialog file={sharing} onClose={() => setSharing(null)} />}

      {/* Rename dialog */}
      <Dialog open={!!renaming} onOpenChange={(o) => !o && setRenaming(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Rename whiteboard</DialogTitle></DialogHeader>
          <Input value={renameText} onChange={(e) => setRenameText(e.target.value)} placeholder="Whiteboard name" autoFocus />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenaming(null)}>Cancel</Button>
            <Button
              className="bg-fuchsia-600 hover:bg-fuchsia-700 text-white"
              onClick={async () => {
                if (!renaming) return;
                try { await rename.mutateAsync({ id: renaming.id, title: renameText }); setRenaming(null); }
                catch { toast.error('Rename failed'); }
              }}
            >Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete whiteboard?</DialogTitle>
            <DialogDescription>“{deleting?.title}” will be permanently removed. This can't be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={async () => {
                if (!deleting) return;
                try { await remove.mutateAsync(deleting.id); setDeleting(null); toast.success('Deleted'); }
                catch { toast.error('Delete failed'); }
              }}
            >Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
