import { CanvasTexture, SRGBColorSpace } from 'three';
import type { FurnitureKind } from '@insight/shared';

const INK = '#1a242f';
const PAPER = '#fbfaf7';
const STEEL = '#6d7480';
const BLUSH = '#e7c7cb';

function canvas(size = 256) {
  const element = document.createElement('canvas');
  element.width = size;
  element.height = size;
  const context = element.getContext('2d');
  if (!context) throw new Error('Canvas 2D context is unavailable.');
  return { element, context };
}

function finish(element: HTMLCanvasElement) {
  const texture = new CanvasTexture(element);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 4;
  texture.needsUpdate = true;
  return texture;
}

function roundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  context.beginPath();
  context.roundRect(x, y, width, height, radius);
}

export function createLabelTexture(label: string, options?: { color?: string; size?: number }) {
  const width = 640;
  const height = 160;
  const element = document.createElement('canvas');
  element.width = width;
  element.height = height;
  const context = element.getContext('2d');
  if (!context) throw new Error('Canvas 2D context is unavailable.');

  context.clearRect(0, 0, width, height);
  context.fillStyle = options?.color ?? '#7c666a';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.font = `650 ${options?.size ?? 56}px "Inter Variable", Inter, sans-serif`;
  context.letterSpacing = '4px';
  context.fillText(label, width / 2, height / 2 + 2);

  return finish(element);
}

export function createFurnitureTexture(kind: FurnitureKind) {
  const { element, context } = canvas(256);
  context.clearRect(0, 0, 256, 256);
  context.lineWidth = 9;
  context.strokeStyle = INK;
  context.fillStyle = PAPER;
  context.lineJoin = 'round';
  context.lineCap = 'round';

  switch (kind) {
    case 'chair': {
      context.save();
      context.translate(128, 132);
      context.rotate(-0.04);
      roundedRect(context, -52, -52, 104, 104, 26);
      context.fill();
      context.stroke();
      roundedRect(context, -52, -76, 104, 22, 10);
      context.fill();
      context.stroke();
      context.restore();
      break;
    }
    case 'desk': {
      roundedRect(context, 34, 76, 188, 104, 12);
      context.fill();
      context.stroke();
      context.strokeStyle = STEEL;
      context.lineWidth = 5;
      context.beginPath();
      context.moveTo(62, 168);
      context.lineTo(62, 188);
      context.moveTo(194, 168);
      context.lineTo(194, 188);
      context.stroke();
      roundedRect(context, 100, 92, 56, 33, 5);
      context.fillStyle = INK;
      context.fill();
      context.fillStyle = PAPER;
      roundedRect(context, 108, 100, 40, 17, 3);
      context.fill();
      break;
    }
    case 'rack': {
      roundedRect(context, 28, 58, 200, 140, 8);
      context.fill();
      context.stroke();
      context.strokeStyle = STEEL;
      context.lineWidth = 5;
      for (let row = 0; row < 4; row += 1) {
        const y = 82 + row * 33;
        context.beginPath();
        context.moveTo(42, y);
        context.lineTo(214, y);
        context.stroke();
      }
      context.strokeStyle = INK;
      context.lineWidth = 7;
      context.beginPath();
      context.moveTo(46, 198);
      context.lineTo(46, 216);
      context.moveTo(210, 198);
      context.lineTo(210, 216);
      context.stroke();
      break;
    }
    case 'sink': {
      roundedRect(context, 38, 62, 180, 130, 20);
      context.fill();
      context.stroke();
      context.fillStyle = '#e6e8e8';
      context.beginPath();
      context.ellipse(128, 132, 55, 36, 0, 0, Math.PI * 2);
      context.fill();
      context.stroke();
      context.strokeStyle = STEEL;
      context.lineWidth = 6;
      context.beginPath();
      context.arc(128, 88, 22, Math.PI * 0.1, Math.PI * 0.9);
      context.stroke();
      context.fillStyle = INK;
      context.beginPath();
      context.arc(128, 128, 6, 0, Math.PI * 2);
      context.fill();
      break;
    }
    case 'plant': {
      context.fillStyle = '#e6e4de';
      context.beginPath();
      context.arc(128, 128, 62, 0, Math.PI * 2);
      context.fill();
      context.stroke();
      context.fillStyle = '#8d9b83';
      context.strokeStyle = '#4c5d48';
      context.lineWidth = 5;
      const leaves = [
        [128, 88, 34],
        [92, 122, 27],
        [160, 121, 29],
        [112, 160, 25],
        [147, 158, 26],
      ] as const;
      for (const [x, y, r] of leaves) {
        context.beginPath();
        context.ellipse(x, y, r, r * 0.85, x * 0.01, 0, Math.PI * 2);
        context.fill();
        context.stroke();
      }
      break;
    }
    case 'machine': {
      roundedRect(context, 52, 52, 152, 152, 18);
      context.fill();
      context.stroke();
      context.fillStyle = '#2b3540';
      roundedRect(context, 78, 78, 100, 46, 6);
      context.fill();
      context.fillStyle = '#f6f4ef';
      context.fillRect(88, 88, 38, 10);
      context.fillRect(88, 103, 56, 8);
      context.strokeStyle = STEEL;
      context.lineWidth = 5;
      context.beginPath();
      context.arc(128, 160, 22, 0, Math.PI * 2);
      context.stroke();
      context.beginPath();
      context.arc(128, 160, 6, 0, Math.PI * 2);
      context.stroke();
      break;
    }
    case 'pallet': {
      context.fillStyle = '#edeae3';
      roundedRect(context, 44, 72, 168, 112, 5);
      context.fill();
      context.stroke();
      context.strokeStyle = STEEL;
      context.lineWidth = 6;
      for (let row = 0; row < 4; row += 1) {
        const y = 88 + row * 28;
        context.beginPath();
        context.moveTo(52, y);
        context.lineTo(204, y);
        context.stroke();
      }
      context.strokeStyle = INK;
      context.lineWidth = 7;
      context.strokeRect(44, 72, 168, 112);
      break;
    }
    default:
      break;
  }

  return finish(element);
}

export function createRobotTexture() {
  const { element, context } = canvas(256);
  context.clearRect(0, 0, 256, 256);
  context.strokeStyle = INK;
  context.fillStyle = PAPER;
  context.lineWidth = 6;
  context.lineJoin = 'round';

  context.save();
  context.translate(128, 126);

  context.fillStyle = '#131c26';
  context.strokeStyle = '#131c26';
  for (const [x, y] of [
    [-74, -43],
    [58, -43],
    [-74, 23],
    [58, 23],
  ] as const) {
    roundedRect(context, x, y, 16, 34, 8);
    context.fill();
  }

  context.fillStyle = PAPER;
  context.strokeStyle = INK;
  roundedRect(context, -58, -68, 116, 126, 30);
  context.fill();
  context.stroke();

  context.fillStyle = '#222d38';
  roundedRect(context, -43, -51, 86, 31, 8);
  context.fill();

  context.fillStyle = '#f3c312';
  context.beginPath();
  context.arc(-23, -36, 5, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = '#ce2431';
  context.beginPath();
  context.arc(23, -36, 5, 0, Math.PI * 2);
  context.fill();

  context.strokeStyle = '#3e4a57';
  context.lineWidth = 4;
  context.beginPath();
  context.moveTo(-30, -6);
  context.lineTo(30, -6);
  context.moveTo(-30, 10);
  context.lineTo(30, 10);
  context.stroke();

  context.fillStyle = '#e8e5de';
  context.strokeStyle = INK;
  context.lineWidth = 5;
  context.beginPath();
  context.arc(0, 34, 16, 0, Math.PI * 2);
  context.fill();
  context.stroke();

  context.strokeStyle = INK;
  context.lineWidth = 5;
  context.beginPath();
  context.moveTo(0, -68);
  context.lineTo(0, -92);
  context.stroke();
  context.fillStyle = '#f3c312';
  context.beginPath();
  context.arc(0, -96, 8, 0, Math.PI * 2);
  context.fill();

  context.restore();

  return finish(element);
}

export function createScanTexture() {
  const element = document.createElement('canvas');
  element.width = 32;
  element.height = 256;
  const context = element.getContext('2d');
  if (!context) throw new Error('Canvas 2D context is unavailable.');

  const gradient = context.createLinearGradient(0, 0, 0, 256);
  gradient.addColorStop(0, 'rgba(35, 197, 94, 0)');
  gradient.addColorStop(0.72, 'rgba(35, 197, 94, 0.08)');
  gradient.addColorStop(0.94, 'rgba(35, 197, 94, 0.5)');
  gradient.addColorStop(1, 'rgba(35, 197, 94, 0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, 32, 256);

  const texture = new CanvasTexture(element);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

export function createSoftShadowTexture() {
  const { element, context } = canvas(128);
  const gradient = context.createRadialGradient(64, 64, 4, 64, 64, 62);
  gradient.addColorStop(0, 'rgba(13, 20, 31, 0.3)');
  gradient.addColorStop(0.55, 'rgba(13, 20, 31, 0.12)');
  gradient.addColorStop(1, 'rgba(13, 20, 31, 0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, 128, 128);

  const texture = new CanvasTexture(element);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

export { BLUSH };
