import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'motion/react';
import { Pause, Play, VideoOff } from 'lucide-react';
import { cx } from '../../lib/format';

type CameraFeedProps = {
  zoom: number;
  main: boolean;
};

export function CameraFeed({ zoom, main }: CameraFeedProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const reducedMotion = useReducedMotion();
  const [playing, setPlaying] = useState(!reducedMotion);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (playing) {
      const promise = video.play();
      promise?.catch(() => setPlaying(false));
    } else {
      video.pause();
    }
  }, [playing]);

  return (
    <div className="bg-ink-950 relative h-full w-full overflow-hidden">
      {failed ? (
        <div className="grid h-full w-full place-items-center bg-[radial-gradient(circle_at_35%_25%,#2a3746_0%,#111a25_70%)]">
          <div className="flex flex-col items-center gap-2 text-white/60">
            <VideoOff className="size-6" aria-hidden />
            <span className="text-[9px] font-semibold tracking-[0.18em] uppercase">
              Camera feed unavailable
            </span>
          </div>
        </div>
      ) : (
        <video
          ref={videoRef}
          className="h-full w-full object-cover brightness-[1.32] contrast-[1.02] saturate-[0.72] transition-transform duration-500 ease-out"
          style={{ transform: `scale(${zoom})` }}
          poster="/media/camera-poster.jpg"
          autoPlay={!reducedMotion}
          muted
          loop
          playsInline
          preload="auto"
          disablePictureInPicture
          onError={() => setFailed(true)}
          aria-label="Live warehouse camera feed"
        >
          <source src="/media/camera-feed.mp4" type="video/mp4" />
        </video>
      )}

      <div
        className="from-ink-950/15 pointer-events-none absolute inset-0 bg-gradient-to-t via-transparent to-[#c7d9e6]/10"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 bg-[#a9c4d8]/10 mix-blend-screen"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 [background-image:repeating-linear-gradient(0deg,rgba(255,255,255,0.45)_0px,rgba(255,255,255,0.45)_1px,transparent_1px,transparent_4px)] opacity-[0.06] mix-blend-screen"
        aria-hidden
      />

      {main && !failed && (
        <button
          type="button"
          onClick={() => setPlaying((value) => !value)}
          aria-label={playing ? 'Pause camera feed' : 'Play camera feed'}
          className={cx(
            'bg-ink-950/45 hover:bg-ink-950/70 absolute bottom-5 left-1/2 z-10 grid size-8 -translate-x-1/2 place-items-center rounded-full border border-white/20 text-white/80 backdrop-blur-md transition hover:text-white',
            playing && 'opacity-45 hover:opacity-100',
          )}
        >
          {playing ? (
            <Pause className="size-3.5 fill-current" aria-hidden />
          ) : (
            <Play className="size-3.5 fill-current" aria-hidden />
          )}
        </button>
      )}

      {main && !playing && !failed && (
        <button
          type="button"
          onClick={() => setPlaying(true)}
          className="bg-ink-950/10 absolute inset-0 z-[5] grid place-items-center"
          aria-label="Play camera feed"
        >
          <span className="bg-ink-950/40 hover:bg-ink-950/60 grid size-16 place-items-center rounded-full border border-white/25 text-white backdrop-blur-md transition hover:scale-105">
            <Play className="size-6 fill-current" aria-hidden />
          </span>
        </button>
      )}
    </div>
  );
}
