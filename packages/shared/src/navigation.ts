import { floorplan } from './floorplan';
import type { NavNode, Point2, Pose2 } from './types';

type Graph = {
  nodes: Map<string, NavNode>;
  adjacency: Map<string, { id: string; cost: number }[]>;
};

function distance(a: Point2, b: Point2) {
  return Math.hypot(b.x - a.x, b.z - a.z);
}

function buildGraph(): Graph {
  const nodes = new Map(floorplan.navNodes.map((node) => [node.id, node]));
  const adjacency = new Map<string, { id: string; cost: number }[]>();

  for (const node of floorplan.navNodes) {
    adjacency.set(node.id, []);
  }

  for (const edge of floorplan.navEdges) {
    const a = nodes.get(edge.a);
    const b = nodes.get(edge.b);
    if (!a || !b) continue;
    const cost = distance(a, b);
    adjacency.get(edge.a)?.push({ id: edge.b, cost });
    adjacency.get(edge.b)?.push({ id: edge.a, cost });
  }

  return { nodes, adjacency };
}

const graph = buildGraph();

export function nearestNode(pose: Point2): NavNode {
  let best = floorplan.navNodes[0]!;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const node of floorplan.navNodes) {
    const nextDistance = distance(pose, node);
    if (nextDistance < bestDistance) {
      best = node;
      bestDistance = nextDistance;
    }
  }

  return best;
}

export function findPath(startNodeId: string, goalNodeId: string): NavNode[] {
  const start = graph.nodes.get(startNodeId);
  const goal = graph.nodes.get(goalNodeId);

  if (!start || !goal) return [];
  if (startNodeId === goalNodeId) return [start];

  const open = new Set<string>([startNodeId]);
  const cameFrom = new Map<string, string>();
  const gScore = new Map<string, number>([[startNodeId, 0]]);
  const fScore = new Map<string, number>([[startNodeId, distance(start, goal)]]);

  while (open.size > 0) {
    let currentId: string | null = null;
    let currentScore = Number.POSITIVE_INFINITY;

    for (const id of open) {
      const score = fScore.get(id) ?? Number.POSITIVE_INFINITY;
      if (score < currentScore) {
        currentScore = score;
        currentId = id;
      }
    }

    if (!currentId) break;
    if (currentId === goalNodeId) {
      const path: NavNode[] = [];
      let cursor: string | undefined = currentId;
      while (cursor) {
        const node = graph.nodes.get(cursor);
        if (node) path.unshift(node);
        cursor = cameFrom.get(cursor);
      }
      return path;
    }

    open.delete(currentId);
    for (const neighbor of graph.adjacency.get(currentId) ?? []) {
      const tentative = (gScore.get(currentId) ?? Number.POSITIVE_INFINITY) + neighbor.cost;
      if (tentative < (gScore.get(neighbor.id) ?? Number.POSITIVE_INFINITY)) {
        cameFrom.set(neighbor.id, currentId);
        gScore.set(neighbor.id, tentative);
        fScore.set(neighbor.id, tentative + distance(graph.nodes.get(neighbor.id)!, goal));
        open.add(neighbor.id);
      }
    }
  }

  return [];
}

export function planRoute(start: Point2, goalNodeId: string): Point2[] {
  const startNode = nearestNode(start);
  const path = findPath(startNode.id, goalNodeId);
  if (path.length === 0) return [];
  return path.map(({ x, z }) => ({ x, z }));
}

export function routeLength(route: Point2[]): number {
  let total = 0;
  for (let i = 1; i < route.length; i += 1) {
    total += distance(route[i - 1]!, route[i]!);
  }
  return total;
}

export function pointInPolygon(point: Point2, polygon: Point2[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const a = polygon[i]!;
    const b = polygon[j]!;
    const intersects =
      a.z > point.z !== b.z > point.z &&
      point.x < ((b.x - a.x) * (point.z - a.z)) / (b.z - a.z || Number.EPSILON) + a.x;
    if (intersects) inside = !inside;
  }
  return inside;
}

export function normaliseAngle(angle: number): number {
  let value = angle;
  while (value > Math.PI) value -= Math.PI * 2;
  while (value < -Math.PI) value += Math.PI * 2;
  return value;
}

export function angleTowards(current: number, target: number, maxStep: number): number {
  const delta = normaliseAngle(target - current);
  if (Math.abs(delta) <= maxStep) return target;
  return current + Math.sign(delta) * maxStep;
}

export function moveTowardsPose(pose: Pose2, target: Point2, step: number) {
  const deltaX = target.x - pose.x;
  const deltaZ = target.z - pose.z;
  const distanceToTarget = Math.hypot(deltaX, deltaZ);
  if (distanceToTarget <= step || distanceToTarget === 0) {
    return { pose: { ...pose, x: target.x, z: target.z }, arrived: true };
  }
  const ratio = step / distanceToTarget;
  return {
    pose: {
      ...pose,
      x: pose.x + deltaX * ratio,
      z: pose.z + deltaZ * ratio,
      heading: Math.atan2(deltaZ, deltaX),
    },
    arrived: false,
  };
}
