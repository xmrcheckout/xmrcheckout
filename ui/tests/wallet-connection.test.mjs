import test from 'node:test';
import assert from 'node:assert/strict';
import { dashboardDestination, walletFormatErrors } from '../lib/wallet-connection.ts';

test('wallet format errors explain every incomplete field without checking credential matching', () => {
  const address = '4' + '1'.repeat(94), key = 'a'.repeat(64);
  assert.deepEqual(walletFormatErrors(address, key), {address:null, viewKey:null});
  for (const value of ['', '8' + '1'.repeat(94), '4' + '1'.repeat(93), '4' + '0'.repeat(94)]) assert.ok(walletFormatErrors(value,key).address);
  for (const value of ['', 'a'.repeat(63), 'z'.repeat(64)]) assert.ok(walletFormatErrors(address,value).viewKey);
});
test('login keeps dashboard tabs and rejects external or ambiguous destinations', () => {
  assert.equal(dashboardDestination('/dashboard?tab=invoices'), '/dashboard?tab=invoices');
  assert.equal(dashboardDestination('/dashboard?tab=invoices&view_key=secret&payment_address=secret'), '/dashboard?tab=invoices');
  for (const value of ['https://evil.example/dashboard', '//evil.example/dashboard', '/dashboard.evil', '/dashboard/../pay/x', '/dashboard\\evil', '/dashboard%2f..%2fpay', '/dashboard\n?tab=invoices', null]) assert.equal(dashboardDestination(value), '/dashboard');
});
