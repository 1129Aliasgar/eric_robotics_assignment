import {
  Activity,
  LayoutGrid,
  LocateFixed,
  Map,
  MapPin,
  Scan,
  UserRound,
  type LucideIcon,
} from 'lucide-react';
import { cx } from '../../lib/format';
import { useToastStore } from '../../store/toastStore';
import { useUiStore, type NavId } from '../../store/uiStore';
import { Tooltip } from '../ui/Tooltip';

type NavItem = {
  id: NavId;
  label: string;
  icon: LucideIcon;
  active: boolean;
  toggled?: boolean;
  onClick: () => void;
};

export function Sidebar() {
  const drawer = useUiStore((state) => state.drawer);
  const primaryView = useUiStore((state) => state.primaryView);
  const scanEnabled = useUiStore((state) => state.scanEnabled);
  const routeVisible = useUiStore((state) => state.routeVisible);
  const resetMap = useUiStore((state) => state.resetMap);
  const setDrawer = useUiStore((state) => state.setDrawer);
  const setPrimaryView = useUiStore((state) => state.setPrimaryView);
  const closeModal = useUiStore((state) => state.closeModal);
  const toggleScan = useUiStore((state) => state.toggleScan);
  const toggleRoute = useUiStore((state) => state.toggleRoute);
  const pushToast = useToastStore((state) => state.push);

  const handleScan = () => {
    const next = !scanEnabled;
    toggleScan();
    pushToast(
      next ? 'Scan overlay enabled. The LiDAR sweep is now visible.' : 'Scan overlay hidden.',
      'info',
    );
  };

  const handleRoute = () => {
    const next = !routeVisible;
    toggleRoute();
    pushToast(
      next ? 'Route overlay visible. The dashed path updates live.' : 'Route overlay hidden.',
      'info',
    );
  };

  const items: NavItem[] = [
    {
      id: 'overview',
      label: 'Reset view',
      icon: LayoutGrid,
      active: false,
      onClick: () => {
        closeModal();
        resetMap();
      },
    },
    {
      id: 'map',
      label: 'Map view',
      icon: Map,
      active: drawer === null && primaryView === 'map',
      onClick: () => {
        setDrawer(null);
        setPrimaryView('map');
      },
    },
    {
      id: 'locations',
      label: 'Destinations',
      icon: MapPin,
      active: drawer === 'locations',
      onClick: () => setDrawer(drawer === 'locations' ? null : 'locations'),
    },
    {
      id: 'scan',
      label: scanEnabled ? 'Hide scan overlay' : 'Show scan overlay',
      icon: Scan,
      active: false,
      toggled: scanEnabled,
      onClick: handleScan,
    },
    {
      id: 'route',
      label: routeVisible ? 'Hide route overlay' : 'Show route overlay',
      icon: LocateFixed,
      active: false,
      toggled: routeVisible,
      onClick: handleRoute,
    },
    {
      id: 'activity',
      label: 'Mission activity',
      icon: Activity,
      active: drawer === 'activity',
      onClick: () => setDrawer(drawer === 'activity' ? null : 'activity'),
    },
  ];

  const navButton = (item: NavItem) => {
    const Icon = item.icon;
    return (
      <Tooltip key={item.id} label={item.label} side="right" className="inline-flex">
        <button
          type="button"
          onClick={item.onClick}
          aria-label={item.label}
          aria-current={item.active ? 'page' : undefined}
          aria-pressed={item.toggled === undefined ? undefined : item.toggled}
          className={cx(
            'group relative grid size-10 place-items-center rounded-xl transition-colors duration-200 md:size-11',
            item.active
              ? 'bg-white/[0.11] text-white'
              : 'text-white/55 hover:bg-white/[0.07] hover:text-white',
            item.toggled && 'text-safety-400',
          )}
        >
          {item.active && (
            <span
              className="bg-safety-400 absolute top-1/2 -left-[7px] hidden h-5 w-[2px] -translate-y-1/2 rounded-full md:block lg:-left-[10px]"
              aria-hidden
            />
          )}
          <Icon className="size-[19px]" strokeWidth={1.7} aria-hidden />
          {item.toggled && (
            <span className="bg-safety-400 absolute top-2 right-2 size-1.5 rounded-full shadow-[0_0_0_2px_var(--color-ink-900)]" />
          )}
        </button>
      </Tooltip>
    );
  };

  return (
    <aside
      className="sidebar-texture fixed inset-x-0 bottom-0 z-50 flex h-[calc(56px+env(safe-area-inset-bottom))] flex-row items-center border-t border-white/10 px-2 pb-[env(safe-area-inset-bottom)] md:inset-y-0 md:right-auto md:h-auto md:w-16 md:flex-col md:border-t-0 md:border-r md:px-0 md:pb-0 lg:w-[96px]"
      aria-label="Primary"
    >
      <div className="hidden h-[102px] w-full shrink-0 flex-col items-center justify-center gap-1.5 md:flex">
        <div className="hidden flex-col items-center lg:flex">
          <span className="text-[26px] leading-none font-semibold tracking-[0.13em] text-white">
            ERIC
          </span>
          <span className="mt-1.5 text-[7.5px] font-semibold tracking-[0.3em] text-white/45">
            ROBOTICS
          </span>
        </div>
        <div className="bg-paper text-ink-900 grid size-8 place-items-center rounded-lg text-[13px] font-bold lg:hidden">
          E
        </div>
      </div>

      <nav
        className="flex flex-1 items-center justify-around gap-0.5 md:mt-2 md:flex-none md:flex-col md:justify-start md:gap-1.5"
        aria-label="Workspace navigation"
      >
        {items.map(navButton)}
      </nav>

      <div className="flex shrink-0 items-center md:mt-auto md:pb-5">
        <Tooltip label="Operator profile" side="right" className="inline-flex">
          <button
            type="button"
            onClick={() => setDrawer(drawer === 'profile' ? null : 'profile')}
            aria-label="Operator profile"
            aria-current={drawer === 'profile' ? 'page' : undefined}
            className={cx(
              'relative grid size-10 place-items-center rounded-xl transition-colors duration-200 md:size-11',
              drawer === 'profile'
                ? 'bg-white/[0.11] text-white'
                : 'text-white/55 hover:bg-white/[0.07] hover:text-white',
            )}
          >
            <span className="grid size-7 place-items-center rounded-full border border-white/20 bg-white/[0.07]">
              <UserRound className="size-[15px]" strokeWidth={1.7} aria-hidden />
            </span>
            <span className="border-ink-900 bg-live-500 absolute right-1.5 bottom-1.5 size-1.5 rounded-full border" />
          </button>
        </Tooltip>
      </div>
    </aside>
  );
}
