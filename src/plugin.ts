/////////////////////////////////////////////////////////////////////////////
/** @file
Roof control plugin

\copyright Copyright (c) 2022 Chris Byrne. All rights reserved.
Licensed under the MIT License. Refer to LICENSE file in the project root. */
/////////////////////////////////////////////////////////////////////////////

import {
    AccessoryConfig,
    AccessoryPlugin,
    API,
    CharacteristicEventTypes,
    CharacteristicGetCallback,
    CharacteristicSetCallback,
    CharacteristicValue,
    HAP,
    Logging,
    Service
} from 'homebridge';
import crypto from 'crypto';
import RoofControl from './roof-control';

let hap: HAP;
let roofControl: RoofControl | undefined;
let roofControlInited = false;

/*
 * Initializer function called when the plugin is loaded.
 */
export = (api: API) => {
    hap = api.hap;
    api.registerAccessory("RoofControl", RoofControlPlugin);
};

class RoofControlPlugin implements AccessoryPlugin {
    private readonly log: Logging;
    private readonly name: string;
    private readonly uuid: string;

    private readonly switchOpenService: Service;
    private readonly switchCloseService: Service;
    private readonly informationService: Service;

    constructor(log: Logging, config: AccessoryConfig, api: API) {
        this.log = log;
        this.name = config.name;
        this.uuid = crypto.randomBytes(12).toString('hex');

        // single instance of RoofControl
        if (null == roofControl) {
            roofControl = new RoofControl((msg) => log.info(msg));
            roofControl.init().then(() => {
                roofControlInited = true;
            }).catch((e) => {
                console.error(e);
            });
        }

        function createSwitchService(uuid: string, name: string, subtype: string, code: number, times: number) {
            const service = new hap.Service.Switch(`${subtype}`, subtype);
            let switchOn = false;
            service.getCharacteristic(hap.Characteristic.On)
                .on(CharacteristicEventTypes.GET, (callback: CharacteristicGetCallback) => {
                    callback(undefined, switchOn);
                })
                .on(CharacteristicEventTypes.SET, (value: CharacteristicValue, callback: CharacteristicSetCallback) => {
                    switchOn = value as boolean;
                    // log.info(`Switch ${name} ${subtype} state was set to: ` + (switchOn? "ON": "OFF"));

                    if (roofControl && roofControlInited) {
                        roofControl.setTransmitting(uuid, code, switchOn, times, () => {
                            switchOn = false;
                            service.setCharacteristic(hap.Characteristic.On, false);
                        });
                    }

                    callback();
                })
            ;
            return service;
        }

        // separate open/close switches, which reference the same UUID so they can't run at the same time
        const code = parseInt(config.code, 16);
        let times = parseInt(config.times, 10);
        if (!isFinite(times) || times <= 0) times = 40;
        this.switchOpenService  = createSwitchService(this.uuid, this.name, 'Open',  (code << 4) | 0x1, times);
        this.switchCloseService = createSwitchService(this.uuid, this.name, 'Close', (code << 4) | 0x2, times);

        this.informationService = new hap.Service.AccessoryInformation()
            .setCharacteristic(hap.Characteristic.Manufacturer, "Custom Manufacturer")
            .setCharacteristic(hap.Characteristic.Model, "Custom Model")
        ;
    }

    identify(): void {
        this.log("Identify!");
    }

    getServices(): Service[] {
        return [
            this.informationService,
            this.switchOpenService,
            this.switchCloseService,
        ];
    }
}
