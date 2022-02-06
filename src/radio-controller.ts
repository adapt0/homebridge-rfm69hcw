/////////////////////////////////////////////////////////////////////////////
/** @file
Radio controller

\copyright Copyright (c) 2022 Chris Byrne. All rights reserved.
Licensed under the MIT License. Refer to LICENSE file in the project root. */
/////////////////////////////////////////////////////////////////////////////

import Ev1527 from './ev1527';
import LightStrip from './light-strip';
import Oled from './oled';
import Pins from './pins';
import Rfm69, { Mode as Rfm69Mode } from './rfm69';
import rpio from 'rpio';

export enum RadioDevice {
    UNKNOWN,
    EV1527,
    LIGHTSTRIP, // no idea what chip, they sanded the identifiers off :(
}

interface IToTransmit {
    deviceType: RadioDevice;
    code: number;
    state?: boolean;
    times: number;
    onDone?: () => void;
}

type LogFunc = (msg: string) => void;

export default class RadioController {
    private ev1527_ = new Ev1527();
    private lightStrip_ = new LightStrip();
    private log_: LogFunc;
    private oled_ = new Oled();
    private rfm69_ = new Rfm69();
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

        await this.rfm69_.init();
        await this.rfm69_.setHighPower();
        await this.rfm69_.setMode(Rfm69Mode.SLEEP);

        await this.oled_.init();

        await this.begin_();
    }

    setTransmitting(id: string, deviceType: RadioDevice, code: number, state: boolean | undefined, times = 40, onDone?: () => void): void {
        this.stopTransmitting(id);
        this.toTransmit_[id] = { deviceType, code, times, state, onDone };
    }
    stopTransmitting(id: string): void {
        const entry = this.toTransmit_[id];
        if (entry) {
            delete this.toTransmit_[id];
            if (entry.onDone) entry.onDone();
        }
    }

    private begin_() {
        this.timer_ = setTimeout(async () => {
            const toTransmitEntries = Object.entries(this.toTransmit_);
            if (toTransmitEntries.length > 0) {
                for (const [id, entry] of toTransmitEntries) {
                    if (isFinite(entry.code) && entry.code >= 0x10) {
                        // console.log('TX', entry.code.toString(16), entry.state);
                        try {
                            if (RadioDevice.EV1527 == entry.deviceType) {
                                // need to send twice for transmission to be picked up when multiple are being sent
                                await this.ev1527_.transmit(this.rfm69_, entry.code);
                                await this.ev1527_.transmit(this.rfm69_, entry.code);
                            } else if (RadioDevice.LIGHTSTRIP == entry.deviceType) {
                                await this.lightStrip_.transmit(this.rfm69_, entry.code, entry.state);
                            } else {
                                this.log_(`Unknown device type ${entry.deviceType}`);
                            }
                        } catch (e) {
                            console.error(e);
                        }
                    }

                    if (--entry.times <= 0) {
                        delete this.toTransmit_[id];
                        if (entry.onDone) entry.onDone();
                    }
                }
            } else {
                // nothing to do, so can sleep
                this.rfm69_.setMode(Rfm69Mode.SLEEP);
            }

            this.begin_();
        }, 100);
    }
}
