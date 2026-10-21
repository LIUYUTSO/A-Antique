// Flat things (paper, booklets, cards, discs) as thin GLB slabs built straight from their photos.
// Meshy would turn these into a melted plank, so they skip it and cost no credits.
// Front photo on one face, optional back photo on the other, plain paper tone on the edges.

import { Document } from '@gltf-transform/core';

export const KIND_THICKNESS_MM = { sheet: 0.4, card: 1.2, booklet: 3, disc: 1.5 };
const PAPER_EDGE = [0.92, 0.9, 0.84, 1];
const ASSUMED_LONG_SIDE_MM = 200;

export function imageSize(buf) {
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20), mime: 'image/png' };
  }
  if (buf[0] === 0xff && buf[1] === 0xd8) {
    let i = 2;
    while (i + 9 < buf.length) {
      if (buf[i] !== 0xff) { i++; continue; }
      const m = buf[i + 1];
      if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) {
        return { h: buf.readUInt16BE(i + 5), w: buf.readUInt16BE(i + 7), mime: 'image/jpeg' };
      }
      i += 2 + buf.readUInt16BE(i + 2);
    }
  }
  throw new Error('Unsupported image: need a PNG or JPEG');
}

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (v) => { const l = Math.hypot(...v) || 1; return v.map((x) => x / l); };

class Mesh {
  constructor() { this.pos = []; this.nrm = []; this.uv = []; this.idx = []; }
  quad(p, uv) {
    const n = norm(cross(sub(p[1], p[0]), sub(p[2], p[0])));
    const base = this.pos.length / 3;
    p.forEach((v, i) => { this.pos.push(...v); this.nrm.push(...n); this.uv.push(...uv[i]); });
    this.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
}

function boxMeshes(w, h, t) {
  const x = w / 2, y = h / 2, z = t / 2;
  const front = new Mesh(), back = new Mesh(), edge = new Mesh();
  front.quad([[-x, -y, z], [x, -y, z], [x, y, z], [-x, y, z]], [[0, 1], [1, 1], [1, 0], [0, 0]]);
  back.quad([[x, -y, -z], [-x, -y, -z], [-x, y, -z], [x, y, -z]], [[0, 1], [1, 1], [1, 0], [0, 0]]);
  const flat = [[0, 0], [1, 0], [1, 1], [0, 1]];
  edge.quad([[-x, y, z], [x, y, z], [x, y, -z], [-x, y, -z]], flat);
  edge.quad([[-x, -y, -z], [x, -y, -z], [x, -y, z], [-x, -y, z]], flat);
  edge.quad([[x, -y, z], [x, -y, -z], [x, y, -z], [x, y, z]], flat);
  edge.quad([[-x, -y, -z], [-x, -y, z], [-x, y, z], [-x, y, -z]], flat);
  return { front, back, edge };
}

function discMeshes(d, t, seg = 96) {
  const r = d / 2, z = t / 2;
  const front = new Mesh(), back = new Mesh(), edge = new Mesh();
  const cap = (m, sign) => {
    m.pos.push(0, 0, sign * z); m.nrm.push(0, 0, sign); m.uv.push(0.5, 0.5);
    for (let i = 0; i <= seg; i++) {
      const a = (i / seg) * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
      m.pos.push(r * c, r * s, sign * z); m.nrm.push(0, 0, sign);
      m.uv.push(0.5 + 0.5 * (sign > 0 ? c : -c), 0.5 - 0.5 * s);
    }
    for (let i = 1; i <= seg; i++) m.idx.push(...(sign > 0 ? [0, i, i + 1] : [0, i + 1, i]));
  };
  cap(front, 1); cap(back, -1);
  for (let i = 0; i <= seg; i++) {
    const a = (i / seg) * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
    edge.pos.push(r * c, r * s, z, r * c, r * s, -z); edge.nrm.push(c, s, 0, c, s, 0); edge.uv.push(i / seg, 0, i / seg, 1);
  }
  for (let i = 0; i < seg; i++) { const b = i * 2; edge.idx.push(b, b + 2, b + 1, b + 1, b + 2, b + 3); }
  return { front, back, edge };
}

// front/back: Buffer of PNG or JPEG. sizeMm: [width, height] in millimetres, or null when not measured yet.
export function buildFlat({ id, front, back, kind = 'sheet', sizeMm = null, thicknessMm = null, edgeColor = PAPER_EDGE }) {
  if (!(kind in KIND_THICKNESS_MM)) throw new Error(`Unknown kind "${kind}" (sheet, card, booklet, disc)`);
  const fImg = imageSize(front);
  let wMm, hMm, assumedSize = false;
  if (sizeMm) [wMm, hMm] = sizeMm;
  else {
    assumedSize = true;
    const k = ASSUMED_LONG_SIDE_MM / Math.max(fImg.w, fImg.h);
    wMm = fImg.w * k; hMm = fImg.h * k;
  }
  const tMm = thicknessMm ?? KIND_THICKNESS_MM[kind];
  const m = (mm) => mm / 1000; // glTF is in metres

  const doc = new Document();
  const buffer = doc.createBuffer();
  const mat = (name) => doc.createMaterial(name).setMetallicFactor(0).setRoughnessFactor(0.9);
  const frontMat = mat(`${id}-front`).setBaseColorTexture(doc.createTexture(`${id}-front`).setImage(new Uint8Array(front)).setMimeType(fImg.mime));
  const backMat = mat(`${id}-back`);
  if (back) backMat.setBaseColorTexture(doc.createTexture(`${id}-back`).setImage(new Uint8Array(back)).setMimeType(imageSize(back).mime));
  else backMat.setBaseColorFactor(edgeColor);
  const edgeMat = mat(`${id}-edge`).setBaseColorFactor(edgeColor);

  const parts = kind === 'disc' ? discMeshes(m(Math.min(wMm, hMm)), m(tMm)) : boxMeshes(m(wMm), m(hMm), m(tMm));
  const accessor = (type, arr, Ctor) => doc.createAccessor().setType(type).setArray(new Ctor(arr)).setBuffer(buffer);
  const mesh = doc.createMesh(id);
  for (const [key, material] of [['front', frontMat], ['back', backMat], ['edge', edgeMat]]) {
    const p = parts[key];
    mesh.addPrimitive(doc.createPrimitive()
      .setAttribute('POSITION', accessor('VEC3', p.pos, Float32Array))
      .setAttribute('NORMAL', accessor('VEC3', p.nrm, Float32Array))
      .setAttribute('TEXCOORD_0', accessor('VEC2', p.uv, Float32Array))
      .setIndices(accessor('SCALAR', p.idx, Uint16Array))
      .setMaterial(material));
  }
  doc.createScene(id).addChild(doc.createNode(id).setMesh(mesh));
  return { doc, assumedSize, sizeMm: [wMm, hMm, tMm] };
}
