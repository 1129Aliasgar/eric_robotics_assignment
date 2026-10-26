import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { floorplan } from '../packages/shared/src/floorplan';
import { pointInPolygon } from '../packages/shared/src/navigation';
import type { Point2 } from '../packages/shared/src/types';

type Sample = {
  x: number;
  y: number;
  z: number;
  rgb: number;
  intensity: number;
};

const here = dirname(fileURLToPath(import.meta.url));
const outputPath = resolve(here, '../apps/web/public/map/insight-floor.pcd');

function mulberry32(seed: number) {
  return () => {
    let value = (seed += 0x6d2b79f5);
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

const random = mulberry32(0x1a2b3c4d);
const samples: Sample[] = [];

function range(min: number, max: number) {
  return min + random() * (max - min);
}

function packRgb(r: number, g: number, b: number) {
  const clamp = (value: number) => Math.max(0, Math.min(255, Math.round(value)));
  return ((clamp(r) << 16) | (clamp(g) << 8) | clamp(b)) >>> 0;
}

function addFloorPoint(x: number, z: number) {
  const tone = range(-4, 3);
  samples.push({
    x: x + range(-0.035, 0.035),
    y: range(0.005, 0.035),
    z: z + range(-0.035, 0.035),
    rgb: packRgb(244 + tone, 244 + tone, 240 + tone),
    intensity: range(0.82, 1),
  });
}

function addWallPoint(x: number, z: number, y: number, tint = 0) {
  const tone = range(-7, 9);
  samples.push({
    x,
    y,
    z,
    rgb: packRgb(17 + tone + tint, 19 + tone + tint, 23 + tone + tint),
    intensity: range(0.04, 0.22),
  });
}

function addObstaclePoint(cluster: (typeof floorplan.obstacles)[number]) {
  const angle = range(0, Math.PI * 2);
  const radius = Math.sqrt(random()) * cluster.radius;
  samples.push({
    x: cluster.x + Math.cos(angle) * radius + range(-0.04, 0.04),
    y: range(0.04, 0.55),
    z: cluster.z + Math.sin(angle) * radius + range(-0.04, 0.04),
    rgb: packRgb(range(196, 225), range(28, 48), range(40, 62)),
    intensity: range(0.88, 1),
  });
}

function addDebris() {
  const bounds = { minX: 3, maxX: 44, minZ: 0, maxZ: 58 };
  const candidate: Point2 = {
    x: range(bounds.minX, bounds.maxX),
    z: range(bounds.minZ, bounds.maxZ),
  };
  if (!pointInPolygon(candidate, floorplan.outerPolygon)) return;
  const tone = range(22, 60);
  samples.push({
    x: candidate.x,
    y: range(0.02, 0.18),
    z: candidate.z,
    rgb: packRgb(tone, tone + 2, tone + 5),
    intensity: range(0.12, 0.35),
  });
}

// Dense, slightly noisy floor grid. The floor mesh underneath keeps the map clean;
// these points add the scanned/LiDAR texture visible in the reference.
for (let x = 3.4; x < 44; x += 0.26) {
  for (let z = 0.2; z < 58; z += 0.26) {
    const point = { x, z };
    if (pointInPolygon(point, floorplan.outerPolygon)) {
      if (random() < 0.82) addFloorPoint(x, z);
    }
  }
}

// Sample both faces of every wall segment, then extrude a small height profile.
for (const wall of floorplan.walls) {
  const dx = wall.b.x - wall.a.x;
  const dz = wall.b.z - wall.a.z;
  const length = Math.hypot(dx, dz);
  if (length === 0) continue;
  const nx = -dz / length;
  const nz = dx / length;
  const step = wall.kind === 'outer' ? 0.055 : 0.07;

  for (let travel = 0; travel <= length; travel += step) {
    const ratio = travel / length;
    const baseX = wall.a.x + dx * ratio;
    const baseZ = wall.a.z + dz * ratio;

    for (const side of [-0.5, 0.5]) {
      const offset = (wall.thickness / 2) * side + range(-0.018, 0.018);
      const x = baseX + nx * offset;
      const z = baseZ + nz * offset;
      const heightSteps = wall.kind === 'outer' ? 9 : 6;
      for (let level = 0; level < heightSteps; level += 1) {
        const y = (wall.height / heightSteps) * level + range(0.01, 0.09);
        addWallPoint(x + range(-0.012, 0.012), z + range(-0.012, 0.012), y);
      }
    }
  }
}

for (const cluster of floorplan.obstacles) {
  for (let index = 0; index < cluster.count * 3; index += 1) {
    addObstaclePoint(cluster);
  }
}

for (let index = 0; index < 900; index += 1) {
  addDebris();
}

const header = `# .PCD v0.7 - Point Cloud Data file format
VERSION 0.7
FIELDS x y z rgb intensity
SIZE 4 4 4 4 4
TYPE F F F U F
COUNT 1 1 1 1 1
WIDTH ${samples.length}
HEIGHT 1
VIEWPOINT 0 0 0 1 0 0 0
POINTS ${samples.length}
DATA binary
`;

const stride = 4 * 5;
const body = Buffer.alloc(samples.length * stride);

samples.forEach((sample, index) => {
  const offset = index * stride;
  body.writeFloatLE(sample.x, offset);
  body.writeFloatLE(sample.y, offset + 4);
  body.writeFloatLE(sample.z, offset + 8);
  body.writeUInt32LE(sample.rgb, offset + 12);
  body.writeFloatLE(sample.intensity, offset + 16);
});

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, Buffer.concat([Buffer.from(header, 'utf8'), body]));

const sizeMb = (Buffer.byteLength(header) + body.length) / (1024 * 1024);
console.log(
  `Generated ${samples.length.toLocaleString()} points -> ${outputPath} (${sizeMb.toFixed(2)} MB)`,
);
