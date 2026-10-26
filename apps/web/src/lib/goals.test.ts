import { describe, expect, it } from 'vitest';
import { floorplan } from '@insight/shared';
import {
  distanceBetween,
  estimateGoal,
  findGoal,
  goalNode,
  headingDegrees,
  zoneLabelForGoal,
} from './goals';

describe('goal helpers', () => {
  it('finds known goals and rejects unknown ids', () => {
    expect(findGoal('storage-1')?.name).toBe('Storage 1');
    expect(findGoal(null)).toBeNull();
    expect(findGoal('missing')).toBeNull();
  });

  it('resolves a goal nav node and zone label', () => {
    const goal = findGoal('storage-1');
    expect(goal).not.toBeNull();
    expect(goalNode(goal!)).toMatchObject({ id: 'n5' });
    expect(zoneLabelForGoal(goal!)).toBe('STORAGE 1');
  });

  it('estimates a plausible route from the robot start', () => {
    const goal = findGoal('storage-1');
    const estimate = estimateGoal(floorplan.robotStart, goal!);

    expect(estimate.distance).toBeGreaterThan(0);
    expect(estimate.eta).toBeGreaterThan(estimate.distance / 0.72);
    expect(estimate.distanceLabel).toMatch(/m$/);
    expect(estimate.etaLabel).toMatch(/^~/);
  });

  it('converts headings to compass degrees', () => {
    expect(headingDegrees(0)).toBe(0);
    expect(headingDegrees(Math.PI / 2)).toBeCloseTo(90);
    expect(headingDegrees(-Math.PI / 2)).toBeCloseTo(270);
  });

  it('calculates planar distance', () => {
    expect(distanceBetween({ x: 0, z: 0 }, { x: 3, z: 4 })).toBe(5);
  });
});
