const test = require('node:test');
const assert = require('node:assert');
const { getHeroSuffix } = require('./hero-utils.js');

test('generation 1 should return empty string', () => {
    assert.strictEqual(getHeroSuffix(1), "");
});

test('generation 2 should return Jr', () => {
    assert.strictEqual(getHeroSuffix(2), " Jr");
});

test('generation 3 should return " the 3rd"', () => {
    assert.strictEqual(getHeroSuffix(3), " the 3rd");
});

test('generation 4 should return " the 4th"', () => {
    assert.strictEqual(getHeroSuffix(4), " the 4th");
});

test('generation 11 should return " the 11th" (not 11st)', () => {
    assert.strictEqual(getHeroSuffix(11), " the 11th");
});

test('generation 12 should return " the 12th" (not 12nd)', () => {
    assert.strictEqual(getHeroSuffix(12), " the 12th");
});

test('generation 13 should return " the 13th" (not 13rd)', () => {
    assert.strictEqual(getHeroSuffix(13), " the 13th");
});

test('generation 21 should return " the 21st"', () => {
    assert.strictEqual(getHeroSuffix(21), " the 21st");
});

test('generation 22 should return " the 22nd"', () => {
    assert.strictEqual(getHeroSuffix(22), " the 22nd");
});

test('generation 23 should return " the 23rd"', () => {
    assert.strictEqual(getHeroSuffix(23), " the 23rd");
});

test('generation 101 should return " the 101st"', () => {
    assert.strictEqual(getHeroSuffix(101), " the 101st");
});

test('generation 111 should return " the 111th"', () => {
    assert.strictEqual(getHeroSuffix(111), " the 111th");
});
