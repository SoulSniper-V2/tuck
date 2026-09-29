import assert from 'node:assert/strict';
import {test} from 'node:test';
import vm from 'node:vm';
import fs from 'node:fs';
import {legacyMarks} from '../unicodeMarks.js';
import {SignalGroup} from '../shell/signals.js';

// Exercise the actual model's fallback branch, rather than a second search implementation.
test('older GJS engines retain Unicode search when property escapes are unavailable', () => {
    const source = fs.readFileSync(new URL('../model.js', import.meta.url), 'utf8')
        .replace(/^import .+;$/m, '').replaceAll('export ', '');
    const OldRegExp = function (pattern, flags) {
        if (pattern.includes('\\p{'))
            throw new SyntaxError('Property escapes unavailable');
        return new RegExp(pattern, flags);
    };
    const context = vm.createContext({legacyMarks, RegExp: OldRegExp});
    vm.runInContext(source, context);
    assert.ok(context.matchesQuery('Café — Résumé', 'Papers', 'cafe resume'));
    assert.ok(context.matchesQuery('À bientôt — Ελληνικά', 'Editor', 'a bientot ελληνικα'));
    assert.equal(context.matchesQuery('Budget', 'Papers', 'firefox'), false);
});

test('signal ownership can be released by source and reused after full cleanup', () => {
    let nextId = 0;
    const source = {ids: new Set(), connect() { const id = ++nextId; this.ids.add(id); return id; },
        disconnect(id) { assert.ok(this.ids.delete(id)); }};
    const other = {...source, ids: new Set()};
    const group = new SignalGroup();
    group.connect(source, 'changed', () => {});
    group.connect(source, 'destroy', () => {});
    group.connect(other, 'changed', () => {});
    group.disconnect(source);
    assert.equal(source.ids.size, 0);
    assert.equal(other.ids.size, 1);
    group.connect(source, 'changed', () => {});
    group.clear();
    group.clear();
    assert.equal(source.ids.size + other.ids.size, 0);
});
