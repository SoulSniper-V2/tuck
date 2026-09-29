import assert from 'node:assert/strict';
import {test} from 'node:test';
import {fitPreview, matchesQuery} from '../model.js';

test('search combines title and application with independent accent-insensitive terms', () => {
    assert.ok(matchesQuery('Café — Quarterly report', 'Document Viewer', 'viewer cafe'));
    assert.ok(matchesQuery('Résumé.pdf', 'Papers', 'resume'));
    assert.ok(matchesQuery('项目计划', 'Text Editor', '项目 editor'));
    assert.ok(matchesQuery('Anything', 'Anything', '   '));
    assert.equal(matchesQuery('Budget', 'Papers', 'budget firefox'), false);
    assert.equal(matchesQuery('<b>Budget</b>', 'Papers', '<b>'), true);
});

test('portrait and wide windows fit without distortion or overflowing bounds', () => {
    assert.deepEqual(fitPreview(1600, 900, 120, 80), {width: 120, height: 67.5, scale: 0.075});
    const portrait = fitPreview(400, 1000, 120, 80);
    assert.deepEqual(portrait, {width: 32, height: 80, scale: 0.08});
    assert.equal(fitPreview(0, 900, 120, 80), null);
    assert.equal(fitPreview(Infinity, 900, 120, 80), null);
    assert.equal(fitPreview(100, 100, -1, 80), null);
});

