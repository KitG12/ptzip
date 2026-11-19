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
