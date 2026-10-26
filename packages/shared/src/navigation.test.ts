import { describe, expect, it } from 'vitest';
import { findGoal, floorplan } from './floorplan';
import {
  angleTowards,
  findPath,
  nearestNode,
  normaliseAngle,
  planRoute,
  pointInPolygon,
  routeLength,
} from './navigation';

describe('navigation graph', () => {
  it('finds a route from the dock to every configured goal', () => {
    const start = nearestNode(floorplan.robotStart);

    for (const goal of floorplan.goals) {
      const path = findPath(start.id, goal.nodeId);
      expect(path.length, `${goal.id} should be reachable`).toBeGreaterThan(1);
      expect(path[0]?.id).toBe(start.id);
      expect(path.at(-1)?.id).toBe(goal.nodeId);
    }
  });

  it('returns an empty path for unknown nodes', () => {
    expect(findPath('n0', 'missing-node')).toEqual([]);
    expect(findPath('missing-node', 'n0')).toEqual([]);
  });

  it('plans a route that starts on the graph and lands on the goal node', () => {
    const goal = findGoal('storage-1');
    expect(goal).not.toBeNull();

    const route = planRoute(floorplan.robotStart, goal!.nodeId);
    const startNode = nearestNode(floorplan.robotStart);
    const goalNode = floorplan.navNodes.find((node) => node.id === goal!.nodeId);

    expect(route.length).toBeGreaterThan(1);
    expect(route[0]).toEqual({ x: startNode.x, z: startNode.z });
    expect(route.at(-1)).toEqual({ x: goalNode?.x, z: goalNode?.z });
  });

  it('calculates the total route length', () => {
    expect(routeLength([])).toBe(0);
    expect(routeLength([{ x: 0, z: 0 }])).toBe(0);
    expect(
      routeLength([
        { x: 0, z: 0 },
        { x: 3, z: 4 },
      ]),
    ).toBe(5);
  });
});

describe('geometry helpers', () => {
  it('detects points inside and outside the facility', () => {
    expect(pointInPolygon({ x: 23.5, z: 28.5 }, floorplan.outerPolygon)).toBe(true);
    expect(pointInPolygon({ x: -50, z: -50 }, floorplan.outerPolygon)).toBe(false);
  });

  it('normalises angles into the short path', () => {
    expect(normaliseAngle((Math.PI * 5) / 2)).toBeCloseTo(Math.PI / 2);
    expect(normaliseAngle((-Math.PI * 5) / 2)).toBeCloseTo(-Math.PI / 2);
  });

  it('turns toward a target without overshooting', () => {
    expect(angleTowards(0, Math.PI / 2, 0.1)).toBeCloseTo(0.1);
    expect(angleTowards(0, 0.05, 0.1)).toBe(0.05);
    expect(angleTowards(3, -3, 0.2)).toBeCloseTo(3.2);
  });
});
