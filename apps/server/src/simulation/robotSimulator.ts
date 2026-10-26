import {
  angleTowards,
  findPath,
  findGoal,
  floorplan,
  nearestNode,
  normaliseAngle,
  planRoute,
  pointInPolygon,
  routeLength,
} from '@insight/shared';
import type {
  Health,
  MissionStatus,
  Point2,
  Pose2,
  RobotMode,
  SignalLevel,
  TelemetryState,
} from '@insight/shared';
import { AppError } from '../errors';

type Listener = (state: TelemetryState) => void;

const MIN_MISSION_ID = 1234;
const AUTO_SPEED = 0.72;
const MANUAL_SPEED = 1.15;
const MANUAL_TURN = 1.35;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function distance(a: Point2, b: Point2) {
  return Math.hypot(b.x - a.x, b.z - a.z);
}

function signalFor(pose: Point2): { signal: SignalLevel; bars: number } {
  const accessPoints: Point2[] = [
    { x: 16, z: 22 },
    { x: 24, z: 40 },
    { x: 36, z: 26 },
  ];
  const nearest = Math.min(...accessPoints.map((point) => distance(pose, point)));
  if (nearest < 14) return { signal: 'strong', bars: 4 };
  if (nearest < 22) return { signal: 'good', bars: 3 };
  if (nearest < 30) return { signal: 'weak', bars: 2 };
  return { signal: 'lost', bars: 0 };
}

export class RobotSimulator {
  private readonly listeners = new Set<Listener>();
  private timer: NodeJS.Timeout | null = null;
  private sequence = 0;

  private pose: Pose2;
  private mode: RobotMode = 'auto';
  private missionId = MIN_MISSION_ID;
  private missionStatus: MissionStatus = 'active';
  private goalId: string | null = 'storage-1';
  private route: Point2[] = [];
  private waypointIndex = 0;
  private startedAt = Date.now();
  private completedElapsed = 0;
  private odometer = 0;
  private velocity = { linear: 0, angular: 0 };
  private targetVelocity = { linear: 0, angular: 0 };
  private failsafe: Health['failsafe'] = 'okay';
  private lastTick = Date.now();

  constructor() {
    this.pose = { ...floorplan.robotStart };
    this.planToGoal('storage-1');
    this.startedAt = Date.now();
  }

  start(intervalMs = 100) {
    if (this.timer) return;
    this.lastTick = Date.now();
    this.timer = setInterval(() => {
      const now = Date.now();
      const dt = clamp((now - this.lastTick) / 1000, 0.01, 0.3);
      this.lastTick = now;
      this.advance(dt);
      this.emit();
    }, intervalMs);
    this.timer.unref?.();
  }

  stop() {
    if (!this.timer) return;
    clearInterval(this.timer);
    this.timer = null;
  }

  subscribe(listener: Listener) {
    this.listeners.add(listener);
    listener(this.snapshot());
    return () => this.listeners.delete(listener);
  }

  getState(): TelemetryState {
    return this.snapshot();
  }

  advance(dt: number) {
    if (this.missionStatus !== 'active') {
      this.velocity.linear = 0;
      this.velocity.angular = 0;
      return;
    }

    if (this.mode === 'auto') {
      this.advanceAuto(dt);
    } else {
      this.advanceManual(dt);
    }
  }

  setMode(mode: RobotMode) {
    if (this.mode === mode) return this.snapshot();
    if (this.failsafe === 'triggered') {
      throw new AppError(409, 'ESTOP_ACTIVE', 'Reset the emergency stop before changing mode.');
    }
    this.mode = mode;
    this.velocity = { linear: 0, angular: 0 };
    this.targetVelocity = { linear: 0, angular: 0 };
    if (mode === 'auto' && this.missionStatus === 'active') {
      this.replanFromPose();
    }
    this.emit();
    return this.snapshot();
  }

  setGoal(goalId: string) {
    const goal = findGoal(goalId);
    if (!goal) throw new AppError(404, 'GOAL_NOT_FOUND', `Unknown goal: ${goalId}.`);
    const route = planRoute(this.pose, goal.nodeId);
    if (route.length === 0) {
      throw new AppError(409, 'ROUTE_UNAVAILABLE', 'No route is available to that goal.');
    }
    this.goalId = goalId;
    this.route = route;
    this.waypointIndex = 0;
    this.targetVelocity = { linear: 0, angular: 0 };
    this.emit();
    return this.snapshot();
  }

  initiate(goalId?: string) {
    if (this.failsafe === 'triggered') {
      throw new AppError(
        409,
        'ESTOP_ACTIVE',
        'Reset the emergency stop before initiating a mission.',
      );
    }
    if (goalId) {
      this.setGoal(goalId);
    }
    if (!this.goalId) {
      throw new AppError(409, 'NO_GOAL', 'Select a goal before initiating a mission.');
    }
    if (this.route.length === 0) {
      this.replanFromPose();
    }
    if (this.route.length === 0) {
      throw new AppError(409, 'ROUTE_UNAVAILABLE', 'No route is available to the selected goal.');
    }

    this.missionId += 1;
    this.missionStatus = 'active';
    this.mode = 'auto';
    this.startedAt = Date.now();
    this.completedElapsed = 0;
    this.waypointIndex = 0;
    this.velocity = { linear: 0, angular: 0 };
    this.targetVelocity = { linear: 0, angular: 0 };
    this.emit();
    return this.snapshot();
  }

  pause() {
    if (this.missionStatus !== 'active') {
      throw new AppError(409, 'MISSION_NOT_ACTIVE', 'There is no active mission to pause.');
    }
    this.missionStatus = 'paused';
    this.velocity = { linear: 0, angular: 0 };
    this.targetVelocity = { linear: 0, angular: 0 };
    this.emit();
    return this.snapshot();
  }

  resume() {
    if (this.failsafe === 'triggered') {
      throw new AppError(409, 'ESTOP_ACTIVE', 'Reset the emergency stop before resuming.');
    }
    if (this.missionStatus !== 'paused') {
      throw new AppError(409, 'MISSION_NOT_PAUSED', 'The mission is not paused.');
    }
    this.missionStatus = 'active';
    if (this.mode === 'auto') this.replanFromPose();
    this.emit();
    return this.snapshot();
  }

  setVelocity(linear: number, angular: number) {
    if (this.failsafe === 'triggered') {
      throw new AppError(
        409,
        'ESTOP_ACTIVE',
        'Manual driving is disabled during an emergency stop.',
      );
    }
    if (this.missionStatus !== 'active') {
      throw new AppError(409, 'MISSION_NOT_ACTIVE', 'Resume the mission before driving manually.');
    }
    if (this.mode !== 'manual') {
      throw new AppError(409, 'AUTO_MODE', 'Switch to manual mode to drive the robot.');
    }
    this.targetVelocity = {
      linear: clamp(linear, -1, 1),
      angular: clamp(angular, -1, 1),
    };
    return this.snapshot();
  }

  emergencyStop() {
    this.failsafe = 'triggered';
    this.missionStatus = 'estop';
    this.velocity = { linear: 0, angular: 0 };
    this.targetVelocity = { linear: 0, angular: 0 };
    this.completedElapsed = this.elapsedSeconds();
    this.emit();
    return this.snapshot();
  }

  resetEmergencyStop() {
    if (this.failsafe !== 'triggered') {
      throw new AppError(409, 'ESTOP_NOT_ACTIVE', 'The emergency stop is not active.');
    }
    this.failsafe = 'okay';
    this.missionStatus = 'paused';
    this.velocity = { linear: 0, angular: 0 };
    this.emit();
    return this.snapshot();
  }

  private advanceAuto(dt: number) {
    if (this.route.length === 0) {
      this.completeMission();
      return;
    }
    const target = this.route[this.waypointIndex] ?? this.route[this.route.length - 1]!;
    const deltaX = target.x - this.pose.x;
    const deltaZ = target.z - this.pose.z;
    const distanceToTarget = Math.hypot(deltaX, deltaZ);

    if (distanceToTarget < 0.22) {
      if (this.waypointIndex >= this.route.length - 1) {
        this.completeMission();
        return;
      }
      this.waypointIndex += 1;
      return;
    }

    const desiredHeading = Math.atan2(deltaZ, deltaX);
    this.pose.heading = angleTowards(this.pose.heading, desiredHeading, MANUAL_TURN * dt);

    const headingError = Math.abs(normaliseAngle(desiredHeading - this.pose.heading));
    const speed = AUTO_SPEED * clamp(1 - headingError / (Math.PI / 2), 0.18, 1);
    const step = Math.min(distanceToTarget, speed * dt);

    this.pose.x += Math.cos(this.pose.heading) * step;
    this.pose.z += Math.sin(this.pose.heading) * step;
    this.odometer += step;
    this.velocity = { linear: speed, angular: 0 };
    this.targetVelocity = { linear: speed, angular: 0 };
  }

  private advanceManual(dt: number) {
    const acceleration = 4.2 * dt;
    this.velocity.linear +=
      Math.sign(this.targetVelocity.linear - this.velocity.linear) *
      Math.min(acceleration, Math.abs(this.targetVelocity.linear - this.velocity.linear));
    this.velocity.angular +=
      Math.sign(this.targetVelocity.angular - this.velocity.angular) *
      Math.min(acceleration, Math.abs(this.targetVelocity.angular - this.velocity.angular));

    const nextHeading = this.pose.heading + this.velocity.angular * MANUAL_TURN * dt;
    const linear = this.velocity.linear * MANUAL_SPEED;
    const nextX = this.pose.x + Math.cos(nextHeading) * linear * dt;
    const nextZ = this.pose.z + Math.sin(nextHeading) * linear * dt;

    if (pointInPolygon({ x: nextX, z: nextZ }, floorplan.outerPolygon)) {
      this.pose.x = nextX;
      this.pose.z = nextZ;
      this.pose.heading = nextHeading;
      this.odometer += Math.abs(linear) * dt;
    } else {
      this.velocity = { linear: 0, angular: 0 };
      this.targetVelocity = { linear: 0, angular: 0 };
    }
  }

  private completeMission() {
    this.missionStatus = 'complete';
    this.completedElapsed = this.elapsedSeconds();
    this.velocity = { linear: 0, angular: 0 };
    this.targetVelocity = { linear: 0, angular: 0 };
    this.emit();
  }

  private replanFromPose() {
    if (!this.goalId) return;
    const goal = findGoal(this.goalId);
    if (!goal) return;
    const startNode = nearestNode(this.pose);
    const path = findPath(startNode.id, goal.nodeId);
    if (path.length === 0) return;
    this.route = path.map(({ x, z }) => ({ x, z }));
    this.waypointIndex = 0;
  }

  private planToGoal(goalId: string) {
    const goal = findGoal(goalId);
    if (!goal) return;
    this.goalId = goalId;
    this.route = planRoute(this.pose, goal.nodeId);
    this.waypointIndex = 0;
  }

  private elapsedSeconds() {
    if (this.missionStatus === 'active') {
      return Math.max(0, (Date.now() - this.startedAt) / 1000);
    }
    return Math.max(0, this.completedElapsed);
  }

  private progress() {
    if (this.missionStatus === 'complete') return 1;
    if (this.route.length <= 1) return 0;
    const total = routeLength(this.route);
    if (total === 0) return 0;
    const completed = routeLength(this.route.slice(0, this.waypointIndex + 1));
    return clamp(completed / total, 0, 1);
  }

  private battery() {
    return Math.round(clamp(100 - this.odometer * 0.035, 0, 100) * 10) / 10;
  }

  private snapshot(): TelemetryState {
    const signal = signalFor(this.pose);
    const goal = this.goalId ? findGoal(this.goalId) : null;
    return {
      sequence: this.sequence,
      serverTime: new Date().toISOString(),
      mission: {
        id: this.missionId,
        status: this.missionStatus,
        goalId: this.goalId,
        startedAt: new Date(this.startedAt).toISOString(),
        elapsedSeconds: Math.round(this.elapsedSeconds() * 10) / 10,
        progress: Math.round(this.progress() * 1000) / 1000,
      },
      robot: {
        pose: {
          x: Math.round(this.pose.x * 1000) / 1000,
          z: Math.round(this.pose.z * 1000) / 1000,
          heading: Math.round(this.pose.heading * 10000) / 10000,
        },
        velocity: {
          linear: Math.round(this.velocity.linear * 1000) / 1000,
          angular: Math.round(this.velocity.angular * 1000) / 1000,
        },
        mode: this.mode,
        odometer: Math.round(this.odometer * 100) / 100,
      },
      health: {
        battery: this.battery(),
        signal: signal.signal,
        signalBars: signal.bars,
        failsafe: this.failsafe,
        system: this.failsafe === 'triggered' ? 'warning' : 'okay',
      },
      goal: {
        id: goal?.id ?? null,
        name: goal?.name ?? null,
        route: this.route,
        waypointIndex: this.waypointIndex,
      },
    };
  }

  private emit() {
    this.sequence += 1;
    const state = this.snapshot();
    for (const listener of this.listeners) {
      try {
        listener(state);
      } catch {
        this.listeners.delete(listener);
      }
    }
  }
}
