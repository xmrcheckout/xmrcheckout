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
test('invoice context reports where the invoice came from', () => {
  assert.equal(invoiceContext({origin:'payment_link', payment_link:{title:'Guide'}}).source,'payment_link');
  const sale = invoiceContext({origin:'terminal', terminal:{name:'Front counter', note:'2 coffees'}});
  assert.equal(sale.source,'terminal');
  assert.equal(sale.title,'Front counter · 2 coffees');
  assert.equal(invoiceContext({payment_link:{title:'Guide'}}).source,'payment_link');
  assert.equal(invoiceContext({description:'Manual'}).source,null);
  assert.equal(invoiceContext({origin:'other', payment_link:{title:'Guide'}}).source,null);
  assert.equal(invoiceContext({order_id:'42'}, (order) => `Pedido ${order}`).title,'Pedido 42');
});
