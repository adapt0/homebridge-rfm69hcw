/////////////////////////////////////////////////////////////////////////////
/** @file
RFM69HCW control plugin

\copyright Copyright (c) 2022 Chris Byrne. All rights reserved.
Licensed under the MIT License. Refer to LICENSE file in the project root. */
/////////////////////////////////////////////////////////////////////////////

import {
    AccessoryConfig,
    AccessoryPlugin,
    API,
    HAP,
    Logging,
    Service
} from 'homebridge';
import AccessoryBase, { getController } from './accessory-base';
import AccessoryEv1527 from './accessory-ev1527';
import AccessoryLightStrip from './accessory-lightstrip';

let hap: HAP;

/*
 * Initializer function called when the plugin is loaded.
 */
export = (api: API) => {
    hap = api.hap;
    api.registerAccessory("rfm69hcw", Rfm69hcwPlugin);
};

/**
 * RFM69HCW main plugin
 */
class Rfm69hcwPlugin implements AccessoryPlugin {
    private accessory_?: AccessoryBase;

    constructor(log: Logging, config: AccessoryConfig/*, api: API */) {
        // initialize singleton
        getController(log);

        //
        switch (String(config.deviceType).toLowerCase()) {
        case 'ev1527':
            this.accessory_ = new AccessoryEv1527(hap, log, config);
            break;
        case 'lightstrip':
            this.accessory_ = new AccessoryLightStrip(hap, log, config);
            break;
        default:
            log(`Unknown device type: ${config.deviceType}`);
        }
    }

    getServices(): Service[] {
        return this.accessory_?.services ?? [];
    }
}
