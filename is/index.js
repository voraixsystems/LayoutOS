#!/usr/bin/env node

const blessed = require('blessed');
const fs = require('fs');
const path = require('path');
const { spawn, exec } = require('child_process');

const ROOT         = path.join(__dirname, '..');
const PRICES_PATH  = path.join(ROOT, 'data', 'shared', 'prices.json');
const HISTORY_PATH = path.join(ROOT, 'data', 'shared', 'price_history.json');

// ── helpers ───────────────────────────────────────────────────

function readJSON(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
  catch { return {}; }
}

function writeJSON(p, obj) {
  fs.writeFileSync(p, JSON.stringify(obj, null, 2));
}

function fmt(n) { return '$' + Number(n).toFixed(2); }
function today() { return new Date().toISOString().slice(0, 10); }

let prices = readJSON(PRICES_PATH);
let history = readJSON(HISTORY_PATH);

function savePrices() { writeJSON(PRICES_PATH, prices); }
function saveHistory() { writeJSON(HISTORY_PATH, history); }

function recordHistory(key, oldPrice) {
  if (!history[key]) history[key] = [];
  history[key].unshift({ price: oldPrice, date: today() });
  history[key] = history[key].slice(0, 2);
  saveHistory();
}

// ── screen ────────────────────────────────────────────────────

const screen = blessed.screen({
  smartCSR: true,
  title: 'LayoutIS',
  fullUnicode: true
});

const root = blessed.box({
  width: '100%',
  height: '100%',
  style: { bg: '#0f172a', fg: '#e2e8f0' }
});

screen.append(root);

// ── utils ─────────────────────────────────────────────────────

function clear() {
  root.children.forEach(c => c.detach());
}

function footer(text) {
  blessed.box({
    parent: root,
    bottom: 0,
    height: 1,
    width: '100%',
    content: ' ' + text,
    style: { bg: '#1e293b', fg: '#94a3b8' }
  });
}

function makeLog() {
  const box = blessed.box({
    parent: root,
    scrollable: true,
    keys: true,
    mouse: true,
    border: 'line',
    scrollbar: { ch: '│' }
  });

  const lines = [];
  const MAX = 400;

  box.add = (t) => {
    lines.push(t);
    if (lines.length > MAX) lines.shift();
    box.setContent(lines.join('\n'));
    box.setScroll(lines.length);
    screen.render();
  };

  return box;
}

// ── PRICES ────────────────────────────────────────────────────

function openPrices() {
  clear();

  const keys = Object.keys(prices).filter(k => typeof prices[k] === 'number');

  const list = blessed.list({
    parent: root,
    width: '45%',
    height: '100%-1',
    border: 'line',
    keys: true,
    vi: true,
    mouse: true,
    scrollable: true,
    alwaysScroll: true,
    scrollbar: { ch: '│' },
    style: {
      selected: { bg: '#1e3a5f', bold: true }
    },
    items: keys.map(k => `${k.padEnd(28)} ${fmt(prices[k])}`)
  });

  const detail = blessed.box({
    parent: root,
    left: '45%',
    width: '55%',
    bottom: 1,
    border: 'line',
    scrollable: true
  });

  const input = blessed.textbox({
    parent: root,
    bottom: 1,
    left: '45%',
    width: '55%',
    height: 3,
    hidden: true,
    border: 'line',
    inputOnFocus: true
  });

  function renderDetail(k) {
    const h = history[k] || [];

    let txt = `\n ${k}\n\n Current: ${fmt(prices[k])}\n\n`;

    if (h.length) {
      txt += ` History:\n`;
      h.forEach(x => txt += `  ${x.date} → ${fmt(x.price)}\n`);
    }

    txt += `\n [e] edit`;
    detail.setContent(txt);
    screen.render();
  }

  function updateFromCursor() {
    const k = keys[list.selected];
    if (k) renderDetail(k);
  }

  list.on('keypress', (_, key) => {
    if (['up','down','j','k'].includes(key.name)) {
      updateFromCursor();
    }
  });

  list.on('select', (_, i) => renderDetail(keys[i]));

  list.key('e', () => {
    const key = keys[list.selected];

    input.setLabel(` Edit: ${key} (Ctrl+G save | Esc cancel) `);
    input.setValue(String(prices[key] ?? ''));
    input.show();
    input.setFront();
    input.focus();

    input.removeAllListeners('keypress');

    screen.render();

    input.key('C-g', () => {
      const val = parseFloat(input.getValue());

      if (isNaN(val) || val <= 0) return;

      recordHistory(key, prices[key]);
      prices[key] = val;
      prices._last_updated = today();
      savePrices();

      list.setItem(list.selected, `${key.padEnd(28)} ${fmt(val)}`);
      renderDetail(key);

      input.hide();
      list.focus();
      screen.render();
    });

    input.key('escape', () => {
      input.hide();
      list.focus();
      screen.render();
    });
  });

  footer('[↑↓] move  [enter] select  [e] edit  [Ctrl+G] save  [esc] cancel  [2] server  [q] quit');

  list.focus();
  renderDetail(keys[0]);
  screen.render();
}

// ── SERVER ────────────────────────────────────────────────────

let serverProc = null;

function openServer() {
  clear();

  const log = makeLog();

  function start() {
    if (serverProc) return log.add('already running');

    log.add('starting server...');

    serverProc = spawn(process.execPath, [path.join(ROOT, 'server.js')], { cwd: ROOT });

    serverProc.stdout.on('data', d =>
      d.toString().split('\n').forEach(l => l && log.add(l))
    );

    serverProc.stderr.on('data', d =>
      d.toString().split('\n').forEach(l => l && log.add('ERR: ' + l))
    );

    serverProc.on('close', () => {
      log.add('server exited');
      serverProc = null;
    });
  }

  function stop() {
    if (!serverProc) return log.add('no server running');

    try {
      serverProc.kill('SIGTERM');
      setTimeout(() => {
        if (serverProc && !serverProc.killed) {
          try { serverProc.kill('SIGKILL'); } catch {}
        }
      }, 500);
    } catch {}

    serverProc = null;
    log.add('stopped');
  }

  log.key('s', start);
  log.key('x', stop);

  footer('[s] start  [x] stop  [1] prices  [q] quit');

  log.focus();
  log.add('server ready');
  screen.render();
}

// ── GIT ───────────────────────────────────────────────────────

function openGit() {
  clear();

  const box = makeLog();

  function refresh() {
    exec('git status', { cwd: ROOT }, (_, out) => {
      box.add('--- status ---');
      box.add(out || 'none');

      exec('git log --oneline -10', { cwd: ROOT }, (_, log) => {
        box.add('--- log ---');
        box.add(log || 'none');
      });
    });
  }

  box.key('r', refresh);

  footer('[r] refresh  [1] prices  [q] quit');

  box.focus();
  refresh();
  screen.render();
}

// ── global ────────────────────────────────────────────────────

screen.key('1', openPrices);
screen.key('2', openServer);
screen.key('3', openGit);

screen.key(['q','C-c'], () => process.exit(0));

process.on('exit', () => {
  if (serverProc) {
    try { serverProc.kill('SIGTERM'); } catch {}
  }
});

// ── boot ──────────────────────────────────────────────────────

openPrices();
screen.render();
