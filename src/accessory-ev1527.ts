/////////////////////////////////////////////////////////////////////////////
/** @file
EV1527 accessory

\copyright Copyright (c) 2022 Chris Byrne. All rights reserved.
Licensed under the MIT License. Refer to LICENSE file in the project root. */
/////////////////////////////////////////////////////////////////////////////

import {
    AccessoryConfig,
    HAP,
    Logging,
    Service
} from 'homebridge';
import AccessoryBase from './accessory-base';
import { DeviceType } from './controller';

export default class AccessoryEv1527 extends AccessoryBase {
    private readonly switchOpenService: Service;
    private readonly switchCloseService: Service;

    get deviceType() { return DeviceType.EV1527; }

    constructor(hap: HAP, log: Logging, config: AccessoryConfig) {
        super(hap, log, config.name);

        // separate open/close switches, which reference the same UUID so they can't run at the same time
        const code = parseInt(config.code, 16);
        let times = parseInt(config.times, 10);
        if (!isFinite(times) || times <= 0) times = 40;
        this.switchOpenService  = this.createSwitchService_('Open',  (code << 4) | 0x1, times, true);
        this.switchCloseService = this.createSwitchService_('Close', (code << 4) | 0x2, times, true);
    }

    get services(): Service[] {
        return [ this.switchOpenService, this.switchCloseService ];
    }
}
