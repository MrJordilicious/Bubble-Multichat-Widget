/* ================================================
   CHAT OVERLAY CUSTOMIZER — script.js
   ================================================ */
'use strict';

const OVERLAY_URL = 'https://widgets.mrjordilicious.com/Bubble-Multichat-Widget/overlay.html';

const $ = id => document.getElementById(id);

// ── Font handling ─────────────────────────────────
function syncFontInput(val) {
  const group = $('customFontGroup');
  if (group) group.style.display = (val === 'custom') ? 'block' : 'none';
  updateAll();
}
window.syncFontInput = syncFontInput; // expose for inline onchange

function getChosenFont() {
  const sel = $('fontFamily');
  if (!sel) return 'Nunito';
  if (sel.value === 'custom') {
    return ($('customFont')?.value?.trim()) || 'Nunito';
  }
  return sel.value;
}

// ── Build overlay URL ─────────────────────────────
function buildURL(demo) {
  const q = new URLSearchParams();

  // Connection
  const host = $('wsHost')?.value?.trim();
  const port = $('wsPort')?.value?.trim();
  const pass = $('wsPass')?.value?.trim();
  if (host && host !== '127.0.0.1') q.set('wsHost', host);
  if (port && port !== '8080')      q.set('wsPort', port);
  if (pass)                         q.set('wsPass', pass);

  // Filtering
  const ignored = $('ignored')?.value?.trim().replace(/\s*,\s*/g, ',');
  if (ignored)                       q.set('ignored', ignored);
  if (!$('ignoreCmd')?.checked)      q.set('ignoreCmd', 'false');

  // Appearance — font
  const font = getChosenFont();
  if (font !== 'Nunito')             q.set('fontFamily', font);

  const size = $('fontSize')?.value;
  if (size && size !== '15')         q.set('fontSize', size);

  const bc = $('bubbleColor')?.value?.replace('#', '');
  if (bc && bc.toUpperCase() !== 'FFF8F0') q.set('bubbleColor', bc);

  const tc = $('textColor')?.value?.replace('#', '');
  if (tc && tc.toLowerCase() !== '3a2f2f') q.set('textColor', tc);

  const unMode = $('usernameMode')?.checked ? 'usercolor' : 'custom';
  if (unMode !== 'usercolor')        q.set('usernameMode', unMode);

  const uc = $('usernameColor')?.value?.replace('#', '');
  if (uc && uc.toLowerCase() !== 'ff7043') q.set('usernameColor', uc);

  const avSz = parseInt($('avatarSize')?.value);
  if (avSz && avSz !== 54)           q.set('avatarSize', avSz);

  // Behavior
  const maxM = parseInt($('maxMsg')?.value);
  if (maxM && maxM !== 8)            q.set('maxMsg', maxM);

  // msgLife — 0 is valid and means "forever", can't use || fallback
  const life = $('msgLife')?.value;
  if (life !== null && life !== '30') q.set('msgLife', life);

  const dir = $('scrollDir')?.value;
  if (dir && dir !== 'up')           q.set('scrollDir', dir);

  const anim = $('animIn')?.value;
  if (anim && anim !== 'bounce')     q.set('animIn', anim);

  // Chat position
  const chatSide = $('chatSide')?.value;
  if (chatSide && chatSide !== 'left') q.set('chatSide', chatSide);

  const chatX = parseInt($('chatX')?.value ?? 20);
  if (chatX !== 20)                  q.set('chatX', chatX);

  const chatY = parseInt($('chatY')?.value ?? 20);
  if (chatY !== 20)                  q.set('chatY', chatY);

  // Features
  if (!$('showPlatform')?.checked)   q.set('showPlatform', 'false');
  if (!$('showBadges')?.checked)     q.set('showBadges', 'false');
  if ($('showPronouns')?.checked)    q.set('showPronouns', 'true');

  // Events
  if (!$('showEvents')?.checked)     q.set('showEvents', 'false');
  if (!$('evSub')?.checked)          q.set('evSub', 'false');
  if (!$('evGift')?.checked)         q.set('evGift', 'false');
  if (!$('evCheer')?.checked)        q.set('evCheer', 'false');
  if (!$('evFollow')?.checked)       q.set('evFollow', 'false');
  if (!$('evRaid')?.checked)         q.set('evRaid', 'false');
  if (!$('evYtSuper')?.checked)      q.set('evYtSuper', 'false');
  if (!$('evYtMember')?.checked)     q.set('evYtMember', 'false');

  // Shared chat
  if (!$('showSharedChat')?.checked) q.set('showSharedChat', 'false');

  // Hype train
  if (!$('showHypeTrain')?.checked)  q.set('showHypeTrain', 'false');

  const hypeX = parseInt($('hypeX')?.value ?? -1);
  if (hypeX !== -1)                  q.set('hypeX', hypeX);

  const hypeY = parseInt($('hypeY')?.value ?? 24);
  if (hypeY !== 24)                  q.set('hypeY', hypeY);

  if (demo) q.set('demo', 'true');

  const qs = q.toString();
  return OVERLAY_URL + (qs ? '?' + qs : '');
}

// ── Update UI + preview ───────────────────────────
function updateAll() {
  // Toggle custom username color group
  const customColorGroup = $('customColorGroup');
  if (customColorGroup)
    customColorGroup.style.display = $('usernameMode')?.checked ? 'none' : 'block';

  // Event sub-options dimming
  const evSubOpts = $('eventSubOptions');
  if (evSubOpts)
    evSubOpts.classList.toggle('disabled', !$('showEvents')?.checked);

  // Hype train position group dimming
  const hypePosGrp = $('hypePositionGroup');
  if (hypePosGrp) {
    hypePosGrp.style.opacity      = $('showHypeTrain')?.checked ? '1' : '0.4';
    hypePosGrp.style.pointerEvents = $('showHypeTrain')?.checked ? '' : 'none';
  }

  // Update URL
  $('result').textContent = buildURL(false);

  // Update preview iframe
  const iframe   = $('widgetPreview');
  const demoURL  = buildURL(true);
  if (iframe && iframe.src !== demoURL) iframe.src = demoURL;
}

// ── Range slider labels ───────────────────────────
function wireRange(id, labelId) {
  const el = $(id), lbl = $(labelId);
  if (el && lbl) el.addEventListener('input', () => { lbl.textContent = el.value; updateAll(); });
}
wireRange('fontSize',   'fontSizeVal');
wireRange('avatarSize', 'avatarSizeVal');
wireRange('maxMsg',     'maxMsgVal');

// ── Wire all inputs ───────────────────────────────
[
  'wsHost','wsPort','wsPass',
  'ignored','ignoreCmd',
  'fontFamily','customFont','fontSize','bubbleColor','textColor',
  'usernameMode','usernameColor',
  'avatarSize',
  'maxMsg','msgLife','scrollDir','animIn',
  'chatSide','chatX','chatY',
  'showPlatform','showBadges','showPronouns',
  'showEvents','evSub','evGift','evCheer','evFollow','evRaid','evYtSuper','evYtMember',
  'showSharedChat',
  'showHypeTrain','hypeX','hypeY',
].forEach(id => {
  const el = $(id);
  if (!el) return;
  el.addEventListener('input',  updateAll);
  el.addEventListener('change', updateAll);
});

// ── Copy button ───────────────────────────────────
$('copyBtn')?.addEventListener('click', () => {
  const url = $('result')?.textContent || '';
  navigator.clipboard.writeText(url).then(() => {
    const msg = $('copyMsg');
    if (msg) { msg.style.display = 'inline'; setTimeout(() => msg.style.display = 'none', 1800); }
  });
});

// ── Initial render ────────────────────────────────
window.addEventListener('load', () => {
  const cg = $('customColorGroup');
  if (cg) cg.style.display = 'none';
  updateAll();
});
