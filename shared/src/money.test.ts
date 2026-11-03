import { test } from 'node:test';
import assert from 'node:assert/strict';
import { balance, netCharge } from './money';

test('netCharge: a normal visit costs fee minus discount, never below zero', () => {
  assert.equal(netCharge({ status: 'DONE', fee: 1500, discount: 0, paid: 0, refunded: 0 }), 1500);
  assert.equal(netCharge({ status: 'DONE', fee: 1500, discount: 500, paid: 0, refunded: 0 }), 1000);
  assert.equal(netCharge({ status: 'DONE', fee: 1500, discount: 2000, paid: 0, refunded: 0 }), 0);
});

test('netCharge: cancelled costs nothing; no-show keeps what was paid', () => {
  assert.equal(netCharge({ status: 'CANCELLED', fee: 1500, discount: 0, paid: 1500, refunded: 0 }), 0);
  assert.equal(netCharge({ status: 'NO_SHOW', fee: 1500, discount: 0, paid: 1500, refunded: 0 }), 1500);
  assert.equal(netCharge({ status: 'NO_SHOW', fee: 1500, discount: 0, paid: 0, refunded: 0 }), 0);
});

test('balance: positive = still to collect, negative = owed back', () => {
  assert.equal(balance({ status: 'DONE', fee: 1500, discount: 0, paid: 0, refunded: 0 }), 1500); // unpaid
  assert.equal(balance({ status: 'DONE', fee: 1500, discount: 0, paid: 1500, refunded: 0 }), 0); // settled
  assert.equal(balance({ status: 'CANCELLED', fee: 1500, discount: 0, paid: 1500, refunded: 0 }), -1500); // refund owed
});
