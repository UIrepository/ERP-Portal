import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Play } from 'lucide-react';
import { listForBatch } from '@/lib/videoProgress';
import { pullProgress } from '@/lib/videoProgressSync';
import { parseVideoUrl } from '@/components/video-player/useVideoPlayer';

interface ContinueWatchingStripProps {
  userId?: string | null;
  batch?: string | null;
}

/**
 * Horizontal, single-row strip of partially-watched videos for the current
 * batch, read entirely from on-device localStorage (no DB/egress). Renders
 * nothing when there's no in-progress video. Tapping a card resumes playback.
 */
export const ContinueWatchingStrip = ({ userId, batch }: ContinueWatchingStripProps) => {
  const navigate = useNavigate();
  const [version, setVersion] = useState(0);

  // One cheap cross-device pull when the dashboard mounts (merges the DB rows
  // into localStorage), then re-read.
  useEffect(() => {
    if (!userId) return;
    pullProgress(userId).then((merged) => { if (merged) setVersion((v) => v + 1); });
  }, [userId]);

  const items = useMemo(() => listForBatch(userId, batch), [userId, batch, version]);

  if (items.length === 0) return null;

  return (
    <section>
      <div className="mb-3">
        <h2 className="text-lg font-semibold text-[#1e293b]">Continue watching</h2>
        <p className="text-[13px] text-[#64748b]">Pick up where you left off</p>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-2 -mx-1 px-1" style={{ scrollbarWidth: 'thin' }}>
        {items.map((it) => {
          const parsed = parseVideoUrl(it.videoUrl);
          const thumb =
            parsed.type === 'youtube' && parsed.videoId
              ? `https://img.youtube.com/vi/${parsed.videoId}/mqdefault.jpg`
              : null;
          return (
            <button
              key={it.videoId}
              type="button"
              onClick={() => navigate(`/lecture/${it.videoId}`)}
              className="group relative shrink-0 w-[230px] text-left rounded-xl overflow-hidden border border-slate-200 bg-white shadow-sm hover:shadow-md hover:border-indigo-200 transition-all"
            >
              <div className="relative aspect-video bg-gradient-to-br from-slate-800 to-slate-900">
                {thumb && (
                  <img src={thumb} alt="" loading="lazy" className="h-full w-full object-cover" />
                )}
                <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="h-11 w-11 rounded-full bg-white/90 flex items-center justify-center">
                    <Play className="h-5 w-5 text-slate-900 ml-0.5" fill="currentColor" />
                  </div>
                </div>
                {/* watched progress */}
                <div className="absolute bottom-0 inset-x-0 h-1 bg-black/40">
                  <div className="h-full bg-indigo-500" style={{ width: `${it.percent}%` }} />
                </div>
              </div>
              <div className="p-3">
                <p className="text-sm font-semibold text-slate-900 line-clamp-2 leading-snug">{it.title}</p>
                <p className="mt-1 text-[11px] text-slate-400 truncate">
                  {it.subject ? `${it.subject} · ` : ''}{it.percent}% watched
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
};
