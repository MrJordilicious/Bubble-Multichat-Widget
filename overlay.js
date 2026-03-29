/* ================================================
   CHAT OVERLAY — overlay.js
   Streamer.bot WebSocket · Twitch + YouTube
   ================================================ */
'use strict';

// ═══════════════════════════════════════════════════
// CONFIG — parsed from URL query params
// ═══════════════════════════════════════════════════
const P = new URLSearchParams(window.location.search);

const cfg = {
  // Streamer.bot connection
  wsHost:        P.get('wsHost')        || '127.0.0.1',
  wsPort:        P.get('wsPort')        || '7474',
  wsPass:        P.get('wsPass')        || '',

  // Filtering
  ignored:       (P.get('ignored') || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean),
  ignoreCmd:     P.get('ignoreCmd')     !== 'false',   // default: true (commands filtered)

  // Appearance
  fontFamily:    P.get('fontFamily')    || 'Nunito',
  fontSize:      parseInt(P.get('fontSize'))     || 15,
  bubbleColor:   '#' + (P.get('bubbleColor')    || 'FFF8F0'),
  textColor:     '#' + (P.get('textColor')      || '3a2f2f'),
  usernameMode:  P.get('usernameMode')  || 'usercolor',
  usernameColor: '#' + (P.get('usernameColor')  || 'ff7043'),
  avatarSize:    parseInt(P.get('avatarSize'))   || 54,

  // Behavior
  maxMsg:        parseInt(P.get('maxMsg'))       || 8,
  msgLife:       parseInt(P.get('msgLife'))      || 30,
  scrollDir:     P.get('scrollDir')     || 'up',    // up | down | horizontal
  position:      P.get('position')      || 'left',
  animIn:        P.get('animIn')        || 'bounce',

  // Features
  showPlatform:  P.get('showPlatform')  !== 'false',
  showBadges:    P.get('showBadges')    !== 'false',
  showPronouns:  P.get('showPronouns')  === 'true',
  showSharedChat:P.get('showSharedChat') !== 'false',

  // Events (master toggle + per-type)
  showEvents:    P.get('showEvents')    !== 'false',
  evSub:         P.get('evSub')         !== 'false',
  evGift:        P.get('evGift')        !== 'false',
  evCheer:       P.get('evCheer')       !== 'false',
  evFollow:      P.get('evFollow')      !== 'false',
  evRaid:        P.get('evRaid')        !== 'false',
  evYtSuper:     P.get('evYtSuper')     !== 'false',
  evYtMember:    P.get('evYtMember')    !== 'false',

  // Hype Train
  showHypeTrain: P.get('showHypeTrain') !== 'false',
  hypePosTop:    P.get('hypePosTop')    === 'true',

  // Demo mode (for customizer preview)
  demo:          P.get('demo')          === 'true',
};

// ═══════════════════════════════════════════════════
// APPLY CSS VARIABLES
// ═══════════════════════════════════════════════════
const root = document.documentElement;
root.style.setProperty('--bubble-color', cfg.bubbleColor);
root.style.setProperty('--text-color',   cfg.textColor);
root.style.setProperty('--font-size',    cfg.fontSize + 'px');
root.style.setProperty('--font-family',  `'${cfg.fontFamily}', 'Nunito', sans-serif`);
root.style.setProperty('--avatar-size',  cfg.avatarSize + 'px');

// ═══════════════════════════════════════════════════
// DOM REFERENCES
// ═══════════════════════════════════════════════════
const container  = document.getElementById('chat-container');
const statusEl   = document.getElementById('status');
const statusDot  = document.getElementById('statusDot');
const statusTxt  = document.getElementById('statusText');
const hypeEl     = document.getElementById('hype-train');
const hypeBar    = document.getElementById('hype-bar');
const hypeLvl    = document.getElementById('hype-level');
const hypePct    = document.getElementById('hype-pct');

// Apply layout classes
if (cfg.position  === 'right')      container.classList.add('pos-right');
if (cfg.scrollDir === 'horizontal') container.classList.add('scroll-horizontal');
if (cfg.scrollDir === 'down')       container.classList.add('scroll-down');
if (cfg.hypePosTop)                 hypeEl.classList.add('hype-top');

// ═══════════════════════════════════════════════════
// UTILITIES
// ═══════════════════════════════════════════════════
function esc(text) {
  const d = document.createElement('div');
  d.textContent = String(text ?? '');
  return d.innerHTML;
}

async function sha256b64(message) {
  const buf  = new TextEncoder().encode(message);
  const hash = await crypto.subtle.digest('SHA-256', buf);
  return btoa(String.fromCharCode(...new Uint8Array(hash)));
}

function tierLabel(tier) {
  const t = String(tier || '1000');
  if (t === '1000' || t === '1') return 'Tier 1';
  if (t === '2000' || t === '2') return 'Tier 2';
  if (t === '3000' || t === '3') return 'Tier 3';
  return `Tier ${tier}`;
}

function getPlatformIcon(platform) {
  return platform === 'twitch'
    ? 'https://cdn.simpleicons.org/twitch/9146FF'
    : 'https://cdn.simpleicons.org/youtube/FF0000';
}

function fallbackAvatar(username) {
  return `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(username)}&backgroundColor=b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf`;
}

// ═══════════════════════════════════════════════════
// AVATAR CACHE — prefers real profile pictures
// ═══════════════════════════════════════════════════
const avatarCache = new Map();

function getAvatarUrl(platform, username, providedUrl) {
  if (!username) return fallbackAvatar('unknown');
  const key = `${platform}:${username.toLowerCase()}`;
  if (avatarCache.has(key)) return avatarCache.get(key);

  let url;
  if (providedUrl && providedUrl.startsWith('http')) {
    // Streamer.bot gave us the real profile picture URL — use it directly
    url = providedUrl;
  } else if (platform === 'twitch') {
    // unavatar.io fetches real Twitch avatars server-side, no API key needed
    url = `https://unavatar.io/twitch/${encodeURIComponent(username.toLowerCase())}`;
  } else if (platform === 'youtube') {
    // Try unavatar.io for YouTube, with DiceBear fallback on img error
    url = `https://unavatar.io/youtube/${encodeURIComponent(username)}`;
  } else {
    url = fallbackAvatar(username);
  }

  avatarCache.set(key, url);
  return url;
}

// ═══════════════════════════════════════════════════
// PRONOUNS — pr.alejo.io
// ═══════════════════════════════════════════════════
const pronounsMap  = {};
const pronounCache = {};
let   pronounsReady = false;

async function loadPronounsList() {
  if (pronounsReady) return;
  try {
    const res = await fetch('https://pronouns.alejo.io/api/pronouns');
    const data = await res.json();
    data.forEach(p => { pronounsMap[p.name] = p.display; });
    pronounsReady = true;
  } catch (_) {}
}

async function getPronoun(username) {
  if (!cfg.showPronouns || !username) return '';
  if (pronounCache[username] !== undefined) return pronounCache[username];
  try {
    const res  = await fetch(`https://pronouns.alejo.io/api/users/${encodeURIComponent(username.toLowerCase())}`);
    const data = await res.json();
    pronounCache[username] = data.length ? (pronounsMap[data[0].pronoun_id] || '') : '';
  } catch (_) {
    pronounCache[username] = '';
  }
  return pronounCache[username];
}

if (cfg.showPronouns) loadPronounsList();

// ═══════════════════════════════════════════════════
// STREAMER.BOT WEBSOCKET
// ═══════════════════════════════════════════════════
let ws, reconnectTimer, subscribed = false;

function setStatus(state) {
  statusEl.classList.remove('hidden');
  statusDot.classList.remove('connected');
  if (state === 'connected') {
    statusDot.classList.add('connected');
    statusTxt.textContent = 'Connected ✓';
    setTimeout(() => statusEl.classList.add('hidden'), 3000);
  } else if (state === 'auth') {
    statusTxt.textContent = 'Authenticating…';
  } else {
    statusTxt.textContent = 'Connecting to Streamer.bot…';
  }
}

function connect() {
  clearTimeout(reconnectTimer);
  subscribed = false;

  try { ws = new WebSocket(`ws://${cfg.wsHost}:${cfg.wsPort}/`); }
  catch (_) { scheduleReconnect(); return; }

  ws.onerror = () => ws.close();
  ws.onclose = () => { setStatus('disconnected'); scheduleReconnect(); };

  ws.onopen = () => {
    // Streamer.bot (0.1.x) sends a Connected event message after the socket opens,
    // and we subscribe inside onmessage when we receive it.
    // But as a safety net: if no Connected event arrives within 2 seconds we
    // subscribe anyway — this handles servers that skip the Connected event.
    setTimeout(() => {
      if (!subscribed) subscribe();
    }, 2000);
  };

  ws.onmessage = async (e) => {
    let data;
    try { data = JSON.parse(e.data); } catch (_) { return; }

    // ── Streamer.bot "Connected" handshake message ──
    // Sent by Streamer.bot right after the WebSocket opens.
    // May contain authentication challenge if a password is configured.
    const isConnectedMsg = (
      data?.event?.type === 'Connected' ||
      data?.event?.type === 'Hello' ||
      // Some versions wrap it differently
      (data?.data?.version && !data?.event)
    );

    if (isConnectedMsg && !subscribed) {
      const auth = data?.data?.authentication;

      if (auth && cfg.wsPass) {
        // Password auth required — compute HMAC response
        setStatus('auth');
        try {
          // Streamer.bot auth: base64(SHA256( base64(SHA256(password + salt)) + challenge ))
          const secret = await sha256b64(cfg.wsPass + auth.salt);
          const token  = await sha256b64(secret + auth.challenge);
          ws.send(JSON.stringify({ request: 'Authenticate', authentication: token, id: 'auth' }));
        } catch (_) {
          // If crypto fails for any reason, try subscribing anyway
          subscribe();
        }
      } else {
        // No auth needed — subscribe straight away
        subscribe();
      }
      return;
    }

    // ── Auth response from Streamer.bot ──
    if (data?.id === 'auth') {
      if (data?.status === 'ok' || data?.data?.authenticated === true) {
        setStatus('connected');
      }
      // Subscribe regardless — server will reject events if auth truly failed,
      // but this avoids leaving the user with a broken silent connection.
      subscribe();
      return;
    }

    // ── Subscription acknowledged ──
    if (data?.id === 'sub') {
      setStatus('connected');
      return;
    }

    // ── All other messages are chat/event data ──
    handleEvent(data);
  };
}

function subscribe() {
  if (subscribed) return;
  subscribed = true;
  ws.send(JSON.stringify({
    request: 'Subscribe',
    events: {
      Twitch: [
        'ChatMessage',
        'Sub', 'ReSub', 'GiftSub', 'GiftBomb',
        'Cheer', 'Follow', 'Raid',
        'HypeTrainStart', 'HypeTrainUpdate', 'HypeTrainEnd', 'HypeTrainExpire',
      ],
      YouTube: [
        'Message',
        'SuperChat', 'SuperSticker',
        'NewSponsor', 'MemberMilestone', 'NewMember',
      ],
    },
    id: 'sub',
  }));
}

function scheduleReconnect() {
  clearTimeout(reconnectTimer);
  reconnectTimer = setTimeout(connect, 5000);
}

// ═══════════════════════════════════════════════════
// EVENT ROUTER
// ═══════════════════════════════════════════════════
function handleEvent(data) {
  if (!data?.event) return;
  const { source, type } = data.event;
  const d = data.data;

  if (source === 'Twitch') {
    switch (type) {
      case 'ChatMessage':     return onTwitchChat(d);
      case 'Sub':             return cfg.showEvents && cfg.evSub   && onSub(d);
      case 'ReSub':           return cfg.showEvents && cfg.evSub   && onReSub(d);
      case 'GiftSub':         return cfg.showEvents && cfg.evGift  && onGiftSub(d);
      case 'GiftBomb':        return cfg.showEvents && cfg.evGift  && onGiftBomb(d);
      case 'Cheer':           return cfg.showEvents && cfg.evCheer && onCheer(d);
      case 'Follow':          return cfg.showEvents && cfg.evFollow && onFollow(d, 'twitch');
      case 'Raid':            return cfg.showEvents && cfg.evRaid  && onRaid(d);
      case 'HypeTrainStart':  return onHypeStart(d);
      case 'HypeTrainUpdate': return onHypeUpdate(d);
      case 'HypeTrainEnd':
      case 'HypeTrainExpire': return onHypeEnd(d);
    }
  }
  if (source === 'YouTube') {
    switch (type) {
      case 'Message':          return onYouTubeChat(d);
      case 'SuperChat':
      case 'SuperSticker':     return cfg.showEvents && cfg.evYtSuper  && onSuperChat(d);
      case 'NewSponsor':
      case 'NewMember':        return cfg.showEvents && cfg.evYtMember && onYTMember(d, false);
      case 'MemberMilestone':  return cfg.showEvents && cfg.evYtMember && onYTMember(d, true);
    }
  }
}

// ═══════════════════════════════════════════════════
// CONTENT FILTERS
// ═══════════════════════════════════════════════════
function shouldFilter(username, text) {
  if (cfg.ignored.includes((username || '').toLowerCase())) return true;
  if (cfg.ignoreCmd && String(text || '').trimStart().startsWith('!')) return true;
  return false;
}

// ═══════════════════════════════════════════════════
// TWITCH CHAT HANDLER
// ═══════════════════════════════════════════════════
async function onTwitchChat(d) {
  // Streamer.bot can nest message data in different ways
  const m = d?.message ?? d ?? {};
  if (!m.message && !m.text) return;

  const username  = m.displayName  || m.username  || 'Unknown';
  const userLogin = m.username     || m.login     || '';
  const text      = m.message      || m.text      || '';

  if (shouldFilter(username, text)) return;

  // Profile picture: prefer Streamer.bot's provided URL, fall back to unavatar.io
  const providedAvatar = d.user?.profileImageUrl
    || d.user?.profile_image_url
    || m.userProfileImageUrl
    || m.profileImageUrl
    || '';

  // Shared chat — messages forwarded from another channel's chat
  const isShared  = !!(m.sourceRoomId || m.sourceBroadcasterLogin);
  const sharedFrom = isShared
    ? (m.sourceBroadcasterName || m.sourceBroadcasterLogin || '')
    : '';

  if (isShared && !cfg.showSharedChat) return;

  const pronoun = await getPronoun(userLogin || username);

  addChatBubble({
    platform:       'twitch',
    username,
    userLogin,
    color:          m.color,
    text,
    emotes:         m.emotes || [],
    isBroadcaster:  m.isBroadcaster,
    isModerator:    m.isModerator,
    isSubscriber:   m.isSubscribed || m.isSubscriber,
    isVip:          m.isVip,
    isFirstMessage: m.isFirstMessage,
    bits:           m.bits || 0,
    avatarUrl:      providedAvatar,
    pronoun,
    isShared,
    sharedFrom,
  });
}

// ═══════════════════════════════════════════════════
// YOUTUBE CHAT HANDLER
// ═══════════════════════════════════════════════════
async function onYouTubeChat(d) {
  const m = d?.message ?? d ?? {};
  if (!m.message && !m.text) return;

  const username = m.displayName || m.username || 'Unknown';
  const text     = m.message     || m.text     || '';

  if (shouldFilter(username, text)) return;

  // YouTube profile pictures often come directly from Streamer.bot
  const providedAvatar = d.user?.profileImageUrl
    || d.user?.profile_image_url
    || m.profileImageUrl
    || m.userProfileImageUrl
    || '';

  addChatBubble({
    platform:    'youtube',
    username,
    userLogin:   m.username || '',
    color:       null,
    text,
    emotes:      [],
    isOwner:     m.isOwner,
    isModerator: m.isModerator,
    isMember:    m.isMember || m.isSponsor,
    avatarUrl:   providedAvatar,
    pronoun:     '',
    isShared:    false,
    sharedFrom:  '',
  });
}

// ═══════════════════════════════════════════════════
// TWITCH EVENT HANDLERS
// ═══════════════════════════════════════════════════
function onSub(d) {
  const tier  = tierLabel(d.subTier);
  const prime = d.isPrime ? ' (Prime)' : '';
  addEventBubble({
    icon: '🎉', type: 'sub', platform: 'twitch',
    username: d.displayName || d.username || '',
    avatarUrl: getAvatarUrl('twitch', d.username || '', d.user?.profileImageUrl || ''),
    title: `${esc(d.displayName || d.username)} just subscribed!`,
    body:  `${tier}${prime}${d.message ? ` · "${esc(d.message)}"` : ''}`,
  });
}

function onReSub(d) {
  addEventBubble({
    icon: '🎊', type: 'sub', platform: 'twitch',
    username: d.displayName || d.username || '',
    avatarUrl: getAvatarUrl('twitch', d.username || '', d.user?.profileImageUrl || ''),
    title: `${esc(d.displayName || d.username)} resubscribed!`,
    body:  `${tierLabel(d.subTier)} · ${d.cumulativeMonths || d.months || '?'} months${d.message ? ` · "${esc(d.message)}"` : ''}`,
  });
}

function onGiftSub(d) {
  addEventBubble({
    icon: '🎁', type: 'gift', platform: 'twitch',
    username: d.displayName || d.username || '',
    avatarUrl: getAvatarUrl('twitch', d.username || '', ''),
    title: `${esc(d.displayName || d.username)} gifted a sub!`,
    body:  `To ${esc(d.recipientDisplayName || d.recipientUsername || 'someone')} · ${tierLabel(d.subTier)}`,
  });
}

function onGiftBomb(d) {
  addEventBubble({
    icon: '💣', type: 'gift', platform: 'twitch',
    username: d.displayName || d.username || '',
    avatarUrl: getAvatarUrl('twitch', d.username || '', ''),
    title: `${esc(d.displayName || d.username)} gifted ${d.gifts || d.amount || '?'} subs!`,
    body:  `${tierLabel(d.subTier)} · Total given: ${d.totalGifts ?? '?'}`,
  });
}

function onCheer(d) {
  addEventBubble({
    icon: '⭐', type: 'cheer', platform: 'twitch',
    username: d.displayName || d.username || '',
    avatarUrl: getAvatarUrl('twitch', d.username || '', ''),
    title: `${esc(d.displayName || d.username)} cheered ${d.bits || 0} bits!`,
    body:  d.message ? `"${esc(d.message)}"` : '',
  });
}

function onFollow(d, platform) {
  addEventBubble({
    icon: '💜', type: 'follow', platform,
    username: d.displayName || d.username || '',
    avatarUrl: getAvatarUrl(platform, d.username || '', ''),
    title: `${esc(d.displayName || d.username)} just followed!`,
    body:  'Welcome to the community! 🎉',
  });
}

function onRaid(d) {
  addEventBubble({
    icon: '🚀', type: 'raid', platform: 'twitch',
    username: d.displayName || d.username || '',
    avatarUrl: getAvatarUrl('twitch', d.username || '', ''),
    title: `${esc(d.displayName || d.username)} is raiding!`,
    body:  `Bringing ${d.viewerCount || d.viewers || '?'} viewers! 🚀`,
  });
}

// ═══════════════════════════════════════════════════
// YOUTUBE EVENT HANDLERS
// ═══════════════════════════════════════════════════
function onSuperChat(d) {
  addEventBubble({
    icon: '💰', type: 'superchat', platform: 'youtube',
    username: d.displayName || d.username || '',
    avatarUrl: getAvatarUrl('youtube', d.username || '', d.user?.profileImageUrl || ''),
    title: `${esc(d.displayName || d.username)} sent a Super Chat!`,
    body:  `${d.formattedAmount || d.amount || ''} · ${d.message ? `"${esc(d.message)}"` : ''}`,
    accentColor: d.color || '#ff0000',
  });
}

function onYTMember(d, isMilestone) {
  addEventBubble({
    icon: '🌟', type: 'member', platform: 'youtube',
    username: d.displayName || d.username || '',
    avatarUrl: getAvatarUrl('youtube', d.username || '', d.user?.profileImageUrl || ''),
    title: isMilestone
      ? `${esc(d.displayName || d.username)} has been a member for ${d.months || '?'} months!`
      : `${esc(d.displayName || d.username)} just became a member!`,
    body:  d.level || '',
  });
}

// ═══════════════════════════════════════════════════
// HYPE TRAIN
// ═══════════════════════════════════════════════════
let hypeTimer;

function onHypeStart(d) {
  if (!cfg.showHypeTrain) return;
  hypeEl.classList.remove('hidden');
  _updateHype(d.level || 1, d.total || 0, d.goal || 1500);
}

function onHypeUpdate(d) {
  if (!cfg.showHypeTrain) return;
  hypeEl.classList.remove('hidden');
  _updateHype(d.level || 1, d.total || 0, d.goal || 1500);
}

function onHypeEnd(d) {
  if (!cfg.showHypeTrain) return;
  clearTimeout(hypeTimer);
  _updateHype(d.level || 1, d.total || 0, d.total || 1);
  hypeTimer = setTimeout(() => hypeEl.classList.add('hidden'), 6000);
}

function _updateHype(level, total, goal) {
  const pct       = Math.min(100, Math.round((total / (goal || 1)) * 100));
  hypeLvl.textContent  = `🚂 HYPE TRAIN LEVEL ${level}`;
  hypePct.textContent  = `${pct}%`;
  hypeBar.style.width  = `${pct}%`;
}

// ═══════════════════════════════════════════════════
// RENDER — Chat bubble
// ═══════════════════════════════════════════════════
async function addChatBubble(msg) {
  const uColor    = (cfg.usernameMode === 'usercolor' && msg.color) ? msg.color : cfg.usernameColor;
  const avatarUrl = getAvatarUrl(msg.platform, msg.userLogin || msg.username, msg.avatarUrl);
  const animClass = getAnimClass();

  // Badges
  let badgeHtml = '';
  if (cfg.showBadges) {
    if (msg.isBroadcaster)   badgeHtml += `<span class="badge" title="Broadcaster">🎙️</span>`;
    else if (msg.isModerator || msg.isOwner) badgeHtml += `<span class="badge" title="Moderator">⚔️</span>`;
    if (msg.isSubscriber || msg.isMember)    badgeHtml += `<span class="badge-pill badge-${msg.isMember ? 'member' : 'sub'}">${msg.isMember ? 'Member' : 'Sub'}</span>`;
    if (msg.isVip)           badgeHtml += `<span class="badge" title="VIP">💎</span>`;
    if (msg.isFirstMessage)  badgeHtml += `<span class="badge-pill badge-first">First chat! 🌟</span>`;
    if (msg.bits > 0)        badgeHtml += `<span class="badge-pill badge-bits">⭐ ${msg.bits}</span>`;
  }

  const pronounHtml = msg.pronoun
    ? `<span class="pronoun">${esc(msg.pronoun)}</span>` : '';

  const platformHtml = cfg.showPlatform ? `
    <div class="platform-badge">
      <img class="platform-icon" src="${getPlatformIcon(msg.platform)}" alt="${msg.platform}" />
    </div>` : '';

  const sharedHtml = (msg.isShared && msg.sharedFrom)
    ? `<div class="shared-label">📡 from @${esc(msg.sharedFrom)}'s chat</div>` : '';

  const msgHtml = msg.platform === 'twitch'
    ? parseEmotes(msg.text, msg.emotes)
    : esc(msg.text);

  const safeName = esc(msg.username);
  const fbAvatar = fallbackAvatar(msg.username);

  const el = document.createElement('div');
  el.className = `message ${animClass}${msg.isShared ? ' shared-chat' : ''}`;
  el.innerHTML = `
    <div class="avatar-wrapper">
      <div class="avatar">
        <img src="${avatarUrl}" alt="${safeName}" loading="lazy"
             onerror="if(this.src!=='${fbAvatar}')this.src='${fbAvatar}'" />
      </div>
      ${platformHtml}
    </div>
    <div class="bubble-wrapper">
      <div class="username-row">
        <span class="username" style="color:${uColor}">${safeName}</span>
        ${pronounHtml}${badgeHtml}
      </div>
      ${sharedHtml}
      <div class="bubble"><span class="msg-text">${msgHtml}</span></div>
    </div>`;

  appendMsg(el);
}

// ═══════════════════════════════════════════════════
// RENDER — Event bubble
// ═══════════════════════════════════════════════════
function addEventBubble(ev) {
  const animClass = getAnimClass();
  const fbAvatar  = fallbackAvatar(ev.username);
  const accent    = ev.accentColor ? `style="--event-accent:${ev.accentColor}"` : '';

  const el = document.createElement('div');
  el.className = `message event-bubble event-${ev.type} ${animClass}`;
  el.innerHTML = `
    <div class="avatar-wrapper">
      <div class="avatar">
        <img src="${ev.avatarUrl}" alt="${esc(ev.username)}" loading="lazy"
             onerror="if(this.src!=='${fbAvatar}')this.src='${fbAvatar}'" />
      </div>
      ${cfg.showPlatform ? `<div class="platform-badge"><img class="platform-icon" src="${getPlatformIcon(ev.platform)}" alt="${ev.platform}"/></div>` : ''}
    </div>
    <div class="bubble-wrapper">
      <div class="bubble" ${accent}>
        <div class="event-title">${ev.icon} ${ev.title}</div>
        ${ev.body ? `<div class="event-body">${ev.body}</div>` : ''}
      </div>
    </div>`;

  appendMsg(el);
}

// ═══════════════════════════════════════════════════
// MESSAGE MANAGEMENT
// ═══════════════════════════════════════════════════
function getAnimClass() {
  if (cfg.animIn === 'slide') {
    return (cfg.position === 'right' || cfg.scrollDir === 'horizontal')
      ? 'anim-slide-right' : 'anim-slide';
  }
  return `anim-${cfg.animIn}`;
}

function appendMsg(el) {
  if (cfg.scrollDir === 'down') {
    container.insertBefore(el, container.firstChild);
  } else {
    container.appendChild(el);
  }

  // Prune when over limit
  const all = container.querySelectorAll('.message:not(.removing)');
  if (all.length > cfg.maxMsg) {
    const oldest = cfg.scrollDir === 'down' ? all[all.length - 1] : all[0];
    removeMsg(oldest);
  }

  // Auto-expire
  if (cfg.msgLife > 0) {
    setTimeout(() => { if (el.parentNode) removeMsg(el); }, cfg.msgLife * 1000);
  }
}

function removeMsg(el) {
  if (!el || el.classList.contains('removing')) return;
  el.classList.add('removing');
  el.addEventListener('animationend', () => el.remove(), { once: true });
  setTimeout(() => el?.remove(), 800); // safety fallback
}

// ═══════════════════════════════════════════════════
// TWITCH EMOTE PARSER
// ═══════════════════════════════════════════════════
function parseEmotes(text, emotes) {
  if (!emotes?.length) return esc(text);
  const chars  = [...text]; // emoji-safe split
  const sorted = [...emotes].sort((a, b) => a.startIndex - b.startIndex);
  let result = '', cursor = 0;

  for (const em of sorted) {
    if (em.startIndex > cursor)
      result += esc(chars.slice(cursor, em.startIndex).join(''));
    const name = chars.slice(em.startIndex, em.endIndex + 1).join('');
    result += `<img class="emote" src="https://static-cdn.jtvnw.net/emoticons/v2/${em.id}/default/dark/1.0" alt="${esc(name)}" />`;
    cursor = em.endIndex + 1;
  }
  if (cursor < chars.length) result += esc(chars.slice(cursor).join(''));
  return result;
}

// ═══════════════════════════════════════════════════
// DEMO MODE — simulated messages for the customizer preview
// ═══════════════════════════════════════════════════
const DEMO_QUEUE = [
  () => onTwitchChat({ message:{ displayName:'StreamFan99',  username:'streamfan99',  color:'#FF4D4D', message:'POGGERS this overlay is so cute!! 🎮', isSubscribed:true }}),
  () => onYouTubeChat({ message:{ displayName:'YouTubeLurker', username:'youtubelurker', message:'Hello from YouTube! Love the stream ❤️', isMember:true }}),
  () => onTwitchChat({ message:{ displayName:'ModeratorPro',  username:'moderatorpro',  color:'#5CB85C', message:"Pog let's gooooo!!!", isModerator:true }}),
  () => onSub({ displayName:'HypeNewSub', username:'hypesub', subTier:'1000', isPrime:false, message:'Finally subscribed!' }),
  () => onTwitchChat({ message:{ displayName:'FirstTimer99', username:'firsttimer99', color:'#9146FF', message:'This is my first time chatting!', isFirstMessage:true }}),
  () => onCheer({ displayName:'BitsDono', username:'bitsdono', bits:500, message:'Keep it up!!🎉' }),
  () => onYouTubeChat({ message:{ displayName:'SuperFan', username:'superfan', message:'Great content as always Clap', isOwner:false }}),
  () => onSuperChat({ displayName:'YTSupporter', username:'ytsupporter', formattedAmount:'$10.00', message:'Amazing stream!', color:'#1DE9B6' }),
  () => onRaid({ displayName:'FriendlyRaider', username:'friendlyraider', viewerCount:84 }),
  () => onGiftSub({ displayName:'GenerousGifter', username:'generousgifter', subTier:'1000', recipientDisplayName:'LuckyViewer' }),
];

if (cfg.demo) {
  statusEl.classList.add('hidden');
  if (cfg.showHypeTrain) {
    hypeEl.classList.remove('hidden');
    _updateHype(2, 850, 1500);
  }
  let i = 0;
  (function demoTick() {
    DEMO_QUEUE[i % DEMO_QUEUE.length]();
    i++;
    setTimeout(demoTick, 2600);
  })();
} else {
  connect();
}
