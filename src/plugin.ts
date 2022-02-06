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
import RadioController, { RadioDevice } from './radio-controller';

let hap: HAP;

// radio controller singleton
const getRadioController = (() => {
    let roofControl: RadioController | undefined;
    let roofControlInited = false;

    return function(log: Logging) {
        if (!roofControl) {
            roofControl = new RadioController((msg) => log.info(msg));
            roofControl.init().then(() => {
                roofControlInited = true;
            }).catch((e) => {
                console.error(e);
            });
        }
        return (roofControlInited) ? roofControl : undefined;
    };
})();

/*
 * Initializer function called when the plugin is loaded.
 */
export = (api: API) => {
    hap = api.hap;
    api.registerAccessory("RadioControl", RadioControlPlugin);
};

abstract class RadioControlDeviceBase {
    readonly uuid: string;

    constructor(readonly log: Logging, readonly name: string) {
        this.uuid = crypto.randomBytes(12).toString('hex');
    }

    abstract get deviceType(): RadioDevice;
    abstract get services(): Service[];

    protected createSwitchService_(subtype: string, code: number, times = -1, onlyOn = false) {
        const service = new hap.Service.Switch(subtype, subtype);
        return this.setSwitchOnCharacteristic_(service, code, times, onlyOn);
    }
    protected setSwitchOnCharacteristic_(service: Service, code: number, times = -1, onlyOn = false) {
        let switchOn = false;
        service.getCharacteristic(hap.Characteristic.On)
            .on(CharacteristicEventTypes.GET, (callback: CharacteristicGetCallback) => {
                callback(undefined, switchOn);
            })
            .on(CharacteristicEventTypes.SET, (value: CharacteristicValue, callback: CharacteristicSetCallback) => {
                switchOn = value as boolean;
                // this.log.info(`Switch ${this.name} ${subtype} state was set to: ` + (switchOn? "ON": "OFF"));

                const radio = getRadioController(this.log);
                if (radio) {
                    if (!onlyOn || switchOn) {
                        radio.setTransmitting(this.uuid, this.deviceType, code, switchOn, times, () => {
                            // automatically turn off if this is an only on switch
                            // e.g., louvres has separate open/close switches to trigger actions
                            if (onlyOn) {
                                switchOn = false;
                                service.setCharacteristic(hap.Characteristic.On, false);
                            }
                        });
                    } else {
                        radio.stopTransmitting(this.uuid);
                    }
                }

                callback();
            })
        ;
        return service;
    }
}

class RadioControlDeviceEv1527 extends RadioControlDeviceBase {
    private readonly switchOpenService: Service;
    private readonly switchCloseService: Service;

    get deviceType() { return RadioDevice.EV1527; }

    constructor(log: Logging, config: AccessoryConfig) {
        super(log, config.name);

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

class RadioControlDeviceLightStrip extends RadioControlDeviceBase {
    private readonly lightService: Service;

    get deviceType() { return RadioDevice.LIGHTSTRIP; }

    constructor(log: Logging, config: AccessoryConfig) {
        super(log, config.name);

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

                const radio = getRadioController(this.log);
                if (radio) {
                    // lightbulb brightness is in 100%
                    // while the weird light strip is 9 bits with the MSB for the lower portion
                    const brightnessVal = 0x1FF * switchBrightness / 100;
                    let sendCode = code & 0xFFF00;
                    sendCode += brightnessVal & 0xFF;
                    if (brightnessVal < 0x100) sendCode |= 0x100;

                    // code 
                    radio.setTransmitting(`${this.uuid}-brightness`, this.deviceType, sendCode, undefined, times);
                }

                callback();
            })
        ;
    }

    get services(): Service[] {
        return [ this.lightService ];
    }
}


class RadioControlPlugin implements AccessoryPlugin {
    private device_?: RadioControlDeviceBase;

    constructor(log: Logging, config: AccessoryConfig, api: API) {
        // initialize singleton
        getRadioController(log);

        //
        switch (String(config.deviceType).toLowerCase()) {
        case 'ev1527':
            this.device_ = new RadioControlDeviceEv1527(log, config);
            break;
        case 'lightstrip':
            this.device_ = new RadioControlDeviceLightStrip(log, config);
            break;
        default:
            log(`Unknown device type: ${config.deviceType}`);
        }
    }

    getServices(): Service[] {
        return this.device_?.services ?? [];
    }
}
