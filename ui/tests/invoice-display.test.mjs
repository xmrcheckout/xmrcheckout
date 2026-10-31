import test from 'node:test';
import assert from 'node:assert/strict';
import { invoiceContext, invoiceLookupId } from '../lib/invoice-display.ts';
const id = '11111111-1111-4111-8111-111111111111';
const origin = 'https://checkout.example';
test('lookup accepts IDs and local invoice URLs without following them', () => {
  assert.equal(invoiceLookupId(` ${id} `, origin), id);
  for (const path of ['invoice', 'i']) assert.equal(invoiceLookupId(`${origin}/${path}/${id}?a=1#receipt`, origin), id);
  for (const value of [`https://other.example/invoice/${id}`, `${origin}/invoice/${id}/extra`, `javascript:${id}`, `/invoice/${id}`, `${origin}/pay/${id}`, 'broken', `https://user@checkout.example/invoice/${id}`]) assert.equal(invoiceLookupId(value, origin), null);
});
test('invoice context uses existing human descriptions and tolerates malformed metadata', () => {
  assert.equal(invoiceContext({description:'Order #1027', payment_link:{title:'Guide'}, order_id:'1027'}).title,'Order #1027');
  assert.equal(invoiceContext({payment_link:{title:'Guide'}}).title,'Guide');
  assert.equal(invoiceContext({posData:JSON.stringify({WooCommerce:{'Order ID':27}})}).title,'Order 27');
  for (const value of [null, [], 'bad', {description:{x:1},payment_link:[],posData:'{'}]) assert.equal(invoiceContext(value).title,null);
  assert.equal(invoiceContext({description:'<script>alert(1)</script>'}).title,'<script>alert(1)</script>');
});
