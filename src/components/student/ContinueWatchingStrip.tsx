import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Play } from 'lucide-react';
import { listForBatch } from '@/lib/videoProgress';
import { pullProgress } from '@/lib/videoProgressSync';
import { parseVideoUrl } from '@/components/video-player/useVideoPlayer';
import { useIsMobile } from '@/hooks/use-mobile';
import { openInternalRoute } from '@/hooks/useInstallApp';

interface ContinueWatchingStripProps {
  userId?: string | null;
  batch?: string | null;
}

/**
 * Horizontal, single-row strip of partially-watched videos for the current
 * batch. localStorage is the source of truth; one cheap pull merges cross-device
 * progress. Renders nothing when there's no in-progress video.
 */
export const ContinueWatchingStrip = ({ userId, batch }: ContinueWatchingStripProps) => {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [version, setVersion] = useState(0);

  // One cheap cross-device pull when the dashboard mounts, then re-read.
  useEffect(() => {
    if (!userId) return;
    pullProgress(userId).then((merged) => { if (merged) setVersion((v) => v + 1); });
  }, [userId]);

  const items = useMemo(() => listForBatch(userId, batch), [userId, batch, version]);

  if (items.length === 0) return null;

  // Desktop opens in the same tab; mobile keeps the existing behaviour
  // (same tab inside the installed PWA, new tab in a mobile browser).
  const openLecture = (videoId: string) => {
    const url = `/lecture/${videoId}`;
    if (isMobile) openInternalRoute(url, navigate);
    else navigate(url);
  };

  return (
    <section className="bg-white rounded-lg border border-slate-100 shadow-sm p-5 md:p-6">
      <h2 className="text-lg font-semibold text-[#1e293b] mb-4">Continue watching</h2>

      <div className="flex gap-3 overflow-x-auto pb-1 -mx-1 px-1" style={{ scrollbarWidth: 'thin' }}>
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
              onClick={() => openLecture(it.videoId)}
              className="group relative shrink-0 w-[150px] sm:w-[168px] text-left rounded-lg overflow-hidden border border-slate-200 bg-white hover:shadow-md hover:border-violet-200 transition-all"
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
                <div className="absolute bottom-0 inset-x-0 h-1 bg-black/40">
                  <div className="h-full bg-violet-600" style={{ width: `${it.percent}%` }} />
                </div>
              </div>
              <div className="p-2.5">
                <p className="text-[13px] font-semibold text-slate-900 line-clamp-2 leading-snug">{it.title}</p>
                <p className="mt-1 text-[11px] font-semibold text-violet-700">{it.percent}% complete</p>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
};
