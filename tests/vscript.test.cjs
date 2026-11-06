const test = require('node:test');
const assert = require('node:assert/strict');
const { parseVScript, runEvent } = require('../src/vscript.js');

const sampleScript = [
  'on_start:',
  '    set score to 0',
  '    say "Welcome!"',
  '',
  'on_collect "star":',
  '    add 1 to score',
  '    say "Star collected!"',
  '',
  'on_win:',
  '    win'
].join('\n');

test('parses starter events and actions', () => {
  const parsed = parseVScript(sampleScript);
  assert.deepEqual(parsed.errors, []);
  assert.equal(parsed.events.length, 3);
  assert.equal(parsed.events[1].argument, 'star');
});

test('runs state changes and messages for matching events', () => {
  const { events } = parseVScript(sampleScript);
  const started = runEvent(events, 'start', null);
  assert.equal(started.state.score, 0);
  assert.deepEqual(started.messages, ['Welcome!']);

  const collected = runEvent(events, 'collect', 'star', started.state);
  assert.equal(collected.state.score, 1);
  assert.deepEqual(collected.messages, ['Star collected!']);
  assert.equal(collected.won, false);
});

test('reports unsupported statements with line numbers', () => {
  const parsed = parseVScript('on_start:\n    teleport player');
  assert.deepEqual(parsed.errors, [{ line: 2, message: 'Try say "text", set score to 0, add 1 to score, or win.' }]);
});

test('reports malformed quoted strings without throwing', () => {
  const parsed = parseVScript('on_start:\n    say "unfinished\\q"');
  assert.deepEqual(parsed.errors, [{ line: 2, message: 'This message has an invalid escape sequence.' }]);
});

test('runs win events', () => {
  const { events } = parseVScript(sampleScript);
  assert.equal(runEvent(events, 'win', null).won, true);
});
