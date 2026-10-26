import { floorplan, planRoute, routeLength } from '@insight/shared';
import type { Goal, Point2, Pose2 } from '@insight/shared';
import { formatEta, formatMeters } from './format';

export function findGoal(goalId: string | null | undefined): Goal | null {
  if (!goalId) return null;
  return floorplan.goals.find((goal) => goal.id === goalId) ?? null;
}

export function goalNode(goal: Goal) {
  return floorplan.navNodes.find((node) => node.id === goal.nodeId) ?? null;
}

export function estimateGoal(pose: Pose2, goal: Goal) {
  const route = planRoute(pose, goal.nodeId);
  const first = route[0];
  const lead = first ? Math.hypot(first.x - pose.x, first.z - pose.z) : 0;
  const distance = route.length > 0 ? routeLength(route) + lead : Number.POSITIVE_INFINITY;
  const eta = distance / 0.72 + 6;

  return {
    distance,
    eta,
    distanceLabel: formatMeters(distance),
    etaLabel: formatEta(eta),
  };
}

export function zoneLabelForGoal(goal: Goal) {
  const zone = floorplan.zones.find((item) => item.id === goal.zoneId);
  return zone?.label ?? goal.name.toUpperCase();
}

export function distanceBetween(a: Point2, b: Point2) {
  return Math.hypot(b.x - a.x, b.z - a.z);
}

export function headingDegrees(heading: number) {
  return ((heading * 180) / Math.PI + 360) % 360;
}
