import test from 'node:test';
import assert from 'node:assert/strict';

const email = /^\S+@\S+\.\S+$/;
const date = /^\d{4}-\d{2}-\d{2}$/;
const time = /^\d{2}:\d{2}$/;
const slotSupports = (slotMode, requestedMode) => slotMode === 'BOTH' || slotMode === requestedMode;

test('valid email accepted', () => assert.equal(email.test('user@example.com'), true));
test('invalid email rejected', () => assert.equal(email.test('not-an-email'), false));
test('valid date format accepted', () => assert.equal(date.test('2026-10-05'), true));
test('malformed date rejected', () => assert.equal(date.test('05-10-2026'), false));
test('valid time format accepted', () => assert.equal(time.test('10:30'), true));
test('clinic slot accepts clinic booking', () => assert.equal(slotSupports('CLINIC', 'CLINIC'), true));
test('clinic slot rejects online booking', () => assert.equal(slotSupports('CLINIC', 'ONLINE'), false));
test('online slot rejects clinic booking', () => assert.equal(slotSupports('ONLINE', 'CLINIC'), false));
test('both slot accepts either booking mode', () => assert.equal(slotSupports('BOTH', 'ONLINE') && slotSupports('BOTH', 'CLINIC'), true));
