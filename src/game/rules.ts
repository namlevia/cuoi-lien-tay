// Luật thuần (không React, không 3D): đọc lệnh trong comment, khớp tên, giá cướp dâu. Test: npx tsx src/game/rules.check.ts
import { plain } from '../live/chatter';

export type Role = 'groom' | 'bride';

export type Command =
  | { type: 'propose'; role: Role | 'any'; target: string } // role = vai của NGƯỜI GÕ
  | { type: 'yes' }
  | { type: 'no' }
  | { type: 'zo' }
  | { type: 'duyen' }
  | { type: 'punch'; target: string }
  | { type: 'tease'; target: string }
  | { type: 'dance' };

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
    if (target && !head.includes('dam cuoi') && /(^| )(dam|danh|tat|bop|choang|uppercut)( |$)/.test(head)) return { type: 'punch', target: target.slice(0, 40) };
    if (target && /(^| )(treu|choc|gheo)( |$)/.test(head)) return { type: 'tease', target: target.slice(0, 40) };
    if (target && !head.includes('dam cuoi') && /(^|\s)(cuoi|lay|ruoc|hoi)(\s|$)/.test(head)) {
      const role: Role | 'any' = /(vo|em ay|nang)(\s|$)/.test(head) ? 'groom' : /(chong|anh ay|chang)(\s|$)/.test(head) ? 'bride' : 'any';
      return { type: 'propose', role, target: target.slice(0, 40) };
    }
  }
  const p = plain(raw).trim();
  if (/^((ok|em|anh|toi|minh) )?(dong y|chiu|ung|gat dau|yes)( |$)/.test(p)) return { type: 'yes' };
  // chỉ câu ngắn: "không biết nói gì luôn" không phải từ chối
  if (p.split(' ').length <= 4 && /^((em|anh|toi|minh) )?(khong|ko|k dong y|tu choi|no|thoi|hong)( |$)/.test(p)) return { type: 'no' };
  if (/(^| )(se duyen|xin duyen|cau duyen)( |$)/.test(p)) return { type: 'duyen' };
  if (p.length <= 16 && /(^| )(quay|nhay|quay len|bung)( |$)/.test(p)) return { type: 'dance' };
  if (/(^| )(d?zo+|do+)( |$)/.test(p) && p.length <= 20) return { type: 'zo' };
  return null;
}

/**
 * Comment "@Lan Anh 🌸" có khớp người này không? So không dấu, bỏ emoji, phải ĐÚNG tên:
 * "@lan" chỉ khớp người tên "Lan", không khớp "Lan Anh" (chủ kênh chốt).
 * Chữ gõ thêm phía sau được bỏ qua: "@Lan Anh nha" vẫn khớp "Lan Anh".
 */
export function matchName(typed: string, nickname: string, username: string): boolean {
  const names = [squash(nickname), squash(username)].filter(Boolean);
  const words = typed.trim().split(/\s+/);
  for (let k = words.length; k >= 1; k--) {
    const t = squash(words.slice(0, k).join(' '));
    if (t && names.includes(t)) return true;
  }
  return false;
}

/** đúng y tên (không dấu, bỏ emoji) */
export function exactName(typed: string, nickname: string, username: string) {
  const t = squash(typed);
  return !!t && (t === squash(nickname) || t === squash(username));
}

/** các cách cắt chữ sau @, dài trước: "Lan Anh nha" -> "Lan Anh nha", "Lan Anh", "Lan" */
export function namePrefixes(typed: string) {
  const words = typed.trim().split(/\s+/);
  return words.map((_, i) => words.slice(0, words.length - i).join(' '));
}

const squash = (s: string) => plain(s).replace(/[^a-z0-9]/g, '');

/** Bốc vai khi gõ "cưới @x" không nói rõ: tung đồng xu theo tên cho cố định, khỏi cãi */
export function pickRole(proposerId: string): Role {
  let h = 0;
  for (const c of proposerId) h = (h * 31 + c.charCodeAt(0)) | 0;
  return Math.abs(h) % 2 ? 'groom' : 'bride';
}

export const other = (r: Role): Role => (r === 'groom' ? 'bride' : 'groom');
