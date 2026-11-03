import { useEffect, useRef, useState } from 'react';
import { useLiveEvents } from '../live/useLiveEvents';
import type { GiftEvent, LiveStatus } from '../live/types';
import { voice, speakableName } from '../live/voice';
import { containsBanned, maskBanned } from '../live/bannedWords';
import { NameBatcher } from '../live/scoreboard';
import { GiftThanker, makePicker, OncePerPerson, RecentPeople } from '../live/chatter';
import { IS_STAGE } from '../live/page';
import { GAME } from './config';
import { matchName, other, parseCommand, pickRole, type Role } from './rules';
import { pickWeddingSet } from './world/chibi3d';
import { world } from './world/world';
import { music } from './music';

const pick = makePicker();

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
  const findGuest = (typed: string) => world.ids().find((id) => matchName(typed, shown(id), id)) ?? null;

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
      world.confetti(160);
      world.heartsRain(60);
    });
    voice.say(set.rare ? GAME.outfitFunny : GAME.outfit(set.name), false, undefined, true);
    voice.say(pick(GAME.walk)!(spoken(w.ids.groom), spoken(w.ids.bride)), false, undefined, true);
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
    voice.say(V.open(g, b), false, undefined, keep, st);
    voice.say(V.promiseG(g), false, undefined, keep, () => w.ids.groom && world.look(w.ids.groom, 6000));
    voice.say(V.promiseB(b), false, undefined, keep, () => w.ids.bride && world.look(w.ids.bride, 6000));
    voice.say(GAME.ring, false, () => world.ringExchange(), keep, st);
    voice.say(GAME.hug, false, () => world.hug(6000), keep);
    voice.say(GAME.toast, false, undefined, keep, () => {
      world.partyAll(9000);
      world.cannons();
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
    setTimeout(nextInQueue, 5000);
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
    };
    return () => {
      world.events = {};
      voice.onSpeaker = undefined;
    };
  }, []);

  useLiveEvents({
    onStatus: setStatus,

    onChat: (e) => {
      const id = e.username;
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
      if (cmd?.type === 'zo') {
        world.zo(id);
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
      const name = meet(id, e.nickname, e.avatar);
      const coins = e.diamondCount * e.repeatCount;
      setLastGift({ ...e, nickname: name, coins });
      if (trySteal(id, coins)) return;

      const tier = GAME.giftTiers.find((t) => coins >= t.min) ?? GAME.giftTiers[GAME.giftTiers.length - 1];
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
      const n = speakableName(safeName(e.nickname, e.username));
      if (n !== 'bạn') s.greeter.add(e.username, n);
    },

    onFollow: (e) => {
      if (s.follows.first(e.username)) voice.say(GAME.thankFollow(speakableName(safeName(e.nickname, e.username))));
    },

    onLike: (e) => {
      if (likeBase.current === null) likeBase.current = e.totalLikes - e.likeCount;
      if (e.totalLikes - likeBase.current >= GAME.likesPerBoost) {
        likeBase.current += GAME.likesPerBoost;
        world.partyAll(10000);
        world.heartsRain(120);
        voice.say(GAME.boostLine, true);
      }
      setLikeProgress(Math.max(0, e.totalLikes - likeBase.current));
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
      if (!IS_STAGE) return; // chỉ trang stage làm theo lệnh có tiếng, tránh 2 giọng
      if (c.action === 'speak' && c.text) voice.say(c.text, true);
      if (c.action === 'custom' && (c.text === 'music:on' || c.text === 'music:off')) music.set(c.text === 'music:on');
      if (c.action === 'custom' && c.text?.startsWith('musicVol:')) music.setLevel(Number(c.text.slice(9)) / 100);
      if (c.action === 'setRate' && c.text) voice.rate = Number(c.text) || 1;
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
      () => {
        const [a, b] = world.someGuests(2);
        if (!a || !b) return null;
        world.look(a, 5000);
        return C.match(spoken(a), spoken(b));
      },
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
          if (ph === 'vows' || ph === 'walk' || voice.quietForMs() < GAME.chatterQuietMs) return;
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

  return { status, channelName, lastGift, likeProgress, guestCount, view, queueLen, married };
}

export type GameState = ReturnType<typeof useGame>;

const cut = (t: string, n: number) => (t.length > n ? t.slice(0, n - 1) + '…' : t);

function joinNames(list: string[]) {
  const sp = list.map((n) => (n === 'bạn' ? n : `bạn ${n}`));
  return sp.length > 1 ? `${sp.slice(0, -1).join(', ')} và ${sp[sp.length - 1]}` : sp[0] ?? '';
}
