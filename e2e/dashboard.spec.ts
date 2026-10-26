import { expect, test } from '@playwright/test';
import type { APIRequestContext } from '@playwright/test';

type Telemetry = {
  mission: {
    id: number;
    status: string;
    goalId: string | null;
  };
  robot: { mode: 'auto' | 'manual' };
  health: { failsafe: 'okay' | 'triggered' };
};

async function readState(request: APIRequestContext): Promise<Telemetry> {
  const response = await request.get('/api/state');
  expect(response.ok()).toBeTruthy();
  const body = await response.json();
  return body.data as Telemetry;
}

async function ensureActiveMission(request: APIRequestContext): Promise<Telemetry> {
  let state = await readState(request);

  if (state.health.failsafe === 'triggered') {
    await request.post('/api/emergency/reset');
    state = await readState(request);
  }
  if (state.mission.status === 'paused') {
    await request.post('/api/mission/resume');
    state = await readState(request);
  }
  if (state.mission.status === 'complete') {
    await request.post('/api/mission/initiate', {
      data: { goalId: state.mission.goalId ?? 'storage-1' },
    });
    state = await readState(request);
  }
  if (state.robot.mode !== 'auto') {
    await request.post('/api/robot/mode', { data: { mode: 'auto' } });
    state = await readState(request);
  }

  return state;
}

test.describe('Insight.IO dashboard', () => {
  test('loads the map and swaps between camera and map views', async ({ page, request }) => {
    const state = await ensureActiveMission(request);

    await page.goto('/');
    await expect(page.getByRole('heading', { name: /Insight.IO/i })).toBeAttached();
    await expect(page.getByText(`On Mission ${state.mission.id}`)).toBeVisible();
    await expect(page.locator('canvas')).toBeVisible({ timeout: 20_000 });

    const enterCamera = page.getByRole('button', { name: 'Click to enter camera view' });
    await expect(enterCamera).toBeVisible();
    await enterCamera.click();
    await expect(page.getByRole('button', { name: 'Click to open map view' })).toBeVisible();

    await page.getByRole('button', { name: 'Click to open map view' }).click();
    await expect(enterCamera).toBeVisible();

    await page.keyboard.press('KeyV');
    await expect(page.getByRole('button', { name: 'Click to open map view' })).toBeVisible();
    await page.keyboard.press('KeyV');
    await expect(enterCamera).toBeVisible();
  });

  test('retargets a goal and completes the emergency reset flow', async ({ page, request }) => {
    const state = await ensureActiveMission(request);

    await page.goto('/');
    await expect(page.locator('canvas')).toBeVisible({ timeout: 20_000 });
    await page.getByRole('button', { name: 'Open quick goal selector' }).click();

    const goalDialog = page.getByRole('dialog', { name: 'Quick goal' });
    await expect(goalDialog).toBeVisible();
    await goalDialog.getByRole('button', { name: /Tool Crib/ }).click();
    await goalDialog.getByRole('button', { name: 'Set goal' }).click();

    await expect(page.getByText('Route updated to Tool Crib.')).toBeVisible();
    await expect(goalDialog).toBeHidden();

    await page.getByRole('button', { name: 'Emergency stop' }).click();
    await expect(page.getByText('Emergency Stop', { exact: true })).toBeVisible();

    await page.getByRole('button', { name: 'Reset emergency stop' }).last().click();
    const resetDialog = page.getByRole('dialog', { name: 'Reset emergency stop?' });
    await expect(resetDialog).toBeVisible();
    await expect(resetDialog.getByText(new RegExp(`mission #${state.mission.id}`))).toBeVisible();
    await resetDialog.getByRole('button', { name: 'Reset drive' }).click();

    await expect(page.getByText('Mission Paused', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Resume mission (Space)' }).click();
    await expect(page.getByText(`On Mission ${state.mission.id}`)).toBeVisible();
  });

  test('keeps the dashboard usable on a phone viewport', async ({ page, request }) => {
    await ensureActiveMission(request);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');

    await expect(page.locator('canvas')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('button', { name: 'Open quick goal selector' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Click to enter camera view' })).toBeVisible();

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);

    await page.getByRole('button', { name: 'Open quick goal selector' }).click();
    await expect(page.getByRole('dialog', { name: 'Quick goal' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toBeHidden();
  });
});
