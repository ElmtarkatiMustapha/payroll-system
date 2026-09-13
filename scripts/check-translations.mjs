import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import assert from 'node:assert/strict';

const dictionaries = Object.fromEntries(['en', 'fr', 'ar'].map(locale => [locale, JSON.parse(readFileSync('resources/js/locales/' + locale + '.json', 'utf8'))]));
const keys = Object.keys(dictionaries.en).sort();
for (const [locale, dictionary] of Object.entries(dictionaries)) {
    assert.deepEqual(Object.keys(dictionary).sort(), keys, locale + ': translation keys differ');
    for (const key of keys) assert.ok(typeof dictionary[key] === 'string' && dictionary[key].trim(), locale + ': missing ' + key);
}
function files(path) {
    return readdirSync(path, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? files(join(path, entry.name)) : [join(path, entry.name)]);
}
for (const file of files('resources/js').filter(file => file.endsWith('.jsx'))) {
    for (const match of readFileSync(file, 'utf8').matchAll(/\bt\('([^']+)'\)/g)) {
        assert.ok(dictionaries.en[match[1]], file + ': unknown translation ' + match[1]);
    }
}
console.log('All ' + keys.length + ' translation keys are complete in English, French, and Arabic.');
