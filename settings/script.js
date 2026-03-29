/* ================================================
   CHAT OVERLAY CUSTOMIZER — script.js
   ================================================ */
'use strict';

// ── Element references ────────────────────────────
const $ = id => document.getElementById(id);

const els = {
  // Connection
  wsHost:        $('wsHost'),
  wsPort:        $('wsPort'),
  wsPass:        $('wsPass'),

  // Filtering
  ignored:       $('ignored'),
  ignoreCmd:     $('ignoreCmd'),

  // Appearance
  fontFamily:    $('fontFamily'),
  fontSize:      $('fontSize'),
  fontSizeVal:   $('fontSizeVal'),
  bubbleColor:   $('bubbleColor'),
  textColor:     $('textColor'),
  usernameMode:  $('usernameMode'),
  usernameColor: $('usernameColor'),
  customColorGroup: $('customColorGroup'),

  // Avatars
  avatarSize:    $('avatarSize'),
  avatarSizeVal: $('avatarSizeVal'),

  // Behavior
  maxMsg:        $('maxMsg'),
  maxMsgVal:     $('maxMsgVal'),
  msgLife:       $('msgLife'),
  scrollDir:     $('scrollDir'),
  animIn:        $('animIn'),

  // Position
  positionToggle:$('positionToggle'),

  // Features
  showPlatform:  $('showPlatform'),
  showBadges:    $('showBadges'),
  showPronouns:  $('showPronouns'),

  // Events
  showEvents:    $('showEvents'),
  eventSubOptions:$('eventSubOptions'),
  evSub:         $('evSub'),
  evGift:        $('evGift'),
  evCheer:       $('evCheer'),
  evFollow:      $('evFollow'),
  evRaid:        $('evRaid'),
  evYtSuper:     $('evYtSuper'),
  evYtMember:    $('evYtMember'),

  // Shared chat
  showSharedChat:$('showSharedChat'),

  // Hype train
  showHypeTrain: $('showHypeTrain'),
  hypePosTop:    $('hypePosTop'),
  hypePosRow:    $('hypePosRow'),

  // Output
  result:        $('result'),
  copyBtn:       $('copyBtn'),
  copyMsg:       $('copyMsg'),
  iframe:        $('widgetPreview'),
};

// ── Overlay URL ───────────────────────────────────
// Smart pre-fill: swap this page's filename for overlay.html.
// This is correct when both files are in the same folder.
// If the user put them in different folders they just edit the field.
function guessOverlayUrl() {
  const loc  = window.location;
  const base = loc.origin + loc.pathname.replace(/\/[^/]*$/, '/');
  return base + 'overlay.html';
}

// ── Helpers ───────────────────────────────────────
const colorHex = el => el.value.replace('#', '');

function getOverlayBase() {
  const v = $('overlayUrl')?.value?.trim();
  return (v && v.startsWith('http')) ? v : guessOverlayUrl();
}

// ── Build overlay URL ─────────────────────────────
function buildURL(demo) {
  const q = new URLSearchParams();

  // Connection (only include non-defaults to keep URL clean)
  const host = els.wsHost.value.trim();
  const port = els.wsPort.value.trim();
  const pass = els.wsPass.value.trim();
  if (host && host !== '127.0.0.1') q.set('wsHost', host);
  if (port && port !== '7474')       q.set('wsPort', port);
  if (pass)                          q.set('wsPass', pass);

  // Filtering
  const ignored = els.ignored.value.trim().replace(/\s*,\s*/g, ',');
  if (ignored)                               q.set('ignored', ignored);
  if (!els.ignoreCmd.checked)                q.set('ignoreCmd', 'false');  // default true

  // Appearance
  const font = els.fontFamily.value;
  if (font !== 'Nunito')                     q.set('fontFamily', font);
  const size = els.fontSize.value;
  if (size !== '15')                         q.set('fontSize', size);
  const bc = colorHex(els.bubbleColor);
  if (bc.toUpperCase() !== 'FFF8F0')         q.set('bubbleColor', bc);
  const tc = colorHex(els.textColor);
  if (tc.toLowerCase() !== '3a2f2f')         q.set('textColor', tc);
  const unMode = els.usernameMode.checked ? 'usercolor' : 'custom';
  if (unMode !== 'usercolor')                q.set('usernameMode', unMode);
  const uc = colorHex(els.usernameColor);
  if (uc.toLowerCase() !== 'ff7043')         q.set('usernameColor', uc);

  // Avatars
  const avSz = parseInt(els.avatarSize.value);
  if (avSz !== 54)                           q.set('avatarSize', avSz);

  // Behavior
  const maxM = parseInt(els.maxMsg.value);
  if (maxM !== 8)                            q.set('maxMsg', maxM);
  const life = els.msgLife.value;
  if (life !== '30')                         q.set('msgLife', life);
  const dir = els.scrollDir.value;
  if (dir !== 'up')                          q.set('scrollDir', dir);
  const anim = els.animIn.value;
  if (anim !== 'bounce')                     q.set('animIn', anim);

  // Position
  if (els.positionToggle.checked)            q.set('position', 'right');

  // Features
  if (!els.showPlatform.checked)             q.set('showPlatform', 'false');
  if (!els.showBadges.checked)               q.set('showBadges', 'false');
  if (els.showPronouns.checked)              q.set('showPronouns', 'true');  // default false

  // Events
  if (!els.showEvents.checked)               q.set('showEvents', 'false');
  if (!els.evSub.checked)                    q.set('evSub', 'false');
  if (!els.evGift.checked)                   q.set('evGift', 'false');
  if (!els.evCheer.checked)                  q.set('evCheer', 'false');
  if (!els.evFollow.checked)                 q.set('evFollow', 'false');
  if (!els.evRaid.checked)                   q.set('evRaid', 'false');
  if (!els.evYtSuper.checked)                q.set('evYtSuper', 'false');
  if (!els.evYtMember.checked)               q.set('evYtMember', 'false');

  // Shared chat
  if (!els.showSharedChat.checked)           q.set('showSharedChat', 'false');

  // Hype train
  if (!els.showHypeTrain.checked)            q.set('showHypeTrain', 'false');
  if (els.hypePosTop.checked)                q.set('hypePosTop', 'true');

  // Demo flag (preview only)
  if (demo) q.set('demo', 'true');

  const qs = q.toString();
  const base = getOverlayBase();
  return base + (qs ? '?' + qs : '');
}

// ── Update everything ─────────────────────────────
function updateAll() {
  // Validate overlay URL field
  const urlField = $('overlayUrl');
  const urlHint  = $('urlHint');
  if (urlField && urlHint) {
    const v = urlField.value.trim();
    if (!v) {
      urlHint.textContent = '⚠ Enter your overlay URL so the generated link is correct.';
    } else if (!v.startsWith('http')) {
      urlHint.textContent = '⚠ Must start with https://';
    } else if (!v.endsWith('overlay.html')) {
      urlHint.textContent = '⚠ URL should end with overlay.html';
    } else {
      urlHint.textContent = '';
    }
  }
  // Toggle custom username color visibility
  els.customColorGroup.style.display = els.usernameMode.checked ? 'none' : 'block';

  // Toggle event sub-options enabled state
  els.eventSubOptions.classList.toggle('disabled', !els.showEvents.checked);

  // Toggle hype train position row
  els.hypePosRow.style.opacity = els.showHypeTrain.checked ? '1' : '0.4';
  els.hypePosRow.style.pointerEvents = els.showHypeTrain.checked ? '' : 'none';

  // Update displayed URL
  els.result.textContent = buildURL(false);

  // Update preview iframe (with demo=true)
  const demoURL = buildURL(true);
  if (els.iframe.src !== demoURL) els.iframe.src = demoURL;
}

// ── Range slider live labels ──────────────────────
els.fontSize.addEventListener('input',  () => els.fontSizeVal.textContent  = els.fontSize.value);
els.avatarSize.addEventListener('input',() => els.avatarSizeVal.textContent = els.avatarSize.value);
els.maxMsg.addEventListener('input',    () => els.maxMsgVal.textContent     = els.maxMsg.value);

// ── Wire up all inputs ────────────────────────────
[
  $('overlayUrl'),
  els.wsHost, els.wsPort, els.wsPass,
  els.ignored, els.ignoreCmd,
  els.fontFamily, els.fontSize, els.bubbleColor, els.textColor,
  els.usernameMode, els.usernameColor,
  els.avatarSize,
  els.maxMsg, els.msgLife, els.scrollDir, els.animIn,
  els.positionToggle,
  els.showPlatform, els.showBadges, els.showPronouns,
  els.showEvents, els.evSub, els.evGift, els.evCheer, els.evFollow,
  els.evRaid, els.evYtSuper, els.evYtMember,
  els.showSharedChat,
  els.showHypeTrain, els.hypePosTop,
].forEach(el => {
  el.addEventListener('input',  updateAll);
  el.addEventListener('change', updateAll);
});

// ── Copy button ───────────────────────────────────
els.copyBtn.addEventListener('click', () => {
  navigator.clipboard.writeText(els.result.textContent).then(() => {
    els.copyMsg.style.display = 'inline';
    setTimeout(() => els.copyMsg.style.display = 'none', 1800);
  });
});

// ── Initial render ────────────────────────────────
window.addEventListener('load', () => {
  // Pre-fill the overlay URL field with a smart guess
  const urlField = $('overlayUrl');
  if (urlField && !urlField.value) urlField.value = guessOverlayUrl();

  els.customColorGroup.style.display = 'none'; // usernameMode defaults to on
  updateAll();
});
