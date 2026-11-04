import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { matchLocale } from '../lib/i18n/config.ts';
import { createTranslator, mergeMessages, splitRich } from '../lib/i18n/translate.ts';

const root = new URL('..', import.meta.url).pathname;
const load = (locale) => JSON.parse(readFileSync(join(root, 'messages', `${locale}.json`), 'utf8'));
const en = load('en');
const catalogs = { es: load('es'), ru: load('ru'), de: load('de'), fr: load('fr'), pt: load('pt') };

// Forbidden terms per DESIGN_PRINCIPLES.md §9 and messages/GLOSSARY.md.
// Each entry is [pattern, allowed negation pattern or null].
const forbidden = {
  en: [[/processor/i, /not a (?:payment )?processor/i], [/settle/i, null], [/payout/i, null], [/\bbalance/i, null], [/payments company/i, null]],
  es: [[/procesador/i, /no es un procesador/i], [/liquida/i, null], [/desembols/i, null], [/\bretir/i, null], [/\bsaldo/i, null], [/empresa de pagos/i, null]],
  ru: [[/процессор|процессинг/i, /не (?:является )?платёжн\S* процессор\S*/i], [/расч[её]т/i, null], [/выплат/i, null], [/вывод средств|вывести средства|снятие средств/i, null], [/баланс/i, null], [/платёжн\S* компани/i, null]],
  de: [[/zahlungsabwickl|zahlungsdienstleist|prozessor/i, /kein(?:en)? (?:Zahlungsabwickler|Zahlungsdienstleister)/i], [/abrechn/i, null], [/auszahl/i, null], [/abheb|abhebung/i, null], [/guthaben|\bsaldo|kontostand/i, null], [/zahlungsunternehmen/i, null]],
  pt: [[/processador|intermediador\S* de pagamento/i, /não é um processador/i], [/liquida/i, null], [/repasse/i, null], [/\bsaque|\bsacar|retirada de fundos|retirar fundos/i, null], [/\bsaldo/i, null], [/empresa de pagamentos?/i, null]],
  fr: [[/processeur|prestataire de (?:services de )?paiement/i, /n['’]est pas un (?:processeur|prestataire)/i], [/règlement/i, null], [/versement/i, null], [/\bretrait|retirer/i, null], [/\bsolde/i, null], [/(?:société|entreprise) de paiement/i, null]],
};

const isPlural = (value) => value && typeof value === 'object' && typeof value.other === 'string';
function flatten(messages, prefix = '', out = new Map()) {
  for (const [key, value] of Object.entries(messages)) {
    const path = prefix + key;
    if (typeof value === 'string' || isPlural(value)) out.set(path, value);
    else flatten(value, `${path}.`, out);
  }
  return out;
}
const strings = (value) => (typeof value === 'string' ? [value] : Object.values(value));
const placeholders = (value) => new Set(strings(value).flatMap((text) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1])));
const tags = (value) => strings(value).flatMap((text) => splitRich(text).map((s) => s.tag).filter(Boolean)).sort().join();

test('locale matching follows Accept-Language preference and falls back to English', () => {
  assert.equal(matchLocale(null), 'en');
  assert.equal(matchLocale('es-MX,es;q=0.9,en;q=0.8'), 'es');
  assert.equal(matchLocale('it-IT,it;q=0.9'), 'en');
  assert.equal(matchLocale('it;q=1, es;q=0.5, en;q=0.4'), 'es');
  assert.equal(matchLocale('en;q=0.4, es;q=0.6'), 'es');
  assert.equal(matchLocale('es;q=0, en'), 'en');
  assert.equal(matchLocale('ru-RU,ru;q=0.9,en;q=0.8'), 'ru');
  assert.equal(matchLocale('de-DE,de;q=0.9,en;q=0.8'), 'de');
  assert.equal(matchLocale('fr-FR,fr;q=0.9,en;q=0.8'), 'fr');
  assert.equal(matchLocale('pt-BR,pt;q=0.9,en;q=0.8'), 'pt');
});

test('translator interpolates, pluralizes, and falls back to English', () => {
  const messages = mergeMessages({ a: 'A {x}', n: { one: '{count} item', other: '{count} items' }, only: 'English' }, { a: 'Ä {x}' });
  const t = createTranslator('en', messages);
  assert.equal(t('a', { x: 1 }), 'Ä 1');
  assert.equal(t('n', { count: 1 }), '1 item');
  assert.equal(t('n', { count: 2 }), '2 items');
  assert.equal(t('only'), 'English');
  assert.equal(t('missing.key'), 'missing.key');
  assert.equal(t('a'), 'Ä {x}');
  assert.deepEqual(splitRich('Go <link>here</link>.'), [{ tag: null, text: 'Go ' }, { tag: 'link', text: 'here' }, { tag: null, text: '.' }]);
});

test('every translation has exactly the English keys, placeholders, and tags', () => {
  const source = flatten(en);
  for (const [locale, messages] of Object.entries(catalogs)) {
    const translated = flatten(messages);
    const missing = [...source.keys()].filter((key) => !translated.has(key));
    const extra = [...translated.keys()].filter((key) => !source.has(key));
    assert.deepEqual(missing, [], `${locale} is missing keys`);
    assert.deepEqual(extra, [], `${locale} has keys not in en.json`);
    for (const [key, value] of source) {
      const other = translated.get(key);
      assert.deepEqual(placeholders(other), placeholders(value), `${locale} ${key} placeholders`);
      assert.equal(tags(other), tags(value), `${locale} ${key} tags`);
      assert.equal(isPlural(other), isPlural(value), `${locale} ${key} plural shape`);
    }
  }
});

test('catalogs avoid custody and payments-industry terms', () => {
  for (const [locale, messages] of Object.entries({ en, ...catalogs })) {
    for (const [key, value] of flatten(messages)) {
      for (const text of strings(value)) {
        for (const [pattern, allowed] of forbidden[locale]) {
          const remainder = allowed ? text.replace(new RegExp(allowed.source, 'gi'), '') : text;
          assert.doesNotMatch(remainder, pattern, `${locale} ${key}: "${text}"`);
        }
      }
    }
  }
});

test('every translation key used in the UI exists in en.json', () => {
  const keys = flatten(en);
  const prefixes = new Set([...keys.keys()].flatMap((key) => key.split('.').map((_, i, parts) => parts.slice(0, i + 1).join('.') + '.')));
  const files = [];
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) walk(path);
      else if (/\.(tsx?|mjs)$/.test(name)) files.push(path);
    }
  };
  for (const dir of ['app', 'components', 'lib']) walk(join(root, dir));
  const unknown = [];
  for (const file of files) {
    const source = readFileSync(file, 'utf8');
    for (const [, key] of source.matchAll(/\bt\("([\w.]+)"/g)) if (!keys.has(key)) unknown.push(`${file}: ${key}`);
    // Dynamic keys such as t(`invoiceStatus.${status}`) must name an existing group.
    for (const [, prefix] of source.matchAll(/\bt\(`([\w.]+\.)\$\{/g)) if (!prefixes.has(prefix)) unknown.push(`${file}: ${prefix}*`);
  }
  assert.deepEqual(unknown, []);
});
