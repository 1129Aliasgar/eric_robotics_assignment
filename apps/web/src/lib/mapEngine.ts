import {
  AdditiveBlending,
  AmbientLight,
  BoxGeometry,
  BufferGeometry,
  CircleGeometry,
  Color,
  DirectionalLight,
  DoubleSide,
  Group,
  Line,
  LineBasicMaterial,
  LineDashedMaterial,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  NoToneMapping,
  OrthographicCamera,
  PCFSoftShadowMap,
  PlaneGeometry,
  Points,
  PointsMaterial,
  RingGeometry,
  Scene,
  Shape,
  ShapeGeometry,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
} from 'three';
import type { CanvasTexture } from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { PCDLoader } from 'three/addons/loaders/PCDLoader.js';
import { findGoal, floorplan } from '@insight/shared';
import type { FurnitureKind, MissionStatus, Point2, Pose2 } from '@insight/shared';
import {
  createFurnitureTexture,
  createLabelTexture,
  createRobotTexture,
  createScanTexture,
  createSoftShadowTexture,
} from './mapTextures';
import { clamp, lerp, lerpAngle } from './format';

type MapEngineOptions = {
  container: HTMLElement;
  reducedMotion?: boolean;
  onProgress?: (value: number, label: string) => void;
  onReady?: () => void;
  onError?: (message: string) => void;
  onNotice?: (message: string) => void;
};

const MAP_CENTER = new Vector3(23.5, 0, 28.5);
const VIEW_TARGET = new Vector3(6.5, 0, 26.9);
const BASE_ZOOM = 0.96;
const MAP_SCALE_X = 1.2;
const WIDE_MIN_WIDTH = 760;
const WIDE_MIN_ASPECT = 1.4;

type ViewLayout = {
  target: Vector3;
  baseZoom: number;
};

const WIDE_VIEW: ViewLayout = { target: VIEW_TARGET, baseZoom: BASE_ZOOM };
const COMPACT_WIDE_VIEW: ViewLayout = { target: MAP_CENTER, baseZoom: 1.38 };
const COMPACT_TALL_VIEW: ViewLayout = { target: MAP_CENTER, baseZoom: 1 };

function resolveViewLayout(width: number, height: number): ViewLayout {
  const aspect = width / Math.max(1, height);
  if (width >= WIDE_MIN_WIDTH && aspect >= WIDE_MIN_ASPECT) return WIDE_VIEW;
  return aspect >= 1.3 ? COMPACT_WIDE_VIEW : COMPACT_TALL_VIEW;
}
const CAMERA_HEIGHT = 65;

function polygonShape(points: Point2[]) {
  const shape = new Shape();
  points.forEach((point, index) => {
    if (index === 0) shape.moveTo(point.x, -point.z);
    else shape.lineTo(point.x, -point.z);
  });
  shape.closePath();
  return shape;
}

function disposeObject(root: Group) {
  root.traverse((object) => {
    if (object instanceof Mesh || object instanceof Line || object instanceof Points) {
      object.geometry.dispose();
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of materials) {
        const withMap = material as typeof material & { map?: CanvasTexture | null };
        withMap.map?.dispose();
        material.dispose();
      }
    }
  });
}

function furnitureSize(kind: FurnitureKind) {
  switch (kind) {
    case 'desk':
      return 2.7;
    case 'rack':
      return 3.1;
    case 'pallet':
      return 2.5;
    case 'machine':
      return 2.4;
    case 'sink':
      return 1.9;
    case 'chair':
      return 1.25;
    case 'plant':
      return 1.25;
    default:
      return 1.5;
  }
}

export class MapEngine {
  private readonly container: HTMLElement;
  private readonly options: MapEngineOptions;
  private readonly scene = new Scene();
  private readonly camera: OrthographicCamera;
  private readonly renderer: WebGLRenderer;
  private readonly controls: OrbitControls;
  private readonly mapGroup = new Group();
  private readonly resizeObserver: ResizeObserver;
  private readonly robotGroup = new Group();
  private readonly robotShadow: Mesh;
  private readonly robotPulse: Mesh;
  private readonly goalRing: Mesh;
  private readonly goalCore: Mesh;
  private readonly scanMesh: Mesh;
  private readonly scanTexture: CanvasTexture;
  private routeGroup = new Group();

  private frame = 0;
  private disposed = false;
  private ready = false;
  private targetPose: Pose2 = { ...floorplan.robotStart };
  private currentPose: Pose2 = { ...floorplan.robotStart };
  private missionStatus: MissionStatus = 'active';
  private zoom = 1;
  private baseZoom = BASE_ZOOM;
  private readonly viewTarget = VIEW_TARGET.clone();
  private routeVisible = false;
  private elapsed = 0;
  private lastFrame = performance.now();

  constructor(options: MapEngineOptions) {
    this.options = options;
    this.container = options.container;

    const rect = this.container.getBoundingClientRect();
    const width = Math.max(1, rect.width);
    const height = Math.max(1, rect.height);
    const layout = resolveViewLayout(width, height);
    this.viewTarget.copy(layout.target);
    this.baseZoom = layout.baseZoom;

    this.renderer = new WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(width, height, false);
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.renderer.toneMapping = NoToneMapping;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = PCFSoftShadowMap;
    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.height = '100%';
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.touchAction = 'none';
    this.renderer.domElement.setAttribute(
      'aria-label',
      'Interactive top-down map of Insight Facility Bay 04. Drag to pan, scroll to zoom, right-drag to tilt.',
    );
    this.renderer.domElement.setAttribute('role', 'img');
    this.container.appendChild(this.renderer.domElement);

    this.camera = this.createCamera(width, height);
    this.controls = this.createControls();
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(this.container);

    this.scene.add(new AmbientLight(0xffffff, 2.35));
    this.scene.add(this.createSunlight());
    this.scene.add(this.mapGroup);
    this.mapGroup.rotation.y = floorplan.rotation;
    this.mapGroup.scale.x = MAP_SCALE_X;
    const scaledCenter = new Vector3(MAP_CENTER.x * MAP_SCALE_X, 0, MAP_CENTER.z);
    const rotatedCenter = scaledCenter.applyAxisAngle(new Vector3(0, 1, 0), floorplan.rotation);
    this.mapGroup.position.set(MAP_CENTER.x - rotatedCenter.x, 0, MAP_CENTER.z - rotatedCenter.z);

    this.buildBase();
    this.goalRing = this.createGoalRing();
    this.goalCore = this.createGoalCore();
    this.goalCore.scale.x = 1 / MAP_SCALE_X;
    this.mapGroup.add(this.goalRing, this.goalCore);

    this.robotShadow = this.createRobotShadow();
    this.robotPulse = this.createRobotPulse();
    this.robotGroup.add(this.robotShadow, this.robotPulse, this.createRobotBody());
    this.robotGroup.position.set(this.currentPose.x, 0, this.currentPose.z);
    this.robotGroup.rotation.y = -Math.PI / 2 - this.currentPose.heading;
    this.mapGroup.add(this.robotGroup);
    this.mapGroup.add(this.routeGroup);

    this.scanTexture = createScanTexture();
    this.scanMesh = this.createScanSweep(this.scanTexture);
    this.scanMesh.visible = false;
    this.mapGroup.add(this.scanMesh);

    this.setGoal(floorplan.goals[0]?.id ?? null, 'active');
    this.loadPointCloud();

    this.options.onProgress?.(0.18, 'Building floor plan');
    this.lastFrame = performance.now();
    this.frame = requestAnimationFrame(this.tick);
  }

  private createCamera(width: number, height: number) {
    const aspect = Math.max(0.35, width / height);
    const viewWidth = Math.max(74, 68 * aspect);
    const halfWidth = viewWidth / 2;
    const halfHeight = halfWidth / aspect;

    const camera = new OrthographicCamera(-halfWidth, halfWidth, halfHeight, -halfHeight, 0.1, 220);

    camera.position.set(this.viewTarget.x, CAMERA_HEIGHT, this.viewTarget.z + 0.01);
    camera.up.set(0, 1, 0);
    camera.lookAt(this.viewTarget);
    camera.zoom = this.baseZoom;
    camera.updateProjectionMatrix();
    return camera;
  }

  private createControls() {
    const controls = new OrbitControls(this.camera, this.renderer.domElement);
    controls.target.copy(this.viewTarget);
    controls.enableDamping = true;
    controls.dampingFactor = 0.075;
    controls.enableRotate = true;
    controls.enableZoom = true;
    controls.enablePan = true;
    controls.screenSpacePanning = true;
    controls.minZoom = 0.55;
    controls.maxZoom = 3.2;
    controls.minPolarAngle = 0;
    controls.maxPolarAngle = Math.PI / 2.7;
    controls.zoomSpeed = 0.8;
    controls.rotateSpeed = 0.55;
    controls.panSpeed = 0.9;
    controls.update();
    return controls;
  }

  private createSunlight() {
    const light = new DirectionalLight(0xffffff, 1.5);
    light.position.set(16, 55, 18);
    light.target.position.copy(MAP_CENTER);
    light.castShadow = true;
    light.shadow.mapSize.set(2048, 2048);
    light.shadow.camera.left = -45;
    light.shadow.camera.right = 45;
    light.shadow.camera.top = 45;
    light.shadow.camera.bottom = -45;
    light.shadow.camera.near = 1;
    light.shadow.camera.far = 120;
    light.shadow.bias = -0.0004;
    light.shadow.normalBias = 0.02;
    return light;
  }

  private buildBase() {
    const floor = new Mesh(
      new ShapeGeometry(polygonShape(floorplan.outerPolygon), 12),
      new MeshStandardMaterial({
        color: new Color('#fbfaf6'),
        roughness: 0.94,
        metalness: 0,
      }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.mapGroup.add(floor);

    const outlinePoints = floorplan.outerPolygon.map(
      (point) => new Vector3(point.x, 0.025, point.z),
    );
    const outline = new Line(
      new BufferGeometry().setFromPoints([...outlinePoints, outlinePoints[0]!]),
      new LineBasicMaterial({ color: 0x8f8d88, transparent: true, opacity: 0.65 }),
    );
    this.mapGroup.add(outline);

    const unmappedMaterial = new MeshBasicMaterial({
      color: 0xc9c7c2,
      transparent: true,
      opacity: 0.96,
      side: DoubleSide,
      depthWrite: false,
    });
    for (const polygon of floorplan.unmapped) {
      if (polygon.length < 3) continue;
      const mesh = new Mesh(new ShapeGeometry(polygonShape(polygon), 8), unmappedMaterial.clone());
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.y = 0.026;
      this.mapGroup.add(mesh);
    }

    const outerWallMaterial = new MeshStandardMaterial({
      color: new Color('#1a222c'),
      roughness: 0.82,
      metalness: 0.04,
    });
    const innerWallMaterial = new MeshStandardMaterial({
      color: new Color('#28323d'),
      roughness: 0.86,
      metalness: 0.02,
    });

    for (const wall of floorplan.walls) {
      const dx = wall.b.x - wall.a.x;
      const dz = wall.b.z - wall.a.z;
      const length = Math.hypot(dx, dz);
      if (length < 0.01) continue;

      const geometry = new BoxGeometry(length, wall.height, wall.thickness);
      const mesh = new Mesh(
        geometry,
        wall.kind === 'outer' ? outerWallMaterial : innerWallMaterial,
      );
      mesh.position.set((wall.a.x + wall.b.x) / 2, wall.height / 2, (wall.a.z + wall.b.z) / 2);
      mesh.rotation.y = -Math.atan2(dz, dx);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.mapGroup.add(mesh);
    }

    for (const zone of floorplan.zones) {
      if (zone.polygon.length < 3) continue;
      const color = zone.tone === 'pink' ? 0xf0d3d5 : 0xdeddd7;
      const mesh = new Mesh(
        new ShapeGeometry(polygonShape(zone.polygon), 8),
        new MeshBasicMaterial({
          color,
          transparent: true,
          opacity: zone.tone === 'pink' ? 0.88 : 0.82,
          side: DoubleSide,
          depthWrite: false,
        }),
      );
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.y = 0.018;
      this.mapGroup.add(mesh);

      const labelTexture = createLabelTexture(zone.label, {
        color: zone.tone === 'pink' ? '#594349' : '#565149',
        size: zone.label.length > 12 ? 48 : 56,
      });
      const labelWidth = clamp(zone.label.length * 0.72 + 2.8, 6.4, 13);
      const label = new Mesh(
        new PlaneGeometry(labelWidth, labelWidth / 4),
        new MeshBasicMaterial({
          map: labelTexture,
          transparent: true,
          opacity: 0.95,
          depthWrite: false,
          side: DoubleSide,
        }),
      );
      label.geometry.rotateX(-Math.PI / 2);
      label.position.set(zone.labelAt.x, 0.065, zone.labelAt.z);
      label.rotation.y = -floorplan.rotation + (zone.labelRotation ?? 0);
      this.mapGroup.add(label);
    }

    const furnitureTextures = new Map<FurnitureKind, CanvasTexture>();
    for (const item of floorplan.furniture) {
      let texture = furnitureTextures.get(item.kind);
      if (!texture) {
        texture = createFurnitureTexture(item.kind);
        furnitureTextures.set(item.kind, texture);
      }
      const size = furnitureSize(item.kind) * (item.scale ?? 1);
      const mesh = new Mesh(
        new PlaneGeometry(size, size),
        new MeshBasicMaterial({
          map: texture,
          transparent: true,
          alphaTest: 0.05,
          depthWrite: false,
          side: DoubleSide,
        }),
      );
      mesh.geometry.rotateX(-Math.PI / 2);
      mesh.position.set(item.x, 0.055, item.z);
      mesh.rotation.y = item.rotation;
      this.mapGroup.add(mesh);
    }
  }

  private loadPointCloud() {
    this.options.onProgress?.(0.42, 'Streaming point cloud');
    const loader = new PCDLoader();

    loader.load(
      '/map/insight-floor.pcd',
      (points) => {
        if (this.disposed) {
          points.geometry.dispose();
          return;
        }
        const material = new PointsMaterial({
          size: 1.55,
          sizeAttenuation: false,
          vertexColors: true,
          transparent: true,
          opacity: 0,
          depthWrite: false,
        });
        points.material = material;
        points.position.y = 0.035;
        points.frustumCulled = false;
        this.mapGroup.add(points);
        this.options.onProgress?.(0.9, 'Calibrating scanner');
        this.ready = true;
        this.options.onReady?.();
        this.fadePoints(material);
      },
      (event) => {
        if (event.total > 0) {
          const ratio = clamp(event.loaded / event.total, 0, 1);
          this.options.onProgress?.(0.42 + ratio * 0.46, 'Streaming point cloud');
        }
      },
      () => {
        if (this.disposed) return;
        this.ready = true;
        this.options.onNotice?.('Point cloud unavailable. Showing the vector map.');
        this.options.onReady?.();
      },
    );
  }

  private fadePoints(material: PointsMaterial) {
    const startedAt = performance.now();
    const duration = this.options.reducedMotion ? 0 : 900;
    const fade = () => {
      if (this.disposed) return;
      const progress = duration === 0 ? 1 : Math.min(1, (performance.now() - startedAt) / duration);
      material.opacity = 0.92 * progress;
      if (progress < 1) requestAnimationFrame(fade);
    };
    fade();
  }

  private createRobotBody() {
    const texture = createRobotTexture();
    const mesh = new Mesh(
      new PlaneGeometry(2.65, 2.65),
      new MeshBasicMaterial({
        map: texture,
        transparent: true,
        alphaTest: 0.04,
        depthWrite: false,
        side: DoubleSide,
      }),
    );
    mesh.geometry.rotateX(-Math.PI / 2);
    mesh.position.y = 0.115;
    return mesh;
  }

  private createRobotShadow() {
    const mesh = new Mesh(
      new PlaneGeometry(3.4, 3.4),
      new MeshBasicMaterial({
        map: createSoftShadowTexture(),
        transparent: true,
        depthWrite: false,
        opacity: 0.9,
      }),
    );
    mesh.geometry.rotateX(-Math.PI / 2);
    mesh.position.y = 0.074;
    return mesh;
  }

  private createRobotPulse() {
    const mesh = new Mesh(
      new RingGeometry(1.25, 1.42, 64),
      new MeshBasicMaterial({
        color: 0xce2431,
        transparent: true,
        opacity: 0.35,
        depthWrite: false,
        side: DoubleSide,
      }),
    );
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = 0.085;
    return mesh;
  }

  private createGoalRing() {
    const mesh = new Mesh(
      new RingGeometry(1.05, 1.22, 64),
      new MeshBasicMaterial({
        color: 0xce2431,
        transparent: true,
        opacity: 0.5,
        depthWrite: false,
        side: DoubleSide,
      }),
    );
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = 0.08;
    return mesh;
  }

  private createGoalCore() {
    const mesh = new Mesh(
      new CircleGeometry(0.17, 24),
      new MeshBasicMaterial({
        color: 0xce2431,
        transparent: true,
        opacity: 0.9,
        depthWrite: false,
        side: DoubleSide,
      }),
    );
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = 0.082;
    return mesh;
  }

  private createScanSweep(texture: CanvasTexture) {
    const mesh = new Mesh(
      new PlaneGeometry(56, 12),
      new MeshBasicMaterial({
        map: texture,
        transparent: true,
        opacity: 0.75,
        depthWrite: false,
        side: DoubleSide,
        blending: AdditiveBlending,
      }),
    );
    mesh.geometry.rotateX(-Math.PI / 2);
    mesh.position.set(MAP_CENTER.x, 0.19, 0);
    return mesh;
  }

  private resize() {
    if (this.disposed) return;
    const rect = this.container.getBoundingClientRect();
    const width = Math.max(1, rect.width);
    const height = Math.max(1, rect.height);
    const aspect = Math.max(0.35, width / height);
    const viewWidth = Math.max(74, 68 * aspect);
    const layout = resolveViewLayout(width, height);
    const targetChanged = !this.viewTarget.equals(layout.target);
    const zoomChanged = this.baseZoom !== layout.baseZoom;

    if (targetChanged || zoomChanged) {
      const dx = layout.target.x - this.viewTarget.x;
      const dz = layout.target.z - this.viewTarget.z;
      this.viewTarget.copy(layout.target);
      this.baseZoom = layout.baseZoom;
      this.camera.position.x += dx;
      this.camera.position.z += dz;
      this.controls.target.copy(this.viewTarget);
      this.camera.zoom = this.baseZoom * this.zoom;
      this.camera.updateProjectionMatrix();
      this.controls.update();
    }

    this.camera.left = -viewWidth / 2;
    this.camera.right = viewWidth / 2;
    this.camera.top = viewWidth / 2 / aspect;
    this.camera.bottom = -viewWidth / 2 / aspect;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  }

  private tick = (now: number) => {
    if (this.disposed) return;
    const dt = clamp((now - this.lastFrame) / 1000, 0, 0.08);
    this.lastFrame = now;
    this.elapsed += dt;

    const alpha = 1 - Math.exp(-9 * dt);
    this.currentPose.x = lerp(this.currentPose.x, this.targetPose.x, alpha);
    this.currentPose.z = lerp(this.currentPose.z, this.targetPose.z, alpha);
    this.currentPose.heading = lerpAngle(this.currentPose.heading, this.targetPose.heading, alpha);

    this.robotGroup.position.set(this.currentPose.x, 0, this.currentPose.z);
    this.robotGroup.rotation.y = -Math.PI / 2 - this.currentPose.heading;

    const pulse =
      this.missionStatus === 'estop'
        ? 1 + (Math.sin(this.elapsed * 8) * 0.5 + 0.5) * 0.45
        : 1 + (Math.sin(this.elapsed * 2.4) * 0.5 + 0.5) * 0.22;
    this.robotPulse.scale.setScalar(pulse);
    (this.robotPulse.material as MeshBasicMaterial).opacity =
      this.missionStatus === 'estop' ? 0.55 : 0.34 - (pulse - 1) * 0.35;

    const goalPulse = 1 + (Math.sin(this.elapsed * 2.1) * 0.5 + 0.5) * 0.16;
    this.goalRing.scale.set(goalPulse / MAP_SCALE_X, goalPulse, 1);
    (this.goalRing.material as MeshBasicMaterial).opacity =
      0.38 + Math.sin(this.elapsed * 2.1) * 0.12;

    if (this.scanMesh.visible) {
      const travel = (this.elapsed * 6.2) % 72;
      this.scanMesh.position.z = travel - 7;
      (this.scanMesh.material as MeshBasicMaterial).opacity = 0.55;
    }

    this.controls.update();
    this.controls.target.x = clamp(this.controls.target.x, -8, 54);
    this.controls.target.z = clamp(this.controls.target.z, -10, 70);
    this.renderer.render(this.scene, this.camera);
    this.frame = requestAnimationFrame(this.tick);
  };

  setTargetPose(pose: Pose2) {
    this.targetPose = { ...pose };
  }

  snapToPose(pose: Pose2) {
    this.targetPose = { ...pose };
    this.currentPose = { ...pose };
    this.robotGroup.position.set(pose.x, 0, pose.z);
    this.robotGroup.rotation.y = -Math.PI / 2 - pose.heading;
  }

  setGoal(goalId: string | null, missionStatus: MissionStatus) {
    const goal = goalId ? findGoal(goalId) : null;
    const node = goal ? floorplan.navNodes.find((candidate) => candidate.id === goal.nodeId) : null;
    const visible = Boolean(node);
    this.goalRing.visible = visible;
    this.goalCore.visible = visible;
    if (node) {
      this.goalRing.position.set(node.x, 0.08, node.z);
      this.goalCore.position.set(node.x, 0.082, node.z);
    }
    this.missionStatus = missionStatus;
    if (missionStatus === 'complete' && node) {
      (this.goalRing.material as MeshBasicMaterial).color.set(0x23c55e);
      (this.goalCore.material as MeshBasicMaterial).color.set(0x23c55e);
    } else {
      (this.goalRing.material as MeshBasicMaterial).color.set(0xce2431);
      (this.goalCore.material as MeshBasicMaterial).color.set(0xce2431);
    }
  }

  setMissionStatus(status: MissionStatus) {
    this.missionStatus = status;
  }

  setRoute(route: Point2[]) {
    this.mapGroup.remove(this.routeGroup);
    disposeObject(this.routeGroup);
    this.routeGroup = new Group();

    if (route.length > 1) {
      const points = route.map((point) => new Vector3(point.x, 0.135, point.z));
      const line = new Line(
        new BufferGeometry().setFromPoints(points),
        new LineDashedMaterial({
          color: 0x69727c,
          dashSize: 0.38,
          gapSize: 0.3,
          transparent: true,
          opacity: 0.8,
          depthWrite: false,
        }),
      );
      line.computeLineDistances();
      this.routeGroup.add(line);
    }

    this.routeGroup.visible = this.routeVisible;
    this.mapGroup.add(this.routeGroup);
  }

  setRouteVisible(visible: boolean) {
    this.routeVisible = visible;
    this.routeGroup.visible = visible;
  }

  setScanEnabled(enabled: boolean) {
    this.scanMesh.visible = enabled;
  }

  setZoom(value: number) {
    this.zoom = clamp(value, 0.55, 3.2);
    this.camera.zoom = this.baseZoom * this.zoom;
    this.camera.updateProjectionMatrix();
  }

  resetView() {
    this.controls.target.copy(this.viewTarget);
    this.camera.position.set(this.viewTarget.x, CAMERA_HEIGHT, this.viewTarget.z + 0.01);
    this.camera.zoom = this.baseZoom;
    this.camera.updateProjectionMatrix();
    this.controls.update();
  }

  isReady() {
    return this.ready;
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    cancelAnimationFrame(this.frame);
    this.resizeObserver.disconnect();
    this.controls.dispose();
    disposeObject(this.mapGroup);
    this.scene.clear();
    this.scanTexture.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
