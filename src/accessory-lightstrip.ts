/////////////////////////////////////////////////////////////////////////////
/** @file
Lightstrip (unknown manufacturer) accessory

\copyright Copyright (c) 2022 Chris Byrne. All rights reserved.
Licensed under the MIT License. Refer to LICENSE file in the project root. */
/////////////////////////////////////////////////////////////////////////////

import {
    AccessoryConfig,
    CharacteristicEventTypes,
    CharacteristicGetCallback,
    CharacteristicSetCallback,
    CharacteristicValue,
    HAP,
    Logging,
    Service
} from 'homebridge';
import AccessoryBase, { getController } from './accessory-base';
import { DeviceType } from './controller';

export default class AccessoryLightStrip extends AccessoryBase {
    private readonly lightService: Service;

    get deviceType() { return DeviceType.LIGHTSTRIP; }

    constructor(hap: HAP, log: Logging, config: AccessoryConfig) {
        super(hap, log, config.name);

        const code = parseInt(config.code, 16);
        let times = parseInt(config.times, 10);
        if (!isFinite(times) || times <= 0) times = 4;

        this.lightService = new hap.Service.Lightbulb('Light');
        this.setSwitchOnCharacteristic_(this.lightService, code, times);

        // const service = new hap.Service.Switch(`${subtype}`, subtype);
        let switchBrightness = 100;
        this.lightService.getCharacteristic(hap.Characteristic.Brightness)
            .on(CharacteristicEventTypes.GET, (callback: CharacteristicGetCallback) => {
                callback(undefined, switchBrightness);
            })
            .on(CharacteristicEventTypes.SET, (value: CharacteristicValue, callback: CharacteristicSetCallback) => {
                switchBrightness = value as number;

                const controller = getController(this.log);
                if (controller) {
                    // lightbulb brightness is in 100%
                    // while the weird light strip is 9 bits with the MSB for the lower portion
                    const brightnessVal = 0x1FF * switchBrightness / 100;
                    let sendCode = code & 0xFFF00;
                    sendCode += brightnessVal & 0xFF;
                    if (brightnessVal < 0x100) sendCode |= 0x100;

                    // code
                    controller.beginTransmitting(`${this.uuid}-brightness`, this.deviceType, sendCode, undefined, times);
                }

                callback();
            })
        ;
    }

    get services(): Service[] {
        return [ this.lightService ];
    }
}
