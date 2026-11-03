// Chạy: npx tsx src/game/rules.check.ts
import assert from 'node:assert/strict';
import { parseCommand, matchName, pickRole } from './rules';

assert.deepEqual(parseCommand('cưới vợ @Lan Anh'), { type: 'propose', role: 'groom', target: 'Lan Anh' });
assert.deepEqual(parseCommand('Cưới chồng @Tuấn 🌸'), { type: 'propose', role: 'bride', target: 'Tuấn 🌸' });
assert.deepEqual(parseCommand('cuoi @minhtuan99'), { type: 'propose', role: 'any', target: 'minhtuan99' });
assert.deepEqual(parseCommand('lấy chồng @Bảo'), { type: 'propose', role: 'bride', target: 'Bảo' });
assert.equal(parseCommand('đám cưới vui quá'), null);
assert.equal(parseCommand('@Lan đẹp quá'), null);
assert.deepEqual(parseCommand('Đồng ý!'), { type: 'yes' });
assert.deepEqual(parseCommand('em đồng ý'), { type: 'yes' });
assert.deepEqual(parseCommand('dong y nha'), { type: 'yes' });
assert.deepEqual(parseCommand('không'), { type: 'no' });
assert.deepEqual(parseCommand('từ chối'), { type: 'no' });
assert.deepEqual(parseCommand('zô'), { type: 'zo' });
assert.deepEqual(parseCommand('Se duyên cho con'), { type: 'duyen' });
assert.deepEqual(parseCommand('xin duyen'), { type: 'duyen' });
assert.deepEqual(parseCommand('đấm @Minh Tuấn'), { type: 'punch', target: 'Minh Tuấn' });
assert.deepEqual(parseCommand('trêu @Lan'), { type: 'tease', target: 'Lan' });
assert.deepEqual(parseCommand('quẩy'), { type: 'dance' });
assert.deepEqual(parseCommand('quẩy lên'), { type: 'dance' });
assert.equal(parseCommand('đám cưới @Lan vui ghê'), null);
assert.deepEqual(parseCommand('dzô dzô'), { type: 'zo' });
assert.equal(parseCommand('không biết nói gì luôn á mọi người ơi'), null);
assert.deepEqual(parseCommand('không cưới đâu'), { type: 'no' });

assert.ok(matchName('Lan Anh', 'Lan Anh 🌸', 'lananh2k'));
assert.ok(matchName('lan anh', 'Lan Anh 🌸', 'x'));
assert.ok(matchName('lananh2k', 'Bé Na', 'lananh2k'));
assert.ok(!matchName('Lan', 'Lan Anh', 'x')); // @lan là Lan, không phải Lan Anh
assert.ok(matchName('Lan', 'Lan', 'x'));
assert.ok(matchName('Lan Anh nha', 'Lan Anh 🌸', 'x'));
assert.ok(matchName('lan', 'Lan Anh', 'lan'));
assert.ok(!matchName('Lan', 'Ngọc Lan', 'x'));
assert.ok(!matchName('a', 'Anh', 'x'));

assert.equal(pickRole('abc'), pickRole('abc'));

console.log('rules ok');
