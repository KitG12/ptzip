import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';

const helper=readFileSync('public/downloads/ptzip-helper.cjs','utf8');
const start=helper.indexOf('function connectedNetworks(');
const end=helper.indexOf('let busy = false;',start);
const connected=runInNewContext(`${helper.slice(start,end)}; connectedNetworks`, {ipOK: (ip:string)=>/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(ip)}) as (interfaces:Record<string,object[]>) => {name:string;target:string;limited:boolean;address:string}[];
describe('Automatic local networks',()=>{
 it('keeps both physical connections when they share an address range',()=>{
  const networks=connected({en7:[{family:'IPv4',address:'192.168.1.20',cidr:'192.168.1.20/24',internal:false}],en8:[{family:'IPv4',address:'192.168.1.21',cidr:'192.168.1.21/24',internal:false}]});
  expect(networks.map(n=>n.address)).toEqual(['192.168.1.20','192.168.1.21']);
 });
 it('targets every connected private IPv4 interface, not a hardcoded subnet',()=>{
  const networks=connected({Ethernet:[{family:'IPv4',address:'192.168.7.20',cidr:'192.168.7.20/24',internal:false}],WiFi:[{family:'IPv4',address:'10.20.3.10',cidr:'10.20.3.10/24',internal:false}]});
  expect(networks.map(n=>n.target)).toEqual(['192.168.7.0/24','10.20.3.0/24']);
 });
 it('ignores loopback, IPv6 and public interfaces',()=>{
  expect(connected({lo:[{family:'IPv4',address:'127.0.0.1',internal:true}],wan:[{family:'IPv4',address:'8.8.8.8',internal:false}],ipv6:[{family:'IPv6',address:'::1',internal:false}]})).toHaveLength(0);
 });
 it('bounds large networks to the local /24 and reports the limit',()=>{
  const networks=connected({LAN:[{family:'IPv4',address:'10.20.3.10',cidr:'10.20.3.10/16',internal:false}]});
  expect(networks[0]?.target).toBe('10.20.3.0/24');expect(networks[0]?.limited).toBe(true);
 });
 it('keeps legacy and branded helper downloads identical',()=>{expect(readFileSync('public/downloads/camera-finder-helper.cjs','utf8')).toBe(helper);});
});