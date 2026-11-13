// ==UserScript==
// @name         nonag-shorts
// @namespace    https://github.com/arxodeus/nonag-shorts
// @version      1.0.0
// @updateURL    https://raw.githubusercontent.com/arxodeus/nonag-shorts/main/nonag-shorts.user.js
// @downloadURL  https://raw.githubusercontent.com/arxodeus/nonag-shorts/main/nonag-shorts.user.js
// @match        *://www.youtube.com/*
// @match        *://m.youtube.com/*
// @match        *://consent.youtube.com/*
// @run-at       document-idle
// @license      EUPL-1.2+
// ==/UserScript==

// no ampersands, angle brackets, carets, asterisks, backslashes or backticks

function hide(el) {
  el.style.setProperty('display', 'none', 'important');
}

function textOf(el) {
  return (el.innerText || el.textContent || el.value || '').trim().toLowerCase();
}

const isMobile = location.hostname === 'm.youtube.com';

// the desktop "like this video? sign in" popover after liking or subscribing
const style = document.createElement('style');
style.textContent = 'tp-yt-iron-dropdown:has(ytd-modal-with-title-and-button-renderer) { display: none !important; }';
(document.head || document.documentElement).appendChild(style);

// sign-in links and "open youtube app" links
function isNagLink(a) {
  const href = a.getAttribute('href') || '';
  if (href.indexOf('intent:') === 0) return true;
  return href.indexOf('https://accounts.google.com/') === 0;
}

// the mobile sign-in dialog is shown with css, not the open attribute. its
// cancel, the only button that isn't a link, lets youtube reset its own state
function closeSignInDialogs() {
  for (const d of document.querySelectorAll('dialog')) {
    if (!d.getBoundingClientRect().height) continue;
    if (!Array.from(d.querySelectorAll('a[href]')).some(isNagLink)) continue;
    const cancel = Array.from(d.querySelectorAll('button, [role=button]')).find(function (b) {
      return !b.closest('a');
    });
    if (cancel) {
      cancel.click();
    } else {
      hide(d);
    }
  }
}

// the cookie consent wall in the eu, as its own page or inside youtube
function rejectCookies() {
  for (const b of document.querySelectorAll('button, [role=button], input[type=submit]')) {
    if (b.dataset.nonag) continue;
    if (textOf(b) !== 'reject all') continue;
    b.dataset.nonag = '1';
    b.click();
  }
}

function clean() {
  for (const a of document.querySelectorAll('a[href]')) {
    if (isNagLink(a)) hide(a);
  }
  closeSignInDialogs();
  rejectCookies();
}

const barHeight = 14;
const bars = new Map();

function makeBar(v) {
  const bar = document.createElement('div');
  bar.style.cssText = 'position: fixed; z-index: 2147483647; height: ' + barHeight + 'px; cursor: pointer; touch-action: none; display: none;';
  const track = document.createElement('div');
  track.style.cssText = 'position: absolute; left: 0; right: 0; bottom: 0; height: 4px; background: rgba(255, 255, 255, 0.3);';
  const fill = document.createElement('div');
  fill.style.cssText = 'width: 100%; height: 100%; background: #fff; transform-origin: left; transform: scaleX(0);';
  track.append(fill);
  bar.append(track);
  document.body.append(bar);

  let dragging = false;

  function stop(e) {
    e.stopPropagation();
    e.preventDefault();
  }

  function seek(e) {
    const r = bar.getBoundingClientRect();
    const x = Math.min(Math.max(e.clientX - r.left, 0), r.width);
    v.currentTime = v.duration / (r.width / x);
  }

  bar.addEventListener('pointerdown', function (e) {
    stop(e);
    dragging = true;
    bar.setPointerCapture(e.pointerId);
    seek(e);
  });

  bar.addEventListener('pointermove', function (e) {
    if (!dragging) return;
    stop(e);
    seek(e);
  });

  for (const type of ['pointerup', 'pointercancel']) {
    bar.addEventListener(type, function (e) {
      stop(e);
      dragging = false;
    });
  }

  for (const type of ['click', 'mousedown', 'mouseup', 'touchstart', 'touchend']) {
    bar.addEventListener(type, stop);
  }

  return { bar: bar, fill: fill };
}

// the desktop player has its own progress bar
function findVideos() {
  if (!isMobile) return;
  for (const v of document.querySelectorAll('video')) {
    if (!bars.has(v)) bars.set(v, makeBar(v));
  }
}

function onScreen(v, r) {
  if (location.pathname.indexOf('/shorts/') !== 0) return false;
  if (!v.duration) return false;
  if (!isFinite(v.duration)) return false;
  if (!r.width) return false;
  if (Math.max(r.bottom, 0) === 0) return false;
  return Math.min(r.top, innerHeight) !== innerHeight;
}

function drawBars() {
  for (const [v, b] of bars) {
    if (!v.isConnected) {
      b.bar.remove();
      bars.delete(v);
      continue;
    }
    const r = v.getBoundingClientRect();
    if (!onScreen(v, r)) {
      b.bar.style.display = 'none';
      continue;
    }
    b.bar.style.display = 'block';
    b.bar.style.left = r.left + 'px';
    b.bar.style.top = Math.min(r.bottom, innerHeight) - barHeight + 'px';
    b.bar.style.width = r.width + 'px';
    b.fill.style.transform = 'scaleX(' + v.currentTime / v.duration + ')';
  }
  requestAnimationFrame(drawBars);
}

new MutationObserver(clean).observe(document, { childList: true, subtree: true });
setInterval(function () {
  clean();
  findVideos();
}, 500);
requestAnimationFrame(drawBars);
