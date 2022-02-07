/////////////////////////////////////////////////////////////////////////////
/** @file
Accessory device base class

\copyright Copyright (c) 2022 Chris Byrne. All rights reserved.
Licensed under the MIT License. Refer to LICENSE file in the project root. */
/////////////////////////////////////////////////////////////////////////////

import {
    CharacteristicEventTypes,
    CharacteristicGetCallback,
    CharacteristicSetCallback,
    CharacteristicValue,
    HAP,
    Logging,
    Service
} from 'homebridge';
import Controller, { DeviceType } from './controller';
import crypto from 'crypto';

/**
 * radio controller singleton access
 */
export const getController = (() => {
    let controller: Controller | undefined;
    let controllerInited = false;

    return function(log: Logging) {
        if (!controller) {
            controller = new Controller((msg) => log.info(msg));
            controller.init().then(() => {
                controllerInited = true;
            }).catch((e) => {
                log(e);
            });
        }
        return (controllerInited) ? controller : undefined;
    };
})();

/**
 * base class for our various device types used by our single accessory
 * Homebridge allows either a plugin to be an accessory or a platform
 * eventually we should probably be a platform, but for now there's enough
 * commonality that we can be a hybrid accessory which adjusts its behavior
 * based on deviceType
 */
export default abstract class AccessoryBase {
    readonly uuid: string;

    constructor(protected readonly hap_: HAP, readonly log: Logging, readonly name: string) {
        this.uuid = crypto.randomBytes(12).toString('hex');
    }

    abstract get deviceType(): DeviceType;
    abstract get services(): Service[];

    /**
     * create a new switch service
     * @param subtype service's subtype
     * @param code transmission code
     * @param times number of times to transmit code
     * @param onlyOn only transmit while switch is on (level vs edge)
     * @returns created service
     */
    protected createSwitchService_(subtype: string, code: number, times = -1, onlyOn = false) {
        const service = new this.hap_.Service.Switch(subtype, subtype);
        return this.setSwitchOnCharacteristic_(service, code, times, onlyOn);
    }

    protected setSwitchOnCharacteristic_(service: Service, code: number, times = -1, onlyOn = false) {
        let switchOn = false;
        service.getCharacteristic(this.hap_.Characteristic.On)
            .on(CharacteristicEventTypes.GET, (callback: CharacteristicGetCallback) => {
                callback(undefined, switchOn);
            })
            .on(CharacteristicEventTypes.SET, (value: CharacteristicValue, callback: CharacteristicSetCallback) => {
                switchOn = value as boolean;
                // this.log.info(`Switch ${this.name} ${subtype} state was set to: ` + (switchOn? "ON": "OFF"));

                const controller = getController(this.log);
                if (controller) {
                    if (!onlyOn || switchOn) {
                        controller.beginTransmitting(this.uuid, this.deviceType, code, switchOn, times, () => {
                            // automatically turn off if this is an only on switch
                            // e.g., louvres has separate open/close switches to trigger actions
                            if (onlyOn) {
                                switchOn = false;
                                service.setCharacteristic(this.hap_.Characteristic.On, false);
                            }
                        });
                    } else {
                        controller.stopTransmitting(this.uuid);
                    }
                }

                callback();
            })
        ;
        return service;
    }
}
