import assert from 'node:assert/strict';
import {request} from 'node:http';
import {requireLoopback} from '../application/safety.mjs';
// Node fetch ignores a supplied Host header; use HTTP transport for virtual-host verification.
export function readHost(origin,host){
 requireLoopback(origin);assert.ok(['127.0.0.1','localhost'].includes(host));
 return new Promise((resolve,reject)=>{const req=request(origin+'/',{headers:{host},timeout:15000},res=>{let text='';res.setEncoding('utf8');res.on('data',x=>text+=x);res.on('end',()=>resolve({status:res.statusCode,text}));});req.on('error',reject);req.on('timeout',()=>req.destroy(Error('Virtual-host read timeout')));req.end();});
}
