// Thế giới 3D (Three.js, ngoài React): khách đi lại, ngồi bàn, cặp đôi lên lễ đường, camera lia, hiệu ứng.
import * as THREE from 'three';
import { Chibi, guestLook, weddingLook, type Look, type Pose, type WeddingSet } from './chibi3d';
import { AISLE_HALF, buildHall, GATE_Z, SEATS, STAGE_FRONT, STAGE_Y, STAGE_Z, STANDING, TABLES, type Seat } from './hall';
import { bubble, nameTag } from './tags';

export const W = 1080;
export const H = 1920;
const NPC_COUNT = 70; // khách đệm (không tên) cho rạp đông
const MAX_REAL = 160;
const TAGS_MAX = 36; // bảng tên tối đa mỗi khung hình (đông quá thì chỉ hiện người vừa tương tác)

type V3 = THREE.Vector3;
const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

interface Guest {
  id: string;
  name: string;
  real: boolean;
  c: Chibi;
  shadow: THREE.Mesh;
  avatar: HTMLImageElement | null;
  seat: Seat | null;
  spot: (typeof STANDING)[number] | null;
  path: V3[];
  speed: number;
  face: number | null; // hướng nhìn khi đứng yên
  action: { pose: Pose; until: number } | null;
  hold: { what: Parameters<Chibi['hold']>[0]; until: number } | null;
  title: { text: string; gold: boolean } | null;
  tag: HTMLCanvasElement | null;
  bubble: { cv: HTMLCanvasElement; until: number } | null;
  active: number; // lần cuối tương tác (để chọn bảng tên nào hiện)
  wedding: Look | null; // đang mặc đồ cưới
  baseLook: Look;
  role: 'groom' | 'bride' | null; // đang là cô dâu / chú rể trên lễ đường
}

type CamMode = 'wide' | 'gate' | 'aisle' | 'stage';

export interface WorldEvents {
  coupleAtGate?: () => void;
  coupleOnStage?: () => void;
}

class World {
  events: WorldEvents = {};
  private renderer: THREE.WebGLRenderer | null = null;
  private overlay: CanvasRenderingContext2D | null = null;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(46, W / H, 0.1, 120);
  private camPos = v(0, 10.5, 12.5);
  private camLook = v(0, 0, -15);
  private hemi = new THREE.HemisphereLight('#fff7f0', '#d9c2b0', 1.6);
  private guests = new Map<string, Guest>();
  private npcs: Guest[] = [];
  private mcM: Chibi;
  private mcF: Chibi;
  private speaker: 'M' | 'F' | null = null;
  private hall: ReturnType<typeof buildHall>;
  private raf = 0;
  private last = 0;
  private t = 0;
  private base: CamMode = 'wide';
  private focus: { id: string | null; mode: CamMode | null; until: number } = { id: null, mode: null, until: 0 };
  private couple: { groom: string | null; bride: string | null; mode: 'none' | 'gate' | 'walk' | 'stage' } = { groom: null, bride: null, mode: 'none' };
  private partyUntil = 0;
  private fx: Particles;
  private hearts: Particles;
  private ring: THREE.Mesh;
  private ringAnim: { from: V3; to: V3; t0: number } | null = null;
  private shadowGeo = new THREE.CircleGeometry(0.32, 16);
  private shadowMat = new THREE.MeshBasicMaterial({ color: '#000000', transparent: true, opacity: 0.16, depthWrite: false });
  private glow: THREE.Mesh;

  constructor() {
    const s = this.scene;
    s.background = new THREE.Color('#fbe9ee');
    s.fog = new THREE.Fog('#fbe9ee', 30, 60);
    s.add(this.hemi);
    const sun = new THREE.DirectionalLight('#ffffff', 1.3);
    sun.position.set(4, 12, 10);
    s.add(sun);
    this.hall = buildHall(s);

    // 2 MC: anh MC vest đen nơ đỏ, chị MC áo dài hồng
    this.mcM = new Chibi({ ...guestLook('mc-nam'), body: 'suit', main: '#16161c', pants: '#16161c', accent: '#111111', hair: '#1b1512', longHair: false, hat: 'none', flower: true }, 1.15);
    this.mcF = new Chibi({ ...guestLook('mc-nu'), body: 'aodaiF', main: '#ff8fab', pants: '#ffffff', accent: '#f6c453', hair: '#2b1d16', longHair: true, hat: 'none' }, 1.15);
    this.mcM.root.position.set(-4.2, STAGE_Y, -21.2);
    this.mcF.root.position.set(4.2, STAGE_Y, -21.2);
    this.mcM.root.rotation.y = 0.35;
    this.mcF.root.rotation.y = -0.35;
    this.mcM.hold('mic');
    this.mcF.hold('mic');
    s.add(this.mcM.root, this.mcF.root);

    this.fx = new Particles(2600, 0.16, squareTex());
    this.hearts = new Particles(500, 0.5, heartTex());
    s.add(this.fx.points, this.hearts.points);

    this.ring = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.05, 10, 24), new THREE.MeshLambertMaterial({ color: '#ffd166', emissive: '#7a5a00' }));
    this.ring.visible = false;
    s.add(this.ring);

    // vòng sáng dưới chân cặp đôi
    this.glow = new THREE.Mesh(new THREE.RingGeometry(0.5, 1.4, 32), new THREE.MeshBasicMaterial({ color: '#ffd6e0', transparent: true, opacity: 0.6, depthWrite: false }));
    this.glow.rotation.x = -Math.PI / 2;
    this.glow.visible = false;
    s.add(this.glow);

    for (let i = 0; i < NPC_COUNT; i++) this.addNpc(i);
  }

  // ---------- gắn vào trang ----------
  attach(gl: HTMLCanvasElement, overlay: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas: gl, antialias: true });
    this.renderer.setPixelRatio(1);
    this.renderer.setSize(W, H, false);
    this.overlay = overlay.getContext('2d');
    this.last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.05, Math.max(0, (now - this.last) / 1000));
      this.last = now;
      this.step(dt);
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  detach() {
    cancelAnimationFrame(this.raf);
    this.renderer?.dispose();
    this.renderer = null;
    this.overlay = null;
  }

  // ---------- khách ----------
  private makeGuest(id: string, name: string, real: boolean, look: Look): Guest {
    const c = new Chibi(look);
    const shadow = new THREE.Mesh(this.shadowGeo, this.shadowMat);
    shadow.rotation.x = -Math.PI / 2;
    this.scene.add(c.root, shadow);
    return {
      id, name, real, c, shadow, avatar: null, seat: null, spot: null, path: [], speed: 2.2, face: null, action: null, hold: null,
      title: null, tag: null, bubble: null, active: 0, wedding: null, baseLook: look, role: null,
    };
  }

  private addNpc(i: number) {
    const free = SEATS.filter((s) => !s.taken);
    if (!free.length) return;
    const seat = free[Math.floor(Math.random() * free.length)];
    const g = this.makeGuest(`npc${i}-${Math.random()}`, '', false, guestLook(`npc-${i}-${Math.random()}`));
    seat.taken = g.id;
    g.seat = seat;
    g.c.root.position.set(seat.x, 0, seat.z);
    this.npcs.push(g);
  }

  private removeGuest(g: Guest) {
    this.scene.remove(g.c.root, g.shadow);
    if (g.seat) g.seat.taken = null;
    if (g.spot) g.spot.taken = null;
  }

  has(id: string) {
    return this.guests.has(id);
  }

  get count() {
    return this.guests.size;
  }

  ids() {
    return [...this.guests.keys()];
  }

  nameOf(id: string) {
    return this.guests.get(id)?.name ?? id;
  }

  /** Người xem comment: vào từ cổng hoa, đi tìm ghế */
  ensure(id: string, name: string, avatarUrl = '') {
    let g = this.guests.get(id);
    if (g) {
      g.active = Date.now();
      if (name !== g.name) {
        g.name = name;
        g.tag = null;
      }
    } else {
      if (this.guests.size >= MAX_REAL) {
        const old = [...this.guests.values()].filter((x) => !x.role).sort((a, b) => a.active - b.active)[0];
        if (old) {
          this.removeGuest(old);
          this.guests.delete(old.id);
        }
      }
      g = this.makeGuest(id, name, true, guestLook(id));
      g.active = Date.now();
      g.c.root.position.set((Math.random() - 0.5) * 1.2, 0, GATE_Z + 2.5);
      this.guests.set(id, g);
      this.takePlace(g);
    }
    if (avatarUrl && !g.avatar) {
      const img = new Image();
      img.referrerPolicy = 'no-referrer';
      const guest = g;
      img.onload = () => {
        guest.avatar = img;
        guest.tag = null;
      };
      img.src = avatarUrl;
    }
  }

  /** Tìm ghế (mời bớt khách đệm nếu hết), hết ghế thì đứng dọc tường */
  private takePlace(g: Guest) {
    let seat = SEATS.find((s) => !s.taken) ?? null;
    if (!seat && this.npcs.length) {
      const npc = this.npcs.splice(Math.floor(Math.random() * this.npcs.length), 1)[0];
      seat = npc.seat;
      this.poof(npc.c.root.position, 20);
      this.removeGuest(npc);
    }
    if (seat) {
      seat.taken = g.id;
      g.seat = seat;
    } else {
      const spot = STANDING.find((p) => !p.taken);
      if (spot) {
        spot.taken = g.id;
        g.spot = spot;
      }
    }
    this.goHome(g);
  }

  /** Đi về ghế: xuống sân khấu nếu đang ở trên, theo thảm đỏ, rẽ vào lối giữa 2 hàng bàn */
  private goHome(g: Guest) {
    const p = g.c.root.position;
    const path: V3[] = [];
    if (p.z < STAGE_FRONT) path.push(v(Math.sign(p.x) * 0.4, STAGE_Y, STAGE_FRONT - 0.2), v(Math.sign(p.x) * 0.4, 0, STAGE_FRONT + 0.8));
    const home = g.seat ?? g.spot;
    if (home) {
      const table = g.seat ? TABLES[g.seat.table] : null;
      const lane = table ? table.z + 2.2 : home.z;
      if (Math.abs(p.x) > AISLE_HALF + 0.2) path.push(v(p.x, 0, lane), v(home.x, 0, lane));
      else path.push(v(p.x * 0.3, 0, lane), v(home.x, 0, lane));
      path.push(v(home.x, 0, home.z));
    }
    g.path = path;
    g.face = g.seat ? g.seat.face : g.spot ? (g.spot.x < 0 ? Math.PI / 2 : -Math.PI / 2) : 0;
  }

  say(id: string, text: string, ms = 5000) {
    const g = this.guests.get(id);
    if (!g) return;
    g.bubble = { cv: bubble(text), until: Date.now() + ms };
    g.active = Date.now();
  }

  setTitle(id: string, title: { text: string; gold: boolean } | null) {
    const g = this.guests.get(id);
    if (!g) return;
    g.title = title;
    g.tag = null;
  }

  act(id: string, pose: Pose, ms = 3000) {
    const g = this.guests.get(id);
    if (g) g.action = { pose, until: Date.now() + ms };
  }

  /** gõ ZÔ: nâng ly */
  zo(id: string) {
    const g = this.guests.get(id);
    if (!g || g.role) return;
    g.action = { pose: g.seat && !g.path.length ? 'zo' : 'cheer', until: Date.now() + 3500 };
    g.hold = { what: 'glass', until: Date.now() + 3500 };
    g.c.hold('glass');
  }

  // ---------- camera ----------
  /** Lia camera tới 1 người / 1 cảnh trong `ms` rồi về cảnh chính */
  look(target: string | CamMode, ms = 4000) {
    if (target === 'wide' || target === 'gate' || target === 'aisle' || target === 'stage') this.focus = { id: null, mode: target, until: Date.now() + ms };
    else if (this.guests.has(target)) this.focus = { id: target, mode: null, until: Date.now() + ms };
  }

  setBaseCamera(mode: CamMode) {
    this.base = mode;
  }

  private updateCamera(dt: number) {
    const now = Date.now();
    let mode: CamMode | null = this.base;
    let gid: string | null = null;
    if (now < this.focus.until) {
      mode = this.focus.mode;
      gid = this.focus.id;
    }
    const pos = v(0, 0, 0);
    const look = v(0, 0, 0);
    const g = gid ? this.guests.get(gid) : null;
    if (g) {
      const p = g.c.root.position;
      pos.set(p.x * 0.85, p.y + 2.6, p.z + 4.8);
      look.set(p.x, p.y + 0.85, p.z);
    } else if (mode === 'gate') {
      // đứng phía sân khấu nhìn ra cổng hoa: thấy mặt 2 người
      pos.set(Math.sin(this.t * 0.3) * 0.5, 3.2, GATE_Z - 7.5);
      look.set(0, 0.8, GATE_Z - 1.6);
    } else if (mode === 'aisle') {
      const m = this.coupleMid() ?? v(0, 0, 0);
      // lùi trước mặt cặp đôi như quay phim đám cưới thật
      pos.set(m.x + 1.2, m.y + 2.8, m.z - 6.5);
      look.set(m.x, m.y + 0.8, m.z + 0.5);
    } else if (mode === 'stage') {
      pos.set(Math.sin(this.t * 0.25) * 1.2, STAGE_Y + 3.2, STAGE_Z + 8.5);
      look.set(0, STAGE_Y + 1.3, STAGE_Z);
    } else {
      pos.set(Math.sin(this.t * 0.08) * 1.8, 10.5, 12.5);
      look.set(0, 0, -15);
    }
    const k = 1 - Math.exp(-dt * 2.2);
    this.camPos.lerp(pos, k);
    this.camLook.lerp(look, k);
    this.camera.position.copy(this.camPos);
    this.camera.lookAt(this.camLook);
  }

  private coupleMid() {
    const a = this.couple.groom ? this.guests.get(this.couple.groom) : null;
    const b = this.couple.bride ? this.guests.get(this.couple.bride) : null;
    if (a && b) return a.c.root.position.clone().add(b.c.root.position).multiplyScalar(0.5);
    return (a ?? b)?.c.root.position.clone() ?? null;
  }

  // ---------- lễ cưới ----------
  get coupleIds() {
    return { ...this.couple };
  }

  private gateSpot(role: 'groom' | 'bride') {
    return v(role === 'groom' ? -0.65 : 0.65, 0, GATE_Z - 1.6);
  }

  private walkTo(g: Guest, path: V3[], face: number, speed = 2.2) {
    g.path = path;
    g.face = face;
    g.speed = speed;
  }

  /** Cầu hôn: người gõ ra cổng hoa quỳ chờ; người kia (nếu đang trong tiệc) ra đứng đối diện */
  proposal(proposer: string, proposerRole: 'groom' | 'bride', target: string | null) {
    this.clearStage();
    const a = this.guests.get(proposer);
    if (!a) return;
    this.couple = { groom: null, bride: null, mode: 'gate' };
    this.couple[proposerRole] = proposer;
    a.role = proposerRole;
    this.walkTo(a, [v(a.c.root.position.x * 0.3, 0, a.c.root.position.z), this.gateSpot(proposerRole)], proposerRole === 'groom' ? Math.PI / 2 : -Math.PI / 2, 3);
    a.action = { pose: 'kneel', until: Date.now() + 60_000 };
    a.c.hold('ring');
    a.hold = { what: 'ring', until: Date.now() + 60_000 };
    if (target) this.targetCome(target, proposerRole === 'groom' ? 'bride' : 'groom');
    this.base = 'gate';
  }

  /** người được hỏi bước ra cổng hoa */
  targetCome(id: string, role: 'groom' | 'bride') {
    const b = this.guests.get(id);
    if (!b || b.role) return;
    this.couple[role] = id;
    b.role = role;
    this.walkTo(b, [v(b.c.root.position.x * 0.3, 0, b.c.root.position.z), this.gateSpot(role)], role === 'groom' ? Math.PI / 2 : -Math.PI / 2, 3);
  }

  /** Đồng ý: đổi đồ cưới, khoác tay nhau đi thảm đỏ lên sân khấu */
  accept(set: WeddingSet) {
    const ids = [this.couple.groom, this.couple.bride];
    for (const id of ids) {
      const g = id ? this.guests.get(id) : null;
      if (!g) continue;
      g.action = null;
      g.hold = null;
      g.c.hold(null);
      this.dress(g, set);
    }
    this.hearts.burst(this.gateSpot('groom').add(v(0.65, 1.4, 0)), 40, ['#ff4d6d', '#ff8fab', '#ffffff'], 2.5, -1);
    setTimeout(() => this.walkAisle(), 1800);
  }

  private dress(g: Guest, set: WeddingSet) {
    if (!g.role) return;
    g.wedding = weddingLook(g.baseLook, g.role === 'groom' ? set.groom : set.bride);
    g.c.setLook(g.wedding);
    this.poof(g.c.root.position, 50);
  }

  private walkAisle() {
    this.couple.mode = 'walk';
    this.base = 'aisle';
    for (const role of ['groom', 'bride'] as const) {
      const id = this.couple[role];
      const g = id ? this.guests.get(id) : null;
      if (!g) continue;
      const x = role === 'groom' ? -0.38 : 0.38;
      this.walkTo(g, [v(x, 0, GATE_Z - 2), v(x, 0, STAGE_FRONT + 0.8), v(x, 0.3, STAGE_FRONT + 0.3), v(x, STAGE_Y, STAGE_FRONT - 0.4), v(x * 1.4, STAGE_Y, STAGE_Z)], 0, 1.5);
    }
  }

  /** Cướp: người mới chạy tới thế chỗ, người cũ bị hất ngã rồi khóc về chỗ */
  steal(oldId: string, newId: string) {
    const o = this.guests.get(oldId);
    const n = this.guests.get(newId);
    if (!o || !n || !o.role) return;
    const role = o.role;
    if (n.role) return;
    this.couple[role] = newId;
    n.role = role;
    if (o.wedding) {
      n.wedding = { ...o.wedding, skin: n.baseLook.skin, hair: n.baseLook.hair };
      n.c.setLook(n.wedding);
    }
    // người mới chạy thật nhanh tới chỗ người cũ, rồi đi tiếp đúng đường người cũ đang đi
    n.path = [o.c.root.position.clone(), ...o.path.map((p) => p.clone())];
    n.face = o.face;
    n.speed = 6;
    if (o.action?.pose === 'kneel') {
      n.action = { ...o.action };
      n.hold = o.hold;
      if (o.hold) n.c.hold(o.hold.what);
    }
    setTimeout(() => (n.speed = this.couple.mode === 'walk' ? 1.5 : 3), 1800);
    // người cũ: văng ra, ngã, khóc, về chỗ (đồ cưới bị lột)
    o.role = null;
    o.path = [];
    o.hold = null;
    o.c.hold(null);
    o.action = { pose: 'fall', until: Date.now() + 2200 };
    o.c.root.position.x += role === 'groom' ? -1.4 : 1.4;
    o.bubble = { cv: bubble('😭 Trả người yêu đây!'), until: Date.now() + 6000 };
    setTimeout(() => {
      if (o.role) return;
      o.wedding = null;
      o.c.setLook(o.baseLook);
      o.action = { pose: 'cry', until: Date.now() + 2500 };
      setTimeout(() => !o.role && this.goHome(o), 2500);
    }, 2200);
    this.look('aisle', 4000);
  }

  /** Từ chối / hết giờ: người cầu hôn khóc về chỗ */
  reject() {
    const ids = [this.couple.groom, this.couple.bride];
    this.couple = { groom: null, bride: null, mode: 'none' };
    this.base = 'wide';
    for (const id of ids) {
      const g = id ? this.guests.get(id) : null;
      if (!g) continue;
      g.role = null;
      g.hold = null;
      g.c.hold(null);
      g.action = { pose: 'cry', until: Date.now() + 3000 };
      setTimeout(() => !g.role && this.goHome(g), 3000);
    }
  }

  ringExchange() {
    const m = this.coupleMid();
    if (!m) return;
    this.ring.visible = true;
    this.ringAnim = { from: this.mcM.root.position.clone().add(v(0.3, 1.2, 0)), to: m.clone().add(v(0, 1.0, 0.3)), t0: this.t };
  }

  /** cô dâu chú rể ôm nhau, tim bay */
  hug(ms = 5000) {
    for (const id of [this.couple.groom, this.couple.bride]) {
      const g = id ? this.guests.get(id) : null;
      if (!g) continue;
      g.action = { pose: 'hug', until: Date.now() + ms };
      g.c.root.position.x *= 0.55;
    }
    const m = this.coupleMid();
    if (m) this.hearts.burst(m.add(v(0, 1.4, 0)), 60, ['#ff4d6d', '#ff8fab', '#ffffff'], 2.5, -1);
  }

  /** Cặp đôi đứng vẫy tay trên sân khấu tới khi có đám mới */
  wave(ms = 8000) {
    for (const id of [this.couple.groom, this.couple.bride]) if (id) this.act(id, 'wave', ms);
  }

  /** Đám cũ xuống sân khấu về chỗ (vẫn mặc đồ cưới) */
  clearStage() {
    for (const id of [this.couple.groom, this.couple.bride]) {
      const g = id ? this.guests.get(id) : null;
      if (!g) continue;
      g.role = null;
      g.action = null;
      this.goHome(g);
    }
    this.couple = { groom: null, bride: null, mode: 'none' };
    this.base = 'wide';
  }

  setNames(groom: string, bride: string) {
    this.hall.setNames(groom, bride);
  }

  setSpeaker(who: 'M' | 'F' | null) {
    this.speaker = who;
  }

  // ---------- hiệu ứng ----------
  confetti(n = 200) {
    for (let i = 0; i < n; i++)
      this.fx.add(v((Math.random() - 0.5) * 22, 7 + Math.random() * 4, -22 + Math.random() * 30), v(0, -1.2, 0), randColor(), 7, 0.7);
  }

  petals(n = 200) {
    for (let i = 0; i < n; i++)
      this.fx.add(v((Math.random() - 0.5) * 22, 7 + Math.random() * 4, -22 + Math.random() * 30), v(0, -0.8, 0), Math.random() < 0.6 ? '#ff8fab' : '#ffffff', 9, 1.2);
  }

  goldRain(n = 300) {
    for (let i = 0; i < n; i++)
      this.fx.add(v((Math.random() - 0.5) * 22, 7 + Math.random() * 5, -24 + Math.random() * 32), v(0, -2, 0), Math.random() < 0.7 ? '#ffd166' : '#fff3b0', 6, 0.3);
  }

  fireworks(n = 4) {
    for (let k = 0; k < n; k++)
      setTimeout(() => {
        const at = v((Math.random() - 0.5) * 12, 6 + Math.random() * 2.5, -24 + Math.random() * 10);
        const c = randColor();
        this.fx.burst(at, 90, [c, '#ffffff', c], 4.5, 3);
      }, k * 450);
  }

  heartsAt(id: string, n = 20) {
    const g = this.guests.get(id);
    if (g) this.hearts.burst(g.c.root.position.clone().add(v(0, 1.4, 0)), n, ['#ff4d6d', '#ff8fab'], 1.8, -1);
  }

  heartsRain(n = 80) {
    for (let i = 0; i < n; i++)
      this.hearts.add(v((Math.random() - 0.5) * 20, 7 + Math.random() * 3, -20 + Math.random() * 26), v(0, -1, 0), Math.random() < 0.5 ? '#ff4d6d' : '#ff8fab', 7, 0.5);
  }

  private poof(at: V3, n: number) {
    this.fx.burst(at.clone().add(v(0, 0.8, 0)), n, ['#ffffff', '#ffe5ec', '#ffd166'], 2.2, 0);
  }

  /** cả sảnh đứng dậy nhảy, đèn đổi màu */
  partyAll(ms = 10000) {
    this.partyUntil = Date.now() + ms;
  }

  // ---------- mỗi khung hình ----------
  private step(dt: number) {
    this.t += dt;
    const now = Date.now();
    const party = now < this.partyUntil;
    this.hemi.color.setHSL(party ? (this.t * 0.25) % 1 : 0.05, party ? 0.8 : 0.3, party ? 0.75 : 0.97);

    const all = [...this.guests.values(), ...this.npcs];
    for (const g of all) this.stepGuest(g, dt, now, party);

    // MC
    for (const [mc, who] of [[this.mcM, 'M'], [this.mcF, 'F']] as const) {
      mc.pose = this.speaker === who ? 'talk' : party ? 'dance' : 'stand';
      mc.update(this.t, false);
    }

    // vòng sáng dưới cặp đôi
    const mid = this.couple.mode !== 'none' ? this.coupleMid() : null;
    this.glow.visible = !!mid;
    if (mid) {
      this.glow.position.set(mid.x, mid.y + 0.03, mid.z);
      this.glow.scale.setScalar(1 + Math.sin(this.t * 3) * 0.08);
    }

    // nhẫn bay
    if (this.ringAnim) {
      const k = Math.min(1, (this.t - this.ringAnim.t0) / 1.8);
      this.ring.position.lerpVectors(this.ringAnim.from, this.ringAnim.to, k);
      this.ring.position.y += Math.sin(k * Math.PI) * 1.5;
      this.ring.rotation.y += dt * 8;
      if (k >= 1) {
        this.hearts.burst(this.ring.position.clone(), 40, ['#ffd166', '#ff8fab', '#ffffff'], 2.2, -1);
        this.ring.visible = false;
        this.ringAnim = null;
      }
    }

    this.fx.update(dt);
    this.hearts.update(dt);
    (this.hall.fairy.material as THREE.PointsMaterial).size = 0.08 + Math.abs(Math.sin(this.t * 2)) * 0.04;

    this.updateCamera(dt);
    this.renderer?.render(this.scene, this.camera);
    this.drawOverlay(now);
  }

  private stepGuest(g: Guest, dt: number, now: number, party: boolean) {
    const r = g.c.root;
    let moving = false;
    const target = g.path[0];
    if (target) {
      const dx = target.x - r.position.x;
      const dz = target.z - r.position.z;
      const dist = Math.hypot(dx, dz);
      const stepLen = g.speed * dt;
      if (dist <= Math.max(stepLen, 0.02)) {
        r.position.copy(target);
        g.path.shift();
        if (!g.path.length) this.arrived(g);
      } else {
        r.position.x += (dx / dist) * stepLen;
        r.position.z += (dz / dist) * stepLen;
        r.position.y += (target.y - r.position.y) * Math.min(1, stepLen / dist);
        r.rotation.y = turn(r.rotation.y, Math.atan2(dx, dz), dt * 10);
        moving = true;
      }
    } else if (g.face !== null) r.rotation.y = turn(r.rotation.y, g.face, dt * 6);

    if (g.action && now > g.action.until) g.action = null;
    if (g.hold && now > g.hold.until) {
      g.hold = null;
      g.c.hold(null);
    }
    const home = !g.path.length && !g.role && g.seat && Math.hypot(r.position.x - g.seat.x, r.position.z - g.seat.z) < 0.05;
    let pose: Pose = g.action?.pose ?? (home ? 'sit' : 'stand');
    if (party && !g.action && !g.role) pose = home ? 'zo' : 'dance';
    if (party && g.role && !g.action) pose = 'dance';
    g.c.pose = pose;
    g.c.update(this.t, moving);
    g.shadow.position.set(r.position.x, r.position.y + 0.015, r.position.z);
    if (g.bubble && now > g.bubble.until) g.bubble = null;
  }

  private arrived(g: Guest) {
    if (!g.role) return;
    const c = this.couple;
    const others = [c.groom, c.bride].map((id) => (id ? this.guests.get(id) : null));
    if (others.some((o) => !o || o.path.length)) return;
    if (c.mode === 'gate' && others.every((o) => o && Math.abs(o.c.root.position.z - (GATE_Z - 1.6)) < 0.1)) this.events.coupleAtGate?.();
    if (c.mode === 'walk') {
      c.mode = 'stage';
      this.base = 'stage';
      this.events.coupleOnStage?.();
    }
  }

  // ---------- bảng tên + bong bóng (lớp 2D phủ trên cảnh 3D) ----------
  private drawOverlay(now: number) {
    const ctx = this.overlay;
    if (!ctx) return;
    ctx.clearRect(0, 0, W, H);
    const cam = this.camera;
    const list: { g: Guest; x: number; y: number; d: number }[] = [];
    const p = new THREE.Vector3();
    for (const g of this.guests.values()) {
      p.copy(g.c.root.position);
      p.y += 1.55;
      const d = p.distanceTo(cam.position);
      p.project(cam);
      if (p.z > 1 || p.x < -1.1 || p.x > 1.1 || p.y < -1.1 || p.y > 1.1) continue;
      const y = ((1 - p.y) / 2) * H;
      if (y < 600 && !g.role) continue; // không đè lên tiêu đề + bảng hướng dẫn
      list.push({ g, x: ((p.x + 1) / 2) * W, y, d });
    }
    // đông quá: ưu tiên cô dâu chú rể, người đang nói, người vừa tương tác
    const score = (e: (typeof list)[number]) => (e.g.role ? 1e13 : 0) + (e.g.bubble ? 1e12 : 0) + e.g.active;
    const shown = list.length > TAGS_MAX ? [...list].sort((a, b) => score(b) - score(a)).slice(0, TAGS_MAX) : list;
    shown.sort((a, b) => b.d - a.d); // xa vẽ trước, gần đè lên
    for (const { g, x, y, d } of shown) {
      const s = Math.max(0.32, Math.min(1.1, 9 / d)) * (g.role ? 1.25 : 1);
      if (!g.tag) {
        const title = g.role ? { text: g.role === 'groom' ? '🤵 CHÚ RỂ' : '👰 CÔ DÂU', gold: true } : g.title;
        g.tag = nameTag(g.name, g.avatar, g.role ? '#c9184a' : '#7a2e43', title);
      }
      const tw = g.tag.width * 0.5 * s;
      const th = g.tag.height * 0.5 * s;
      ctx.drawImage(g.tag, x - tw / 2, y - th, tw, th);
      if (g.bubble) {
        const bw = g.bubble.cv.width * 0.5 * Math.max(0.6, s);
        const bh = g.bubble.cv.height * 0.5 * Math.max(0.6, s);
        ctx.drawImage(g.bubble.cv, Math.max(110, Math.min(W - 110 - bw, x - bw / 2)), y - th - bh - 6, bw, bh);
      }
      void now;
    }
  }

  /** gán lại bảng tên khi đổi vai (cô dâu/chú rể) */
  refreshTag(id: string) {
    const g = this.guests.get(id);
    if (g) g.tag = null;
  }

  someGuests(n: number) {
    const ids = [...this.guests.values()].filter((g) => !g.role).map((g) => g.id);
    const out: string[] = [];
    while (out.length < n && ids.length) out.push(ids.splice(Math.floor(Math.random() * ids.length), 1)[0]);
    return out;
  }

  reset() {
    for (const g of this.guests.values()) this.removeGuest(g);
    this.guests.clear();
    this.couple = { groom: null, bride: null, mode: 'none' };
    this.base = 'wide';
    for (const n of this.npcs) this.removeGuest(n);
    this.npcs = [];
    for (let i = 0; i < NPC_COUNT; i++) this.addNpc(i);
  }
}

// ---------- hạt: pháo giấy, pháo hoa, tim ----------
class Particles {
  points: THREE.Points;
  private pos: Float32Array;
  private col: Float32Array;
  private vel: Float32Array;
  private life: Float32Array;
  private sway: Float32Array;
  private grav: Float32Array;
  private n = 0;
  private next = 0;

  constructor(private max: number, size: number, map: THREE.Texture) {
    this.pos = new Float32Array(max * 3).fill(-999);
    this.col = new Float32Array(max * 3);
    this.vel = new Float32Array(max * 3);
    this.life = new Float32Array(max);
    this.sway = new Float32Array(max);
    this.grav = new Float32Array(max);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    this.points = new THREE.Points(g, new THREE.PointsMaterial({ size, map, vertexColors: true, transparent: true, alphaTest: 0.3, depthWrite: false }));
    this.points.frustumCulled = false;
  }

  add(p: V3, vel: V3, color: string, life: number, sway = 0, grav = 0) {
    const i = this.next;
    this.next = (this.next + 1) % this.max;
    this.n = Math.max(this.n, this.next === 0 ? this.max : this.next);
    this.pos.set([p.x, p.y, p.z], i * 3);
    this.vel.set([vel.x + (Math.random() - 0.5) * 0.3, vel.y * (0.7 + Math.random() * 0.6), vel.z + (Math.random() - 0.5) * 0.3], i * 3);
    const c = new THREE.Color(color);
    this.col.set([c.r, c.g, c.b], i * 3);
    this.life[i] = life * (0.7 + Math.random() * 0.5);
    this.sway[i] = sway;
    this.grav[i] = grav;
  }

  /** nổ tung từ 1 điểm. grav > 0 rơi xuống, < 0 bay lên */
  burst(at: V3, n: number, colors: string[], speed: number, grav: number) {
    for (let k = 0; k < n; k++) {
      const d = v(Math.random() - 0.5, Math.random() - 0.3, Math.random() - 0.5).normalize().multiplyScalar(speed * (0.4 + Math.random() * 0.6));
      this.add(at, d, colors[k % colors.length], 2.2, 0, grav);
    }
  }

  update(dt: number) {
    for (let i = 0; i < this.n; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= dt;
      if (this.life[i] <= 0) {
        this.pos[i * 3 + 1] = -999;
        continue;
      }
      this.vel[i * 3 + 1] -= this.grav[i] * dt;
      const s = this.sway[i] ? Math.sin(this.life[i] * 3 + i) * this.sway[i] : 0;
      this.pos[i * 3] += (this.vel[i * 3] + s) * dt;
      this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
      this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      if (this.pos[i * 3 + 1] < 0.02 && this.grav[i] >= 0) this.vel.set([0, 0, 0], i * 3); // nằm trên sàn
    }
    (this.points.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    (this.points.geometry.attributes.color as THREE.BufferAttribute).needsUpdate = true;
  }
}

function turn(from: number, to: number, k: number) {
  let d = to - from;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return from + d * Math.min(1, k);
}

const COLORS = ['#ff4d6d', '#ffd166', '#06d6a0', '#4cc9f0', '#f72585', '#ffffff', '#b5179e', '#ff9f1c'];
const randColor = () => COLORS[Math.floor(Math.random() * COLORS.length)];

function squareTex() {
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const x = c.getContext('2d')!;
  x.fillStyle = '#fff';
  x.fillRect(6, 9, 20, 14);
  return new THREE.CanvasTexture(c);
}

function heartTex() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const x = c.getContext('2d')!;
  x.fillStyle = '#fff';
  x.font = '56px sans-serif';
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  x.fillText('♥', 32, 36);
  return new THREE.CanvasTexture(c);
}

export const world = new World();
// để kiểm tra trong DevTools
(window as unknown as { cw: World }).cw = world;
