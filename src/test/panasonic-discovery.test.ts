import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
const req = createRequire(import.meta.url);
const { panasonicRequest, parsePanasonic } = req('../../public/downloads/ptzip-helper.cjs');
const tlv = (id: number, bytes: number[]) => [id >> 8, id & 255, bytes.length >> 8, bytes.length & 255, ...bytes];
const text = (s: string, n: number) => [...Buffer.from(s.padEnd(n, '\0'), 'latin1')];
function announcement() {
  const head = [0,1,1,0x75,0,0x0e, 0x20,0xc6,0xeb,0xef,0x6d,0xca, ...Array(46).fill(0)];
  return Buffer.from([...head, ...tlv(0x20,[192,168,1,147]), ...tlv(0x21,[255,255,255,0]), ...tlv(0x22,[192,168,1,1]),
    ...tlv(0x23,[0,0,0,0,0,0,0,0]), ...tlv(0x25,[0,80]), ...tlv(0xa7,text('AW-UE70',16)), ...tlv(0xa8,text('CAM:UE70',16)), 0xff,0xff,0,0]);
}
describe('Panasonic EasyIP discovery', () => {
  it('builds the same request bytes EasyIP sends, including checksum', () => {
    const pkt = panasonicRequest([0x00,0x1c,0x42,0x4b,0xbb,0xf8], [10,1,0,53]);
    expect(pkt.toString('hex').toUpperCase()).toBe('0001002A000D000000000000001C424BBBF80A010035000020111E11231F1E1913000000010000000000000000000000FFF00026002000210022002300250028004000410042004400A500A600A700A800AD00B300B400B700B8FFFF0FCC');
  });
  it('reads a camera on another subnet with its MAC, IP, mask and gateway', () => {
    expect(parsePanasonic(announcement())).toMatchObject({ mac:'20:C6:EB:EF:6D:CA', ip:'192.168.1.147', cidr:24, gateway:'192.168.1.1', port:80, name:'AW-UE70', model:'AW-UE70' });
  });
  it('ignores unrelated packets', () => {
    expect(parsePanasonic(Buffer.from('hello world'))).toBeNull();
  });
});
const h = req('../../public/downloads/ptzip-helper.cjs');
describe('Sony and Bonjour discovery', () => {
  it('sends the Sony ENQ:network search', () => {
    expect(h.SONY_ENQ.toString('hex')).toBe('02454e513a6e6574776f726bff03');
  });
  it('reads a Sony camera reply including other-subnet address', () => {
    const r = Buffer.concat([Buffer.from([2]), Buffer.from('MAC:08-00-46-aa-bb-cc\xffMODEL:BRC-X400\xffSOFTVERSION:2.10\xffIPADR:192.168.0.100\xffMASK:255.255.255.0\xffGATEWAY:192.168.0.1\xffNAME:CAM2\xff', 'latin1'), Buffer.from([3])]);
    expect(h.parseSony(r)).toMatchObject({ brand:'Sony', model:'BRC-X400', ip:'192.168.0.100', cidr:24, gateway:'192.168.0.1', name:'CAM2', firmware:'2.10' });
  });
  it('identifies a Blackmagic camera from a Bonjour reply', () => {
    const name = (s: string) => Buffer.concat([...s.split('.').map(l => Buffer.concat([Buffer.from([l.length]), Buffer.from(l)])), Buffer.from([0])]);
    const ptrData = name('URSA Broadcast G2._blackmagic._tcp.local');
    const ans = Buffer.concat([name('_blackmagic._tcp.local'), Buffer.from([0,12,0,1,0,0,0,120,0,ptrData.length]), ptrData]);
    const a = Buffer.concat([name('ursa.local'), Buffer.from([0,1,0,1,0,0,0,120,0,4,192,168,10,50])]);
    const pkt = Buffer.concat([Buffer.from([0,0,0x84,0,0,0,0,2,0,0,0,0]), ans, a]);
    expect(h.parseMdns(pkt, '192.168.10.50')).toMatchObject({ brand:'Blackmagic', ip:'192.168.10.50', model:'URSA Broadcast G2' });
  });
});
import dgram from 'node:dgram';
describe('Cross-network Panasonic search', () => {
  it('finds a camera that answers by broadcast and reports a busy listening port', async () => {
    const cam = dgram.createSocket({ type: 'udp4', reuseAddr: true });
    cam.on('message', () => { cam.setBroadcast(true); cam.send(announcement(), 10669, '255.255.255.255'); });
    await new Promise<void>(r => cam.bind(10670, () => r()));
    const d = h.newDiag();
    const rows = await h.udpSearch({ listenPort: 10669, destPort: 10670, d, key: (c: {mac:string}) => c.mac, parse: (b: Buffer) => h.parsePanasonic(b), packet: (r: {address:string}) => h.panasonicRequest([0,0,0,0,0,0], r.address.split('.').map(Number)) });
    cam.close();
    expect(d.sent).toBeGreaterThan(0);
    expect(rows.map((c: {ip:string}) => c.ip)).toEqual(['192.168.1.147']);
  }, 10000);
});
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
const bin = '/tmp/ptzip-bcast-test';
let built = false;
try { execFileSync('cc', ['-O2', '-o', bin, 'electron/native/ptzip-bcast.c']); built = existsSync(bin); } catch { built = false; }
describe.skipIf(!built)('Adapter-pinned broadcast sender (desktop app)', () => {
  it('sends the search out each adapter and still hears the camera', async () => {
    const cam = dgram.createSocket({ type: 'udp4', reuseAddr: true });
    cam.on('message', () => { cam.setBroadcast(true); cam.send(announcement(), 10669, '255.255.255.255'); });
    await new Promise<void>(r => cam.bind(10670, () => r()));
    process.env.PTZIP_BCAST = bin;
    const d = h.newDiag();
    try {
      const rows = await h.udpSearch({ listenPort: 10669, destPort: 10670, d, key: (c: {mac:string}) => c.mac, parse: (b: Buffer) => h.parsePanasonic(b), packet: (r: {address:string}) => h.panasonicRequest([0,0,0,0,0,0], r.address.split('.').map(Number)) });
      expect(d.errors).toEqual([]);
      expect(d.pinned).toBe(d.adapters);
      expect(rows.map((c: {ip:string}) => c.ip)).toEqual(['192.168.1.147']);
    } finally { delete process.env.PTZIP_BCAST; cam.close(); }
  }, 10000);
});
