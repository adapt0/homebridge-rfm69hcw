/////////////////////////////////////////////////////////////////////////////
/** @file
Wireless light strip (unknown manufacturer)

\copyright Copyright (c) 2022 Chris Byrne. All rights reserved.
Licensed under the MIT License. Refer to LICENSE file in the project root. */
/////////////////////////////////////////////////////////////////////////////

import Rfm69, { Mode as Rfm69Mode, Modulation as Rfm69Modulation } from '../hw/rfm69';

export default class LightStrip {
    private readonly PAYLOAD_LENGTH = 13;

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
            bitRate: 3700, // bps
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
            Buffer.from([ 0x80, 0x00 ]), // sync word
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

                console.log(Buffer.from(payload).toString('hex'));

                //
                let val = 0;
                for (const p of payload) {
                    const hi = (p >> 4);
                    const lo = (p & 0x0F);
                    if ((hi != 0x4 && hi != 0x7) || (lo != 0 && lo != 0x4 && lo != 0x7)) {
                        // bad decode (expected 0100 and 0111 only)
                        payload = [];
                        break;
                    }

                    val = (val << 1) | ((0x07 == hi) ? 1 : 0);
                    if (lo > 0) val = (val << 1) | ((0x07 == lo) ? 1 : 0);
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
    async transmit(rfm69: Rfm69, code: number, state?: boolean): Promise<void> {
        await this.setRfm69Config_(rfm69);

        // upper nibble controls on/off
        let value = (code & ~0xF00000);
        if (null != state) value |= (((state) ? 0x4 : 0xA) << 20);
        // console.log(Date.now(), code.toString(16));

        // we are oversampling, so a nibble per received bit
        const toSend = new Array<number>();
        for (let i = 24; i >= 0; i -= 2) {
            toSend.push(
                   ((value & (1 << (i - 0))) ? 0x70 : 0x40)
                 | ((value & (1 << (i - 1))) ? 0x07 : 0x04)
            );
        }
        // trailing couple of nibbles
        toSend[toSend.length - 1] &= 0xF0;
        toSend.push(0x00);

        //
        const preamble = Buffer.from([ 0x00, 0x00, 0x00, 0x00, 0x00,  0x80, 0x00 ]);
        await rfm69.transmit(preamble, Buffer.from(toSend));
        await rfm69.transmit(preamble, Buffer.from(toSend));
        await rfm69.transmit(preamble, Buffer.from(toSend));
    }
}
