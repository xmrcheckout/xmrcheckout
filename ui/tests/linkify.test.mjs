import test from 'node:test';
import assert from 'node:assert/strict';
import { linkifyMessage, safeHttpUrl } from '../lib/linkify.ts';

const links = (message) => linkifyMessage(message).filter(s => s.kind === 'link').map(s => s.href);
const joined = (message) => linkifyMessage(message).map(s => s.text).join('');

test('plain text stays a single text segment', () => {
  assert.deepEqual(linkifyMessage('Thanks for your order!\nEmail us your invoice ID.'), [{ kind: 'text', text: 'Thanks for your order!\nEmail us your invoice ID.' }]);
  assert.deepEqual(linkifyMessage(''), []);
});

test('http and https URLs become links among text and newlines', () => {
  const message = 'Download: https://merchant.example/book-1.pdf\nMirror http://mirror.example/b?x=1&y=2#p\nDone';
  assert.deepEqual(links(message), ['https://merchant.example/book-1.pdf', 'http://mirror.example/b?x=1&y=2#p']);
  assert.equal(joined(message), message);
});

test('trailing punctuation stays outside the link', () => {
  assert.deepEqual(links('See https://merchant.example/a.'), ['https://merchant.example/a']);
  assert.deepEqual(links('(https://merchant.example/a), then go'), ['https://merchant.example/a']);
  assert.deepEqual(links('Wiki https://en.example/Thing_(x).'), ['https://en.example/Thing_(x)']);
  assert.equal(joined('See https://merchant.example/a!?'), 'See https://merchant.example/a!?');
});

test('non-http schemes and markup are never linked', () => {
  for (const value of ['javascript:alert(1)', 'data:text/html,<b>x</b>', 'ftp://files.example/a', '<a href="https://evil.example">x</a>', 'mailto:me@example.com']) {
    assert.equal(joined(value), value);
    for (const href of links(value)) assert.match(href, /^https:\/\/evil\.example\//);
  }
  assert.deepEqual(links('<a href="https://evil.example">x</a>'), ['https://evil.example/']);
  assert.deepEqual(links('https://'), []);
});

test('safeHttpUrl keeps only http(s) links with a host', () => {
  assert.equal(safeHttpUrl('https://shop.example/thanks?order=1'), 'https://shop.example/thanks?order=1');
  assert.equal(safeHttpUrl('http://localhost:3000/done'), 'http://localhost:3000/done');
  for (const value of ['javascript:alert(1)', ' JavaScript:alert(1)', 'java\tscript:alert(1)', 'data:text/html,<script>alert(1)</script>', 'vbscript:msgbox(1)', 'https://', '/relative/path', '', null, undefined]) {
    assert.equal(safeHttpUrl(value), null, String(value));
  }
});
