/////////////////////////////////////////////////////////////////////////////
/** @file
EV1527 wireless RFM69 communications

\copyright Copyright (c) 2022 Chris Byrne. All rights reserved.
Licensed under the MIT License. Refer to LICENSE file in the project root. */
/////////////////////////////////////////////////////////////////////////////

import Rfm69, { Mode as Rfm69Mode, Modulation as Rfm69Modulation } from './rfm69';

export default class Ev1527 {
    private highPower_ = false;
    private payload_ = new Array<number>();
    private payloadLast_?: bigint;
    private rfm69_: Rfm69;
    private readonly PAYLOAD_LENGTH = 12; // 24 bits * (4 received bits per bit)

    constructor() {
        this.rfm69_ = new Rfm69();
    }
    
    async init() {
        await this.rfm69_.init();

        await this.rfm69_.setConfig({
            freqHz:  433920000, // Hz
            freqDev: 50000, // Hz
            bitRate: 2800, // bps
            modulation: Rfm69Modulation.MODE_PACKET | Rfm69Modulation.MODULATION_OOK | Rfm69Modulation.SHAPE_NONE
        });

        await this.beginRx_();

        // await this.rfm69_.dumpRegs();
    }

    private async beginRx_() {
        await this.rfm69_.setPacketConfig({
            packetConfig:	0x00, // fixed length, no decoding, no crc, no addressing);
            preambleSize:	0, // no preamble
            syncWord:		Buffer.from([ 0x80, 0x00, 0x00, 0x00 ]),
            payloadLength:	this.PAYLOAD_LENGTH,
        });

        await this.rfm69_.setMode(Rfm69Mode.RX);
    }

    async receive(): Promise<number | undefined> {
        const now = process.hrtime.bigint();
        if (null != this.payloadLast_ && (now - this.payloadLast_) > 10000000000) {
            this.payloadLast_ = undefined;
            this.payload_ = []; // time out
        }

        while (await this.rfm69_.available()) {
            if (this.payload_.length < this.PAYLOAD_LENGTH) {
                this.payload_.push(await this.rfm69_.read());
                this.payloadLast_ = now;
            }
            if (this.payload_.length !== this.PAYLOAD_LENGTH) continue;

            //
            let val = 0;
            for (const p of this.payload_) {
                const hi = (p >> 4);
                const lo = (p & 0x0F);
                if ((hi != 0x8 && hi != 0xE) || (lo != 0x8 && lo != 0xE)) {
                    // bad decode (expected 1110 and 1000 only)
                    this.payload_ = [];
                    return undefined;
                }
    
                val = (val << 1) | ((0x0E == hi) ? 1 : 0);
                val = (val << 1) | ((0x0E == lo) ? 1 : 0);
            }
    
            // there's a trailing bit here that we are ignoring
    
            //
            console.log(`PACKET: ${this.payload_} -> ${val.toString(16)}`);
            this.payload_ = [];

            return val;
        }
    }

    async transmit(data: number): Promise<void> {
        if (!this.highPower_) {
            this.highPower_ = true;
            await this.rfm69_.setHighPower();
        }
        await this.rfm69_.setPacketConfig({
            packetConfig:	0x00, // fixed length, no decoding, no crc, no addressing);
            preambleSize:	0, // no preamble
            syncWord:		undefined,
            payloadLength:	0,
        });

        // const toSend = Buffer.alloc(this.PAYLOAD_LENGTH + 1);
        // let toSendIdx = 0;
        // uint8_t* p = toSend;
        const toSend = new Array<number>();
        for (let i = 24; i > 0; i -= 2) {
            toSend.push(
                  ((data & (1 << (i - 1))) ? 0xE0 : 0x80)
                | ((data & (1 << (i - 2))) ? 0x0E : 0x08)
            );
        }
        // trailing bit
        toSend.push(0x80);

        //
        const preamble = Buffer.from([ 0x80, 0x00, 0x00, 0x00 ]);
        await this.rfm69_.transmit(preamble, Buffer.from(toSend));

        // reconfigure RX
        await this.beginRx_();
    }
}
