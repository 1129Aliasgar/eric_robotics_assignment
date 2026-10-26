export type Point2 = {
  x: number;
  z: number;
};

export type Pose2 = Point2 & {
  heading: number;
};

export type WallKind = 'outer' | 'inner' | 'partition';

export type WallSegment = {
  id: string;
  kind: WallKind;
  a: Point2;
  b: Point2;
  thickness: number;
  height: number;
};

export type ZoneTone = 'pink' | 'muted';

export type FloorZone = {
  id: string;
  label: string;
  tone: ZoneTone;
  polygon: Point2[];
  labelAt: Point2;
  labelRotation?: number;
};

export type FurnitureKind = 'chair' | 'desk' | 'rack' | 'sink' | 'plant' | 'machine' | 'pallet';

export type FurnitureItem = {
  id: string;
  kind: FurnitureKind;
  x: number;
  z: number;
  rotation: number;
  scale?: number;
};

export type ObstacleCluster = {
  id: string;
  x: number;
  z: number;
  radius: number;
  count: number;
};

export type NavNode = Point2 & {
  id: string;
};

export type NavEdge = {
  a: string;
  b: string;
};

export type Goal = {
  id: string;
  name: string;
  description: string;
  nodeId: string;
  zoneId?: string;
};

export type Floorplan = {
  units: 'm';
  name: string;
  rotation: number;
  outerPolygon: Point2[];
  walls: WallSegment[];
  zones: FloorZone[];
  furniture: FurnitureItem[];
  obstacles: ObstacleCluster[];
  unmapped: Point2[][];
  navNodes: NavNode[];
  navEdges: NavEdge[];
  goals: Goal[];
  robotStart: Pose2;
};

export type RobotMode = 'auto' | 'manual';

export type MissionStatus = 'active' | 'paused' | 'estop' | 'complete' | 'idle';

export type SignalLevel = 'strong' | 'good' | 'weak' | 'lost';

export type HealthState = 'okay' | 'warning' | 'error';

export type MissionState = {
  id: number;
  status: MissionStatus;
  goalId: string | null;
  startedAt: string | null;
  elapsedSeconds: number;
  progress: number;
};

export type RobotState = {
  pose: Pose2;
  velocity: {
    linear: number;
    angular: number;
  };
  mode: RobotMode;
  odometer: number;
};

export type Health = {
  battery: number;
  signal: SignalLevel;
  signalBars: number;
  failsafe: 'okay' | 'triggered';
  system: HealthState;
};

export type TelemetryState = {
  sequence: number;
  serverTime: string;
  mission: MissionState;
  robot: RobotState;
  health: Health;
  goal: {
    id: string | null;
    name: string | null;
    route: Point2[];
    waypointIndex: number;
  };
};

export type MissionEvent = {
  id: string;
  at: string;
  level: 'info' | 'success' | 'warning' | 'danger';
  message: string;
};

export type ApiErrorPayload = {
  error: {
    code: string;
    message: string;
    requestId: string;
  };
};

export type ApiSuccess<T> = {
  ok: true;
  data: T;
};

export type ApiResult<T> = ApiSuccess<T> | { ok: false; error: ApiErrorPayload['error'] };
