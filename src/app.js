const assets = [
  { id: 'mossy-trail', name: 'Mossy Trail', category: 'Worlds', tag: 'ENVIRONMENT', color: 'moss', shape: '▰', description: 'A quiet forest path for getting pleasantly lost.' },
  { id: 'little-orbit', name: 'Little Orbit', category: 'Worlds', tag: 'BACKDROP', color: 'orbit', shape: '◉', description: 'A tiny corner of space with room to explore.' },
  { id: 'pocket-fox', name: 'Pocket Fox', category: 'Characters', tag: 'CHARACTER', color: 'fox', shape: '✳', description: 'A curious friend with a very good nose.' },
  { id: 'soft-steps', name: 'Soft Steps', category: 'Audio', tag: 'SOUND', color: 'sound', shape: '≋', description: 'A handful of gentle footsteps for small adventures.' },
  { id: 'moon-moth', name: 'Moon Moth', category: 'Characters', tag: 'CHARACTER', color: 'moth', shape: '✧', description: 'A glowing nighttime companion.' },
  { id: 'rainy-window', name: 'Rainy Window', category: 'Worlds', tag: 'ATMOSPHERE', color: 'rain', shape: '╱', description: 'A peaceful rainy-day scene to make your own.' }
];

const projects = JSON.parse(localStorage.getItem('malstrom-projects') || '[]');
const installedAssets = new Set(JSON.parse(localStorage.getItem('malstrom-assets') || '[]'));
const titles = { home: 'Overview', projects: 'My projects', store: 'Asset library', studio: 'AI game builder', vscript: 'VScript', editor: 'Editor' };
let activeFilter = 'All';
let toastTimer;

function showToast(message) {
  const toast = document.querySelector('#toast');
  toast.textContent = message;
  toast.classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('visible'), 2800);
}

function navigate(view) {
  document.querySelectorAll('.view').forEach((section) => section.classList.toggle('active', section.id === `view-${view}`));
  document.querySelectorAll('.nav-item').forEach((button) => button.classList.toggle('active', button.dataset.view === view));
  document.querySelector('#page-title').textContent = titles[view] || titles.home;
  document.querySelector('.main-area').scrollTo({ top: 0, behavior: 'smooth' });
}

function projectCard(project, index) {
  const card = document.createElement('article');
  card.className = `project-card art-${index % 3}`;
  card.innerHTML = `<div class="art-top"><span class="project-kind">${project.kind || 'NEW PROJECT'}</span><span class="art-orbit">${['✳', '◉', '✧'][index % 3]}</span></div><div class="art-bottom"><strong></strong><span>GAME PROJECT <i>·</i> ${project.updated || 'JUST NOW'}</span></div>`;
  card.querySelector('.art-bottom strong').textContent = project.name;
  card.tabIndex = 0;
  card.setAttribute('role', 'button');
  card.setAttribute('aria-label', `Open ${project.name}`);
  card.addEventListener('click', () => window.malstromEditor.openProject(project.path));
  card.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') window.malstromEditor.openProject(project.path);
  });
  return card;
}

function renderProjects() {
  const recent = document.querySelector('#recent-projects');
  const all = document.querySelector('#all-projects');
  recent.replaceChildren();
  all.replaceChildren();
  projects.slice(-3).reverse().forEach((project, index) => recent.append(projectCard(project, index)));
  projects.slice().reverse().forEach((project, index) => all.append(projectCard(project, index)));
  if (!projects.length) {
    const blank = document.createElement('div');
    blank.className = 'project-placeholder';
    blank.innerHTML = '<div class="placeholder-art"><span>✳</span><i>01</i></div><div><span class="section-kicker">YOUR CANVAS IS CLEAR</span><strong>A world starts with one idea.</strong><small>Make a project to give it shape.</small></div>';
    recent.append(blank);
  }
  document.querySelector('#projects-empty').classList.toggle('visible', projects.length === 0);
}

function assetCard(asset) {
  const installed = installedAssets.has(asset.id);
  const card = document.createElement('article');
  card.className = 'asset-card';
  const artwork = document.createElement('div');
  artwork.className = `asset-art ${asset.color}`;
  artwork.innerHTML = `<span class="asset-spark">${asset.shape}</span><span class="asset-number">MS / ${String(assets.indexOf(asset) + 1).padStart(2, '0')}</span><span class="asset-art-name"></span>`;
  artwork.querySelector('.asset-art-name').textContent = asset.name;
  const details = document.createElement('div');
  details.className = 'asset-details';
  details.innerHTML = `<span class="asset-tag">${asset.tag}</span><button class="asset-install ${installed ? 'installed' : ''}" aria-label="${installed ? 'Installed' : 'Install asset'}">${installed ? '✓' : '＋'}</button><h3></h3><p></p><span class="asset-format">.MSM <i>·</i> CC0</span>`;
  details.querySelector('h3').textContent = asset.name;
  details.querySelector('p').textContent = asset.description;
  details.querySelector('.asset-install').addEventListener('click', async () => {
    if (installedAssets.has(asset.id)) return;
    try {
      await window.malstrom.installAsset(asset);
      installedAssets.add(asset.id);
      localStorage.setItem('malstrom-assets', JSON.stringify([...installedAssets]));
      showToast(`${asset.name} added to your library`);
      renderAssets();
    } catch {
      showToast('Could not install this asset. Try again.');
    }
  });
  card.append(artwork, details);
  return card;
}

function renderAssets() {
  const query = document.querySelector('#asset-search').value.trim().toLowerCase();
  const filtered = assets.filter((asset) => (activeFilter === 'All' || asset.category === activeFilter) && `${asset.name} ${asset.category} ${asset.description}`.toLowerCase().includes(query));
  const grid = document.querySelector('#asset-grid');
  grid.replaceChildren(...filtered.map(assetCard));
  document.querySelector('#featured-assets').replaceChildren(...assets.slice(0, 3).map((asset) => {
    const item = document.createElement('button');
    item.className = `featured-asset ${asset.color}`;
    item.innerHTML = `<span>${asset.shape}</span><strong></strong><small>${asset.category.toUpperCase()}</small>`;
    item.querySelector('strong').textContent = asset.name;
    item.addEventListener('click', () => navigate('store'));
    return item;
  }));
  if (!filtered.length) grid.innerHTML = '<div class="empty-search">No matching assets. Try another search.</div>';
}

async function createProject() {
  const name = window.prompt('What would you like to call your game?', 'My First Game');
  if (name === null) return;
  try {
    const result = await window.malstrom.createProject(name);
    if (result.canceled) return;
    projects.push({ name: result.name, path: result.path, updated: 'JUST NOW', kind: 'NEW PROJECT' });
    localStorage.setItem('malstrom-projects', JSON.stringify(projects));
    renderProjects();
    const project = await window.malstrom.loadProject(result.path);
    window.malstromEditor.open(project);
    showToast(`${result.name} is ready to build`);
  } catch {
    showToast('Could not create the project. Try again.');
  }
}

async function openExistingProject() {
  try {
    const project = await window.malstrom.openProject();
    if (project.canceled) return;
    if (!projects.some((entry) => entry.path === project.path)) {
      projects.push({ name: project.game.name, path: project.path, updated: 'JUST NOW', kind: 'OPENED PROJECT' });
      localStorage.setItem('malstrom-projects', JSON.stringify(projects));
      renderProjects();
    }
    window.malstromEditor.open(project);
  } catch {
    showToast('Could not open that project. Check that its .msg file is valid.');
  }
}

function generateScript(prompt) {
  const words = prompt.match(/[a-zA-Z0-9']+/g) || [];
  const subject = words.find((word) => /fox|robot|explorer|hero|cat|player|wizard/i.test(word)) || 'player';
  const activity = /collect|gather|find|pick up/i.test(prompt) ? 'collect' : /help|rescue|save/i.test(prompt) ? 'help' : 'explore';
  const item = /mushroom/i.test(prompt) ? 'mushroom' : /star/i.test(prompt) ? 'star' : /berry|berries/i.test(prompt) ? 'berry' : 'item';
  const lines = [
    '# A starter script for your idea',
    '# Generated locally. Make it yours!',
    '',
    'on_start:',
    '    say "Your adventure begins."',
    '    set score to 0',
    '',
    `on_${activity} "${item}":`,
    '    add 1 to score',
    `    say "${subject.charAt(0).toUpperCase() + subject.slice(1)} found one!"`,
    '',
    'on_level_complete:',
    '    say "A lovely little adventure."'
  ];
  document.querySelector('#generated-code code').textContent = lines.join(String.fromCharCode(10));
  document.querySelector('#code-gutter').innerHTML = lines.map((_, index) => String(index + 1).padStart(2, '0')).join('<br />');
  document.querySelector('#generator-status').textContent = 'STARTER GENERATED LOCALLY · READY TO EDIT';
}

document.querySelectorAll('.nav-item').forEach((button) => button.addEventListener('click', () => navigate(button.dataset.view)));
document.querySelectorAll('[data-go]').forEach((button) => button.addEventListener('click', () => navigate(button.dataset.go)));
document.querySelectorAll('[data-filter]').forEach((button) => button.addEventListener('click', () => {
  activeFilter = button.dataset.filter;
  document.querySelectorAll('[data-filter]').forEach((filter) => filter.classList.toggle('active', filter === button));
  renderAssets();
}));
document.querySelectorAll('#new-project, #new-project-list, #empty-new-project, #new-script-project').forEach((button) => button.addEventListener('click', createProject));
document.querySelector('#open-project').addEventListener('click', openExistingProject);
document.querySelector('#asset-search').addEventListener('input', renderAssets);
document.querySelector('#generate-idea').addEventListener('click', () => {
  const prompt = document.querySelector('#idea-prompt').value.trim();
  if (!prompt) return showToast('Add a little detail about your game first.');
  generateScript(prompt);
});
document.querySelector('#idea-prompt').addEventListener('input', (event) => {
  document.querySelector('#prompt-count').textContent = `${event.target.value.length} / 600`;
});
document.querySelectorAll('[data-prompt]').forEach((button) => button.addEventListener('click', () => {
  const prompt = document.querySelector('#idea-prompt');
  prompt.value = button.dataset.prompt;
  prompt.dispatchEvent(new Event('input'));
}));
document.querySelector('#copy-code').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(document.querySelector('#generated-code').textContent);
    showToast('VScript copied to clipboard');
  } catch {
    showToast('Clipboard access is unavailable in this window.');
  }
});
document.querySelector('#install-engine').addEventListener('click', async (event) => {
  const button = event.currentTarget;
  button.disabled = true;
  button.textContent = 'Installing…';
  try {
    const result = await window.malstrom.installEngine();
    document.querySelector('#engine-dot').classList.add('online');
    document.querySelector('#engine-status').textContent = 'STARTER RUNTIME INSTALLED';
    document.querySelector('#engine-copy').textContent = 'VScript starter guide is ready in your workspace.';
    button.textContent = 'Installed ✓';
    showToast('Starter runtime installed');
    document.querySelector('#open-engine-folder').onclick = () => window.malstrom.openPath(result.location);
  } catch {
    button.disabled = false;
    button.innerHTML = 'Install engine <span>↗</span>';
    showToast('Could not install the runtime. Try again.');
  }
});
document.querySelector('#open-engine-folder').addEventListener('click', async () => {
  const status = await window.malstrom.engineStatus();
  if (!status.installed) return showToast('Install the starter runtime first.');
  await window.malstrom.openPath(status.location);
});

window.malstromUI = { navigate, showToast };
renderProjects();
renderAssets();
window.malstrom.engineStatus().then((status) => {
  if (!status.installed) return;
  document.querySelector('#engine-dot').classList.add('online');
  document.querySelector('#engine-status').textContent = 'STARTER RUNTIME INSTALLED';
  document.querySelector('#engine-copy').textContent = 'VScript starter guide is ready in your workspace.';
  const button = document.querySelector('#install-engine');
  button.textContent = 'Installed ✓';
  button.disabled = true;
});
