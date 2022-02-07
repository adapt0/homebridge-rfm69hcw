/////////////////////////////////////////////////////////////////////////////
/** @file
EV1527 wireless RFM69 communications

EV1527 frame consists of:
 [preamble][C0-C19][D0-D3]
 preamble is a 32bit fixed value of 0x8000000
 C0-C19 is a fixed 20bit pre-programmed code
 D0-D3 are 4 variable bits which depend on remote button being pressed

\copyright Copyright (c) 2022 Chris Byrne. All rights reserved.
Licensed under the MIT License. Refer to LICENSE file in the project root. */
/////////////////////////////////////////////////////////////////////////////

import Rfm69, { Mode as Rfm69Mode, Modulation as Rfm69Modulation } from '../hw/rfm69';

export default class Ev1527 {
    private readonly PAYLOAD_LENGTH = 12; // 24 bits * (4 received bits per bit)

    /**
     * concigure RFM69HCW for communicate with an EV1527 OOK at 433Mhz
     * @param rfm69 initialized RFM69HCW instance
     * @param syncWord (optional) synchronization word (used by rx, set to undefined for tx)
     * @param payloadLength (optional) payload length (used by rx, set to 0 for tx)
     * @returns {void}
     */
    private async setRfm69Config_(rfm69: Rfm69, syncWord?: Buffer, payloadLength = 0) {
        await rfm69.setConfig({
            freqHz:  433920000, // Hz
            freqDev: 50000, // Hz
            bitRate: 2700, // bps
            modulation: Rfm69Modulation.MODE_PACKET | Rfm69Modulation.MODULATION_OOK | Rfm69Modulation.SHAPE_NONE
        });
        await rfm69.setPacketConfig({
            packetConfig:	0x00, // fixed length, no decoding, no crc, no addressing);
            preambleSize:	0, // no preamble
            syncWord,
            payloadLength,
        });
    }

    /**
     * (debug) dedicated rx packet receive
     * for finding codes
     * @param rfm69 intialized RFM69 instance
     * @returns {never}
     */
     async debugReceivePackets(rfm69: Rfm69) {
        await this.setRfm69Config_(
            rfm69,
            Buffer.from([ 0x80, 0x00, 0x00, 0x00 ]), // EV1527 32bit preamble
            this.PAYLOAD_LENGTH
        );

        await rfm69.setMode(Rfm69Mode.RX);

        //
        let payload = new Array<number>();
        let payloadLast: bigint | undefined;
        for (;;) {
            const now = process.hrtime.bigint();
            if (null != payloadLast && (now - payloadLast) > 10000000000) {
                payloadLast = undefined;
                payload = []; // time out
            }

            while (await rfm69.available()) {
                if (payload.length < this.PAYLOAD_LENGTH) {
                    const b = await rfm69.read();
                    // console.log(b.toString(16));
                    if (0 === b && 0 == payload.length) continue;
                    payload.push(b);
                    payloadLast = now;
                }
                if (payload.length !== this.PAYLOAD_LENGTH) continue;

                //
                let val = 0;
                for (const p of payload) {
                    const hi = (p >> 4);
                    const lo = (p & 0x0F);
                    if ((hi != 0x8 && hi != 0xE) || (lo != 0x8 && lo != 0xE)) {
                        // bad decode (expected 1110 and 1000 only)
                        payload = [];
                        break;
                    }

                    val = (val << 1) | ((0x0E == hi) ? 1 : 0);
                    val = (val << 1) | ((0x0E == lo) ? 1 : 0);
                }

                if (payload.length) {
                    console.log(`PACKET: ${Buffer.from(payload).toString('hex')} -> ${val.toString(16)}`);
                    payload = [];
                }
            }
        }
    }

    /**
     * transmit data to RFM69HCW
     * @param rfm69 initialized RFM69HCW instance
     * @param code code to transmit
     * @returns {void}
     */
    async transmit(rfm69: Rfm69, code: number): Promise<void> {
        await this.setRfm69Config_(rfm69);

        // we are 4X oversampled with our packts
        // so one nibble = 1 bit
        // 1 - 0xE is 1110 (long pulse)
        // 0 - 0x8 is 1000 (short pulse)
        const toSend = new Array<number>();
        for (let i = 24; i > 0; i -= 2) {
            toSend.push(
                  ((code & (1 << (i - 1))) ? 0xE0 : 0x80)
                | ((code & (1 << (i - 2))) ? 0x0E : 0x08)
            );
        }
        // trailing bit
        toSend.push(0x80);

        // we have a preamble of a short pulse follow by nothing
        // which seems to help with more reliable transmissions
        const preamble = Buffer.from([ 0x80, 0x00, 0x00, 0x00 ]);
        await rfm69.transmit(preamble, Buffer.from(toSend));
    }
}
