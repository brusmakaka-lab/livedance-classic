import { createHash } from 'node:crypto';
const hash = (s) => createHash('sha256').update(String(s)).digest('hex').slice(0, 40);
const text = (s, n) => String(s ?? '').replace(/[<>\x00-\x1f\x7f]/g, '').trim().slice(0, n);
const id = (v) => typeof v === 'string' && /^[1-9]\d{0,29}$/.test(v);
/** SDK 2.5 / protobuf v3. Reject missing stable IDs instead of guessing from nicknames. */
export function normalizeTikTok(kind, raw, roomId, now = Date.now()) {
  const eventType = { member: 'VIEWER_JOIN', join: 'VIEWER_JOIN', chat: 'COMMENT', follow: 'FOLLOW', like: 'LIKE_MILESTONE', gift: 'GIFT' }[kind];
  if (!eventType) throw Error('unsupported_kind');
  // Numeric account IDs only: never infer identity from display names or room totals.
  if (!id(raw?.user?.id)) throw Error('missing_user_id');
  if (!id(roomId) || !id(raw?.common?.msgId)) throw Error('missing_stable_ids');
  if (raw.common.roomId && raw.common.roomId !== '0' && raw.common.roomId !== roomId) throw Error('wrong_room');
  const event = {
    schemaVersion: 1, source: 'tiktok', sessionId: 'tt.' + roomId,
    eventId: hash(`${roomId}:${eventType}:${raw.common.msgId}:${kind === 'gift' ? raw.repeatCount : ''}`),
    viewerId: 'tt:' + raw.user.id, username: text(raw.user.nickname, 24) || 'Viewer ' + raw.user.id.slice(-6),
    eventType,
    giftCount: 1, timestamp: now, metadata: {},
  };
  const packet = { event, sessionId: event.sessionId };
  // Optional display metadata; identity depends only on the numeric account ID.
  event.avatarUrl = (Array.isArray(raw.user.avatarThumb?.urlList) ? raw.user.avatarThumb.urlList : []).find(value => {
    if(typeof value !== 'string' || value.length > 2048)return false;
    try {const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&!u.hash&&['tiktokcdn.com','tiktokcdn-us.com','tiktokcdn-eu.com','byteoversea.com','ibytedtos.com'].some(h=>u.hostname===h||u.hostname.endsWith('.'+h));}catch{return false;}
  });
  if (kind === 'like') {
    if (!Number.isSafeInteger(raw.count) || raw.count < 1 || raw.count > 100000) throw Error('invalid_like_count');
    event.metadata.likeCount = raw.count;
  }
  if (kind === 'gift') {
    if (!id(raw.giftId) || !Number.isSafeInteger(raw.repeatCount) || raw.repeatCount < 1 || raw.repeatCount > 1000) throw Error('invalid_gift');
    event.giftId = raw.giftId;
    event.giftName = text(raw.gift?.name, 40) || 'Regalo ' + raw.giftId;
    event.giftCount = raw.repeatCount;
    const unit = raw.gift?.diamondCount;
    if (Number.isSafeInteger(unit) && unit >= 0 && unit <= 1000000) {
      event.metadata.unitCoins = unit;
      event.coins = unit * event.giftCount;
      // Local MVP policy, not a TikTok gift classification. Missing value stays LOW.
      event.metadata.tier = unit >= 1000 ? 'HIGH' : unit >= 100 ? 'NORMAL' : 'LOW';
    }
    if (id(raw.groupId)) packet.streak = { id: hash(raw.groupId), total: raw.repeatCount };
    else if (raw.gift?.type === 1 || raw.gift?.combo || raw.repeatEnd === 0) throw Error('missing_streak_id');
  }
  return packet;
}
