/////////////////////////////////////////////////////////////////////////////
/** @file
Standalone development

\copyright Copyright (c) 2022 Chris Byrne. All rights reserved.
Licensed under the MIT License. Refer to LICENSE file in the project root. */
/////////////////////////////////////////////////////////////////////////////

import readline from 'readline';
import Rfm69 from '@/hw/rfm69';
import { DeviceType } from '@/controller';
import Ev1527 from '@/devices/ev1527';

(async () => {
    const rfm69 = new Rfm69();
    await rfm69.init();

    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

    for (;;) {
        for (const [k, dt] of Object.entries(DeviceType)) {
            if (DeviceType.UNKNOWN !== dt && !isFinite(parseInt(k, 10))) {
                console.log(dt, k);
            }
        }

        let deviceType: DeviceType | undefined = DeviceType.UNKNOWN;
        for (;;) {
            const answer: string = await new Promise((resolve) => rl.question('Device type? ', resolve));
            deviceType = parseInt(answer, 10) as DeviceType;
            if (null != DeviceType[deviceType]) break;
        }

        //
        switch (deviceType) {
        case DeviceType.EV1527:
        {
            const ev1527 = new Ev1527();
            await ev1527.debugReceivePackets(rfm69);
            break;
        }
        default:
            break;
        }
    }

})().catch((e) => console.error(e));
