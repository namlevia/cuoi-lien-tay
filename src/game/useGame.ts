import { useEffect, useRef, useState } from 'react';
import { useLiveEvents } from '../live/useLiveEvents';
import type { GiftEvent, LiveStatus } from '../live/types';
import { voice, speakableName } from '../live/voice';
import { containsBanned, maskBanned } from '../live/bannedWords';
import { NameBatcher } from '../live/scoreboard';
import { GiftThanker, OncePerPerson, RecentPeople, plain } from '../live/chatter';
import { NGUYEN, type Nguyen } from './seDuyen';
import { IS_STAGE } from '../live/page';
import { GAME } from './config';
import { exactName, matchName, namePrefixes, other, parseCommand, pickRole, type Role } from './rules';
import { pickWeddingSet } from './world/chibi3d';
import { world } from './world/world';
import { music } from './music';

// Bốc kiểu "rút bài": đọc hết 1 vòng mới lặp lại, để giọng MC không bị nhắc lại câu cũ
const bags = new Map<readonly unknown[], number[]>();
function pick<T>(list: readonly T[]): T | undefined {
  if (!list.length) return undefined;
  let bag = bags.get(list);
  if (!bag?.length) {
    bag = list.map((_, i) => i).sort(() => Math.random() - 0.5);
    bags.set(list, bag);
  }
  return list[bag.pop()!];
}

export type Phase = 'idle' | 'proposal' | 'walk' | 'vows' | 'after';

/** Đám cưới đang diễn ra */
interface Wedding {
  phase: Phase;
  ids: Record<Role, string | null>; // ai đang là chú rể / cô dâu
  stealRole: Role; // vai bị cướp: vai của người gõ cầu hôn
  targetName: string; // tên được @ (khi người đó chưa vào tiệc)
  until: number; // hạn trả lời
  nudged: number;
}

interface Pending {
  id: string;
  role: Role | 'any';
  target: string;
}

export interface WeddingView {
  phase: Phase;
  groom: string;
  bride: string;
  groomAva: string;
  brideAva: string;
  stealRole: Role;
  price: number;
  until: number;
  waiting: string; // tên người đang được hỏi (chưa trả lời)
}

/** Mỗi việc chỉ cho phép 1 lần / `ms` */
function limiter(ms: number) {
  const last = new Map<string, number>();
  return (key: string, now = Date.now()) => {
    if (now - (last.get(key) ?? -Infinity) < ms) return false;
    last.set(key, now);
    return true;
  };
}

export function useGame() {
  const [status, setStatus] = useState<LiveStatus | null>(null);
  const [channelName, setChannelName] = useState(GAME.defaultChannelName);
  const [lastGift, setLastGift] = useState<(GiftEvent & { coins: number }) | null>(null);
  const [likeProgress, setLikeProgress] = useState(0);
  const [guestCount, setGuestCount] = useState(0);
  const [view, setView] = useState<WeddingView | null>(null);
  const [queueLen, setQueueLen] = useState(0);
  const [married, setMarried] = useState(0);
  const [duyen, setDuyen] = useState<{ until: number; count: number } | null>(null);
  const [nguyen, setNguyen] = useState<Nguyen | null>(null);
  const [stageCount, setStageCount] = useState(0);
  const [likeNext, setLikeNext] = useState(GAME.likeMilestones[0]);
  const [vote, setVote] = useState<{ until: number; yes: number; no: number } | null>(null);
  const [dark, setDark] = useState(false);
  const likeBase = useRef<number | null>(null);
  const avatars = useRef(new Map<string, string>());
  const names = useRef(new Map<string, string>()); // id -> tên hiển thị (đã che từ bậy)

  const [s] = useState(() => ({
    greeter: new NameBatcher(
      GAME.greetEveryMs,
      GAME.namesPerGreeting,
      (n) => voice.say(pick(GAME.greetings)!(joinNames(n))),
      () => voice.waiting >= 2,
    ),
    gifts: new GiftThanker(GAME.giftThanksCooldownMs, GAME.giftBig),
    follows: new OncePerPerson(),
    recent: new RecentPeople(),
    w: null as Wedding | null,
    queue: [] as Pending[],
    married: 0,
    vowsNo: 0,
    lastWeddingAt: Date.now(),
    zoCount: [] as number[],
    zoLimit: limiter(60_000),
    nudgeLimit: limiter(15_000),
    stealLowLimit: limiter(10_000),
    lastPair: Date.now() - 30_000,
    duyen: null as null | { ids: Set<string>; until: number; said: number; maker: string | null },
    fightLimit: limiter(25_000),
    passerLimit: limiter(15_000),
    // màn mở đầu: ~12 giây sau khi mở trang đã có đám cưới dở dang của dàn khách quen
    lastActivity: Date.now() - GAME.autoAfterMs,
    lastAuto: Date.now() - GAME.autoEveryMs + 12_000,
    likeCycle: null as number | null, // tổng tim lúc bắt đầu vòng mốc (100/300/1000)
    likeStep: 0,
    vote: null as null | { until: number; yes: number; no: number; voted: Set<string>; g: string; b: string },
    nextEventAt: Date.now() + GAME.eventEveryMs[0],
    lastDj: Date.now() - GAME.djEveryMs + 3 * 60_000, // lần đầu sau ~3 phút
    danceCalls: [] as number[],
    actLimit: limiter(6_000),
    crewLimit: limiter(45_000),
    lastDuyen: Date.now() - GAME.duyen.everyMs + 90_000, // lần đầu sau ~1,5 phút
  }));

  const safeName = (nickname: string, username: string) => (containsBanned(nickname) ? username : nickname);
  const shown = (id: string) => names.current.get(id) ?? id;
  const spoken = (id: string | null) => (id ? speakableName(shown(id)) : 'bạn ấy');

  // cập nhật bảng trên màn hình
  const sync = () => {
    const w = s.w;
    setQueueLen(s.queue.length);
    if (!w) return setView(null);
    setView({
      phase: w.phase,
      groom: w.ids.groom ? shown(w.ids.groom) : w.stealRole === 'bride' ? w.targetName : '',
      bride: w.ids.bride ? shown(w.ids.bride) : w.stealRole === 'groom' ? w.targetName : '',
      groomAva: (w.ids.groom && avatars.current.get(w.ids.groom)) || '',
      brideAva: (w.ids.bride && avatars.current.get(w.ids.bride)) || '',
      stealRole: w.stealRole,
      price: GAME.stealMin,
      until: w.until,
      waiting: w.phase === 'proposal' ? (w.ids[other(w.stealRole)] ? shown(w.ids[other(w.stealRole)]!) : w.targetName) : '',
    });
  };

  const meet = (id: string, nickname: string, avatar: string) => {
    const name = safeName(nickname, id);
    names.current.set(id, name);
    if (avatar) avatars.current.set(id, avatar);
    s.recent.note(id, speakableName(name));
    world.ensure(id, name, avatar);
    return name;
  };

  /** tìm người đang trong tiệc theo tên được @ */
  // tên dài khớp trước: "@Lan Anh" chọn Lan Anh dù phòng có cả Lan
  const findGuest = (typed: string) => {
    for (const t of namePrefixes(typed)) {
      const id = world.ids().find((x) => exactName(t, shown(x), x));
      if (id) return id;
    }
    return null;
  };

  // ---------- cầu hôn ----------
  const propose = (p: Pending) => {
    if (s.w && s.w.phase !== 'after') {
      if (s.queue.some((q) => q.id === p.id)) return;
      if (s.queue.length >= GAME.maxQueue) return void voice.say(GAME.queueFull);
      s.queue.push(p);
      voice.say(GAME.queued(spoken(p.id), s.queue.length));
      return sync();
    }
    const targetId = findGuest(p.target);
    if (targetId === p.id) return void voice.say(GAME.self(spoken(p.id)));
    const role: Role = p.role === 'any' ? pickRole(p.id) : p.role;
    s.w = {
      phase: 'proposal',
      ids: { groom: null, bride: null, [role]: p.id } as Record<Role, string | null>,
      stealRole: role,
      targetName: targetId ? shown(targetId) : p.target.replace(/[@]/g, ''),
      until: Date.now() + GAME.answerMs,
      nudged: 0,
    };
    if (targetId) s.w.ids[other(role)] = targetId;
    world.setNames('', '');
    world.proposal(p.id, role, targetId);
    const a = spoken(p.id);
    const b = targetId ? spoken(targetId) : speakableName(s.w.targetName);
    if (p.role === 'any') voice.say(GAME.proposal.picked(a, role));
    voice.say(pick(GAME.proposal[role])!(a, b), false, undefined, false, () => world.look('gate', 9000));
    if (!targetId) voice.say(GAME.targetMissing(b));
    else if (Math.random() < 0.6) voice.say(GAME.proposal.stealHint(GAME.stealMin, role));
    sync();
  };

  const accept = () => {
    const w = s.w;
    if (!w || w.phase !== 'proposal') return;
    w.phase = 'walk';
    const set = pickWeddingSet();
    world.accept(set);
    world.setNames(shown(w.ids.groom!), shown(w.ids.bride!));
    const a = spoken(w.ids[w.stealRole]);
    const b = spoken(w.ids[other(w.stealRole)]);
    voice.say(pick(GAME.accepted)!(a, b), true, undefined, true, () => {
      world.cannons();
      world.roseRain(220);
      world.balloonsUp(20);
      world.dance(9000);
      world.confetti(160);
      world.heartsRain(60);
    });
    voice.say(set.rare ? GAME.outfitFunny : GAME.outfit(set.name), false, undefined, true);
    voice.say(pick(GAME.walk)!(spoken(w.ids.groom), spoken(w.ids.bride)), false, undefined, true, () => world.smokeBurst(20, 'aisle'));
    voice.say(GAME.walkSteal(GAME.stealMin));
    sync();
  };

  const endProposal = (why: 'no' | 'timeout') => {
    const w = s.w;
    if (!w || w.phase !== 'proposal') return;
    const pid = w.ids[w.stealRole];
    const a = spoken(pid);
    const b = w.ids[other(w.stealRole)] ? spoken(w.ids[other(w.stealRole)]) : speakableName(w.targetName);
    world.reject();
    if (pid) world.setTitle(pid, { text: GAME.titles.rejected, gold: false });
    voice.say(pick(why === 'no' ? GAME.rejected : GAME.timeout)!(a, b), true);
    s.w = null;
    sync();
    setTimeout(nextInQueue, 6000);
  };

  // lên tới sân khấu: đọc lời làm lễ, trao nhẫn, ôm, nâng ly, chúc
  const runVows = () => {
    const w = s.w;
    if (!w || w.phase !== 'walk') return;
    w.phase = 'vows';
    sync();
    const g = spoken(w.ids.groom);
    const b = spoken(w.ids.bride);
    const V = GAME.vows[s.vowsNo++ % GAME.vows.length];
    const keep = true;
    const st = () => world.look('stage', 60_000);
    voice.say(V.open(g, b), false, undefined, keep, () => {
      st();
      world.fountains(7000);
      world.smokeBurst(16);
    });
    voice.say(V.promiseG(g), false, undefined, keep, () => w.ids.groom && world.look(w.ids.groom, 6000));
    voice.say(V.promiseB(b), false, undefined, keep, () => w.ids.bride && world.look(w.ids.bride, 6000));
    voice.say(GAME.ring, false, () => world.ringExchange(), keep, st);
    voice.say(GAME.hug, false, () => world.hug(6000), keep);
    voice.say(GAME.toast, false, undefined, keep, () => {
      world.partyAll(9000);
      world.cannons();
      world.fountains(8000);
      world.confetti(200);
      world.fireworks(4);
    });
    voice.say(pick(GAME.closing)!(g, b), false, () => finish(), keep, () => world.petals(260));
  };

  const finish = () => {
    const w = s.w;
    if (!w) return;
    w.phase = 'after';
    s.married++;
    setMarried(s.married);
    s.lastWeddingAt = Date.now();
    const { groom, bride } = w.ids;
    if (groom && bride) {
      world.setTitle(groom, { text: GAME.titles.married(cut(shown(bride), 10)), gold: true });
      world.setTitle(bride, { text: GAME.titles.married(cut(shown(groom), 10)), gold: true });
    }
    world.wave(60_000);
    world.look('wide', 1);
    setTimeout(() => s.w?.phase === 'after' && world.setBaseCamera('wide'), 15_000);
    sync();
    if (groom && bride) setTimeout(() => startVote(groom, bride), 2500);
    setTimeout(nextInQueue, GAME.voteMs + 8000);
  };

  // ---------- Quẩy DJ: cả sảnh lên sân khấu, nhạc DJ, MC hô liên tục ----------
  const startDj = () => {
    if (world.djOn) return;
    s.lastDj = Date.now();
    world.djParty(GAME.djMs);
    music.dj(GAME.djMs);
    world.look('stage', 8000);
    voice.say(pick(GAME.djIntro)!, true);
    const hype = Math.floor(GAME.djMs / 6000);
    for (let i = 1; i <= hype; i++)
      setTimeout(() => {
        if (world.djOn) voice.say(pick(GAME.djHype)!, true, undefined, false, () => world.look(i % 2 ? 'wide' : 'stage', 5000));
      }, i * 5500);
    setTimeout(() => voice.say(GAME.djEnd), GAME.djMs + 500);
  };

  // ---------- Bình chọn đẹp đôi ----------
  const startVote = (g: string, b: string) => {
    if (s.vote) return;
    const until = Date.now() + GAME.voteMs;
    s.vote = { until, yes: 0, no: 0, voted: new Set(), g, b };
    setVote({ until, yes: 0, no: 0 });
    voice.say(pick(GAME.voteAsk)!(spoken(g), spoken(b)), true);
    setTimeout(() => {
      const v = s.vote;
      s.vote = null;
      setVote(null);
      if (!v) return;
      const total = v.yes + v.no;
      if (!total) return void voice.say(GAME.voteNone);
      const p = Math.round((v.yes / total) * 100);
      voice.say(p >= 70 ? GAME.voteHigh(p) : p >= 40 ? GAME.voteMid(p) : GAME.voteLow(p), true);
      if (p >= 70) {
        world.fireworks(4);
        world.heartsRain(80);
      }
    }, GAME.voteMs);
  };

  // ---------- Sự kiện bất ngờ ----------
  const runEvent = () => {
    const w = s.w;
    const onStage = w?.phase === 'after' && w.ids.groom && w.ids.bride;
    const kinds = onStage ? ['blackout', 'mom', 'ex', 'envelope'] : ['blackout', 'envelope'];
    const kind = kinds[Math.floor(Math.random() * kinds.length)];
    const E = GAME.ev;
    if (kind === 'envelope') {
      voice.say(E.envelope, true, undefined, false, () => {
        world.goldRain(400);
        world.confetti(200);
        world.cannons();
      });
    } else if (kind === 'blackout') {
      voice.say(E.blackoutStart, true, undefined, false, () => {
        setDark(true);
        setTimeout(() => {
          const cur = s.w;
          const bride = cur?.phase === 'after' ? cur.ids.bride : null;
          const pool = world.ids().filter((id) => id !== cur?.ids.groom && id !== bride && !id.startsWith('ev-'));
          if (cur && bride && pool.length) {
            const nb = pool[Math.floor(Math.random() * pool.length)];
            world.steal(bride, nb);
            cur.ids.bride = nb;
            world.setNames(shown(cur.ids.groom!), shown(nb));
            sync();
            setTimeout(() => {
              setDark(false);
              voice.say(E.blackoutSwap(spoken(bride), spoken(nb)), true, undefined, false, () => world.look('stage', 6000));
            }, 1200);
          } else {
            setDark(false);
            voice.say(E.blackoutNoCouple(1 + Math.floor(Math.random() * 20)), true);
          }
        }, 2800);
      });
    } else if (kind === 'mom' && w) {
      world.visit('ev-mom', 'Mẹ Chồng', { age: 'old', body: 'aodaiF', main: '#5b3a29', hair: '#d9d9d9', longHair: false, hat: 'bun' }, 'poke', 7000, '🧽 Rửa bát đi con!');
      voice.say(E.mom(spoken(w.ids.bride)), true);
    } else if (kind === 'ex' && w) {
      world.visit('ev-ex', 'Người Yêu Cũ', { body: 'shirt', main: '#2b2b2b', hair: '#141010', longHair: Math.random() < 0.5, hat: 'none' }, 'cry', 7000, '😭 Sao anh nỡ cưới người ta!');
      voice.say(E.ex(spoken(w.ids.groom)), true);
    }
  };

  // ---------- Nguyệt Lão se duyên ----------
  const startDuyen = () => {
    if (s.duyen || (s.w && s.w.phase !== 'after')) return;
    s.lastDuyen = Date.now();
    const until = Date.now() + GAME.duyen.windowMs;
    s.duyen = { ids: new Set(), until, said: 0, maker: null };
    setDuyen({ until, count: 0 });
    world.nguyetLao(true);
    world.fountains(3000);
    voice.say(pick(GAME.duyen.intro)!, true, undefined, false, () => world.look('stage', 6000));
    setTimeout(endDuyen, GAME.duyen.windowMs);
  };

  const endDuyen = () => {
    const d = s.duyen;
    if (!d) return;
    setDuyen(null);
    const busy = new Set([s.w?.ids.groom, s.w?.ids.bride, d.maker].filter(Boolean));
    const ids = [...d.ids].filter((id) => world.has(id) && !busy.has(id)).sort(() => Math.random() - 0.5);
    const close = () => {
      s.duyen = null;
      world.nguyetLao(false);
      world.matchmaker(null);
      setNguyen(null);
    };
    if (!ids.length) {
      voice.say(pick(GAME.duyen.none)!, false, close);
      return;
    }
    const n = pick(NGUYEN)!;
    voice.say(pick(GAME.duyen.before)!, false, undefined, true, () => world.look('stage', 8000));
    voice.say(`F: ${n.ten}. | F: ${n.loi}`, false, undefined, true, () => {
      setNguyen(n);
      world.petals(160);
      world.smokeBurst(12);
    });
    if (ids.length === 1) {
      voice.say(GAME.duyen.single(spoken(ids[0])), false, close, true, () => world.look(ids[0], 6000));
      return;
    }
    const [a, b] = ids;
    const pairLine = d.maker && world.has(d.maker) ? pick(GAME.pairBy)!(spoken(d.maker), spoken(a), spoken(b)) : pick(GAME.duyen.pair)!(spoken(a), spoken(b));
    voice.say(pairLine, false, close, true, () => {
      setNguyen(null);
      world.redThread(a, b, 40_000);
      world.cheerPair(a, b, 8000);
      world.fountains(5000);
      const pa = world.posOf(a);
      const pb = world.posOf(b);
      if (pa && pb) world.lookPoint(pa.add(pb).multiplyScalar(0.5), 9000);
      world.setTitle(a, { text: GAME.titleThread(cut(shown(b), 10)), gold: true });
      world.setTitle(b, { text: GAME.titleThread(cut(shown(a), 10)), gold: true });
    });
  };

  const nextInQueue = () => {
    if (s.w && s.w.phase !== 'after') return;
    const p = s.queue.shift();
    sync();
    if (p && world.has(p.id)) propose(p);
  };

  // ---------- cướp dâu / cướp rể bằng quà ----------
  /** true nếu quà này dùng để cướp (khi đó MC đọc câu cướp thay câu cảm ơn) */
  const trySteal = (id: string, coins: number) => {
    const w = s.w;
    if (!w || (w.phase !== 'proposal' && w.phase !== 'walk')) return false;
    if (w.ids.groom === id || w.ids.bride === id) {
      // người được hỏi tặng quà = đồng ý luôn
      if (w.phase === 'proposal' && w.ids[other(w.stealRole)] === id) accept();
      return false;
    }
    // người được hỏi chưa vào tiệc mà giờ tặng quà
    if (w.phase === 'proposal' && !w.ids[other(w.stealRole)] && matchName(w.targetName, shown(id), id)) {
      w.ids[other(w.stealRole)] = id;
      world.targetCome(id, other(w.stealRole));
      setTimeout(accept, 2500);
      return false;
    }
    if (coins < GAME.stealMin) {
      if (coins >= 10 && s.stealLowLimit('all')) voice.say(GAME.stealLow(spoken(id), GAME.stealMin));
      return false;
    }
    const oldId = w.ids[w.stealRole];
    if (!oldId) return false;
    w.ids[w.stealRole] = id;
    world.steal(oldId, id);
    world.setTitle(id, { text: GAME.titles.stealer(w.stealRole), gold: true });
    world.setTitle(oldId, { text: GAME.titles.robbed, gold: false });
    world.fireworks(2);
    world.cannons(80);
    voice.say(pick(GAME.stolen)!(spoken(id), spoken(oldId), w.stealRole), true, undefined, true);
    // đang chờ trả lời mà người được hỏi đã có mặt: tiền trao cháo múc, lên lễ đường luôn
    if (w.phase === 'proposal' && w.ids[other(w.stealRole)]) {
      voice.say(GAME.stealAccept, true);
      setTimeout(accept, 3500);
    }
    if (w.phase === 'walk' && w.ids.groom && w.ids.bride) world.setNames(shown(w.ids.groom), shown(w.ids.bride));
    sync();
    return true;
  };

  useEffect(() => {
    music.start();
    voice.onSpeaker = (who) => world.setSpeaker(who);
    world.events = {
      coupleOnStage: runVows,
      fight: (a, b, table) => {
        if (!s.fightLimit('all') || voice.waiting > 1) return;
        if (a && b) voice.say(pick(GAME.fight)!(spoken(a), spoken(b)), false, undefined, false, () => world.look(b, 4000));
        else voice.say(pick(GAME.fightTable)!(table));
      },
    };
    return () => {
      world.events = {};
      voice.onSpeaker = undefined;
    };
  }, []);

  useLiveEvents({
    onStatus: setStatus,
    onSpeaker: (d) => setStageCount(d.count),

    onChat: (e) => {
      const id = e.username;
      s.lastActivity = Date.now();
      const isNew = !world.has(id);
      meet(id, e.nickname, e.avatar);
      if (isNew) setGuestCount(world.count);
      const w = s.w;

      // người được @ vừa vào tiệc: ra cổng hoa
      if (w?.phase === 'proposal' && !w.ids[other(w.stealRole)] && w.ids[w.stealRole] !== id && matchName(w.targetName, shown(id), id)) {
        w.ids[other(w.stealRole)] = id;
        world.targetCome(id, other(w.stealRole));
        voice.say(GAME.targetArrived(spoken(id)), true, undefined, false, () => world.look(id, 4000));
        sync();
      }

      // đang bình chọn đẹp đôi: "1"/"hợp" hoặc "2"/"không hợp", mỗi người 1 phiếu
      if (s.vote && !s.vote.voted.has(id)) {
        const t = plain(e.comment).trim();
        const yes = t === '1' || t === 'hop' || t === 'hop qua';
        const no = t === '2' || t === 'khong hop';
        if (yes || no) {
          s.vote.voted.add(id);
          if (yes) s.vote.yes++;
          else s.vote.no++;
          setVote({ until: s.vote.until, yes: s.vote.yes, no: s.vote.no });
          world.say(id, yes ? '💘 Hợp!' : '💔 Không hợp', 2500);
          return;
        }
      }
      const cmd = parseCommand(e.comment);
      if (cmd?.type === 'propose') {
        if (w && (w.ids.groom === id || w.ids.bride === id) && w.phase !== 'after') return;
        world.say(id, `💍 Cưới ${cut(cmd.target, 16)}!`, 4000);
        return propose({ id, role: cmd.role, target: cmd.target });
      }
      const isTarget = w?.phase === 'proposal' && w.ids[other(w.stealRole)] === id;
      if (cmd?.type === 'yes' && isTarget) {
        world.say(id, '💖 Đồng ý!', 4000);
        return accept();
      }
      if (cmd?.type === 'no' && isTarget) {
        world.say(id, '🙅 Không!', 4000);
        return endProposal('no');
      }
      if (cmd?.type === 'punch' || cmd?.type === 'tease') {
        const target = findGuest(cmd.target);
        if (!target || target === id) {
          world.say(id, maskBanned(e.comment));
          if (!target && s.actLimit('missing')) voice.say(GAME.noTarget(speakableName(cmd.target)));
          return;
        }
        if (!world.attack(id, target, cmd.type === 'punch' ? 'punch' : 'poke')) return;
        world.say(id, cmd.type === 'punch' ? '👊 Đứng lại đó!' : '😜 Ê ê!', 2500);
        if (s.actLimit('all')) {
          const lines = cmd.type === 'punch' ? GAME.fight : GAME.tease;
          setTimeout(() => voice.say(pick(lines)!(spoken(id), spoken(target)), false, undefined, false, () => world.look(target, 4500)), 1500);
        }
        return;
      }
      if (cmd?.type === 'dance') {
        const now = Date.now();
        s.danceCalls = [...s.danceCalls.filter((t) => now - t < 30_000), now];
        if (s.danceCalls.length >= 5 && !world.djOn) {
          s.danceCalls = [];
          startDj();
          return;
        }
        world.joinDance(id);
        world.say(id, '💃 Quẩy!', 2500);
        if (s.actLimit('dance')) voice.say(pick(GAME.danceJoin)!(spoken(id)));
        return;
      }
      if (cmd?.type === 'duyen') {
        const d = s.duyen;
        if (!d || Date.now() > d.until) return void world.say(id, maskBanned(e.comment));
        if (d.ids.has(id)) return;
        d.ids.add(id);
        world.say(id, pick(GAME.duyen.bubble)!, 4000);
        world.heartsAt(id, 12);
        setDuyen({ until: d.until, count: d.ids.size });
        const marks = [3, 6, 10, 20];
        if (marks.includes(d.ids.size) && d.said < marks.length) {
          d.said++;
          voice.say(pick(GAME.duyen.count)!(d.ids.size));
        }
        return;
      }
      if (cmd?.type === 'zo') {
        world.zo(id);
        world.say(id, '🥂 Zô!', 2500);
        const now = Date.now();
        s.zoCount = s.zoCount.filter((t) => now - t < 10_000);
        s.zoCount.push(now);
        if (s.zoCount.length >= 5 && s.zoLimit('all')) voice.say(GAME.zoLine);
        return;
      }
      // comment thường: bong bóng trên đầu (đã che từ bậy). Không đọc nguyên văn.
      world.say(id, maskBanned(e.comment));
    },

    onGift: (e) => {
      const id = e.username;
      s.lastActivity = Date.now();
      const name = meet(id, e.nickname, e.avatar);
      const coins = e.diamondCount * e.repeatCount;
      setLastGift({ ...e, nickname: name, coins });
      if (trySteal(id, coins)) return;
      if (s.duyen && !s.duyen.maker && Date.now() < s.duyen.until && world.has(id)) {
        s.duyen.maker = id;
        world.matchmaker(id);
        voice.say(pick(GAME.matchmaker)!(speakableName(name)), true);
      }

      const tier = GAME.giftTiers.find((t) => coins >= t.min) ?? GAME.giftTiers[GAME.giftTiers.length - 1];
      // quà nào cũng bay từ người tặng lên sân khấu; quà to thêm pháo sáng + khói
      world.giftTrail(id, coins >= 99 ? 120 : coins >= 10 ? 70 : 40);
      if (coins >= 10) world.fountains(coins >= 99 ? 8000 : 4000);
      if (coins >= 10) world.roseRain(coins >= 99 ? 260 : 120);
      if (coins >= 99) world.balloonsUp(coins >= 299 ? 36 : 18);
      if (coins >= 299) startDj();
      if (coins >= 30) {
        world.dance(coins >= 99 ? 10000 : 6000);
        if (s.crewLimit('all')) voice.say(pick(GAME.danceCrew)!);
      }
      if (coins >= 30) world.smokeBurst(coins >= 299 ? 30 : 14, coins >= 299 ? 'hall' : 'stage');
      for (const fx of tier.fx) {
        if (fx === 'hearts') world.heartsAt(id, coins >= 30 ? 40 : 16);
        if (fx === 'confetti') world.confetti(coins >= 99 ? 260 : 140);
        if (fx === 'petals') world.petals(180);
        if (fx === 'fireworks') world.fireworks(coins >= 999 ? 10 : 4);
        if (fx === 'gold') world.goldRain(coins >= 999 ? 500 : 300);
        if (fx === 'party') world.partyAll(coins >= 999 ? 15000 : 9000);
      }
      if (s.gifts.shouldThank(id, coins, voice.waitingPriority))
        voice.say(pick(tier.lines)!(speakableName(name)), true, undefined, false, () => world.look(id, 3500));
    },

    onMember: (e) => {
      const name = safeName(e.nickname, e.username);
      const n = speakableName(name);
      if (n !== 'bạn') s.greeter.add(e.username, n);
      // người lướt qua: cho vào ngồi ăn cỗ luôn (người comment vẫn được ưu tiên ghế)
      if (!world.has(e.username)) {
        names.current.set(e.username, name);
        if (e.avatar) avatars.current.set(e.username, e.avatar);
        world.ensure(e.username, name, e.avatar, true);
        setTimeout(() => {
          if (!world.has(e.username)) return;
          world.say(e.username, pick(GAME.passerEmoji)!, 3000);
          if (n !== 'bạn' && s.passerLimit('all') && voice.waiting < 2)
            voice.say(pick(GAME.passer)!(n), false, undefined, false, () => world.look(e.username, 4000));
        }, 7000);
      }
    },

    onFollow: (e) => {
      if (s.follows.first(e.username)) voice.say(GAME.thankFollow(speakableName(safeName(e.nickname, e.username))));
    },

    onLike: (e) => {
      // mốc tim theo vòng: 100 pháo giấy, 300 cả sảnh quẩy, 1000 xe hoa; qua 1000 thì bắt đầu vòng mới
      if (s.likeCycle === null) s.likeCycle = e.totalLikes - e.likeCount;
      const M = GAME.likeMilestones;
      let inCycle = e.totalLikes - s.likeCycle;
      while (inCycle >= M[s.likeStep]) {
        const mark = M[s.likeStep];
        if (mark === 100) {
          world.cannons();
          world.heartsRain(80);
          voice.say(GAME.likes100, true);
        } else if (mark === 300) {
          world.heartsRain(120);
          world.roseRain(200);
          voice.say(GAME.boostLine, true);
          startDj();
        } else {
          world.weddingCar();
          world.fireworks(8);
          world.partyAll(12000);
          voice.say(GAME.likes1000, true);
        }
        s.likeStep++;
        if (s.likeStep >= M.length) {
          s.likeStep = 0;
          s.likeCycle += M[M.length - 1];
          inCycle = e.totalLikes - s.likeCycle;
        }
      }
      setLikeProgress(Math.max(0, inCycle));
      setLikeNext(M[s.likeStep]);
    },

    onControl: (c) => {
      if (c.action === 'setName' && c.text) setChannelName(c.text);
      if (c.action === 'custom' && c.text === 'clearStage') {
        world.clearStage();
        world.setNames('', '');
        s.w = null;
        s.queue = [];
        sync();
      }
      if (c.action === 'custom' && c.text === 'party') world.partyAll(10000);
      if (c.action === 'custom' && c.text === 'duyen') startDuyen();
      if (c.action === 'custom' && c.text === 'event') runEvent();
      if (c.action === 'custom' && c.text === 'car') world.weddingCar();
      if (c.action === 'custom' && c.text === 'dj') startDj();
      if (c.action === 'custom' && c.text === 'roses') world.roseRain(300);
      if (!IS_STAGE) return; // chỉ trang stage làm theo lệnh có tiếng, tránh 2 giọng
      if (c.action === 'speak' && c.text) voice.say(c.text, true);
      if (c.action === 'custom' && (c.text === 'music:on' || c.text === 'music:off')) music.set(c.text === 'music:on');
      if (c.action === 'custom' && c.text?.startsWith('musicVol:')) music.setLevel(Number(c.text.slice(9)) / 100);
      if (c.action === 'setRate' && c.text) {
        voice.rate = Math.min(1.5, Math.max(0.5, Number(c.text) || 1.25));
        try {
          localStorage.setItem('voice-rate', String(voice.rate));
        } catch {
          // bỏ qua
        }
      }
      if (c.action === 'reset') {
        voice.stop();
        s.greeter.reset();
        s.gifts.reset();
        s.follows.reset();
        s.recent.reset();
        s.w = null;
        s.queue = [];
        world.reset();
        setGuestCount(0);
        sync();
      }
    },
  });

  // MC rảnh là nói: hướng dẫn, mai mối, kể số cặp đã cưới
  const chatterLine = (): string | null => {
    const C = GAME.chatter;
    const w = s.w;
    const opts: (() => string | null)[] = [
      () => pick(C.howTo) ?? null,
      () => pick(C.howTo) ?? null,
      () => (world.count >= 3 && !s.married ? C.crowd(world.count) : null),
      () => (s.married ? C.married(s.married) : null),
      () => (w?.phase === 'after' ? C.onStage(spoken(w.ids.groom), spoken(w.ids.bride)) : null),
      () => pick(C.questions) ?? null,
      () => pick(C.zo) ?? null,
    ];
    for (let i = 0; i < 6; i++) {
      const line = opts[Math.floor(Math.random() * opts.length)]();
      if (line) return line;
    }
    return null;
  };

  useEffect(() => {
    const timers: ReturnType<typeof setInterval>[] = [];
    timers.push(setInterval(() => setGuestCount(world.count), 2000));
    // hạn trả lời + nhắc
    timers.push(
      setInterval(() => {
        const w = s.w;
        if (!w || w.phase !== 'proposal') return;
        const left = Math.ceil((w.until - Date.now()) / 1000);
        if (left <= 0) return endProposal('timeout');
        const b = w.ids[other(w.stealRole)] ? spoken(w.ids[other(w.stealRole)]) : speakableName(w.targetName);
        if ((left <= 35 && w.nudged === 0) || (left <= 15 && w.nudged === 1)) {
          w.nudged++;
          if (s.nudgeLimit('all')) voice.say(pick(GAME.nudge)!(b, left), true);
        }
      }, 1000),
    );
    // Dàn khách quen vào tiệc (nhân vật của chương trình, tên vui, không phải người xem)
    GAME.cast.forEach((name, i) =>
      setTimeout(() => {
        names.current.set(`cast-${i}`, name);
        // giới tính theo cách gọi: Cô / Chị / Bà / Con là nữ
        world.ensure(`cast-${i}`, name, '', false, /^(Cô|Chị|Bà|Con) /.test(name));
      }, 1500 + i * 900),
    );
    // Phòng vắng: dàn khách quen tự cầu hôn nhau, đồng ý / từ chối ngẫu nhiên như thật
    timers.push(
      setInterval(() => {
        const now = Date.now();
        if ((s.w && s.w.phase !== 'after') || s.duyen || now - s.lastActivity < GAME.autoAfterMs || now - s.lastAuto < GAME.autoEveryMs || voice.waiting > 0) return;
        const cast = GAME.cast.map((_, i) => `cast-${i}`).filter((id) => world.has(id)).sort(() => Math.random() - 0.5);
        if (cast.length < 2) return;
        s.lastAuto = now;
        const fem = (id: string) => /^(Cô|Chị|Bà|Con) /.test(shown(id));
        const a = cast[0];
        // ưu tiên ghép 1 nam 1 nữ, vai theo giới tính người hỏi
        const b = cast.slice(1).find((x) => fem(x) !== fem(a)) ?? cast[1];
        world.say(a, '💍 Cưới em nhé!', 4000);
        propose({ id: a, role: fem(a) ? 'bride' : 'groom', target: shown(b) });
        voice.say(pick(GAME.autoHook)!(spoken(a), spoken(b)));
        setTimeout(() => {
          const w = s.w;
          if (w?.phase !== 'proposal' || w.ids[other(w.stealRole)] !== b) return;
          if (Math.random() < 0.7) {
            world.say(b, '💖 Đồng ý!', 4000);
            accept();
          } else {
            world.say(b, '🙅 Thôi khỏi!', 4000);
            endProposal('no');
          }
        }, 10_000 + Math.random() * 12_000);
      }, 4000),
    );
    // Quẩy DJ định kỳ lúc không có đám
    timers.push(
      setInterval(() => {
        const ph = s.w?.phase;
        if (Date.now() - s.lastDj < GAME.djEveryMs || (ph && ph !== 'after') || s.duyen || s.vote || world.djOn) return;
        startDj();
      }, 5000),
    );
    // Sự kiện bất ngờ mỗi 3–5 phút (không chen vào lúc cầu hôn / đi thảm đỏ / làm lễ / se duyên / bình chọn)
    timers.push(
      setInterval(() => {
        const ph = s.w?.phase;
        if (Date.now() < s.nextEventAt || (ph && ph !== 'after') || s.duyen || s.vote || voice.waiting > 1) return;
        const [lo, hi] = GAME.eventEveryMs;
        s.nextEventAt = Date.now() + lo + Math.random() * (hi - lo);
        runEvent();
      }, 5000),
    );
    // Nguyệt Lão định kỳ xuống se duyên lúc không có đám
    timers.push(
      setInterval(() => {
        const ph = s.w?.phase;
        if (s.duyen || (ph && ph !== 'after') || Date.now() - s.lastDuyen < GAME.duyen.everyMs || world.count < 2) return;
        startDuyen();
      }, 5000),
    );
    // Mai mối: thỉnh thoảng zoom vào 1 bàn, MC gọi 2 bạn lên cưới
    timers.push(
      setInterval(() => {
        const ph = s.w?.phase;
        if (s.duyen || (ph && ph !== 'after') || Date.now() - s.lastPair < GAME.pairEveryMs || voice.waiting > 1) return;
        const p = world.pickPair();
        if (!p) return;
        s.lastPair = Date.now() + Math.random() * 20_000; // lệch nhịp cho tự nhiên
        const a = spoken(p.a);
        const b = spoken(p.b);
        voice.say(pick(GAME.pair)!(a, b), false, undefined, false, () => {
          world.lookPoint(p.at, 11_000);
          world.cheerPair(p.a, p.b, 9000);
          world.say(p.a, '😳 Hả? Tui hả?', 5000);
          world.say(p.b, pick(GAME.pairBubble)!, 5000);
        });
        // 15 giây chưa ai gõ cưới thì MC ép tiếp
        setTimeout(() => {
          if (!s.w && world.has(p.a) && world.has(p.b)) voice.say(pick(GAME.pairPush)!(a, b), false, undefined, false, () => world.lookPoint(p.at, 6000));
        }, 15_000);
      }, 3000),
    );
    if (IS_STAGE) {
      timers.push(
        setInterval(() => {
          const n = s.recent.latest(3, GAME.shareReminderEveryMs);
          voice.say(n.length ? GAME.shareWithNames(joinNames(n)) : pick(GAME.shareLines)!);
        }, GAME.shareReminderEveryMs),
      );
      timers.push(
        setInterval(() => {
          const ph = s.w?.phase;
          if (ph === 'vows' || ph === 'walk' || world.djOn || voice.quietForMs() < GAME.chatterQuietMs) return;
          const line = chatterLine();
          if (line) voice.say(line);
        }, 2000),
      );
    }
    return () => timers.forEach(clearInterval);
  }, []);

  useEffect(() => {
    if (!lastGift) return;
    const t = setTimeout(() => setLastGift(null), 5000);
    return () => clearTimeout(t);
  }, [lastGift]);

  return { status, channelName, lastGift, likeProgress, likeNext, guestCount, view, queueLen, married, duyen, nguyen, stageCount, vote, dark };
}

export type GameState = ReturnType<typeof useGame>;

const cut = (t: string, n: number) => (t.length > n ? t.slice(0, n - 1) + '…' : t);

function joinNames(list: string[]) {
  const sp = list.map((n) => (n === 'bạn' ? n : `bạn ${n}`));
  return sp.length > 1 ? `${sp.slice(0, -1).join(', ')} và ${sp[sp.length - 1]}` : sp[0] ?? '';
}
