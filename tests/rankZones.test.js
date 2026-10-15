//Tests for rankZones.js
import test from 'node:test';
import assert from 'node:assert';
import { rankZones } from '../backend/rankZones.js';

test('returns an empty list for no zones', () => {
    assert.deepEqual(rankZones([], 10), []);

});

test('sort zones from most to fewest trips', () => {
    const zones = [{ name: 'A', trips: 5 }, { name: 'B', trips: 20 }, { name: 'C', trips: 12 }];
assert.deepEqual(rankZones(zones, 10).map(z=> z.name), ['B', 'C', 'A']);
});

test('keeps only the requested number of zones', () => {
    const zones = Array.from({ length: 25 }, (_, i) => ({ name: 'zone' + i, trips: i}));
    const top = rankZones(zones, 10);
    assert.equal(top.length, 10);
    assert.equal(top[0].name, 'zone24');

});

test('handles equal trip counts', () => {
    const zones = [{name: 'A', trips: 7}, {name: 'B', trips: 7}];
    assert.equal(rankZones(zones, 10).length, 2);
});

test('does not. change the list', () => {
    const zones = [{ name: 'A', trips: 1}, { name: 'B', trips: 2}];
    const copy = zones.slice();
    rankZones(zones, 10);
    assert.deepEqual(zones, copy);

});