import * as THREE from 'three';

/**
 * Procedural sport sedan. +Z is forward, Y=0 is the tyre contact plane.
 * carGeometry() remains a single vertex-coloured geometry for existing traffic,
 * catalog, effects and drive-mode callers. No textures or extra imports needed.
 * carMesh() is an optional PBR version for close-up views; set scene.environment
 * for paint/glass reflections. Dispose its geometry and materials when finished.
 */
type Point = readonly [number, number, number];
type Surface = (u: number, v: number) => Point;
const PAINT = 0, GLASS = 1, RUBBER = 2, ALLOY = 3, TRIM = 4;
const HEADLIGHT = 5, TAILLIGHT = 6, PLATE = 7;
const COLOURS = ['#ffffff', '#263d4d', '#191c20', '#bbc3cb', '#242b32', '#effaff', '#d51c35', '#e5e9eb'];
const AXLES = [-0.099, 0.102] as const;
const TYRE_RADIUS = 0.029;
const ARCH_RADIUS = 0.034;
const WHEEL_X = 0.075;

interface Part { geometry: THREE.BufferGeometry; material: number; colour: string }

const lerp = THREE.MathUtils.lerp;
const vector = (p: Point) => new THREE.Vector3(...p);
const mix = (a: Point, b: Point, t: number): Point => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

/** Indexed, smooth patch. Explicit outward direction also handles mirrored panels. */
function surface(fn: Surface, columns: number, rows: number, outward: Point) {
  const positions: number[] = [], uv: number[] = [], indices: number[] = [];
  for (let j = 0; j <= rows; j++) {
    for (let i = 0; i <= columns; i++) {
      positions.push(...fn(i / columns, j / rows));
      uv.push(i / columns, j / rows);
    }
  }
  const middle = vector(fn(0.5, 0.5));
  const du = vector(fn(0.501, 0.5)).sub(middle);
  const dv = vector(fn(0.5, 0.501)).sub(middle);
  const flip = du.cross(dv).dot(vector(outward)) < 0;
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < columns; i++) {
      const a = j * (columns + 1) + i, b = a + 1, d = a + columns + 1, c = d + 1;
      indices.push(...(flip ? [a, d, b, b, d, c] : [a, b, d, b, c, d]));
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(indices);
  g.computeVertexNormals();
  return g;
}

function panel(a: Point, b: Point, c: Point, d: Point, outward: Point, bow = 0) {
  return surface((u, v) => {
    const p = mix(mix(a, b, u), mix(d, c, u), v);
    const bulge = Math.sin(Math.PI * u) * Math.sin(Math.PI * v) * bow;
    return [p[0] + outward[0] * bulge, p[1] + outward[1] * bulge, p[2] + outward[2] * bulge];
  }, 6, 4, outward);
}

/** Small rounded solid, made only with core Three.js so the game's paste viewer works. */
function roundedBox(w: number, h: number, d: number, radius: number, segments = 3) {
  const g = new THREE.BoxGeometry(w, h, d, segments, segments, segments);
  const p = g.getAttribute('position'), n = g.getAttribute('normal');
  const half = new THREE.Vector3(w / 2, h / 2, d / 2);
  const r = Math.min(radius, w / 2, h / 2, d / 2) * 0.999;
  const inner = half.clone().addScalar(-r);
  const point = new THREE.Vector3(), nearest = new THREE.Vector3(), normal = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    point.fromBufferAttribute(p, i);
    nearest.copy(point).clamp(inner.clone().negate(), inner);
    normal.copy(point).sub(nearest).normalize();
    point.copy(nearest).addScaledVector(normal, r);
    p.setXYZ(i, point.x, point.y, point.z);
    n.setXYZ(i, normal.x, normal.y, normal.z);
  }
  return g;
}

function pipe(points: Point[], radius: number, segments = 20, radialSegments = 5) {
  const curve = new THREE.CatmullRomCurve3(points.map(vector), false, 'centripetal');
  return new THREE.TubeGeometry(curve, segments, radius, radialSegments, false);
}

// z, half-width, shoulder height; interpolated sections give a coherent silhouette.
const BODY = [
  [-0.162, 0.062, 0.071], [-0.151, 0.074, 0.078], [-0.12, 0.079, 0.083],
  [-0.099, 0.081, 0.084], [-0.06, 0.079, 0.085], [0.02, 0.078, 0.085],
  [0.074, 0.079, 0.084], [0.102, 0.081, 0.082], [0.14, 0.077, 0.075],
  [0.158, 0.07, 0.068], [0.165, 0.059, 0.064],
] as const;

function bodySection(z: number) {
  let i = 0;
  while (i < BODY.length - 2 && z > BODY[i + 1][0]) i++;
  const a = BODY[i], b = BODY[i + 1];
  const t = THREE.MathUtils.clamp((z - a[0]) / (b[0] - a[0]), 0, 1);
  // Monotone Hermite interpolation preserves tangents across section joins.
  // Easing each interval separately would make highlights ripple down the hood.
  const sample = (column: 1 | 2) => {
    const secant = (j: number) => (BODY[j + 1][column] - BODY[j][column]) / (BODY[j + 1][0] - BODY[j][0]);
    const slope = (j: number) => {
      if (j === 0) return secant(0);
      if (j === BODY.length - 1) return secant(j - 1);
      const left = secant(j - 1), right = secant(j);
      return left * right <= 0 ? 0 : 2 * left * right / (left + right);
    };
    const t2 = t * t, t3 = t2 * t, span = b[0] - a[0];
    return (2 * t3 - 3 * t2 + 1) * a[column] + (t3 - 2 * t2 + t) * span * slope(i)
      + (-2 * t3 + 3 * t2) * b[column] + (t3 - t2) * span * slope(i + 1);
  };
  return { width: sample(1), height: sample(2) };
}

function archHeight(z: number) {
  let height = 0.025;
  for (const axle of AXLES) {
    const dz = Math.abs(z - axle);
    if (dz <= ARCH_RADIUS) height = Math.max(height, TYRE_RADIUS + Math.sqrt(Math.max(0, ARCH_RADIUS ** 2 - dz ** 2)));
  }
  return height;
}

function buildCar(detail: 'traffic' | 'high') {
  const high = detail === 'high';
  const radialSegments = high ? 32 : 20;
  const patch = (fn: Surface, columns: number, rows: number, outward: Point) =>
    surface(fn, high ? columns : Math.max(1, Math.ceil(columns / 2)), high ? rows : Math.max(1, Math.ceil(rows / 2)), outward);
  const parts: Part[] = [];
  const add = (geometry: THREE.BufferGeometry, material = PAINT, colour = COLOURS[material]) => {
    parts.push({ geometry, material, colour });
  };
  const solid = (w: number, h: number, d: number, x: number, y: number, z: number, material = PAINT, radius = 0.0015) => {
    // Sub-millimetre strips need crisp edges, not hundreds of tiny triangles.
    const geometry = radius <= 0.0007 ? new THREE.BoxGeometry(w, h, d)
      : roundedBox(w, h, d, radius, high && Math.max(w, h, d) >= 0.021 ? 3 : 2);
    add(geometry.translate(x, y, z), material);
  };
  const line = (points: Point[], radius: number, material: number, segments = 16) =>
    add(pipe(points, radius, high ? segments : Math.max(2, Math.ceil(segments / 2)), high ? 5 : 4), material);
  const outline = (points: Point[], radius: number, material: number) => {
    // Separate straight edges avoid spline overshoot at window corners.
    for (let i = 0; i < points.length; i++) line([points[i], points[(i + 1) % points.length]], radius, material, 2);
  };
  const cylinderX = (radius: number, width: number, x: number, y: number, z: number, material: number, segments = 24) => {
    add(new THREE.CylinderGeometry(radius, radius, width, high ? segments : Math.max(6, Math.ceil(segments * 0.65))).rotateZ(Math.PI / 2).translate(x, y, z), material);
  };

  // Narrow undertray stays inside the tyres; side skins have actual arch openings.
  solid(0.111, 0.017, 0.285, 0, 0.032, 0, TRIM, 0.004);
  add(patch((u, v) => {
    const z = lerp(-0.162, 0.165, v), section = bodySection(z), x = u * 2 - 1;
    return [x * section.width, section.height + 0.0065 * (1 - x ** 4), z];
  }, 12, 80, [0, 1, 0]));
  for (const z of [-0.162, 0.165]) {
    const section = bodySection(z);
    add(patch((u, v) => {
      const x = u * 2 - 1;
      return [x * section.width, lerp(0.032, section.height + 0.0065 * (1 - x ** 4), v), z];
    }, 12, 3, [0, 0, Math.sign(z)]));
  }

  for (const side of [-1, 1]) {
    // Sampling every arch tangent explicitly avoids a ragged wheel cutout.
    const stations = new Set<number>(BODY.map((s) => s[0]));
    const longitudinal = high ? 70 : 32, archSteps = high ? 24 : 12;
    for (let i = 0; i <= longitudinal; i++) stations.add(lerp(-0.162, 0.165, i / longitudinal));
    for (const axle of AXLES) {
      for (let i = 0; i <= archSteps; i++) stations.add(axle + Math.cos(i / archSteps * Math.PI) * ARCH_RADIUS);
    }
    const zs = [...stations].sort((a, b) => a - b);
    // One indexed side panel shares normals across all longitudinal samples.
    const positions: number[] = [], uv: number[] = [], indices: number[] = [];
    const bands = high ? 5 : 3;
    for (const z of zs) {
      const section = bodySection(z), bottom = archHeight(z);
      for (let j = 0; j <= bands; j++) {
        const v = j / bands;
        const inset = 0.004 * (1 - v) ** 2 - 0.0007 * Math.sin(v * Math.PI);
        positions.push(side * (section.width - inset), lerp(bottom, section.height, v), z);
        uv.push((z + 0.162) / 0.327, v);
      }
    }
    for (let i = 0; i < zs.length - 1; i++) {
      for (let j = 0; j < bands; j++) {
        const a = i * (bands + 1) + j, b = a + bands + 1;
        indices.push(...(side > 0 ? [a, a + 1, b, a + 1, b + 1, b] : [a, b, a + 1, a + 1, b, b + 1]));
      }
    }
    const skin = new THREE.BufferGeometry();
    skin.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    skin.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    skin.setIndex(indices);
    skin.computeVertexNormals();
    add(skin);

    for (const axle of AXLES) {
      // Recessed wheel-well walls, followed by a thin painted fender bead.
      add(patch((u, v) => {
        const angle = u * Math.PI, z = axle + Math.cos(angle) * ARCH_RADIUS;
        return [side * lerp(0.060, bodySection(z).width - 0.002, v), TYRE_RADIUS + Math.sin(angle) * ARCH_RADIUS, z];
      }, 24, 1, [0, -1, 0]), RUBBER);
      const lip: Point[] = [];
      for (let i = 0; i <= 24; i++) {
        const angle = i / 24 * Math.PI, z = axle + Math.cos(angle) * ARCH_RADIUS;
        lip.push([side * (bodySection(z).width - 0.0002), TYRE_RADIUS + Math.sin(angle) * ARCH_RADIUS, z]);
      }
      line(lip, 0.0011, PAINT, 32);
    }
    solid(0.004, 0.006, 0.129, side * 0.077, 0.027, 0.001, TRIM, 0.001);
    solid(0.003, 0.003, 0.13, side * 0.079, 0.032, 0.001, PAINT, 0.001);

    // Side glass is tucked between the A/B/C pillars, rather than a dark box.
    const frontGlass: Point[] = [
      [side * 0.069, 0.0885, 0.064], [side * 0.0705, 0.0885, -0.022],
      [side * 0.055, 0.123, -0.022], [side * 0.0545, 0.123, 0.014],
    ];
    const rearGlass: Point[] = [
      [side * 0.0705, 0.0885, -0.030], [side * 0.069, 0.0885, -0.103],
      [side * 0.0545, 0.123, -0.059], [side * 0.055, 0.123, -0.030],
    ];
    for (const points of [frontGlass, rearGlass]) {
      add(panel(points[0], points[1], points[2], points[3], [side, 0.2, 0], 0.0006), GLASS);
      outline(points, 0.0009, TRIM);
    }
    add(panel(
      [side * 0.071, 0.086, -0.0215], [side * 0.071, 0.086, -0.0305],
      [side * 0.0555, 0.125, -0.0305], [side * 0.0555, 0.125, -0.0215], [side, 0, 0],
    ), TRIM);
    // Painted A and C pillars form the roof's structural silhouette.
    add(panel(
      [side * 0.071, 0.085, 0.075], [side * 0.069, 0.0885, 0.064],
      [side * 0.0545, 0.123, 0.014], [side * 0.055, 0.125, 0.018], [side, 0.2, 0.2],
    ));
    line([[side * 0.071, 0.085, 0.075], [side * 0.063, 0.105, 0.046], [side * 0.055, 0.125, 0.018]], 0.0024, PAINT);
    add(panel(
      [side * 0.071, 0.085, -0.116], [side * 0.069, 0.0885, -0.103],
      [side * 0.0545, 0.123, -0.059], [side * 0.055, 0.126, -0.065], [side, 0.25, -0.2],
    ));
    line([[side * 0.071, 0.087, -0.112], [side * 0.072, 0.087, -0.026], [side * 0.071, 0.087, 0.069]], 0.00065, ALLOY);

    // Door shut-lines follow the body surface and terminate above the sill.
    for (const points of [
      [[0, 0.083, 0.067], [0, 0.061, 0.060], [0, 0.035, 0.059]],
      [[0, 0.084, -0.026], [0, 0.060, -0.027], [0, 0.035, -0.025]],
      [[0, 0.084, -0.108], [0, 0.068, -0.112]],
      [[0, 0.035, 0.059], [0, 0.034, 0.01], [0, 0.035, -0.025], [0, 0.037, -0.063]],
    ] as Point[][]) {
      line(points.map(([, y, z]): Point => {
        const section = bodySection(z), v = THREE.MathUtils.clamp((y - archHeight(z)) / (section.height - archHeight(z)), 0, 1);
        return [side * (section.width - 0.004 * (1 - v) ** 2 + 0.0007 * Math.sin(v * Math.PI) + 0.0002), y, z];
      }), 0.00035, TRIM, 12);
    }
    for (const z of [-0.014, -0.078]) {
      solid(0.0028, 0.0035, 0.014, side * (bodySection(z).width + 0.0007), 0.075, z, TRIM, 0.001);
      solid(0.0034, 0.0018, 0.011, side * (bodySection(z).width + 0.0014), 0.076, z, ALLOY, 0.0007);
    }
    // Mirror stalk, shaped housing, rear-facing mirror and integrated indicator.
    line([[side * 0.069, 0.090, 0.055], [side * 0.083, 0.094, 0.053]], 0.0018, TRIM, 4);
    solid(0.018, 0.009, 0.014, side * 0.086, 0.096, 0.051, PAINT, 0.003);
    solid(0.014, 0.005, 0.001, side * 0.086, 0.096, 0.0437, ALLOY, 0.0004);
    solid(0.012, 0.001, 0.001, side * 0.087, 0.095, 0.0581, HEADLIGHT, 0.0004);
  }

  // Curved roof, crowned slightly across both axes.
  add(patch((u, v) => {
    const x = u * 2 - 1, z = lerp(-0.065, 0.018, v);
    return [x * (0.055 + 0.001 * Math.sin(v * Math.PI)), 0.125 + 0.003 * (1 - x ** 2) + 0.001 * Math.sin(v * Math.PI), z];
  }, 10, 12, [0, 1, 0]));
  // Close the roof's front/rear thickness and its side rails. These overlap
  // glazing borders so no daylight leaks appear when orbiting at eye level.
  for (const z of [-0.065, 0.018]) {
    add(patch((u, v) => {
      const x = u * 2 - 1;
      return [x * 0.055, lerp(0.1225, 0.125 + 0.003 * (1 - x ** 2), v), z];
    }, 10, 1, [0, 0, Math.sign(z)]));
  }
  for (const side of [-1, 1]) {
    add(patch((u, v) => {
      const crown = Math.sin(u * Math.PI), z = lerp(-0.065, 0.018, u);
      return [side * (0.055 + 0.001 * crown), lerp(0.1218, 0.125 + 0.001 * crown, v), z];
    }, 12, 1, [side, 0, 0]));
  }
  const windscreen: Point[] = [[-0.068, 0.087, 0.075], [0.068, 0.087, 0.075], [0.0525, 0.1245, 0.0185], [-0.0525, 0.1245, 0.0185]];
  const rearScreen: Point[] = [[0.068, 0.087, -0.115], [-0.068, 0.087, -0.115], [-0.0525, 0.1245, -0.065], [0.0525, 0.1245, -0.065]];
  for (const [points, direction] of [[windscreen, [0, 0.7, 1]], [rearScreen, [0, 0.7, -1]]] as [Point[], Point][]) {
    add(panel(points[0], points[1], points[2], points[3], direction, 0.001), GLASS);
    outline(points, 0.001, TRIM);
  }
  // Wipers sit on the windscreen; no floating horizontal bars.
  for (const offset of [-0.030, 0.023]) {
    line([[offset - 0.015, 0.089, 0.072], [offset + 0.012, 0.093, 0.066]], 0.00065, TRIM, 3);
  }
  // Hood shut-lines follow its crown and slope.
  for (const side of [-1, 1]) {
    const points: Point[] = [];
    for (let i = 0; i <= 12; i++) {
      const z = lerp(0.080, 0.151, i / 12), s = bodySection(z), x = side * lerp(0.057, 0.048, i / 12);
      points.push([x, s.height + 0.0065 * (1 - (x / s.width) ** 4) + 0.0002, z]);
    }
    line(points, 0.0003, TRIM, 12);
  }

  // Rounded end caps stay below the hood. Lights occupy the upper fascia.
  solid(0.140, 0.031, 0.017, 0, 0.045, 0.155, PAINT, 0.006);
  solid(0.143, 0.031, 0.018, 0, 0.045, -0.153, PAINT, 0.006);
  solid(0.133, 0.006, 0.010, 0, 0.027, 0.155, TRIM, 0.002);
  solid(0.132, 0.009, 0.011, 0, 0.029, -0.153, TRIM, 0.002);
  solid(0.071, 0.019, 0.005, 0, 0.058, 0.164, TRIM, 0.004);
  solid(0.063, 0.012, 0.0055, 0, 0.058, 0.165, RUBBER, 0.002);
  for (let i = -4; i <= 4; i++) solid(0.0009, 0.011, 0.0008, i * 0.006, 0.058, 0.168, ALLOY, 0.0003);
  solid(0.047, 0.007, 0.004, 0, 0.036, 0.165, RUBBER, 0.001);
  for (const side of [-1, 1]) {
    solid(0.028, 0.008, 0.006, side * 0.054, 0.039, 0.160, TRIM, 0.002);
    // Each light assembly follows the tapered corner; lenses sit outside the
    // closed end caps instead of being hidden inside the bodywork.
    const lamp = (front: boolean, w: number, h: number, d: number, dx: number, dy: number, dz: number, material: number) => {
      const yaw = side * (front ? 0.38 : -0.38);
      const g = roundedBox(w, h, d, Math.min(0.0015, h / 3), 2);
      g.translate(dx, dy, dz).rotateY(yaw).translate(side * (front ? 0.0555 : 0.0565), front ? 0.070 : 0.073, front ? 0.1627 : -0.1614);
      add(g, material);
    };
    lamp(true, 0.035, 0.010, 0.005, 0, 0, 0, TRIM);
    lamp(true, 0.030, 0.006, 0.002, 0, 0.0005, 0.0025, ALLOY);
    lamp(true, 0.030, 0.0018, 0.001, 0, 0.003, 0.0034, HEADLIGHT);
    for (const offset of [-0.006, 0.006]) {
      add(new THREE.SphereGeometry(0.0025, 10, 6).scale(1, 0.85, 0.6)
        .translate(offset, 0, 0.0037).rotateY(side * 0.38).translate(side * 0.0555, 0.070, 0.1627), HEADLIGHT);
    }
    lamp(false, 0.035, 0.009, 0.005, 0, 0, 0, TRIM);
    lamp(false, 0.031, 0.006, 0.002, 0, 0, -0.0026, TAILLIGHT);
    lamp(false, 0.026, 0.0013, 0.0008, 0, 0.001, -0.0038, TAILLIGHT);
    lamp(false, 0.009, 0.0015, 0.0008, -side * 0.008, -0.002, -0.0038, PLATE);
    solid(0.017, 0.0025, 0.002, side * 0.055, 0.038, -0.163, TAILLIGHT, 0.0007);
    // Twin exhaust tips with visible dark bores, facing backwards.
    add(new THREE.CylinderGeometry(0.0035, 0.0035, 0.009, 12, 1, true).rotateX(Math.PI / 2).translate(side * 0.048, 0.026, -0.160), ALLOY);
    add(new THREE.CircleGeometry(0.0029, 12).rotateY(Math.PI).translate(side * 0.048, 0.026, -0.160), RUBBER);
  }
  solid(0.028, 0.008, 0.002, 0, 0.047, 0.169, TRIM, 0.0006);
  solid(0.025, 0.006, 0.0023, 0, 0.047, 0.169, PLATE, 0.0006);
  solid(0.029, 0.009, 0.002, 0, 0.064, -0.163, TRIM, 0.0006);
  solid(0.026, 0.0065, 0.0023, 0, 0.064, -0.163, PLATE, 0.0006);
  // Restrained badge and brake strip, with no branded assets or text textures.
  solid(0.005, 0.003, 0.001, 0, 0.075, 0.162, ALLOY, 0.001);
  solid(0.004, 0.003, 0.001, 0, 0.078, -0.163, ALLOY, 0.001);
  solid(0.030, 0.0015, 0.0018, 0, 0.094, -0.107, TAILLIGHT, 0.0005);

  // Tyres have a closed, rounded lathed profile (axis X), not solid toy cylinders.
  const profile = [
    [0.017, -0.0105], [0.023, -0.0105], [0.0275, -0.0085], [0.029, -0.0055],
    ...(high ? [[0.029, -0.0042], [0.0284, -0.0036], [0.029, -0.003],
      [0.029, 0.003], [0.0284, 0.0036], [0.029, 0.0042]] : []),
    [0.029, 0.0055], [0.0275, 0.0085], [0.023, 0.0105], [0.017, 0.0105], [0.017, -0.0105],
  ].map(([r, axis]) => new THREE.Vector2(r, axis));
  for (const side of [-1, 1]) {
    for (const axle of AXLES) {
      const x = side * WHEEL_X, face = side * (WHEEL_X + 0.011);
      add(new THREE.LatheGeometry(profile, radialSegments).rotateZ(-Math.PI / 2).translate(x, TYRE_RADIUS, axle), RUBBER);
      cylinderX(0.0183, 0.018, x, TYRE_RADIUS, axle, TRIM);
      cylinderX(0.015, 0.001, face - side * 0.003, TYRE_RADIUS, axle, ALLOY);
      // Brake caliper is visible behind the open spokes.
      solid(0.003, 0.010, 0.005, face - side * 0.0018, TYRE_RADIUS + 0.004, axle - 0.011, TAILLIGHT, 0.001);
      for (const radius of [0.018, 0.0192]) {
        add(new THREE.TorusGeometry(radius, 0.0008, high ? 5 : 4, radialSegments).rotateY(Math.PI / 2).translate(face, TYRE_RADIUS, axle), ALLOY);
      }
      // Five/ten swept spokes; a recessed rotor leaves a readable rim silhouette.
      const spokes = high ? 10 : 5;
      for (let i = 0; i < spokes; i++) {
        const angle = i / spokes * Math.PI * 2, outer = angle + 0.12;
        const a: Point = [face, TYRE_RADIUS + Math.cos(angle) * 0.004, axle + Math.sin(angle) * 0.004];
        const b: Point = [face, TYRE_RADIUS + Math.cos(outer) * 0.0175, axle + Math.sin(outer) * 0.0175];
        const bar = new THREE.CylinderGeometry(0.0011, 0.0015, vector(a).distanceTo(vector(b)), 4);
        bar.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), vector(b).sub(vector(a)).normalize()));
        bar.translate(...mix(a, b, 0.5));
        add(bar, ALLOY);
      }
      cylinderX(0.0048, 0.0028, face, TYRE_RADIUS, axle, ALLOY, 16);
      cylinderX(0.0025, 0.0032, face, TYRE_RADIUS, axle, TRIM, 12);
      for (let i = 0; high && i < 5; i++) {
        const a = i / 5 * Math.PI * 2;
        cylinderX(0.00055, 0.001, face + side * 0.0017, TYRE_RADIUS + Math.cos(a) * 0.0035, axle + Math.sin(a) * 0.0035, TRIM, 6);
      }
    }
  }

  // Consolidate by material once. Existing single-material callers still draw
  // everything in one call; the optional PBR mesh uses eight material groups.
  const positions: number[] = [], normals: number[] = [], uv: number[] = [], colours: number[] = [], indices: number[] = [];
  const result = new THREE.BufferGeometry();
  for (let material = 0; material < COLOURS.length; material++) {
    const start = indices.length;
    for (const part of parts.filter((p) => p.material === material)) {
      const g = part.geometry, p = g.getAttribute('position'), n = g.getAttribute('normal'), tex = g.getAttribute('uv');
      const offset = positions.length / 3, colour = new THREE.Color(part.colour);
      for (let i = 0; i < p.count; i++) {
        positions.push(p.getX(i), p.getY(i), p.getZ(i));
        normals.push(n.getX(i), n.getY(i), n.getZ(i));
        uv.push(tex ? tex.getX(i) : 0, tex ? tex.getY(i) : 0);
        colours.push(colour.r, colour.g, colour.b);
      }
      const index = g.getIndex();
      for (let i = 0; i < (index?.count ?? p.count); i++) indices.push(offset + (index ? index.getX(i) : i));
      g.dispose();
    }
    result.addGroup(start, indices.length - start, material);
  }
  result.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  result.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  result.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  result.setAttribute('color', new THREE.Float32BufferAttribute(colours, 3));
  result.setIndex(indices);
  result.computeBoundingBox();
  result.computeBoundingSphere();
  result.name = 'Sport sedan (+Z forward)';
  return result;
}

/** Drop-in replacement: white paint, baked detail colours, original world scale. */
export const carGeometry = (detail: 'traffic' | 'high' = 'traffic'): THREE.BufferGeometry => buildCar(detail);

/**
 * Optional close-up model. Unlike a global tint, paintColor only colours bodywork.
 * Traffic can continue using carGeometry() and its existing Lambert material.
 * No environment is allocated here: the scene owns lighting and reflection maps.
 */
export function carMesh(paintColor: THREE.ColorRepresentation = '#b9c5ce'): THREE.Mesh {
  const materials: THREE.Material[] = [
    new THREE.MeshPhysicalMaterial({ vertexColors: true, color: paintColor, metalness: 0.65, roughness: 0.27, clearcoat: 1, clearcoatRoughness: 0.16 }),
    // Opaque tinted glass keeps this exterior-only model free of transparency
    // sorting issues and avoids exposing an unfinished cabin through refraction.
    new THREE.MeshPhysicalMaterial({ vertexColors: true, metalness: 0.25, roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.06 }),
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.94 }),
    new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.86, roughness: 0.28 }),
    new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.12, roughness: 0.64 }),
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.2, emissive: '#d5edff', emissiveIntensity: 1.4 }),
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.28, emissive: '#d51c35', emissiveIntensity: 0.35 }),
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.4 }),
  ];
  const mesh = new THREE.Mesh(carGeometry('high'), materials);
  mesh.name = 'Sport sedan';
  mesh.castShadow = mesh.receiveShadow = true;
  return mesh;
}
