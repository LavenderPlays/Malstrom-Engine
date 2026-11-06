(() => {
  const canvas = document.querySelector('#game-canvas');
  const context = canvas.getContext('2d');
  const editorCenter = document.querySelector('.editor-center');
  const gameHud = document.querySelector('#game-hud');
  let currentProject = null;
  let selectedId = null;
  let dragging = null;
  let gridEnabled = true;
  let runtime = null;
  let animationFrame = 0;
  let previousFrame = 0;
  let lastMessage = '';

  function scene() {
    return currentProject.game.scenes[0];
  }

  function objects() {
    return scene().objects;
  }

  function selectedObject() {
    return objects().find((object) => object.id === selectedId) || null;
  }

  function markUnsaved() {
    const state = document.querySelector('#save-state');
    state.textContent = 'UNSAVED';
    state.classList.add('unsaved');
  }

  function safeColor(value, fallback = '#d2f268') {
    return /^#[0-9a-f]{6}$/i.test(value) ? value : fallback;
  }

  function open(project) {
    currentProject = project;
    if (!currentProject.game.scenes.length) {
      currentProject.game.scenes.push({ name: 'First Scene', width: 960, height: 540, background: '#18211e', objects: [] });
    }
    if (!Array.isArray(scene().objects)) scene().objects = [];
    selectedId = null;
    document.querySelector('#editor-project-name').textContent = currentProject.game.name || 'Untitled';
    document.querySelector('#scene-name').textContent = scene().name || 'First Scene';
    document.querySelector('#script-source').value = currentProject.script || '';
    document.querySelector('#save-state').textContent = 'SAVED';
    document.querySelector('#save-state').classList.remove('unsaved');
    document.querySelector('#script-dock').classList.remove('open');
    window.malstromUI.navigate('editor');
    refresh();
  }

  async function openProject(directory) {
    try {
      open(await window.malstrom.loadProject(directory));
    } catch (error) {
      window.malstromUI.showToast(error.message || 'Could not open this project.');
    }
  }

  async function saveProject() {
    if (!currentProject) return;
    const script = document.querySelector('#script-source').value;
    try {
      await window.malstrom.saveProject(currentProject.path, currentProject.game, script);
      currentProject.script = script;
      const state = document.querySelector('#save-state');
      state.textContent = 'SAVED';
      state.classList.remove('unsaved');
      window.malstromUI.showToast('Project saved');
    } catch (error) {
      window.malstromUI.showToast(error.message || 'Could not save this project.');
    }
  }

  function refresh() {
    if (!currentProject) return;
    renderObjects();
    renderInspector();
    drawScene();
    document.querySelector('#scene-object-count').textContent = `${objects().length} OBJECT${objects().length === 1 ? '' : 'S'}`;
  }

  function renderObjects() {
    const list = document.querySelector('#object-list');
    list.replaceChildren();
    objects().forEach((object) => {
      const row = document.createElement('button');
      row.className = `object-row ${object.id === selectedId ? 'active' : ''}`;
      row.dataset.type = object.type;
      const glyph = document.createElement('span');
      glyph.className = 'object-glyph';
      glyph.textContent = object.type === 'player' ? 'P' : object.type === 'star' ? '★' : object.type === 'platform' ? '▰' : '◆';
      const name = document.createElement('span');
      name.textContent = object.name || object.type;
      const type = document.createElement('small');
      type.textContent = object.type.toUpperCase();
      row.append(glyph, name, type);
      row.addEventListener('click', () => selectObject(object.id));
      list.append(row);
    });
  }

  function addInspectorField(parent, labelText, value, type, onChange) {
    const group = document.createElement('div');
    group.className = 'inspector-group';
    const label = document.createElement('label');
    label.textContent = labelText;
    const input = document.createElement('input');
    input.type = type;
    input.value = type === 'color' ? safeColor(value) : value;
    if (type === 'number') input.step = '1';
    input.addEventListener(type === 'text' ? 'input' : 'change', () => onChange(type === 'number' ? Number(input.value) : input.value));
    group.append(label, input);
    parent.append(group);
  }

  function renderInspector() {
    const fields = document.querySelector('#inspector-fields');
    const target = selectedObject();
    fields.replaceChildren();
    document.querySelector('#inspector-type').textContent = target ? target.type.toUpperCase() : 'SCENE';
    document.querySelector('#delete-object').disabled = !target || runtime !== null;
    if (!target) {
      const empty = document.createElement('div');
      empty.className = 'inspector-empty';
      empty.textContent = 'Select an object in the scene to edit its properties.';
      fields.append(empty);
      return;
    }

    addInspectorField(fields, 'NAME', target.name, 'text', (value) => {
      target.name = value;
      markUnsaved();
      renderObjects();
    });

    const typeGroup = document.createElement('div');
    typeGroup.className = 'inspector-group';
    const typeLabel = document.createElement('label');
    typeLabel.textContent = 'TYPE';
    const typeSelect = document.createElement('select');
    ['player', 'platform', 'star', 'decoration'].forEach((type) => {
      const option = document.createElement('option');
      option.value = type;
      option.textContent = type[0].toUpperCase() + type.slice(1);
      typeSelect.append(option);
    });
    typeSelect.value = target.type;
    typeSelect.addEventListener('change', () => {
      target.type = typeSelect.value;
      markUnsaved();
      renderObjects();
      renderInspector();
      drawScene();
    });
    typeGroup.append(typeLabel, typeSelect);
    fields.append(typeGroup);

    const positionGroup = document.createElement('div');
    positionGroup.className = 'inspector-pair';
    addInspectorField(positionGroup, 'X', target.x, 'number', (value) => updateNumber(target, 'x', value));
    addInspectorField(positionGroup, 'Y', target.y, 'number', (value) => updateNumber(target, 'y', value));
    fields.append(positionGroup);
    const sizeGroup = document.createElement('div');
    sizeGroup.className = 'inspector-pair';
    addInspectorField(sizeGroup, 'WIDTH', target.width, 'number', (value) => updateNumber(target, 'width', value));
    addInspectorField(sizeGroup, 'HEIGHT', target.height, 'number', (value) => updateNumber(target, 'height', value));
    fields.append(sizeGroup);
    addInspectorField(fields, 'COLOR', target.color, 'color', (value) => {
      target.color = safeColor(value);
      markUnsaved();
      drawScene();
    });
  }

  function updateNumber(target, key, value) {
    target[key] = Math.max(1, Math.min(2000, Number(value) || 1));
    markUnsaved();
    drawScene();
  }

  function selectObject(id) {
    selectedId = id;
    renderObjects();
    renderInspector();
    drawScene();
  }

  function drawStar(ctx, x, y, size, color) {
    ctx.beginPath();
    for (let point = 0; point < 10; point += 1) {
      const angle = -Math.PI / 2 + point * Math.PI / 5;
      const radius = point % 2 === 0 ? size / 2 : size / 4.5;
      const px = x + Math.cos(angle) * radius;
      const py = y + Math.sin(angle) * radius;
      if (point === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  }

  function drawScene() {
    if (!currentProject || !context) return;
    const activeObjects = runtime ? runtime.objects : objects();
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = safeColor(scene().background, '#18211e');
    context.fillRect(0, 0, canvas.width, canvas.height);

    const sky = context.createRadialGradient(690, 70, 5, 690, 70, 380);
    sky.addColorStop(0, '#66704a44');
    sky.addColorStop(1, '#66704a00');
    context.fillStyle = sky;
    context.fillRect(0, 0, canvas.width, canvas.height);

    context.fillStyle = '#d5dfbd';
    [[80, 90], [211, 64], [520, 111], [748, 143], [870, 62], [430, 42]].forEach(([x, y]) => {
      context.globalAlpha = 0.3 + ((x + y) % 4) * 0.13;
      context.fillRect(x, y, 2, 2);
    });
    context.globalAlpha = 1;

    if (gridEnabled && !runtime) {
      context.beginPath();
      context.strokeStyle = '#d8e6c00b';
      context.lineWidth = 1;
      for (let x = 0; x <= canvas.width; x += 40) {
        context.moveTo(x, 0);
        context.lineTo(x, canvas.height);
      }
      for (let y = 0; y <= canvas.height; y += 40) {
        context.moveTo(0, y);
        context.lineTo(canvas.width, y);
      }
      context.stroke();
    }

    activeObjects.forEach((object) => {
      const x = Number(object.x) || 0;
      const y = Number(object.y) || 0;
      const width = Number(object.width) || 30;
      const height = Number(object.height) || 30;
      context.fillStyle = safeColor(object.color, '#839374');
      if (object.type === 'star') {
        drawStar(context, x + width / 2, y + height / 2, Math.min(width, height), object.color || '#f0ce72');
      } else if (object.type === 'player') {
        context.fillRect(x, y, width, height);
        context.fillStyle = '#18211e';
        context.fillRect(x + width * 0.22, y + height * 0.25, 4, 5);
        context.fillRect(x + width * 0.68, y + height * 0.25, 4, 5);
      } else {
        context.fillRect(x, y, width, height);
        if (object.type === 'platform') {
          context.fillStyle = '#e0edb047';
          context.fillRect(x, y, width, 3);
        }
      }
      if (!runtime && object.id === selectedId) {
        context.strokeStyle = '#e5f695';
        context.lineWidth = 2;
        context.setLineDash([6, 4]);
        context.strokeRect(x - 4, y - 4, width + 8, height + 8);
        context.setLineDash([]);
        context.fillStyle = '#e5f695';
        [[x - 5, y - 5], [x + width - 1, y - 5], [x - 5, y + height - 1], [x + width - 1, y + height - 1]].forEach(([hx, hy]) => context.fillRect(hx, hy, 6, 6));
      }
    });

    if (runtime) {
      const score = Number(runtime.state.score) || 0;
      gameHud.textContent = `STARS  ${score}${lastMessage ? `     ${lastMessage}` : ''}`;
    } else {
      gameHud.textContent = '';
    }
  }

  function addObject(type) {
    if (!currentProject || runtime) return;
    const values = {
      player: { name: 'Player', width: 38, height: 42, color: '#d2f268' },
      platform: { name: 'Platform', width: 160, height: 20, color: '#526449' },
      star: { name: 'Star', width: 28, height: 28, color: '#f0ce72' },
      decoration: { name: 'Decoration', width: 48, height: 48, color: '#83b39b' }
    }[type];
    const object = { id: `${type}-${Date.now()}-${Math.floor(Math.random() * 1000)}`, type, x: 120, y: type === 'platform' ? 350 : 150, ...values };
    objects().push(object);
    selectedId = object.id;
    markUnsaved();
    refresh();
    document.querySelector('#scene-add-menu').classList.remove('visible');
  }

  function pointerPosition(event) {
    const rect = canvas.getBoundingClientRect();
    return { x: (event.clientX - rect.left) * (canvas.width / rect.width), y: (event.clientY - rect.top) * (canvas.height / rect.height) };
  }

  function findObject(point) {
    return objects().slice().reverse().find((object) => point.x >= object.x && point.x <= object.x + object.width && point.y >= object.y && point.y <= object.y + object.height) || null;
  }

  function handleCanvasDown(event) {
    if (!currentProject || runtime) return;
    const point = pointerPosition(event);
    const target = findObject(point);
    if (!target) {
      selectedId = null;
      refresh();
      return;
    }
    selectObject(target.id);
    dragging = { id: target.id, dx: point.x - target.x, dy: point.y - target.y };
    canvas.setPointerCapture(event.pointerId);
  }

  function handleCanvasMove(event) {
    if (!dragging || runtime) return;
    const target = selectedObject();
    if (!target) return;
    const point = pointerPosition(event);
    target.x = Math.max(0, Math.min(canvas.width - target.width, Math.round(point.x - dragging.dx)));
    target.y = Math.max(0, Math.min(canvas.height - target.height, Math.round(point.y - dragging.dy)));
    markUnsaved();
    drawScene();
  }

  function handleCanvasUp() {
    if (!dragging) return;
    dragging = null;
    renderInspector();
  }

  function parseScript() {
    const result = window.MalstromVScript.parseVScript(document.querySelector('#script-source').value);
    const errorLabel = document.querySelector('#script-error');
    errorLabel.textContent = result.errors.length ? `${result.errors.length} ISSUE${result.errors.length === 1 ? '' : 'S'}` : 'NO ISSUES';
    errorLabel.style.color = result.errors.length ? '#e7ad89' : '#9aaf6d';
    return result;
  }

  function runEvent(name, argument) {
    const result = window.MalstromVScript.runEvent(runtime.events, name, argument, runtime.state);
    runtime.state = result.state;
    if (result.messages.length) lastMessage = result.messages[result.messages.length - 1];
    if (result.won) lastMessage = 'You win!';
    drawScene();
  }

  function startGame() {
    const parsed = parseScript();
    if (parsed.errors.length) {
      window.malstromUI.showToast(`Fix the VScript issue on line ${parsed.errors[0].line} before playing.`);
      document.querySelector('#script-dock').classList.add('open');
      return;
    }
    const player = objects().find((object) => object.type === 'player');
    if (!player) {
      window.malstromUI.showToast('Add a player object before pressing Play.');
      return;
    }
    runtime = {
      objects: objects().map((object) => ({ ...object })),
      playerId: player.id,
      events: parsed.events,
      state: {},
      keys: new Set(),
      velocityY: 0,
      grounded: false
    };
    lastMessage = '';
    runEvent('start', null);
    editorCenter.classList.add('is-playing');
    document.querySelector('#play-project').innerHTML = '<span>■</span> Stop';
    document.querySelector('#delete-object').disabled = true;
    document.querySelector('#stage-footer span:first-child').textContent = 'Playing. Arrow keys or A/D move; Space jumps; Esc stops.';
    document.querySelector('#script-dock').classList.remove('open');
    previousFrame = performance.now();
    animationFrame = requestAnimationFrame(gameLoop);
  }

  function stopGame() {
    if (!runtime) return;
    cancelAnimationFrame(animationFrame);
    runtime = null;
    lastMessage = '';
    gameHud.textContent = '';
    editorCenter.classList.remove('is-playing');
    document.querySelector('#play-project').innerHTML = '<span>▶</span> Play';
    document.querySelector('#stage-footer span:first-child').textContent = 'Select an object to edit it. Drag objects to move them.';
    refresh();
  }

  function gameLoop(now) {
    if (!runtime) return;
    const dt = Math.min((now - previousFrame) / 1000, 0.035);
    previousFrame = now;
    const player = runtime.objects.find((object) => object.id === runtime.playerId);
    const left = runtime.keys.has('ArrowLeft') || runtime.keys.has('a') || runtime.keys.has('A');
    const right = runtime.keys.has('ArrowRight') || runtime.keys.has('d') || runtime.keys.has('D');
    player.x += ((right ? 1 : 0) - (left ? 1 : 0)) * 235 * dt;
    runtime.velocityY += 1700 * dt;
    const previousBottom = player.y + player.height;
    player.y += runtime.velocityY * dt;
    runtime.grounded = false;
    runtime.objects.filter((object) => object.type === 'platform').forEach((platform) => {
      const overlapsX = player.x + player.width > platform.x && player.x < platform.x + platform.width;
      if (overlapsX && runtime.velocityY >= 0 && previousBottom <= platform.y + 8 && player.y + player.height >= platform.y) {
        player.y = platform.y - player.height;
        runtime.velocityY = 0;
        runtime.grounded = true;
      }
    });
    player.x = Math.max(0, Math.min(canvas.width - player.width, player.x));
    if (player.y > canvas.height + 60) {
      player.x = objects().find((object) => object.id === runtime.playerId).x;
      player.y = objects().find((object) => object.id === runtime.playerId).y;
      runtime.velocityY = 0;
    }

    const collected = runtime.objects.filter((object) => object.type === 'star' && overlaps(player, object));
    collected.forEach((star) => {
      runtime.objects = runtime.objects.filter((object) => object.id !== star.id);
      runEvent('collect', star.type);
      if (!runtime.objects.some((object) => object.type === 'star')) runEvent('win', null);
    });
    drawScene();
    animationFrame = requestAnimationFrame(gameLoop);
  }

  function overlaps(first, second) {
    return first.x < second.x + second.width && first.x + first.width > second.x && first.y < second.y + second.height && first.y + first.height > second.y;
  }

  function handleKeyDown(event) {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
      event.preventDefault();
      saveProject();
      return;
    }
    if (!runtime) return;
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' '].includes(event.key)) event.preventDefault();
    runtime.keys.add(event.key);
    const keyName = event.key === ' ' ? 'space' : event.key.startsWith('Arrow') ? event.key.slice(5).toLowerCase() : event.key.toLowerCase();
    const result = window.MalstromVScript.runEvent(runtime.events, 'key', keyName, runtime.state);
    runtime.state = result.state;
    if (result.messages.length) lastMessage = result.messages[result.messages.length - 1];
    if ((event.key === ' ' || event.key === 'ArrowUp' || event.key.toLowerCase() === 'w') && runtime.grounded) {
      runtime.velocityY = -620;
      runtime.grounded = false;
    }
  }

  document.querySelector('#save-project').addEventListener('click', saveProject);
  document.querySelector('#play-project').addEventListener('click', () => runtime ? stopGame() : startGame());
  document.querySelector('#editor-back').addEventListener('click', () => {
    stopGame();
    window.malstromUI.navigate('home');
  });
  document.querySelector('#toggle-script').addEventListener('click', () => document.querySelector('#script-dock').classList.toggle('open'));
  document.querySelector('#close-script').addEventListener('click', () => document.querySelector('#script-dock').classList.remove('open'));
  document.querySelector('#script-source').addEventListener('input', () => {
    if (currentProject) currentProject.script = document.querySelector('#script-source').value;
    markUnsaved();
    parseScript();
  });
  document.querySelector('#add-object').addEventListener('click', () => document.querySelector('#scene-add-menu').classList.toggle('visible'));
  document.querySelectorAll('[data-add]').forEach((button) => button.addEventListener('click', () => addObject(button.dataset.add)));
  document.querySelector('#delete-object').addEventListener('click', () => {
    if (!selectedId || runtime) return;
    currentProject.game.scenes[0].objects = objects().filter((object) => object.id !== selectedId);
    selectedId = null;
    markUnsaved();
    refresh();
  });
  document.querySelector('#grid-toggle').addEventListener('click', () => {
    gridEnabled = !gridEnabled;
    drawScene();
  });
  document.querySelector('#scene-add-menu').addEventListener('click', (event) => event.stopPropagation());
  document.addEventListener('pointerdown', (event) => {
    if (!event.target.closest('#scene-add-menu') && !event.target.closest('#add-object')) document.querySelector('#scene-add-menu').classList.remove('visible');
  });
  canvas.addEventListener('pointerdown', handleCanvasDown);
  canvas.addEventListener('pointermove', handleCanvasMove);
  canvas.addEventListener('pointerup', handleCanvasUp);
  canvas.addEventListener('pointercancel', handleCanvasUp);
  document.addEventListener('keydown', handleKeyDown);
  document.addEventListener('keyup', (event) => runtime && runtime.keys.delete(event.key));
  document.addEventListener('keydown', (event) => {
    if (runtime && event.key === 'Escape') stopGame();
  });

  window.malstromEditor = { open, openProject };
})();
