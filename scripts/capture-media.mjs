import { spawn } from 'node:child_process';
import { copyFile, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { chromium } from '@playwright/test';

const root = path.resolve(import.meta.dirname, '..');
const screenshotsDir = path.join(root, 'docs', 'screenshots');
const docsDir = path.join(root, 'docs');
const tempDir = path.join(root, '.media-tmp');
const port = 4010;
const baseUrl = `http://127.0.0.1:${port}`;

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: 'inherit', windowsHide: true });
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} exited with code ${code}`));
    });
  });
}

async function waitForServer(timeoutMs = 20_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(`${baseUrl}/api/health`);
      if (response.ok) return;
    } catch {
      // Server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error('Timed out waiting for the production server.');
}

async function waitForMap(page) {
  await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded' });
  await page.locator('canvas').waitFor({ state: 'visible', timeout: 20_000 });
}

async function startDemoMission() {
  const state = await fetch(`${baseUrl}/api/state`).then((response) => response.json());
  if (state.data.health.failsafe === 'triggered') {
    await fetch(`${baseUrl}/api/emergency/reset`, { method: 'POST' });
  }
  await fetch(`${baseUrl}/api/mission/initiate`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ goalId: 'storage-1' }),
  });
}

async function main() {
  await mkdir(screenshotsDir, { recursive: true });
  await rm(tempDir, { recursive: true, force: true });
  await mkdir(tempDir, { recursive: true });

  const server = spawn(process.execPath, ['apps/server/dist/server.js'], {
    cwd: root,
    env: { ...process.env, PORT: String(port), HOST: '127.0.0.1' },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });
  server.stdout.resume();
  server.stderr.resume();

  let browser;
  try {
    await waitForServer();
    browser = await chromium.launch();

    const desktop = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      colorScheme: 'dark',
    });
    const desktopPage = await desktop.newPage();
    await waitForMap(desktopPage);
    await desktopPage.waitForTimeout(11_000);
    await desktopPage.screenshot({
      path: path.join(screenshotsDir, 'desktop-map.png'),
      fullPage: false,
    });

    await desktopPage.getByRole('button', { name: 'Click to enter camera view' }).click();
    await desktopPage.waitForTimeout(2_000);
    await desktopPage.screenshot({
      path: path.join(screenshotsDir, 'desktop-camera.png'),
      fullPage: false,
    });
    await desktop.close();

    await startDemoMission();

    const mobile = await browser.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
      colorScheme: 'dark',
    });
    const mobilePage = await mobile.newPage();
    await waitForMap(mobilePage);
    await mobilePage.waitForTimeout(9_000);
    await mobilePage.screenshot({
      path: path.join(screenshotsDir, 'mobile-map.png'),
      fullPage: false,
    });
    await mobilePage.getByRole('button', { name: 'Click to enter camera view' }).click();
    await mobilePage.waitForTimeout(2_000);
    await mobilePage.screenshot({
      path: path.join(screenshotsDir, 'mobile-camera.png'),
      fullPage: false,
    });
    await mobile.close();

    await startDemoMission();

    const videoContext = await browser.newContext({
      viewport: { width: 1280, height: 720 },
      recordVideo: { dir: tempDir, size: { width: 1280, height: 720 } },
      colorScheme: 'dark',
    });
    const videoPage = await videoContext.newPage();
    await waitForMap(videoPage);
    await videoPage.waitForTimeout(4_000);
    await videoPage.getByRole('button', { name: 'Click to enter camera view' }).click();
    await videoPage.waitForTimeout(4_000);
    await videoPage.getByRole('button', { name: 'Click to open map view' }).click();
    await videoPage.waitForTimeout(2_000);
    const video = videoPage.video();
    await videoContext.close();
    const recordedPath = await video.path();
    const webmPath = path.join(tempDir, 'demo.webm');
    await copyFile(recordedPath, webmPath);

    await run('ffmpeg', [
      '-y',
      '-i',
      webmPath,
      '-ss',
      '1.8',
      '-vf',
      'scale=1280:-2,fps=30',
      '-c:v',
      'libx264',
      '-preset',
      'slow',
      '-crf',
      '23',
      '-pix_fmt',
      'yuv420p',
      '-movflags',
      '+faststart',
      path.join(docsDir, 'demo.mp4'),
    ]);

    await run('ffmpeg', [
      '-y',
      '-i',
      webmPath,
      '-ss',
      '1.8',
      '-vf',
      'fps=8,scale=640:-1:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=48:stats_mode=diff[p];[s1][p]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle',
      '-loop',
      '0',
      path.join(docsDir, 'demo.gif'),
    ]);

    for (const name of ['desktop-map', 'desktop-camera', 'mobile-map', 'mobile-camera']) {
      const pngPath = path.join(screenshotsDir, `${name}.png`);
      await run('ffmpeg', [
        '-y',
        '-i',
        pngPath,
        '-c:v',
        'libwebp',
        '-quality',
        '88',
        path.join(screenshotsDir, `${name}.webp`),
      ]);
      await rm(pngPath, { force: true });
    }

    console.log('Captured screenshots and demo media in docs/.');
  } finally {
    await browser?.close();
    server.kill();
    await new Promise((resolve) => {
      server.once('exit', resolve);
      setTimeout(resolve, 2_000);
    });
    await rm(tempDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
