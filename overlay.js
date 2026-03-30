/* ================================================
   CHAT OVERLAY — overlay.js
   Streamer.bot WebSocket · Twitch + YouTube
   ================================================ */
'use strict';

// ═══════════════════════════════════════════════════
// CONFIG — parsed from URL query params
// ═══════════════════════════════════════════════════
const P = new URLSearchParams(window.location.search);

// Safe int parse: returns null if param missing, otherwise the integer (0 is valid!)
function pInt(key, def) {
  const v = P.get(key);
  return (v !== null && v !== '') ? parseInt(v, 10) : def;
}

const cfg = {
  // Streamer.bot connection
  wsHost:        P.get('wsHost')   || '127.0.0.1',
  wsPort:        P.get('wsPort')   || '8080',
  wsPass:        P.get('wsPass')   || '',

  // Filtering
  ignored:       (P.get('ignored') || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean),
  ignoreCmd:     P.get('ignoreCmd') !== 'false',

  // Appearance
  fontFamily:    P.get('fontFamily')  || 'Nunito',
  fontSize:      pInt('fontSize',  15),
  bubbleColor:   '#' + (P.get('bubbleColor')   || 'FFF8F0'),
  textColor:     '#' + (P.get('textColor')     || '3a2f2f'),
  usernameMode:  P.get('usernameMode') || 'usercolor',
  usernameColor: '#' + (P.get('usernameColor') || 'ff7043'),
  avatarSize:    pInt('avatarSize', 54),
  usernameSize:  parseFloat(P.get('usernameSize') ?? 0.85) || 0.85,

  // Behavior
  maxMsg:        pInt('maxMsg',   8),
  msgLife:       pInt('msgLife', 30),   // 0 = forever — must not use || fallback
  scrollDir:     P.get('scrollDir')  || 'up',  // up | down | horizontal
  animIn:        P.get('animIn')     || 'bounce',

  // Chat position (px from anchor edge)
  chatX:         pInt('chatX', 20),
  chatY:         pInt('chatY', 20),
  chatSide:      P.get('chatSide')   || 'left',   // left | right

  // Features
  showPlatform:  P.get('showPlatform')   !== 'false',
  showBadges:    P.get('showBadges')     !== 'false',
  showPronouns:  P.get('showPronouns')   === 'true',
  showSharedChat:P.get('showSharedChat') !== 'false',

  // Events
  showEvents:    P.get('showEvents')   !== 'false',
  evSub:         P.get('evSub')        !== 'false',
  evGift:        P.get('evGift')       !== 'false',
  evCheer:       P.get('evCheer')      !== 'false',
  evBitsCombo:   P.get('evBitsCombo')  !== 'false',
  evFollow:      P.get('evFollow')     !== 'false',
  evRaid:        P.get('evRaid')       !== 'false',
  evYtSuper:     P.get('evYtSuper')    !== 'false',
  evYtMember:    P.get('evYtMember')   !== 'false',

  // Hype Train
  showHypeTrain: P.get('showHypeTrain') !== 'false',
  hypeX:         pInt('hypeX', -1),   // -1 = centered (default)
  hypeY:         pInt('hypeY', 24),   // px from top

  demo: P.get('demo') === 'true',
  twitchChannel: P.get('twitchChannel') || '',  // used to pre-load BTTV/FFZ emotes
};

// ═══════════════════════════════════════════════════
// FONT LOADING
// ═══════════════════════════════════════════════════
const BUNDLED_FONTS = ['Nunito', 'Fredoka One', 'Comic Neue', 'Patrick Hand'];
function loadFont(family) {
  if (!family || BUNDLED_FONTS.includes(family)) return;
  const link = document.createElement('link');
  link.rel  = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family).replace(/%20/g,'+')}&display=swap`;
  document.head.appendChild(link);
}
loadFont(cfg.fontFamily);

// ═══════════════════════════════════════════════════
// APPLY CSS VARIABLES
// ═══════════════════════════════════════════════════
const root = document.documentElement;
root.style.setProperty('--bubble-color',  cfg.bubbleColor);
root.style.setProperty('--text-color',    cfg.textColor);
root.style.setProperty('--font-size',     cfg.fontSize + 'px');
root.style.setProperty('--font-family',   `'${cfg.fontFamily}', 'Nunito', sans-serif`);
root.style.setProperty('--avatar-size',    cfg.avatarSize + 'px');
const s = cfg.usernameSize; // e.g. 0.85
root.style.setProperty('--username-size', s + 'em');
root.style.setProperty('--pronoun-size',  (s * 0.85).toFixed(3) + 'em');
root.style.setProperty('--badge-size',    (s * 0.80).toFixed(3) + 'em');
root.style.setProperty('--chat-x',        cfg.chatX + 'px');
root.style.setProperty('--chat-y',        cfg.chatY + 'px');

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

// ── Apply layout / position ──────────────────────
if (cfg.chatSide === 'right')       container.classList.add('pos-right');
if (cfg.scrollDir === 'horizontal') container.classList.add('scroll-horizontal');
if (cfg.scrollDir === 'down')       container.classList.add('scroll-down');

// Hype train position — centered by default, or at explicit X/Y
if (cfg.hypeX >= 0) {
  hypeEl.style.left      = cfg.hypeX + 'px';
  hypeEl.style.top       = cfg.hypeY + 'px';
  hypeEl.style.transform = 'none';
} else {
  // Centered horizontally; Y from top
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
// AVATAR CACHE — real profile pictures, DiceBear fallback
// ═══════════════════════════════════════════════════
const avatarCache = new Map();

function getAvatarUrl(platform, username, providedUrl) {
  if (!username) return fallbackAvatar('unknown');
  const key = `${platform}:${username.toLowerCase()}`;
  if (avatarCache.has(key)) return avatarCache.get(key);

  let url;
  if (providedUrl && providedUrl.startsWith('http')) {
    url = providedUrl;
  } else if (platform === 'twitch') {
    url = `https://unavatar.io/twitch/${encodeURIComponent(username.toLowerCase())}`;
  } else if (platform === 'youtube') {
    url = `https://unavatar.io/youtube/${encodeURIComponent(username)}`;
  } else {
    url = fallbackAvatar(username);
  }

  avatarCache.set(key, url);
  return url;
}

// ═══════════════════════════════════════════════════
// PRONOUNS — pronouns.alejo.io
// ═══════════════════════════════════════════════════
const pronounsMap  = {};
const pronounCache = {};
let   pronounsReady = false;

async function loadPronounsList() {
  if (pronounsReady) return;
  try {
    const res  = await fetch('https://pronouns.alejo.io/api/pronouns');
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

// Load third-party emotes if channel is known up front
if (cfg.twitchChannel) loadThirdPartyEmotes(cfg.twitchChannel);

// Track whether we've already loaded emotes (so first ChatMessage can trigger it once)
let emotesLoaded = !!cfg.twitchChannel;

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
    // Safety net: if Streamer.bot doesn't send a Connected event within 2s, subscribe anyway
    setTimeout(() => { if (!subscribed) subscribe(); }, 2000);
  };

  ws.onmessage = async (e) => {
    let data;
    try { data = JSON.parse(e.data); } catch (_) { return; }

    // Streamer.bot Connected handshake (may contain auth challenge)
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
      } else {
        subscribe();
      }
      return;
    }

    if (data?.id === 'auth') {
      setStatus('connected');
      subscribe();
      return;
    }

    if (data?.id === 'sub') {
      setStatus('connected');
      return;
    }

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
        'Cheer', 'CheerCombo',
        'Follow', 'Raid',
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
      case 'Cheer':           return (cfg.showEvents && (cfg.evCheer || cfg.evBitsCombo)) && onCheer(d);
      case 'CheerCombo':      return cfg.showEvents && cfg.evBitsCombo && onCheerCombo(d);
      case 'Follow':          return cfg.showEvents && cfg.evFollow && onFollow(d);
      case 'Raid':            return cfg.showEvents && cfg.evRaid   && onRaid(d);
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
// STREAMER.BOT DATA HELPERS
// ═══════════════════════════════════════════════════
function extractUser(d, platform) {
  // ── Newer Streamer.bot (0.2.x): d.user object ──
  if (d?.user && (d.user.login || d.user.displayName || d.user.userId || d.user.channelId)) {
    return {
      displayName: d.user.displayName || d.user.name || d.user.login || 'Unknown',
      login:       d.user.login       || d.user.userLogin || d.user.displayName || d.user.channelId || '',
      avatarUrl:   d.user.profileImageUrl || d.user.profile_image_url || d.user.profilePhoto || '',
      color:       d.user.color || null,
    };
  }

  // ── YouTube-specific fields that Streamer.bot uses ──
  // SB sends YouTube messages with author/authorName/authorPhoto at the top level or in d.message
  const yt = d?.message || d || {};
  if (platform === 'youtube') {
    const name = yt.author || yt.authorName || yt.displayName || yt.username
              || d?.author || d?.authorName || d?.displayName || d?.username;
    const photo = yt.authorPhoto || yt.profileImageUrl || yt.thumbnail
               || d?.authorPhoto || d?.profileImageUrl || d?.thumbnail || '';
    const id    = yt.authorChannelId || yt.channelId || yt.authorId
               || d?.authorChannelId || d?.channelId || d?.authorId || '';
    if (name) {
      return { displayName: name, login: id || name, avatarUrl: photo, color: null };
    }
  }

  // ── Older SB: fields on d.message or d directly ──
  const msgSrc = d?.message;
  const hasMsgIdentity = msgSrc && (msgSrc.displayName || msgSrc.username || msgSrc.login);
  const src = hasMsgIdentity ? msgSrc : (d || {});
  return {
    displayName: src.displayName || src.username || src.login || src.userLogin
              || d?.displayName  || d?.username  || d?.from   || 'Unknown',
    login:       src.username    || src.login    || src.userLogin || src.from
              || d?.username     || d?.login     || d?.from   || '',
    avatarUrl:   src.profileImageUrl || src.userProfileImageUrl
              || d?.profileImageUrl  || '',
    color:       src.color || d?.color || null,
  };
}

function extractMessage(d) {
  // Newer SB: message text in d.message.message
  if (d?.message?.message !== undefined) return { text: d.message.message, emotes: d.message.emotes || [] };
  // Older SB: text directly on d or d.message as a string
  if (typeof d?.message === 'string')    return { text: d.message, emotes: [] };
  // Direct fields
  return { text: d?.text || d?.message || '', emotes: d?.emotes || [] };
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
  const user = extractUser(d, 'twitch');
  const msg  = extractMessage(d);
  if (!msg.text) return;
  if (shouldFilter(user.login, msg.text)) return;

  // Auto-load BTTV/FFZ emotes on first message using the broadcaster login
  // Streamer.bot includes the channel name in d.channel or d.message.channel
  if (!emotesLoaded) {
    const chan = d?.channel || d?.message?.channel || d?.broadcasterUserLogin || '';
    if (chan) { emotesLoaded = true; loadThirdPartyEmotes(chan); }
  }
  if (!msg.text) return;
  if (shouldFilter(user.login, msg.text)) return;

  // Badge flags can live in different places depending on SB version:
  // - Newer SB (0.2.x): on d.message (the message object)
  // - Older SB: directly on d
  // - Some versions: d.badges array with {type, version} objects
  const mObj = (typeof d?.message === 'object' && d.message !== null) ? d.message : {};
  const badges = d?.badges || mObj?.badges || [];
  const hasBadge = (type) => badges.some?.(b => b?.type?.toLowerCase() === type || b?.name?.toLowerCase() === type);

  const isBroadcaster  = mObj.isBroadcaster  ?? d?.isBroadcaster  ?? hasBadge('broadcaster');
  const isModerator    = mObj.isModerator    ?? d?.isModerator    ?? hasBadge('moderator');
  const isSubscriber   = mObj.isSubscribed   ?? mObj.isSubscriber ?? d?.isSubscribed ?? d?.isSubscriber ?? hasBadge('subscriber');
  const isVip          = mObj.isVip          ?? d?.isVip          ?? hasBadge('vip');
  const isFirstMessage = mObj.isFirstMessage ?? d?.isFirstMessage ?? false;
  const bits           = mObj.bits ?? d?.bits ?? 0;

  // Shared chat
  const isShared   = !!(mObj.sourceRoomId || mObj.sourceBroadcasterLogin || d?.sourceRoomId);
  const sharedFrom = isShared ? (mObj.sourceBroadcasterName || mObj.sourceBroadcasterLogin || d?.sourceBroadcasterName || '') : '';
  if (isShared && !cfg.showSharedChat) return;

  const pronoun = await getPronoun(user.login);

  addChatBubble({
    platform:       'twitch',
    username:       user.displayName,
    userLogin:      user.login,
    color:          user.color || mObj.color || d?.color || null,
    text:           msg.text,
    emotes:         msg.emotes,
    isBroadcaster,
    isModerator,
    isSubscriber,
    isVip,
    isFirstMessage,
    bits,
    avatarUrl:      user.avatarUrl,
    pronoun,
    isShared,
    sharedFrom,
  });
}

// ═══════════════════════════════════════════════════
// YOUTUBE CHAT HANDLER
// ═══════════════════════════════════════════════════
async function onYouTubeChat(d) {
  const user = extractUser(d, 'youtube');
  const msg  = extractMessage(d);
  if (!msg.text) return;
  if (shouldFilter(user.login, msg.text)) return;

  // Badge flags for YouTube
  const m = (typeof d?.message === 'object' && d.message !== null) ? d.message : (d || {});
  const isOwner    = m.isOwner    ?? d?.isOwner    ?? false;
  const isModerator= m.isModerator ?? d?.isModerator ?? false;
  const isMember   = m.isMember   || m.isSponsor   || d?.isMember || d?.isSponsor || false;

  addChatBubble({
    platform:    'youtube',
    username:    user.displayName,
    userLogin:   user.login,
    color:       null,
    text:        msg.text,
    emotes:      [],
    isOwner,
    isModerator,
    isMember,
    avatarUrl:   user.avatarUrl,
    pronoun:     '',
    isShared:    false,
    sharedFrom:  '',
  });
}

// ═══════════════════════════════════════════════════
// TWITCH EVENT HANDLERS
// All use extractUser(d) so we handle both SB versions
// ═══════════════════════════════════════════════════
function onSub(d) {
  const user = extractUser(d, 'twitch');
  const msg  = extractMessage(d);
  const tier = tierLabel(d.subTier || d.tier || d.subPlan);
  const prime = (d.isPrime || d.subPlan === 'Prime') ? ' (Prime)' : '';
  const months = d.cumulativeMonths || d.months || '';
  addEventBubble({
    icon: '🎉', type: 'sub', platform: 'twitch',
    username:  user.displayName,
    avatarUrl: getAvatarUrl('twitch', user.login, user.avatarUrl),
    title: `${esc(user.displayName)} just subscribed!`,
    body:  `${tier}${prime}${months ? ` · ${months} months` : ''}${msg.text ? ` · "${esc(msg.text)}"` : ''}`,
  });
}

function onReSub(d) {
  const user   = extractUser(d, 'twitch');
  const msg    = extractMessage(d);
  const months = d.cumulativeMonths || d.months || '?';
  addEventBubble({
    icon: '🎊', type: 'sub', platform: 'twitch',
    username:  user.displayName,
    avatarUrl: getAvatarUrl('twitch', user.login, user.avatarUrl),
    title: `${esc(user.displayName)} resubscribed!`,
    body:  `${tierLabel(d.subTier || d.tier)} · ${months} months${msg.text ? ` · "${esc(msg.text)}"` : ''}`,
  });
}

function onGiftSub(d) {
  const user      = extractUser(d, 'twitch');
  // Recipient can be in d.recipient or d.recipientUser
  const recipient = d.recipient?.displayName || d.recipient?.login
    || d.recipientUser?.displayName || d.recipientUser?.login
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
  const user = extractUser(d, 'twitch');
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
  const user = extractUser(d, 'twitch');
  const msg  = extractMessage(d);
  const bits = d.bits || d.amount || 0;

  // Bits Combo: SB sets d.combo (or d.isCombo) when multiple viewers cheer together
  const isCombo = d.combo || d.isCombo || d.cheerCombo;
  if (isCombo && cfg.evBitsCombo) {
    const count = d.comboCount || d.userCount || d.combo?.count || '?';
    addEventBubble({
      icon: '🌟', type: 'cheer', platform: 'twitch',
      username:  user.displayName || 'Chat',
      avatarUrl: getAvatarUrl('twitch', user.login, user.avatarUrl),
      title: `Bits Combo — ${bits} bits!`,
      body:  `${count} viewers joined the combo! 🎉`,
    });
    return;
  }

  if (!cfg.evCheer) return;
  addEventBubble({
    icon: '⭐', type: 'cheer', platform: 'twitch',
    username:  user.displayName,
    avatarUrl: getAvatarUrl('twitch', user.login, user.avatarUrl),
    title: `${esc(user.displayName)} cheered ${bits} bits!`,
    body:  msg.text ? `"${esc(msg.text)}"` : '',
  });
}

function onCheerCombo(d) {
  // Also called directly from the router if SB does emit CheerCombo separately
  const user  = extractUser(d, 'twitch');
  const total = d.total || d.bits || d.amount || 0;
  const count = d.count || d.userCount || d.users || '?';
  addEventBubble({
    icon: '🌟', type: 'cheer', platform: 'twitch',
    username:  user.displayName || 'Chat',
    avatarUrl: getAvatarUrl('twitch', user.login, user.avatarUrl),
    title: `Bits Combo — ${total} bits!`,
    body:  `${count} viewers joined the combo! 🎉`,
  });
}

function onFollow(d) {
  const user = extractUser(d, 'twitch');
  addEventBubble({
    icon: '💜', type: 'follow', platform: 'twitch',
    username:  user.displayName,
    avatarUrl: getAvatarUrl('twitch', user.login, user.avatarUrl),
    title: `${esc(user.displayName)} just followed!`,
    body:  'Welcome to the community! 🎉',
  });
}

function onRaid(d) {
  const user    = extractUser(d, 'twitch');
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
  const user   = extractUser(d, 'twitch');
  const msg    = extractMessage(d);
  const amount = d.formattedAmount || d.amount || '';
  addEventBubble({
    icon: '💰', type: 'superchat', platform: 'youtube',
    username:    user.displayName,
    avatarUrl:   getAvatarUrl('youtube', user.login, user.avatarUrl),
    title: `${esc(user.displayName)} sent a Super Chat!`,
    body:  `${amount}${msg.text ? ` · "${esc(msg.text)}"` : ''}`,
    accentColor: d.color || '#ff0000',
  });
}

function onYTMember(d, isMilestone) {
  const user   = extractUser(d, 'twitch');
  const months = d.months || d.monthCount || '?';
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

function onHypeStart(d) {
  if (!cfg.showHypeTrain) return;
  hypeEl.classList.remove('hidden');
  _updateHype(d?.level || 1, d?.total || 0, d?.goal || 1500);
}

function onHypeUpdate(d) {
  if (!cfg.showHypeTrain) return;
  hypeEl.classList.remove('hidden');
  _updateHype(d?.level || 1, d?.total || 0, d?.goal || 1500);
}

function onHypeEnd(d) {
  if (!cfg.showHypeTrain) return;
  clearTimeout(hypeTimer);
  _updateHype(d?.level || 1, d?.total || 0, d?.total || 1);
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
  const avatarUrl = getAvatarUrl(msg.platform, msg.userLogin || msg.username, msg.avatarUrl);
  const animClass = getAnimClass();
  const fbAvatar  = fallbackAvatar(msg.username);

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
    ? `<div class="platform-badge"><img class="platform-icon" src="${getPlatformIcon(msg.platform)}" alt="${msg.platform}" /></div>`
    : '';
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
    return (cfg.chatSide === 'right' || cfg.scrollDir === 'horizontal')
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

  // Prune when over max
  const all = container.querySelectorAll('.message:not(.removing)');
  if (all.length > cfg.maxMsg) {
    const oldest = cfg.scrollDir === 'down' ? all[all.length - 1] : all[0];
    removeMsg(oldest);
  }

  // Auto-expire — 0 means forever, never set a timer
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
// THIRD-PARTY EMOTES — BTTV + FFZ
// Fetched once when the overlay loads using the Twitch
// channel name derived from the Streamer.bot connection.
// Falls back gracefully if the fetch fails.
// ═══════════════════════════════════════════════════
const thirdPartyEmotes = new Map(); // code → img URL

async function loadThirdPartyEmotes(channelLogin) {
  if (!channelLogin) return;
  try {
    // BTTV global emotes
    const bttvGlobal = await fetch('https://api.betterttv.net/3/cached/emotes/global')
      .then(r => r.json());
    for (const e of bttvGlobal) {
      thirdPartyEmotes.set(e.code, `https://cdn.betterttv.net/emote/${e.id}/1x`);
    }
  } catch (_) {}

  try {
    // BTTV channel emotes (needs channel ID — we resolve via Twitch name lookup)
    const bttvChan = await fetch(`https://api.betterttv.net/3/cached/users/twitch/${encodeURIComponent(channelLogin)}`)
      .then(r => r.json());
    const all = [...(bttvChan.channelEmotes || []), ...(bttvChan.sharedEmotes || [])];
    for (const e of all) {
      thirdPartyEmotes.set(e.code, `https://cdn.betterttv.net/emote/${e.id}/1x`);
    }
  } catch (_) {}

  try {
    // FFZ channel emotes
    const ffz = await fetch(`https://api.frankerfacez.com/v1/room/${encodeURIComponent(channelLogin)}`)
      .then(r => r.json());
    for (const set of Object.values(ffz.sets || {})) {
      for (const e of set.emoticons || []) {
        const url = e.urls?.['1'] || e.urls?.['2'];
        if (url) thirdPartyEmotes.set(e.name, url.startsWith('//') ? 'https:' + url : url);
      }
    }
  } catch (_) {}
}

// ── EMOTE PARSER — Twitch built-in + BTTV/FFZ word replacement ──
function parseEmotes(text, emotes) {
  // Step 1: replace Twitch emotes by index range
  let result = '';
  if (emotes?.length) {
    const chars  = [...text];
    const sorted = [...emotes].sort((a, b) => a.startIndex - b.startIndex);
    let cursor = 0;
    for (const em of sorted) {
      if (em.startIndex > cursor)
        result += escAndReplaceThirdParty(chars.slice(cursor, em.startIndex).join(''));
      const name = chars.slice(em.startIndex, em.endIndex + 1).join('');
      result += `<img class="emote" src="https://static-cdn.jtvnw.net/emoticons/v2/${em.id}/default/dark/1.0" alt="${esc(name)}" />`;
      cursor = em.endIndex + 1;
    }
    if (cursor < chars.length)
      result += escAndReplaceThirdParty(chars.slice(cursor).join(''));
  } else {
    result = escAndReplaceThirdParty(text);
  }
  return result;
}

// Replace BTTV/FFZ emote codes in a plain-text segment (word by word)
function escAndReplaceThirdParty(segment) {
  if (!thirdPartyEmotes.size) return esc(segment);
  return segment.split(' ').map(word => {
    const url = thirdPartyEmotes.get(word);
    if (url) return `<img class="emote" src="${url}" alt="${esc(word)}" title="${esc(word)}" />`;
    return esc(word);
  }).join(' ');
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
      if (prog >= 1500) {
        prog -= 1500;
        level++;
        if (level > 5) { clearInterval(iv); onHypeEnd({ level: 5, total: 1500 }); return; }
      }
      _updateHype(level, prog, 1500);
    }, 250);
  }
  if (cmd === 'testEvent') {
    const type = e.data.type || 'sub';
    const demos = {
      sub:       () => onSub({ user:{ displayName:'TestViewer', login:'testviewer' }, subTier:'1000', message:{ message:'Test sub message!' }}),
      cheer:     () => onCheer({ user:{ displayName:'TestCheer', login:'testcheer' }, bits:500, message:{ message:'Test cheer!' }}),
      raid:      () => onRaid({ user:{ displayName:'TestRaider', login:'testraider' }, viewerCount:42 }),
      follow:    () => onFollow({ user:{ displayName:'TestFollower', login:'testfollower' }}),
      bitscombo: () => onCheerCombo({ total:1250, count:7 }),
    };
    demos[type]?.();
  }
});
// ═══════════════════════════════════════════════════
const DEMO_QUEUE = [
  () => onTwitchChat({ user:{ displayName:'StreamFan99', login:'streamfan99', profileImageUrl:'' }, message:{ message:'POGGERS this overlay is so cute!! 🎮', emotes:[], isSubscribed:true, color:'#FF4D4D' }}),
  () => onYouTubeChat({ user:{ displayName:'YouTubeLurker', login:'youtubelurker', profileImageUrl:'' }, message:{ message:'Hello from YouTube! Love the stream ❤️', isMember:true }}),
  () => onTwitchChat({ user:{ displayName:'ModeratorPro', login:'moderatorpro', profileImageUrl:'' }, message:{ message:"Pog let's gooooo!!!", emotes:[], isModerator:true, color:'#5CB85C' }}),
  () => onSub({ user:{ displayName:'HypeNewSub', login:'hypesub', profileImageUrl:'' }, subTier:'1000', isPrime:false, message:{ message:'Finally subscribed!' }}),
  () => onTwitchChat({ user:{ displayName:'FirstTimer99', login:'firsttimer99', profileImageUrl:'' }, message:{ message:'This is my first time chatting!', emotes:[], isFirstMessage:true, color:'#9146FF' }}),
  () => onCheer({ user:{ displayName:'BitsDono', login:'bitsdono', profileImageUrl:'' }, bits:500, message:{ message:'Keep it up!! 🎉' }}),
  () => onSuperChat({ user:{ displayName:'YTSupporter', login:'ytsupporter', profileImageUrl:'' }, formattedAmount:'$10.00', message:{ message:'Amazing stream!' }, color:'#1DE9B6' }),
  () => onRaid({ user:{ displayName:'FriendlyRaider', login:'friendlyraider', profileImageUrl:'' }, viewerCount:84 }),
  () => onGiftSub({ user:{ displayName:'GenerousGifter', login:'generousgifter', profileImageUrl:'' }, subTier:'1000', recipient:{ displayName:'LuckyViewer', login:'luckyviewer' }}),
  () => onReSub({ user:{ displayName:'LoyalFan', login:'loyalfan', profileImageUrl:'' }, subTier:'1000', cumulativeMonths:6, message:{ message:"Six months! LUL" }}),
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
