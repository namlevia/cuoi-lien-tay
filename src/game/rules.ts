// Luật thuần (không React, không 3D): đọc lệnh trong comment, khớp tên, giá cướp dâu. Test: npx tsx src/game/rules.check.ts
import { plain } from '../live/chatter';

export type Role = 'groom' | 'bride';

export type Command =
  | { type: 'propose'; role: Role | 'any'; target: string } // role = vai của NGƯỜI GÕ
  | { type: 'yes' }
  | { type: 'no' }
  | { type: 'zo' };

/**
 *   "cưới vợ @Lan Anh"   -> mình làm chú rể, cưới Lan Anh
 *   "cưới chồng @Tuấn"   -> mình làm cô dâu
 *   "cưới @Tuấn"         -> MC bốc vai
 *   "lấy @Tuấn", "cuoi vo @x" cũng được. Thiếu @ thì không tính (tránh "đám cưới vui quá").
 */
export function parseCommand(comment: string): Command | null {
  const raw = comment.trim();
  const at = raw.indexOf('@');
  if (at >= 0) {
    const head = plain(raw.slice(0, at)).trim();
    const target = raw.slice(at + 1).trim().replace(/\s+/g, ' ');
    if (target && /(^|\s)(cuoi|lay|ruoc|hoi)(\s|$)/.test(head)) {
      const role: Role | 'any' = /(vo|em ay|nang)(\s|$)/.test(head) ? 'groom' : /(chong|anh ay|chang)(\s|$)/.test(head) ? 'bride' : 'any';
      return { type: 'propose', role, target: target.slice(0, 40) };
    }
  }
  const p = plain(raw).trim();
  if (/^((ok|em|anh|toi|minh) )?(dong y|chiu|ung|gat dau|yes)( |$)/.test(p)) return { type: 'yes' };
  // chỉ câu ngắn: "không biết nói gì luôn" không phải từ chối
  if (p.split(' ').length <= 4 && /^((em|anh|toi|minh) )?(khong|ko|k dong y|tu choi|no|thoi|hong)( |$)/.test(p)) return { type: 'no' };
  if (/(^| )(d?zo+|do+)( |$)/.test(p) && p.length <= 20) return { type: 'zo' };
  return null;
}

/**
 * Comment "@Lan Anh 🌸" có khớp người này không? So không dấu, bỏ emoji.
 * Khớp khi tên gõ = tên hiển thị / username, hoặc là phần đầu của tên (gõ thiếu đuôi), tối thiểu 3 chữ cái.
 */
export function matchName(typed: string, nickname: string, username: string): boolean {
  const t = squash(typed);
  if (t.length < 3) return false;
  for (const n of [squash(nickname), squash(username)]) {
    if (!n) continue;
    if (n === t || n.startsWith(t) || t.startsWith(n)) return true;
  }
  return false;
}

const squash = (s: string) => plain(s).replace(/[^a-z0-9]/g, '');

/** Bốc vai khi gõ "cưới @x" không nói rõ: tung đồng xu theo tên cho cố định, khỏi cãi */
export function pickRole(proposerId: string): Role {
  let h = 0;
  for (const c of proposerId) h = (h * 31 + c.charCodeAt(0)) | 0;
  return Math.abs(h) % 2 ? 'groom' : 'bride';
}

export const other = (r: Role): Role => (r === 'groom' ? 'bride' : 'groom');
