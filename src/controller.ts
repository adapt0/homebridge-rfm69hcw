/////////////////////////////////////////////////////////////////////////////
/** @file
Main controller

Intended to be a singleton instance to proxy access to the underlying hardware

\copyright Copyright (c) 2022 Chris Byrne. All rights reserved.
Licensed under the MIT License. Refer to LICENSE file in the project root. */
/////////////////////////////////////////////////////////////////////////////

import Ev1527 from './devices/ev1527';
import LightStrip from './devices/light-strip';
import OledDisplay from './hw/oled-display';
import Pins from './hw/pins';
import Rfm69, { Mode as Rfm69Mode } from './hw/rfm69';
import rpio from 'rpio';

export enum DeviceType {
    UNKNOWN,
    EV1527,
    LIGHTSTRIP, // no idea what chip, they sanded the identifiers off :(
}

interface IToTransmit {
    deviceType: DeviceType;
    code: number;
    state?: boolean;
    times: number;
    onDone?: () => void;
}

type LogFunc = (msg: string) => void;

/**
 * Hardware controller
 */
export default class Controller {
    private ev1527_ = new Ev1527();
    private lightStrip_ = new LightStrip();
    private log_: LogFunc;
    private oled_ = new OledDisplay();
    private rfm69_ = new Rfm69();
    private timer_?: NodeJS.Timer;
    private toTransmit_: { [id: string]: IToTransmit } = { };

    constructor(log?: LogFunc) {
        // eslint-disable-next-line no-console
        this.log_ = log ?? console.log;
    }

    /**
     * initialize controller
     * @returns {void}
     */
    async init() {
        rpio.open(Pins.OLED_RST,  rpio.OUTPUT);
        rpio.open(Pins.BUTTON_1,  rpio.INPUT);
        rpio.open(Pins.BUTTON_2,  rpio.INPUT);
        rpio.open(Pins.BUTTON_3,  rpio.INPUT);

        await this.rfm69_.init();
        await this.rfm69_.setHighPower();
        await this.rfm69_.setMode(Rfm69Mode.SLEEP);

        await this.oled_.init();
    }

    /**
     * schedule transmission of a code
     * @param id UUID for this transmission (only one transmission matching this id at a time, regardless of code)
     * @param deviceType type of device to transmit for
     * @param code code to transmit
     * @param state (optional) on/off state
     * @param times how many times should we transmit code
     * @param onDone (optional) callback when repeated transmission has been completed
     * @returns {void}
     */
    beginTransmitting(id: string, deviceType: DeviceType, code: number, state: boolean | undefined, times = 40, onDone?: () => void): void {
        this.stopTransmitting(id);
        this.toTransmit_[id] = { deviceType, code, times, state, onDone };

        // begin transmitting if we aren't already running
        if (null == this.timer_) this.pollTransmit_();
    }

    /**
     * stop a scheduled transmission
     * @param id UUID associated with transmission
     */
    stopTransmitting(id: string): void {
        const entry = this.toTransmit_[id];
        if (entry) {
            delete this.toTransmit_[id];
            if (entry.onDone) entry.onDone();
        }
    }

    /**
     * our transmission polling loop
     * @returns {void}
     */
    private pollTransmit_() {
        this.timer_ = setTimeout(async () => {
            const toTransmitEntries = Object.entries(this.toTransmit_);
            if (toTransmitEntries.length <= 0) {
                // nothing to do, so can sleep
                await this.rfm69_.setMode(Rfm69Mode.SLEEP);
                this.timer_ = undefined;
                return;
            }

            //
            for (const [id, entry] of toTransmitEntries) {
                if (isFinite(entry.code) && entry.code >= 0x10) {
                    // console.log('TX', entry.code.toString(16), entry.state);
                    try {
                        if (DeviceType.EV1527 === entry.deviceType) {
                            await this.ev1527_.transmit(this.rfm69_, entry.code);
                        } else if (DeviceType.LIGHTSTRIP === entry.deviceType) {
                            await this.lightStrip_.transmit(this.rfm69_, entry.code, entry.state);
                        } else {
                            this.log_(`Unknown device type ${entry.deviceType}`);
                        }
                    } catch (e) {
                        // eslint-disable-next-line no-console
                        console.error(e);
                    }
                }

                if (--entry.times <= 0) {
                    delete this.toTransmit_[id];
                    if (entry.onDone) entry.onDone();
                }
            }

            // schedule next transmit poll cycle
            this.pollTransmit_();
        }, 100);
    }
}
