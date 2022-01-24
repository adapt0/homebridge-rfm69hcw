/////////////////////////////////////////////////////////////////////////////
/** @file
Roof control plugin

\copyright Copyright (c) 2022 Chris Byrne. All rights reserved.
Licensed under the MIT License. Refer to LICENSE file in the project root. */
/////////////////////////////////////////////////////////////////////////////

import Ev1527 from './ev1527';
import Pins from './pins';
import rpio from 'rpio';

(async () => {

try {
    rpio.open(Pins.RFM69_RST, rpio.OUTPUT);
    rpio.open(Pins.BUTTON_1,  rpio.INPUT);
    rpio.open(Pins.BUTTON_2,  rpio.INPUT);
    rpio.open(Pins.BUTTON_3,  rpio.INPUT);
    rpio.open(Pins.CS,        rpio.OUTPUT);

    //
    const ev1527 = new Ev1527();
    await ev1527.init();

    // await ev1527.transmit(0x1234);

    for (;;) {
        const code = await ev1527.receive();
        if (code) console.log(code.toString(16));
    }

} catch (e) {
    console.error(e);
}

})();
