/////////////////////////////////////////////////////////////////////////////
/** @file
Wireless light strip (unknown manufacturer)

\copyright Copyright (c) 2022 Chris Byrne. All rights reserved.
Licensed under the MIT License. Refer to LICENSE file in the project root. */
/////////////////////////////////////////////////////////////////////////////

import Rfm69, { Modulation as Rfm69Modulation } from '@/hw/rfm69';

export default class LightStrip {
    private async setRfm69Config_(rfm69: Rfm69) {
        await rfm69.setConfig({
            freqHz:  433920000, // Hz
            freqDev: 50000, // Hz
            bitRate: 3700, // bps
            modulation: Rfm69Modulation.MODE_PACKET | Rfm69Modulation.MODULATION_OOK | Rfm69Modulation.SHAPE_NONE
        });
        await rfm69.setPacketConfig({
            packetConfig:	0x00, // fixed length, no decoding, no crc, no addressing);
            preambleSize:	0, // no preamble
            syncWord:		undefined,
            payloadLength:	0,
        });
    }

    async transmit(rfm69: Rfm69, data: number, state?: boolean): Promise<void> {
        await this.setRfm69Config_(rfm69);

        // upper nibble controls on/off
        let code = (data & ~0xF00000);
        if (null != state) code |= (((state) ? 0x4 : 0xA) << 20);
        // console.log(Date.now(), code.toString(16));

        // we are oversampling, so a nibble per received bit
        const toSend = new Array<number>();
        for (let i = 24; i >= 0; i -= 2) {
            toSend.push(
                   ((code & (1 << (i - 0))) ? 0x70 : 0x40)
                 | ((code & (1 << (i - 1))) ? 0x07 : 0x04)
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
