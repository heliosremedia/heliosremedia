export const DATABASE = 'postgresql://helios_rehearsal:synthetic_only@127.0.0.1:55439/helios_packet19';
export function requireDatabase(value) {
  if (value !== DATABASE) throw new Error('Only the fixed disposable Packet 19 database is permitted');
  return value;
}
export function requireOrigin(value) {
  const url = new URL(value);
  if (url.protocol !== 'http:' || url.hostname !== '127.0.0.1' || !url.port || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
    throw new Error('Only an explicit loopback application port is permitted');
  }
  return url.origin;
}
