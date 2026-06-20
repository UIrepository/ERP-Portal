import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { Plus, Pencil, Trash2, ExternalLink, Loader2, PenLine, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { openInternalRoute } from '@/hooks/useInstallApp';
import {
  useMyWhiteboards, useAllWhiteboards, useWhiteboardMutations, type WhiteboardFile,
} from '@/hooks/useWhiteboardFiles';

const lastEdited = (iso: string) => {
  try { return `Edited ${formatDistanceToNow(new Date(iso), { addSuffix: true })}`; } catch { return ''; }
};

function BoardCard({
  file, readOnly, onOpen, onRename, onDelete,
}: {
  file: WhiteboardFile;
  readOnly?: boolean;
  onOpen: () => void;
  onRename?: () => void;
  onDelete?: () => void;
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
                <BoardCard key={f.id} file={f} readOnly onOpen={() => open(f.id)} />
              ))}
            </div>
          )}
        </section>
      )}

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
