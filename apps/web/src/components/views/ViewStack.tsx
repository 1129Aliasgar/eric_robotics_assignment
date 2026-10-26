import { Suspense, lazy } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { LoaderCircle, Map as MapIcon, Maximize2 } from 'lucide-react';
import { cx } from '../../lib/format';
import { useUiStore } from '../../store/uiStore';
import { CameraFeed } from '../camera/CameraFeed';
import { ZoomSlider } from '../hud/ZoomSlider';

const MapScene = lazy(() => import('../map/MapScene'));

function MapFallback() {
  return (
    <div className="map-surface grid h-full w-full place-items-center">
      <div className="dark-pill gap-2.5 px-3.5 py-2">
        <LoaderCircle className="text-safety-400 size-3.5 animate-spin" aria-hidden />
        <span className="text-[9px] font-semibold tracking-[0.15em] uppercase">
          Initializing 3D map
        </span>
      </div>
    </div>
  );
}

function PipSwap({ label, map, onClick }: { label: string; map?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="group absolute inset-0 z-20 rounded-[inherit] text-left"
    >
      <span className="pointer-events-none absolute inset-0 rounded-[inherit] ring-1 ring-white/50 transition ring-inset group-hover:ring-white/90" />
      <span className="bg-ink-950/35 pointer-events-none absolute top-2 right-2 grid size-6 place-items-center rounded-full border border-white/25 text-white/80 opacity-0 backdrop-blur-md transition group-hover:opacity-100 group-focus-visible:opacity-100">
        <Maximize2 className="size-3" aria-hidden />
      </span>
      <span
        className={cx(
          'bg-ink-950/85 pointer-events-none absolute left-1/2 -translate-x-1/2 rounded-lg px-2.5 py-1.5 text-[9px] font-medium whitespace-nowrap text-white shadow-lg backdrop-blur-md',
          'top-3 opacity-0 transition group-hover:opacity-100 group-focus-visible:opacity-100',
          map && 'top-11',
        )}
      >
        {label}
      </span>
    </button>
  );
}

function PipLabel() {
  return (
    <span className="bg-ink-900/90 pointer-events-none absolute top-2.5 left-1/2 z-10 inline-flex -translate-x-1/2 items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[8px] font-semibold tracking-[0.13em] text-white uppercase shadow-md backdrop-blur-md">
      <MapIcon className="size-2.5 text-white/65" aria-hidden />
      Map View
    </span>
  );
}

export function ViewStack() {
  const primaryView = useUiStore((state) => state.primaryView);
  const setPrimaryView = useUiStore((state) => state.setPrimaryView);
  const mapZoom = useUiStore((state) => state.mapZoom);
  const setMapZoom = useUiStore((state) => state.setMapZoom);
  const cameraZoom = useUiStore((state) => state.cameraZoom);
  const setCameraZoom = useUiStore((state) => state.setCameraZoom);
  const reducedMotion = useReducedMotion();

  const cameraMain = primaryView === 'camera';
  const transition = reducedMotion
    ? { duration: 0 }
    : { type: 'spring' as const, stiffness: 250, damping: 29, mass: 0.9 };

  return (
    <div className="absolute inset-0 overflow-hidden">
      <motion.div
        layout
        transition={transition}
        className={cx(
          'absolute',
          cameraMain
            ? 'bottom-4 left-4 z-30 aspect-[3/2] w-[min(48vw,330px)] min-w-[190px] sm:bottom-14 sm:left-11'
            : 'inset-0 z-10',
        )}
      >
        <div className="relative h-full w-full">
          <div
            className={cx(
              'relative h-full w-full',
              cameraMain && 'pip-shadow overflow-hidden rounded-[14px] bg-mist-300',
            )}
          >
            <div className={cx('h-full w-full overflow-hidden', cameraMain && 'rounded-[14px]')}>
              <Suspense fallback={<MapFallback />}>
                <MapScene />
              </Suspense>
            </div>
            {cameraMain && (
              <>
                <PipLabel />
                <PipSwap label="Click to open map view" map onClick={() => setPrimaryView('map')} />
              </>
            )}
          </div>
          {cameraMain && (
            <ZoomSlider
              value={mapZoom}
              min={0.55}
              max={3.2}
              label="map"
              onChange={setMapZoom}
              className="absolute top-1/2 -left-8 hidden -translate-y-1/2 sm:flex"
            />
          )}
        </div>
      </motion.div>

      <motion.div
        layout
        transition={transition}
        className={cx(
          'absolute',
          cameraMain
            ? 'inset-0 z-10'
            : 'bottom-4 left-4 z-30 aspect-[3/2] w-[min(48vw,330px)] min-w-[190px] sm:bottom-14 sm:left-11',
        )}
      >
        <div className="relative h-full w-full">
          <div
            className={cx(
              'bg-ink-950 relative h-full w-full',
              !cameraMain && 'pip-shadow overflow-hidden rounded-[14px]',
            )}
          >
            <div className={cx('h-full w-full overflow-hidden', !cameraMain && 'rounded-[14px]')}>
              <CameraFeed zoom={cameraZoom} main={cameraMain} />
            </div>
            {!cameraMain && (
              <PipSwap
                label="Click to enter camera view"
                onClick={() => setPrimaryView('camera')}
              />
            )}
          </div>
          {!cameraMain && (
            <ZoomSlider
              value={cameraZoom}
              min={1}
              max={2.4}
              label="camera"
              onChange={setCameraZoom}
              className="absolute top-1/2 -left-8 hidden -translate-y-1/2 sm:flex"
            />
          )}
        </div>
      </motion.div>
    </div>
  );
}
