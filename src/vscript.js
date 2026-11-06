(function attachVScript(root) {
  const headerPattern = /^on_([a-z_]+)(?:\s+"([^"]+)")?\s*:\s*$/;

  function parseVScript(source) {
    const events = [];
    const errors = [];
    let activeEvent = null;

    String(source).split(/\r?\n/).forEach((rawLine, index) => {
      const lineNumber = index + 1;
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) return;

      const header = rawLine.match(headerPattern);
      if (header) {
        activeEvent = { name: header[1], argument: header[2] || null, actions: [], line: lineNumber };
        events.push(activeEvent);
        return;
      }

      if (!activeEvent || !/^\s/.test(rawLine)) {
        errors.push({ line: lineNumber, message: 'Expected an event such as on_start:.' });
        activeEvent = null;
        return;
      }

      const say = line.match(/^say\s+"((?:[^"\\]|\\.)*)"$/);
      const set = line.match(/^set\s+([a-z_]+)\s+to\s+(-?\d+(?:\.\d+)?|"(?:[^"\\]|\\.)*")$/);
      const add = line.match(/^add\s+(-?\d+(?:\.\d+)?)\s+to\s+([a-z_]+)$/);
      if (say) {
        try {
          activeEvent.actions.push({ type: 'say', value: JSON.parse(`"${say[1]}"`) });
        } catch {
          errors.push({ line: lineNumber, message: 'This message has an invalid escape sequence.' });
        }
      } else if (set) {
        try {
          activeEvent.actions.push({ type: 'set', key: set[1], value: parseValue(set[2]) });
        } catch {
          errors.push({ line: lineNumber, message: 'This value has an invalid escape sequence.' });
        }
      } else if (add) {
        activeEvent.actions.push({ type: 'add', key: add[2], value: Number(add[1]) });
      } else if (line === 'win') {
        activeEvent.actions.push({ type: 'win' });
      } else {
        errors.push({ line: lineNumber, message: 'Try say "text", set score to 0, add 1 to score, or win.' });
      }
    });

    return { events, errors };
  }

  function parseValue(value) {
    return value.startsWith('"') ? JSON.parse(value) : Number(value);
  }

  function runEvent(events, eventName, argument, state = {}) {
    const result = { ...state };
    const messages = [];
    let won = false;
    events.filter((event) => event.name === eventName && (!event.argument || event.argument === argument)).forEach((event) => {
      event.actions.forEach((action) => {
        if (action.type === 'say') messages.push(action.value);
        if (action.type === 'set') result[action.key] = action.value;
        if (action.type === 'add') result[action.key] = (Number(result[action.key]) || 0) + action.value;
        if (action.type === 'win') won = true;
      });
    });
    return { state: result, messages, won };
  }

  const api = { parseVScript, runEvent };
  root.MalstromVScript = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);
