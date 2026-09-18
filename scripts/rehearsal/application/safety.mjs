export const DATABASE='postgresql://helios_rehearsal:synthetic_only@127.0.0.1:55439/helios_packet9';
export const PRIOR='63df1f7ba403144c9858136674b11cad8d3231f0';
export const CANDIDATE='ad165992518283ff72a4d3c4e2e8f888adcacbcb';
export function requireIsolatedDatabase(value){if(value!==DATABASE)throw Error('Only the fixed disposable Packet 9 database is permitted');return value;}
export function requireLoopback(value){const u=new URL(value);if(u.protocol!=='http:'||u.hostname!=='127.0.0.1'||u.username||u.password||u.pathname!=='/'||u.search||u.hash)throw Error('Only loopback application origins are permitted');return u.origin;}
