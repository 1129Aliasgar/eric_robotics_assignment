import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from './app';

describe('Insight telemetry API', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp({ logger: false, serveWeb: false });
  });

  afterAll(async () => {
    await app.close();
  });

  it('reports service health', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/health' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      ok: true,
      data: { status: 'ok', service: 'insight-telemetry' },
    });
  });

  it('returns the current telemetry snapshot', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/state' });
    const body = response.json();

    expect(response.statusCode).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.data).toMatchObject({
      mission: { id: 1234, status: 'active', goalId: 'storage-1' },
      robot: { mode: 'auto' },
      goal: { id: 'storage-1', name: 'Storage 1' },
    });
  });

  it('validates command payloads', async () => {
    const missingGoal = await app.inject({
      method: 'POST',
      url: '/api/mission/goal',
      payload: {},
    });
    expect(missingGoal.statusCode).toBe(400);
    expect(missingGoal.json().error.code).toBe('VALIDATION_ERROR');

    const invalidMode = await app.inject({
      method: 'POST',
      url: '/api/robot/mode',
      payload: { mode: 'turbo' },
    });
    expect(invalidMode.statusCode).toBe(400);
    expect(invalidMode.json().error.code).toBe('VALIDATION_ERROR');

    const invalidVelocity = await app.inject({
      method: 'POST',
      url: '/api/robot/velocity',
      payload: { linear: 4, angular: 0 },
    });
    expect(invalidVelocity.statusCode).toBe(400);
  });

  it('rejects unknown goals with a structured error', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/mission/goal',
      payload: { goalId: 'moon-base' },
    });

    expect(response.statusCode).toBe(404);
    expect(response.json().error).toMatchObject({
      code: 'GOAL_NOT_FOUND',
      message: expect.stringContaining('moon-base'),
    });
  });

  it('accepts goal, mode, and velocity commands', async () => {
    const goal = await app.inject({
      method: 'POST',
      url: '/api/mission/goal',
      payload: { goalId: 'office' },
    });
    expect(goal.statusCode).toBe(200);
    expect(goal.json().data.goal.id).toBe('office');

    const rejectedVelocity = await app.inject({
      method: 'POST',
      url: '/api/robot/velocity',
      payload: { linear: 0.4, angular: 0 },
    });
    expect(rejectedVelocity.statusCode).toBe(409);
    expect(rejectedVelocity.json().error.code).toBe('AUTO_MODE');

    const manual = await app.inject({
      method: 'POST',
      url: '/api/robot/mode',
      payload: { mode: 'manual' },
    });
    expect(manual.statusCode).toBe(200);
    expect(manual.json().data.robot.mode).toBe('manual');

    const velocity = await app.inject({
      method: 'POST',
      url: '/api/robot/velocity',
      payload: { linear: 0.4, angular: -0.2 },
    });
    expect(velocity.statusCode).toBe(200);
    expect(velocity.json().data.robot.mode).toBe('manual');
  });

  it('handles the emergency stop lifecycle over HTTP', async () => {
    const stop = await app.inject({ method: 'POST', url: '/api/emergency/stop' });
    expect(stop.statusCode).toBe(200);
    expect(stop.json().data.mission.status).toBe('estop');
    expect(stop.json().data.health.failsafe).toBe('triggered');

    const reset = await app.inject({ method: 'POST', url: '/api/emergency/reset' });
    expect(reset.statusCode).toBe(200);
    expect(reset.json().data.mission.status).toBe('paused');
    expect(reset.json().data.health.failsafe).toBe('okay');

    const resume = await app.inject({ method: 'POST', url: '/api/mission/resume' });
    expect(resume.statusCode).toBe(200);
    expect(resume.json().data.mission.status).toBe('active');
  });

  it('returns a 404 for unknown api routes when the web bundle is disabled', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/does-not-exist' });
    expect(response.statusCode).toBe(404);
    expect(response.json().error.code).toBe('NOT_FOUND');
  });
});
