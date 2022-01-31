/////////////////////////////////////////////////////////////////////////////
/** @file
Roof control

\copyright Copyright (c) 2022 Chris Byrne. All rights reserved.
Licensed under the MIT License. Refer to LICENSE file in the project root. */
/////////////////////////////////////////////////////////////////////////////

import Ev1527 from './ev1527';
import Oled from './oled';
import Pins from './pins';
import rpio from 'rpio';

interface IToTransmit {
    code: number;
    times:  number;
    onDone: () => void;
}

type LogFunc = (msg: string) => void;

export default class RoofControl {
    private ev1527_ = new Ev1527();
    private log_: LogFunc;
    private oled_ = new Oled();
    private timer_?: NodeJS.Timer;
    private toTransmit_: { [id: string]: IToTransmit } = { };

    constructor(log?: LogFunc) {
        this.log_ = log ?? console.log;
    }

    async init() {
        rpio.open(Pins.OLED_RST,  rpio.OUTPUT);
        rpio.open(Pins.RFM69_RST, rpio.OUTPUT);
        rpio.open(Pins.BUTTON_1,  rpio.INPUT);
        rpio.open(Pins.BUTTON_2,  rpio.INPUT);
        rpio.open(Pins.BUTTON_3,  rpio.INPUT);
        rpio.open(Pins.CS,        rpio.OUTPUT);

        await this.ev1527_.init();
        await this.oled_.init();

        await this.begin_();
    }

    setTransmitting(id: string, code: number, state = true, onDone: () => void): void {
        const entry = this.toTransmit_[id];
        if (entry) {
            delete this.toTransmit_[id];
            entry.onDone();
        }

        if (state) {
            this.toTransmit_[id] = { code, times: 40, onDone };
        }
    }

    private begin_() {
        this.timer_ = setTimeout(async () => {
            const toTransmitEntries = Object.entries(this.toTransmit_);
            if (toTransmitEntries.length > 0) {
                for (const [id, entry] of toTransmitEntries) {
                    if (0 === entry.times) continue;

                    if (isFinite(entry.code) && entry.code >= 0x10) {
                        // console.log('TX', entry.code.toString(16));
                        try {
                            // need to send twice for transmission to be picked up when multiple are being sent
                            await this.ev1527_.transmit(entry.code);
                            await this.ev1527_.transmit(entry.code);
                        } catch (e) {
                            console.error(e);
                        }
                    }

                    if (0 === --entry.times) {
                        delete this.toTransmit_[id];
                        entry.onDone();
                    }
                }

            } else {
                const code = await this.ev1527_.receive();
                if (code) this.log_(`Received code: ${(code >> 4).toString(16)}`);
            }

            this.begin_();
        }, 100);
    }
}
