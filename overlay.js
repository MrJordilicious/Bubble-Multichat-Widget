/* ================================================
   CHAT OVERLAY — overlay.js
   Streamer.bot WebSocket · Twitch + YouTube
   Schema source: docs.streamer.bot (verified)
   ================================================ */
'use strict';

// ═══════════════════════════════════════════════════
// CONFIG
// ═══════════════════════════════════════════════════
const P = new URLSearchParams(window.location.search);

function pInt(key, def) {
  const v = P.get(key);
  return (v !== null && v !== '') ? parseInt(v, 10) : def;
}

const cfg = {
  wsHost:        P.get('wsHost')        || '127.0.0.1',
  wsPort:        P.get('wsPort')        || '8080',
  wsPass:        P.get('wsPass')        || '',
  ignored:       (P.get('ignored') || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean),
  ignoreCmd:     P.get('ignoreCmd')     !== 'false',
  fontFamily:    P.get('fontFamily')    || 'Nunito',
  fontSize:      pInt('fontSize', 15),
  bubbleColor:   '#' + (P.get('bubbleColor')   || 'FFF8F0'),
  textColor:     '#' + (P.get('textColor')     || '3a2f2f'),
  usernameMode:  P.get('usernameMode')  || 'usercolor',
  usernameColor: '#' + (P.get('usernameColor') || 'ff7043'),
  avatarSize:    pInt('avatarSize', 54),
  usernameSize:  parseFloat(P.get('usernameSize') || '0.85') || 0.85,
  maxMsg:        pInt('maxMsg', 8),
  msgLife:       pInt('msgLife', 30),
  scrollDir:     P.get('scrollDir')     || 'up',
  animIn:        P.get('animIn')        || 'bounce',
  chatX:         pInt('chatX', 20),
  chatY:         pInt('chatY', 20),
  chatSide:      P.get('chatSide')      || 'left',
  showPlatform:  P.get('showPlatform')  !== 'false',
  showBadges:    P.get('showBadges')    !== 'false',
  showPronouns:  P.get('showPronouns')  === 'true',
  showSharedChat:P.get('showSharedChat') !== 'false',
  showEvents:    P.get('showEvents')    !== 'false',
  evSub:         P.get('evSub')         !== 'false',
  evGift:        P.get('evGift')        !== 'false',
  evCheer:       P.get('evCheer')       !== 'false',
  evBitsCombo:   P.get('evBitsCombo')   !== 'false',
  evFollow:      P.get('evFollow')      !== 'false',
  evRaid:        P.get('evRaid')        !== 'false',
  evYtSuper:     P.get('evYtSuper')     !== 'false',
  evYtMember:    P.get('evYtMember')    !== 'false',
  showHypeTrain: P.get('showHypeTrain') !== 'false',
  hypeX:         pInt('hypeX', -1),
  hypeY:         pInt('hypeY', 24),
  twitchChannel: P.get('twitchChannel') || '',
  debug:         P.get('debug')         === 'true',
  demo:          P.get('demo')          === 'true',
};

// ═══════════════════════════════════════════════════
// FONT LOADING
// ═══════════════════════════════════════════════════
const BUNDLED_FONTS = ['Nunito', 'Fredoka One', 'Comic Neue', 'Patrick Hand'];
function loadFont(family) {
  if (!family || BUNDLED_FONTS.includes(family)) return;
  const link = document.createElement('link');
  link.rel  = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family).replace(/%20/g, '+')}&display=swap`;
  document.head.appendChild(link);
}
loadFont(cfg.fontFamily);

// ═══════════════════════════════════════════════════
// CSS VARIABLES
// ═══════════════════════════════════════════════════
const root = document.documentElement;
root.style.setProperty('--bubble-color', cfg.bubbleColor);
root.style.setProperty('--text-color',   cfg.textColor);
root.style.setProperty('--font-size',    cfg.fontSize + 'px');
root.style.setProperty('--font-family',  `'${cfg.fontFamily}', 'Nunito', sans-serif`);
root.style.setProperty('--avatar-size',  cfg.avatarSize + 'px');
root.style.setProperty('--chat-x',       cfg.chatX + 'px');
root.style.setProperty('--chat-y',       cfg.chatY + 'px');
const s = cfg.usernameSize;
root.style.setProperty('--username-size', s + 'em');
root.style.setProperty('--pronoun-size',  (s * 0.85).toFixed(3) + 'em');
root.style.setProperty('--badge-size',    (s * 0.80).toFixed(3) + 'em');

// ═══════════════════════════════════════════════════
// DOM REFERENCES
// ═══════════════════════════════════════════════════
const container = document.getElementById('chat-container');
const statusEl  = document.getElementById('status');
const statusDot = document.getElementById('statusDot');
const statusTxt = document.getElementById('statusText');
const hypeEl    = document.getElementById('hype-train');
const hypeBar   = document.getElementById('hype-bar');
const hypeLvl   = document.getElementById('hype-level');
const hypePct   = document.getElementById('hype-pct');

if (cfg.chatSide === 'right')       container.classList.add('pos-right');
if (cfg.scrollDir === 'horizontal') container.classList.add('scroll-horizontal');
if (cfg.scrollDir === 'down')       container.classList.add('scroll-down');

// Hype train position
if (cfg.hypeX >= 0) {
  hypeEl.style.left      = cfg.hypeX + 'px';
  hypeEl.style.top       = cfg.hypeY + 'px';
  hypeEl.style.transform = 'none';
} else {
  hypeEl.style.top       = cfg.hypeY + 'px';
  hypeEl.style.bottom    = 'auto';
  hypeEl.style.left      = '50%';
  hypeEl.style.transform = 'translateX(-50%)';
}

// ═══════════════════════════════════════════════════
// UTILITIES
// ═══════════════════════════════════════════════════
function esc(text) {
  const d = document.createElement('div');
  d.textContent = String(text ?? '');
  return d.innerHTML;
}

function dbg(...args) {
  if (cfg.debug) console.log('[overlay]', ...args);
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
  return `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(username || 'unknown')}&backgroundColor=b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf`;
}

// ═══════════════════════════════════════════════════
// AVATAR CACHE
// ═══════════════════════════════════════════════════
const avatarCache = new Map();

function getAvatarUrl(platform, login, providedUrl) {
  if (!login) return fallbackAvatar('unknown');
  const key = `${platform}:${String(login).toLowerCase()}`;
  if (avatarCache.has(key)) return avatarCache.get(key);
  let url;
  if (providedUrl && providedUrl.startsWith('http')) {
    url = providedUrl;
  } else if (platform === 'twitch') {
    url = `https://unavatar.io/twitch/${encodeURIComponent(String(login).toLowerCase())}`;
  } else {
    url = fallbackAvatar(login);
  }
  avatarCache.set(key, url);
  return url;
}

// ═══════════════════════════════════════════════════
// PRONOUNS
// ═══════════════════════════════════════════════════
const pronounsMap  = {};
const pronounCache = {};
let   pronounsReady = false;

async function loadPronounsList() {
  if (pronounsReady) return;
  try {
    const data = await fetch('https://pronouns.alejo.io/api/pronouns').then(r => r.json());
    data.forEach(p => { pronounsMap[p.name] = p.display; });
    pronounsReady = true;
  } catch (_) {}
}

async function getPronoun(login) {
  if (!cfg.showPronouns || !login) return '';
  if (pronounCache[login] !== undefined) return pronounCache[login];
  try {
    const data = await fetch(`https://pronouns.alejo.io/api/users/${encodeURIComponent(login.toLowerCase())}`).then(r => r.json());
    pronounCache[login] = data.length ? (pronounsMap[data[0].pronoun_id] || '') : '';
  } catch (_) {
    pronounCache[login] = '';
  }
  return pronounCache[login];
}

if (cfg.showPronouns) loadPronounsList();

// ═══════════════════════════════════════════════════
// BTTV + FFZ EMOTES
// Uses d.user.id (numeric Twitch ID) for BTTV — that's what the API requires
// ═══════════════════════════════════════════════════
const thirdPartyEmotes = new Map();
let emotesLoaded = false;

async function loadThirdPartyEmotes(userId, channelLogin) {
  if (emotesLoaded) return;
  emotesLoaded = true;
  dbg('Loading third-party emotes for userId=' + userId + ' login=' + channelLogin);

  // BTTV global emotes
  try {
    const data = await fetch('https://api.betterttv.net/3/cached/emotes/global').then(r => r.json());
    for (const e of data) thirdPartyEmotes.set(e.code, `https://cdn.betterttv.net/emote/${e.id}/1x`);
    dbg('BTTV global emotes loaded:', data.length);
  } catch (e) { dbg('BTTV global failed:', e); }

  // BTTV channel emotes — requires numeric Twitch user ID
  if (userId) {
    try {
      const data = await fetch(`https://api.betterttv.net/3/cached/users/twitch/${encodeURIComponent(userId)}`).then(r => r.json());
      const all = [...(data.channelEmotes || []), ...(data.sharedEmotes || [])];
      for (const e of all) thirdPartyEmotes.set(e.code, `https://cdn.betterttv.net/emote/${e.id}/1x`);
      dbg('BTTV channel emotes loaded:', all.length);
    } catch (e) { dbg('BTTV channel failed:', e); }
  }

  // FFZ channel emotes — accepts login name
  if (channelLogin) {
    try {
      const data = await fetch(`https://api.frankerfacez.com/v1/room/${encodeURIComponent(channelLogin)}`).then(r => r.json());
      for (const set of Object.values(data.sets || {})) {
        for (const e of set.emoticons || []) {
          const url = e.urls?.['1'] || e.urls?.['2'];
          if (url) thirdPartyEmotes.set(e.name, url.startsWith('//') ? 'https:' + url : url);
        }
      }
      dbg('FFZ emotes loaded:', thirdPartyEmotes.size);
    } catch (e) { dbg('FFZ failed:', e); }
  }
}

// If twitchChannel is set in URL, pre-fetch using IVR API to resolve userId
if (cfg.twitchChannel && !emotesLoaded) {
  fetch(`https://api.ivr.fi/v2/twitch/user?login=${encodeURIComponent(cfg.twitchChannel)}`)
    .then(r => r.json())
    .then(data => {
      const userId = data?.[0]?.id || '';
      loadThirdPartyEmotes(userId, cfg.twitchChannel);
    })
    .catch(() => loadThirdPartyEmotes('', cfg.twitchChannel));
}

// ═══════════════════════════════════════════════════
// EMOTE PARSER — Twitch built-in + BTTV/FFZ
// ═══════════════════════════════════════════════════
function parseEmotes(text, emotes) {
  let result = '';
  if (emotes?.length) {
    const chars  = [...text];
    const sorted = [...emotes].sort((a, b) => a.startIndex - b.startIndex);
    let cursor = 0;
    for (const em of sorted) {
      if (em.startIndex > cursor)
        result += replaceThirdParty(chars.slice(cursor, em.startIndex).join(''));
      const name    = chars.slice(em.startIndex, em.endIndex + 1).join('');
      // Use imageUrl from SB if available, else construct from id
      const emoteUrl = em.imageUrl
        || (em.id ? `https://static-cdn.jtvnw.net/emoticons/v2/${em.id}/default/dark/1.0` : null);
      if (emoteUrl) {
        result += `<img class="emote" src="${emoteUrl}" alt="${esc(name)}" />`;
      } else {
        result += esc(name);
      }
      cursor = em.endIndex + 1;
    }
    if (cursor < chars.length) result += replaceThirdParty(chars.slice(cursor).join(''));
  } else {
    result = replaceThirdParty(text);
  }
  return result;
}

function replaceThirdParty(segment) {
  if (!thirdPartyEmotes.size) return esc(segment);
  return segment.split(' ').map(word => {
    const url = thirdPartyEmotes.get(word);
    return url
      ? `<img class="emote" src="${url}" alt="${esc(word)}" title="${esc(word)}" />`
      : esc(word);
  }).join(' ');
}

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
  ws.onopen  = () => { setTimeout(() => { if (!subscribed) subscribe(); }, 2000); };

  ws.onmessage = async (e) => {
    let data;
    try { data = JSON.parse(e.data); } catch (_) { return; }
    dbg('WS event:', data?.event?.source, data?.event?.type, data);

    const isHandshake = data?.event?.type === 'Connected'
      || data?.event?.type === 'Hello'
      || (data?.data?.version && !data?.event);

    if (isHandshake && !subscribed) {
      const auth = data?.data?.authentication;
      if (auth && cfg.wsPass) {
        setStatus('auth');
        try {
          const secret = await sha256b64(cfg.wsPass + auth.salt);
          const token  = await sha256b64(secret + auth.challenge);
          ws.send(JSON.stringify({ request: 'Authenticate', authentication: token, id: 'auth' }));
        } catch (_) { subscribe(); }
      } else { subscribe(); }
      return;
    }

    if (data?.id === 'auth') { setStatus('connected'); subscribe(); return; }
    if (data?.id === 'sub')  { setStatus('connected'); return; }
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
      case 'Sub':             return cfg.showEvents && cfg.evSub    && onSub(d);
      case 'ReSub':           return cfg.showEvents && cfg.evSub    && onReSub(d);
      case 'GiftSub':         return cfg.showEvents && cfg.evGift   && onGiftSub(d);
      case 'GiftBomb':        return cfg.showEvents && cfg.evGift   && onGiftBomb(d);
      case 'Cheer':           return cfg.showEvents && (cfg.evCheer || cfg.evBitsCombo) && onCheer(d);
      case 'Follow':          return cfg.showEvents && cfg.evFollow  && onFollow(d);
      case 'Raid':            return cfg.showEvents && cfg.evRaid    && onRaid(d);
      case 'HypeTrainStart':  return onHypeStart(d);
      case 'HypeTrainUpdate': return onHypeUpdate(d);
      case 'HypeTrainEnd':
      case 'HypeTrainExpire': return onHypeEnd(d);
    }
  }
  if (source === 'YouTube') {
    switch (type) {
      case 'Message':         return onYouTubeChat(d);
      case 'SuperChat':
      case 'SuperSticker':    return cfg.showEvents && cfg.evYtSuper  && onSuperChat(d);
      case 'NewSponsor':
      case 'NewMember':       return cfg.showEvents && cfg.evYtMember && onYTMember(d, false);
      case 'MemberMilestone': return cfg.showEvents && cfg.evYtMember && onYTMember(d, true);
    }
  }
}

// ═══════════════════════════════════════════════════
// DATA EXTRACTION
// Verified against docs.streamer.bot schema
// d.user.name  = display name (NOT displayName)
// d.user.login = login name
// d.user.id    = numeric Twitch/YouTube ID
// d.user.role  = enum: 0=Unknown 1=Viewer 2=Vip 3=Moderator 4=Broadcaster
// d.user.subscribed = boolean
// d.text       = message text (top-level shortcut)
// d.message.message = message text (nested)
// d.message.channel = channel login name
// d.message.firstMessage = boolean (not isFirstMessage)
// ═══════════════════════════════════════════════════
function extractUser(d) {
  // Standard SB 0.2.x structure: d.user object
  if (d?.user) {
    const u = d.user;
    return {
      id:          u.id          || '',
      displayName: u.name        || u.login || u.displayName || 'Unknown',
      login:       u.login       || u.name  || '',
      avatarUrl:   u.profileImageUrl || u.profile_image_url || '',
      color:       u.color       || null,
      role:        u.role        ?? -1,   // enum number
      subscribed:  u.subscribed  ?? false,
    };
  }
  // Fallback: old SB or flat structure
  const src = (typeof d?.message === 'object' && d.message) ? d.message : (d || {});
  return {
    id:          src.userId    || d?.userId    || '',
    displayName: src.displayName || src.username || d?.displayName || d?.username || 'Unknown',
    login:       src.username  || src.login    || d?.username     || d?.login    || '',
    avatarUrl:   src.profileImageUrl           || d?.profileImageUrl || '',
    color:       src.color     || d?.color     || null,
    role:        -1,
    subscribed:  src.subscriber || src.isSubscribed || false,
  };
}

function extractText(d) {
  // d.text is the top-level shortcut SB provides
  if (d?.text && typeof d.text === 'string') return d.text;
  if (d?.message?.message)                   return d.message.message;
  if (typeof d?.message === 'string')        return d.message;
  return '';
}

function extractEmotes(d) {
  // Emotes can be at d.emotes or d.message.emotes
  return d?.emotes || d?.message?.emotes || [];
}

// ═══════════════════════════════════════════════════
// CONTENT FILTERS
// ═══════════════════════════════════════════════════
function shouldFilter(login, text) {
  if (cfg.ignored.includes((login || '').toLowerCase())) return true;
  if (cfg.ignoreCmd && String(text || '').trimStart().startsWith('!')) return true;
  return false;
}

// ═══════════════════════════════════════════════════
// TWITCH CHAT HANDLER
// ═══════════════════════════════════════════════════
async function onTwitchChat(d) {
  const user = extractUser(d);
  const text  = extractText(d);
  if (!text) return;
  if (shouldFilter(user.login, text)) return;

  // Grab the numeric userId and channel name for BTTV on first message
  if (!emotesLoaded && user.id) {
    const chan = d?.message?.channel || cfg.twitchChannel || '';
    loadThirdPartyEmotes(user.id, chan);
  }

  // Badge flags — role enum: 4=Broadcaster, 3=Mod, 2=VIP, 1=Viewer
  const role         = user.role;
  const isBroadcaster = role === 4;
  const isModerator   = role === 3;
  const isVip         = role === 2;
  const isSubscriber  = user.subscribed || d?.message?.subscriber || false;

  // firstMessage lives in d.message.firstMessage (NOT isFirstMessage)
  const msgObj = (typeof d?.message === 'object' && d.message) ? d.message : {};
  const isFirstMessage = msgObj.firstMessage ?? d?.firstMessage ?? false;
  const bits           = msgObj.bits         ?? d?.bits         ?? 0;

  // Shared chat
  const isShared   = !!(msgObj.isInSharedChat || msgObj.sourceRoomId || d?.isInSharedChat);
  const sharedFrom = isShared ? (d?.sharedChatSource?.name || d?.sharedChatSource?.login || msgObj.sourceBroadcasterName || '') : '';
  if (isShared && !cfg.showSharedChat) return;

  const pronoun = await getPronoun(user.login);

  addChatBubble({
    platform: 'twitch',
    username: user.displayName,
    login:    user.login,
    color:    user.color,
    text,
    emotes:   extractEmotes(d),
    isBroadcaster,
    isModerator,
    isSubscriber,
    isVip,
    isFirstMessage,
    bits,
    avatarUrl: user.avatarUrl,
    pronoun,
    isShared,
    sharedFrom,
  });
}

// ═══════════════════════════════════════════════════
// YOUTUBE CHAT HANDLER
// ═══════════════════════════════════════════════════
async function onYouTubeChat(d) {
  const user = extractUser(d);
  const text  = extractText(d);
  dbg('YouTube message raw:', JSON.stringify(d));
  if (!text) return;
  if (shouldFilter(user.login, text)) return;

  const msgObj     = (typeof d?.message === 'object' && d.message) ? d.message : (d || {});
  const isModerator = msgObj.isModerator ?? d?.isModerator ?? (user.role === 3) ?? false;
  const isOwner     = msgObj.isOwner     ?? d?.isOwner     ?? (user.role === 4) ?? false;
  const isMember    = msgObj.isMember    || msgObj.isSponsor || d?.isMember || d?.isSponsor || false;

  addChatBubble({
    platform: 'youtube',
    username: user.displayName,
    login:    user.login,
    color:    null,
    text,
    emotes:   [],
    isOwner,
    isModerator,
    isMember,
    avatarUrl: user.avatarUrl,
    pronoun:   '',
    isShared:  false,
    sharedFrom:'',
  });
}

// ═══════════════════════════════════════════════════
// TWITCH EVENT HANDLERS
// ═══════════════════════════════════════════════════
function onSub(d) {
  const user = extractUser(d);
  const text  = extractText(d);
  addEventBubble({
    icon: '🎉', type: 'sub', platform: 'twitch',
    username:  user.displayName,
    avatarUrl: getAvatarUrl('twitch', user.login, user.avatarUrl),
    title: `${esc(user.displayName)} just subscribed!`,
    body:  `${tierLabel(d.subTier || d.tier)}${d.isPrime ? ' (Prime)' : ''}${text ? ` · "${esc(text)}"` : ''}`,
  });
}

function onReSub(d) {
  const user   = extractUser(d);
  const text    = extractText(d);
  const months  = d.cumulativeMonths || d.months || '?';
  addEventBubble({
    icon: '🎊', type: 'sub', platform: 'twitch',
    username:  user.displayName,
    avatarUrl: getAvatarUrl('twitch', user.login, user.avatarUrl),
    title: `${esc(user.displayName)} resubscribed!`,
    body:  `${tierLabel(d.subTier || d.tier)} · ${months} months${text ? ` · "${esc(text)}"` : ''}`,
  });
}

function onGiftSub(d) {
  const user      = extractUser(d);
  const recipient = d.recipient?.name || d.recipient?.login
    || d.recipientDisplayName || d.recipientUsername || 'someone';
  addEventBubble({
    icon: '🎁', type: 'gift', platform: 'twitch',
    username:  user.displayName,
    avatarUrl: getAvatarUrl('twitch', user.login, user.avatarUrl),
    title: `${esc(user.displayName)} gifted a sub!`,
    body:  `To ${esc(recipient)} · ${tierLabel(d.subTier || d.tier)}`,
  });
}

function onGiftBomb(d) {
  const user = extractUser(d);
  const qty  = d.gifts || d.amount || d.quantity || '?';
  addEventBubble({
    icon: '💣', type: 'gift', platform: 'twitch',
    username:  user.displayName,
    avatarUrl: getAvatarUrl('twitch', user.login, user.avatarUrl),
    title: `${esc(user.displayName)} gifted ${qty} subs!`,
    body:  `${tierLabel(d.subTier || d.tier)} · Total given: ${d.totalGifts ?? '?'}`,
  });
}

function onCheer(d) {
  const user = extractUser(d);
  const text  = extractText(d);
  const bits  = d.bits || d.amount || 0;
  addEventBubble({
    icon: '⭐', type: 'cheer', platform: 'twitch',
    username:  user.displayName,
    avatarUrl: getAvatarUrl('twitch', user.login, user.avatarUrl),
    title: `${esc(user.displayName)} cheered ${bits} bits!`,
    body:  text ? `"${esc(text)}"` : '',
  });
}

function onFollow(d) {
  const user = extractUser(d);
  addEventBubble({
    icon: '💜', type: 'follow', platform: 'twitch',
    username:  user.displayName,
    avatarUrl: getAvatarUrl('twitch', user.login, user.avatarUrl),
    title: `${esc(user.displayName)} just followed!`,
    body:  'Welcome to the community! 🎉',
  });
}

function onRaid(d) {
  const user    = extractUser(d);
  const viewers = d.viewerCount || d.viewers || d.raiderCount || '?';
  addEventBubble({
    icon: '🚀', type: 'raid', platform: 'twitch',
    username:  user.displayName,
    avatarUrl: getAvatarUrl('twitch', user.login, user.avatarUrl),
    title: `${esc(user.displayName)} is raiding!`,
    body:  `Bringing ${viewers} viewers 🚀`,
  });
}

// ═══════════════════════════════════════════════════
// YOUTUBE EVENT HANDLERS
// ═══════════════════════════════════════════════════
function onSuperChat(d) {
  const user   = extractUser(d);
  const text    = extractText(d);
  const amount  = d.formattedAmount || d.amount || '';
  addEventBubble({
    icon: '💰', type: 'superchat', platform: 'youtube',
    username:    user.displayName,
    avatarUrl:   getAvatarUrl('youtube', user.login, user.avatarUrl),
    title: `${esc(user.displayName)} sent a Super Chat!`,
    body:  `${amount}${text ? ` · "${esc(text)}"` : ''}`,
    accentColor: d.color || '#ff0000',
  });
}

function onYTMember(d, isMilestone) {
  const user   = extractUser(d);
  const months  = d.months || d.monthCount || '?';
  addEventBubble({
    icon: '🌟', type: 'member', platform: 'youtube',
    username:  user.displayName,
    avatarUrl: getAvatarUrl('youtube', user.login, user.avatarUrl),
    title: isMilestone
      ? `${esc(user.displayName)} has been a member for ${months} months!`
      : `${esc(user.displayName)} just became a member!`,
    body: d.level || '',
  });
}

// ═══════════════════════════════════════════════════
// HYPE TRAIN
// ═══════════════════════════════════════════════════
let hypeTimer;

function onHypeStart(d)  { if (!cfg.showHypeTrain) return; hypeEl.classList.remove('hidden'); _updateHype(d?.level||1, d?.total||0, d?.goal||1500); }
function onHypeUpdate(d) { if (!cfg.showHypeTrain) return; hypeEl.classList.remove('hidden'); _updateHype(d?.level||1, d?.total||0, d?.goal||1500); }
function onHypeEnd(d) {
  if (!cfg.showHypeTrain) return;
  clearTimeout(hypeTimer);
  _updateHype(d?.level||1, d?.total||0, d?.total||1);
  hypeTimer = setTimeout(() => hypeEl.classList.add('hidden'), 6000);
}
function _updateHype(level, total, goal) {
  const pct = Math.min(100, Math.round((total / (goal || 1)) * 100));
  hypeLvl.textContent = `HYPE TRAIN LEVEL ${level}`;
  hypePct.textContent = `${pct}%`;
  hypeBar.style.width = `${pct}%`;
}

// ═══════════════════════════════════════════════════
// RENDER — Chat bubble
// ═══════════════════════════════════════════════════
async function addChatBubble(msg) {
  const uColor    = (cfg.usernameMode === 'usercolor' && msg.color) ? msg.color : cfg.usernameColor;
  const avatarUrl = getAvatarUrl(msg.platform, msg.login || msg.username, msg.avatarUrl);
  const fbAvatar  = fallbackAvatar(msg.username);
  const animClass = getAnimClass();

  let badgeHtml = '';
  if (cfg.showBadges) {
    if (msg.isBroadcaster)                   badgeHtml += `<span class="badge" title="Broadcaster">🎙️</span>`;
    else if (msg.isModerator || msg.isOwner) badgeHtml += `<span class="badge" title="Moderator">⚔️</span>`;
    if (msg.isSubscriber || msg.isMember)    badgeHtml += `<span class="badge-pill badge-${msg.isMember ? 'member' : 'sub'}">${msg.isMember ? 'Member' : 'Sub'}</span>`;
    if (msg.isVip)                           badgeHtml += `<span class="badge" title="VIP">💎</span>`;
    if (msg.isFirstMessage)                  badgeHtml += `<span class="badge-pill badge-first">First chat! 🌟</span>`;
    if (msg.bits > 0)                        badgeHtml += `<span class="badge-pill badge-bits">⭐ ${msg.bits}</span>`;
  }

  const pronounHtml  = msg.pronoun ? `<span class="pronoun">${esc(msg.pronoun)}</span>` : '';
  const platformHtml = cfg.showPlatform
    ? `<div class="platform-badge"><img class="platform-icon" src="${getPlatformIcon(msg.platform)}" alt="${msg.platform}" /></div>` : '';
  const sharedHtml   = (msg.isShared && msg.sharedFrom)
    ? `<div class="shared-label">📡 from @${esc(msg.sharedFrom)}'s chat</div>` : '';
  const msgHtml      = msg.platform === 'twitch'
    ? parseEmotes(msg.text, msg.emotes) : esc(msg.text);

  const el = document.createElement('div');
  el.className = `message ${animClass}${msg.isShared ? ' shared-chat' : ''}`;
  el.innerHTML = `
    <div class="avatar-wrapper">
      <div class="avatar">
        <img src="${avatarUrl}" alt="${esc(msg.username)}" loading="lazy"
             onerror="if(this.src!=='${fbAvatar}')this.src='${fbAvatar}'" />
      </div>
      ${platformHtml}
    </div>
    <div class="bubble-wrapper">
      <div class="username-row">
        <span class="username" style="color:${uColor}">${esc(msg.username)}</span>
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
  const fbAvatar  = fallbackAvatar(ev.username);
  const animClass = getAnimClass();
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
    return (cfg.chatSide === 'right' || cfg.scrollDir === 'horizontal') ? 'anim-slide-right' : 'anim-slide';
  }
  return `anim-${cfg.animIn}`;
}

function appendMsg(el) {
  if (cfg.scrollDir === 'down') container.insertBefore(el, container.firstChild);
  else                          container.appendChild(el);

  const all = container.querySelectorAll('.message:not(.removing)');
  if (all.length > cfg.maxMsg) {
    const oldest = cfg.scrollDir === 'down' ? all[all.length - 1] : all[0];
    removeMsg(oldest);
  }

  if (cfg.msgLife > 0) {
    setTimeout(() => { if (el.parentNode) removeMsg(el); }, cfg.msgLife * 1000);
  }
}

function removeMsg(el) {
  if (!el || el.classList.contains('removing')) return;
  el.classList.add('removing');
  el.addEventListener('animationend', () => el.remove(), { once: true });
  setTimeout(() => el?.remove(), 800);
}

// ═══════════════════════════════════════════════════
// POSTMESSAGE — test commands from the customizer
// ═══════════════════════════════════════════════════
window.addEventListener('message', (e) => {
  const cmd = e.data?.cmd;
  if (!cmd) return;
  if (cmd === 'testHype') {
    let level = 1, prog = 0;
    hypeEl.classList.remove('hidden');
    _updateHype(1, 0, 1500);
    const iv = setInterval(() => {
      prog += 180;
      if (prog >= 1500) { prog -= 1500; level++; if (level > 5) { clearInterval(iv); onHypeEnd({ level:5, total:1500 }); return; } }
      _updateHype(level, prog, 1500);
    }, 250);
  }
  if (cmd === 'testEvent') {
    const demos = {
      sub:    () => onSub   ({ user:{ id:'1', name:'TestSub',     login:'testsub'    }, subTier:'1000', message:{ message:'Test sub message!' }}),
      cheer:  () => onCheer ({ user:{ id:'2', name:'TestCheer',   login:'testcheer'  }, bits:500, message:{ message:'Keep it up!!' }}),
      raid:   () => onRaid  ({ user:{ id:'3', name:'TestRaider',  login:'testraider' }, viewerCount:42 }),
      follow: () => onFollow({ user:{ id:'4', name:'TestFollower',login:'testfollow' }}),
    };
    demos[e.data.type || 'sub']?.();
  }
});

// ═══════════════════════════════════════════════════
// DEMO MODE
// ═══════════════════════════════════════════════════
const DEMO = [
  () => onTwitchChat({ user:{ id:'101', name:'StreamFan99', login:'streamfan99', color:'#FF4D4D', role:1, subscribed:true, profileImageUrl:'' }, text:'POGGERS this overlay is so cute!! 🎮', emotes:[] }),
  () => onYouTubeChat({ user:{ id:'201', name:'YouTubeLurker', login:'youtubelurker', profileImageUrl:'' }, text:'Hello from YouTube! Love the stream ❤️', message:{ isMember:true }}),
  () => onTwitchChat({ user:{ id:'102', name:'ModeratorPro', login:'moderatorpro', color:'#5CB85C', role:3, subscribed:false, profileImageUrl:'' }, text:"Pog let's gooooo!!!", emotes:[] }),
  () => onSub({ user:{ id:'103', name:'HypeNewSub', login:'hypesub', profileImageUrl:'' }, subTier:'1000', message:{ message:'Finally subscribed!' }}),
  () => onTwitchChat({ user:{ id:'104', name:'FirstTimer99', login:'firsttimer99', color:'#9146FF', role:1, subscribed:false, profileImageUrl:'' }, text:'This is my first time chatting!', emotes:[], message:{ firstMessage:true }}),
  () => onCheer({ user:{ id:'105', name:'BitsDono', login:'bitsdono', profileImageUrl:'' }, bits:500, message:{ message:'Keep it up!! 🎉' }}),
  () => onYouTubeChat({ user:{ id:'202', name:'SuperFan', login:'superfan', profileImageUrl:'' }, text:'Great content as always! 👏' }),
  () => onRaid({ user:{ id:'106', name:'FriendlyRaider', login:'friendlyraider', profileImageUrl:'' }, viewerCount:84 }),
  () => onReSub({ user:{ id:'107', name:'LoyalFan', login:'loyalfan', profileImageUrl:'' }, subTier:'1000', cumulativeMonths:6, message:{ message:'Six months! LUL' }}),
];

if (cfg.demo) {
  statusEl.classList.add('hidden');
  if (cfg.showHypeTrain) { hypeEl.classList.remove('hidden'); _updateHype(2, 850, 1500); }
  let i = 0;
  (function demoTick() { DEMO[i % DEMO.length](); i++; setTimeout(demoTick, 2600); })();
} else {
  connect();
}
