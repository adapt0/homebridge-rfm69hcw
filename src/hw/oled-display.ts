/////////////////////////////////////////////////////////////////////////////
/** @file
Adafruit RFM69HCW Radio Bonnet OLED display

\copyright Copyright (c) 2022 Chris Byrne. All rights reserved.
Licensed under the MIT License. Refer to LICENSE file in the project root. */
/////////////////////////////////////////////////////////////////////////////

import os from 'os';
import Pins from './pins';
import rpio from 'rpio';
import {display, Font, Color, Layer } from 'ssd1306-i2c-js';

export default class OledDisplay {
    private invert_ = false;

    async init() {
        rpio.write(Pins.OLED_RST, rpio.HIGH);
        rpio.usleep(100); // 100us
        rpio.write(Pins.OLED_RST, rpio.LOW);
        rpio.usleep(100); // 100us

        // 128 x 32
        display.init(1, 0x3C);      // Open bus and initialize driver
        display.setFont(Font.UbuntuMono_8ptFontInfo);

        display.turnOn();           // Turn on display module
        display.clearScreen();      // Clear display buffer
        display.refresh();          // Write buffer in display registries

        //
        setInterval(() => this.drawDisplay_(), 120_000);
        this.drawDisplay_();
    }

    /**
     * Update display
     * @returns {void}
     */
    private drawDisplay_() {
        const ip4 = (() => {
            const nets = os.networkInterfaces();
            for (const ips of Object.values(nets)) {
                if (!ips) continue;
                for (const ip of ips) {
                    if (ip.internal && 'ipv4' === ip.family.toLowerCase()) {
                        return ip.address;
                    }
                }
            }
            return undefined;
        })();

        display.clearScreen();
        if (this.invert_) display.fillRect(0, 0, 128, 64, Color.White, Layer.Layer0);
        display.drawString(0,  4, os.hostname(), 2, Color.Inverse, Layer.Layer0);
        display.drawString(0, 40, ip4 ?? '-',    1, Color.Inverse, Layer.Layer0);
        display.refresh();

        this.invert_ = !this.invert_;
    }
}
