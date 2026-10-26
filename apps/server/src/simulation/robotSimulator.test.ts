import { beforeEach, describe, expect, it } from 'vitest';
import { RobotSimulator } from './robotSimulator';

describe('RobotSimulator', () => {
  let simulator: RobotSimulator;

  beforeEach(() => {
    simulator = new RobotSimulator();
  });

  it('starts with a planned autonomous mission', () => {
    const state = simulator.getState();

    expect(state.mission.id).toBe(1234);
    expect(state.mission.status).toBe('active');
    expect(state.mission.goalId).toBe('storage-1');
    expect(state.robot.mode).toBe('auto');
    expect(state.goal.route.length).toBeGreaterThan(1);
    expect(state.health).toMatchObject({
      battery: 100,
      signal: 'strong',
      failsafe: 'okay',
      system: 'okay',
    });
  });

  it('moves the robot and completes an autonomous route', () => {
    for (let step = 0; step < 5000 && simulator.getState().mission.status === 'active'; step += 1) {
      simulator.advance(0.1);
    }

    const state = simulator.getState();
    expect(state.mission.status).toBe('complete');
    expect(state.mission.progress).toBe(1);
    expect(state.robot.odometer).toBeGreaterThan(0);
    expect(state.health.battery).toBeLessThan(100);
  });

  it('pauses and resumes the active mission', () => {
    expect(simulator.pause().mission.status).toBe('paused');
    expect(() => simulator.pause()).toThrow(/no active mission/i);
    expect(simulator.resume().mission.status).toBe('active');
    expect(() => simulator.resume()).toThrow(/not paused/i);
  });

  it('supports a complete emergency stop and reset cycle', () => {
    const stopped = simulator.emergencyStop();
    expect(stopped.mission.status).toBe('estop');
    expect(stopped.health.failsafe).toBe('triggered');
    expect(stopped.health.system).toBe('warning');
    expect(stopped.robot.velocity).toEqual({ linear: 0, angular: 0 });

    expect(() => simulator.setMode('manual')).toThrow(/reset the emergency stop/i);
    expect(() => simulator.setVelocity(0.5, 0)).toThrow(/emergency stop/i);
    expect(() => simulator.initiate()).toThrow(/reset the emergency stop/i);
    expect(() => simulator.resume()).toThrow(/reset the emergency stop/i);

    const reset = simulator.resetEmergencyStop();
    expect(reset.mission.status).toBe('paused');
    expect(reset.health.failsafe).toBe('okay');

    expect(() => simulator.resetEmergencyStop()).toThrow(/not active/i);
    expect(simulator.resume().mission.status).toBe('active');
  });

  it('switches goals without incrementing the mission', () => {
    const state = simulator.setGoal('office');
    expect(state.mission.id).toBe(1234);
    expect(state.mission.goalId).toBe('office');
    expect(state.goal.name).toBe('Office');
    expect(state.goal.route.at(-1)).toEqual(
      expect.objectContaining({ x: expect.any(Number), z: expect.any(Number) }),
    );

    expect(() => simulator.setGoal('missing-goal')).toThrow(/unknown goal/i);
  });

  it('initiates a new mission with a fresh id', () => {
    const state = simulator.initiate('charging');
    expect(state.mission.id).toBe(1235);
    expect(state.mission.status).toBe('active');
    expect(state.mission.goalId).toBe('charging');
    expect(state.robot.mode).toBe('auto');
  });

  it('requires manual mode and an active mission for manual driving', () => {
    expect(() => simulator.setVelocity(0.5, 0)).toThrow(/manual mode/i);

    simulator.setMode('manual');
    const before = simulator.getState().robot.pose;
    simulator.setVelocity(0.65, 0.2);
    simulator.advance(0.5);
    const after = simulator.getState().robot.pose;

    expect(after).not.toEqual(before);
    expect(after.x).not.toBe(before.x);

    simulator.pause();
    expect(() => simulator.setVelocity(0.5, 0)).toThrow(/resume the mission/i);
  });

  it('notifies subscribers and stops after unsubscribing', () => {
    const frames: number[] = [];
    const unsubscribe = simulator.subscribe((state) => frames.push(state.sequence));

    expect(frames.length).toBe(1);
    simulator.pause();
    expect(frames.length).toBe(2);
    unsubscribe();
    simulator.resume();
    expect(frames.length).toBe(2);
  });
});
