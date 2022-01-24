/////////////////////////////////////////////////////////////////////////////
/** @file
RFM69HCW SPI driver

\copyright Copyright (c) 2022 Chris Byrne. All rights reserved.
Licensed under the MIT License. Refer to LICENSE file in the project root. */
/////////////////////////////////////////////////////////////////////////////

import Pins from './pins';
import rpio from 'rpio';
import SPI from 'pi-spi';

export interface Config {
    freqHz:  	number;
    freqDev: 	number;
    bitRate: 	number;
    modulation: number;
}

export interface PacketConfig {
    packetConfig:	number;
    preambleSize:	number;
    syncWord?:		Buffer;
    payloadLength:	number;
}

export enum Mode {
    SLEEP  		= 0 << 2,   ///< Sleep mode (SLEEP)
    STANDBY		= 1 << 2,   ///< Standby mode (STDBY)
    FS     		= 2 << 2,   ///< Frequency Synthesizer mode (FS)
    TX     		= 3 << 2,   ///< Transmitter mode (TX)
    RX     		= 4 << 2,   ///< Receiver mode (RX)
}

/// data modulation + shaping
export enum Modulation {
    MODE_PACKET         = 0 << 5,   ///< Packet mode
    MODE_CONT_WITH_BIT  = 2 << 5,   ///< Continuous mode with bit synchronizer
    MODE_CONT_NO_BIT    = 3 << 5,   ///< Continuous mode without bit synchronizer
    MODULATION_FSK      = 0 << 3,   ///< FSK
    MODULATION_OOK      = 1 << 3,   ///< OOK
    SHAPE_NONE          = 0 << 0,   ///< no shaping
};

enum Registers {
    // common configuration
    REG00_FIFO          = 0x00,
    REG01_OPMODE        = 0x01,
    REG02_DATAMODUL     = 0x02,
    REG03_BITRATEMSB    = 0x03,
    REG04_BITRATELSB    = 0x04,
    REG05_FDEVMSB       = 0x05,
    REG06_FDEVLSB       = 0x06,
    REG07_FRFMSB        = 0x07,
    REG08_FRFMID        = 0x08,
    REG09_FRFLSB        = 0x09,
    REG0A_OSC1          = 0x0A,
    REG0B_AFCCTRL       = 0x0B,
    // RESERVED0C       = 0x0C
    REG0D_LISTEN1       = 0x0D,
    REG0E_LISTEN2       = 0x0E,
    REG0F_LISTEN3       = 0x0F,
    REG10_VERSION       = 0x10,
    // transmitter registers
    REG11_PALEVEL       = 0x11,
    REG12_PARAMP        = 0x12,
    REG13_OCP           = 0x13,
    // receiver registers
    // RESERVED14       = 0x14,
    // RESERVED15       = 0x15,
    // RESERVED16       = 0x16,
    // RESERVED17       = 0x17,
    REG18_LNA           = 0x18,
    REG19_RXBW          = 0x19,
    REG1A_AFCBW         = 0x1A,
    REG1B_OOKPEAK       = 0x1B,
    REG1C_OOKAVG        = 0x1C,
    REG1D_OOKFIX        = 0x1D,
    REG1E_AFCFEI        = 0x1E,
    REG1F_AFCMSB        = 0x1F,
    REG20_AFCLSB        = 0x20,
    REG21_FEIMSB        = 0x21,
    REG22_FEILSB        = 0x22,
    REG23_RSSICONFIG    = 0x23,
    REG24_RSSIVALUE     = 0x24,
    // IRQ and pin mapping
    REG25_DIOMAPPING1   = 0x25,
    REG26_DIOMAPPING2   = 0x26,
    REG27_IRQFLAGS1     = 0x27,
    REG28_IRQFLAGS2     = 0x28,
    REG29_RSSITHRESH    = 0x29,
    REG2A_RXTIMEOUT1    = 0x2A,
    REG2B_RXTIMEOUT2    = 0x2B,
    // packet engine
    REG2C_PREAMBLEMSB   = 0x2C,
    REG2D_PREAMBLELSB   = 0x2D,
    REG2E_SYNCCONFIG    = 0x2E,
    REG2F_SYNCVALUE1    = 0x2F,
    REG30_SYNCVALUE2    = 0x30,
    REG31_SYNCVALUE3    = 0x31,
    REG32_SYNCVALUE4    = 0x32,
    REG33_SYNCVALUE5    = 0x33,
    REG34_SYNCVALUE6    = 0x34,
    REG35_SYNCVALUE7    = 0x35,
    REG36_SYNCVALUE8    = 0x36,
    REG37_PACKETCONFIG1 = 0x37,
    REG38_PAYLOADLENGTH = 0x38,
    REG39_NODEADRS      = 0x39,
    REG3A_BROADCASTADRS = 0x3A,
    REG3B_AUTOMODES     = 0x3B,
    REG3C_FIFOTHRESH    = 0x3C,
    REG3D_PACKETCONFIG2 = 0x3D,
    REG3E_AESKEY1       = 0x3E,
    REG3F_AESKEY2       = 0x3F,
    REG40_AESKEY3       = 0x40,
    REG41_AESKEY4       = 0x41,
    REG42_AESKEY5       = 0x42,
    REG43_AESKEY6       = 0x43,
    REG44_AESKEY7       = 0x44,
    REG45_AESKEY8       = 0x45,
    REG46_AESKEY9       = 0x46,
    REG47_AESKEY10      = 0x47,
    REG48_AESKEY11      = 0x48,
    REG49_AESKEY12      = 0x49,
    REG4A_AESKEY13      = 0x4A,
    REG4B_AESKEY14      = 0x4B,
    REG4C_AESKEY15      = 0x4C,
    REG4D_AESKEY16      = 0x4D,
    // temperature
    REG4E_TEMP1         = 0x4E,
    REG4F_TEMP2         = 0x4F,
    // test
    REG58_TESTLNA       = 0x58,
    REG5A_TESTPA1       = 0x5A,
    REG5C_TESTPA2       = 0x5C,
    REG6F_TESTDAGC      = 0x6F,
    REG71_TESTAFC       = 0x71,	
}

/// IRQ flags
enum IrqFlags {
    IRQFLAGS1_MODE_READY    = 1 << 7,   ///< set when the operation mode requested in mode is ready
    IRQFLAGS1_RX_READY      = 1 << 6,   ///< Set in Rx mode, after RSSI, AGC and AFC. Cleared when leaving R
    IRQFLAGS1_TX_READY      = 1 << 5,   ///< Set in Tx mode, after PA ramp-up.

    IRQFLAGS2_FIFO_FULL     = 1 << 7,   ///< Set when FIFO is full (i.e. contains 66 bytes), else cleared.
    IRQFLAGS2_FIFO_NOT_EMPTY= 1 << 6,   ///< Set when FIFO contains at least one byte, else cleared
    IRQFLAGS2_FIFO_LEVEL    = 1 << 5,   ///< Set when the number of bytes in the FIFO strictly exceeds FifoThreshold
    IRQFLAGS2_FIFO_OVERRUN  = 1 << 4,   ///< Set when FIFO overrun occurs
    IRQFLAGS2_PACKET_SENT   = 1 << 3,   ///< Set in Tx when the complete packet has been sent
    IRQFLAGS2_PAYLOAD_READY = 1 << 2,   ///< Set in Rx when the payload is ready (cleared when FIFO is empty)
    IRQFLAGS2_CRC_OK        = 1 << 1,   ///< Set in Rx when the CRC of the payload is Ok
};

const SPI_WNR = 0x80;   ///< SPI Write access

async function delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

export default class Rfm69 {
    private spi_: SPI.SPI;
    private spiTransferInProgress_ = false;

    constructor() {
        this.spi_ = SPI.initialize('/dev/spidev0.0');
        this.spi_.clockSpeed(10000000);
    }

    async init() {
        this.reset();
        
        const version = await (async () => {
            let ver = -1;
            for (let attempts = 0; attempts < 3; ++attempts) {
                ver = await this.read8_(Registers.REG10_VERSION);
                if (0x24 === ver) return ver;
                await delay(1);
            }
            return ver
        })();
        if (0x24 !== version) {
            console.error(`Failed to initialize RFM69 (unexpected version ${version})`);
            throw new Error('Failed to initialize RFM69')
        }
    }

    async dumpRegs(): Promise<void> {
        for (let i = 0; i < 0x4D; ++i) {
            console.log(i.toString(16), await (await this.read8_(i as any)).toString(16));
        }
    }

    reset(): void {
        rpio.write(Pins.RFM69_RST, rpio.HIGH);
        rpio.usleep(100); // 100us
        rpio.write(Pins.RFM69_RST, rpio.LOW);
        rpio.msleep(5); // 5ms
    }

    async setConfig(config: Config): Promise<void> {
        await this.setMode(Mode.STANDBY);

        const FXOSC = 32000000; ///< Hz - Crystal oscillator frequency (from data sheet)
        const FSTEP = FXOSC / (1 << 19); ///< Hz - Frequency synthesizer step (from data sheet)

        /**
         * calculate RxBw settings for bitRate with modulation
         */
        function calcRxBw(targetBw: number, modulation: Modulation) {
            const rxBwExpOfs = (modulation & Modulation.MODULATION_OOK) ? 3 : 2;

            const RX_BW_MANT = [ 24, 20, 16 ];
            const RX_BW_EXP  = [ 7, 6, 5, 4, 3, 2, 1, 0 ];
            for (const rxBwExp of RX_BW_EXP) {
                for (const rxBwMant of RX_BW_MANT) {
                    const rxBw = FXOSC / (rxBwMant * (1 << (rxBwExp + rxBwExpOfs)));
                    if (rxBw > targetBw) return { mant: (rxBwMant - 16) / 4, exp: rxBwExp };
                }
            }
            return undefined;
        }

        // RF carrier frequency
        {
            const frf = Math.round(config.freqHz / FSTEP);
            await this.transfer_([
                SPI_WNR | Registers.REG07_FRFMSB,
                (frf >> 16) & 0xff,
                (frf >>  8) & 0xff,
                (frf >>  0) & 0xff,
            ]);
        }

        // data modulation
        await this.write8_(Registers.REG02_DATAMODUL, config.modulation);

        // bit rate
        if (config.bitRate > 0) {
            const br = Math.round(FXOSC / config.bitRate);
            await this.write16_(Registers.REG03_BITRATEMSB, br);
        }

        if (config.bitRate > 0 && config.freqDev > 0) {
            // frequency deviation
            const fd = Math.round(config.freqDev / FSTEP);
            await this.write16_(Registers.REG05_FDEVMSB, fd);

            // RxBw settings
            {
                const rxbw = calcRxBw(Math.max(config.freqDev, 2 * config.bitRate), config.modulation);
                if (null == rxbw) throw new Error('RxBw out of range');

                const dccFreq = 4; // fc in % of rxBW (default)
                await this.write8_(Registers.REG19_RXBW,  (dccFreq << 5) | (rxbw.mant << 3) | (rxbw.exp << 0));
                await this.write8_(Registers.REG1A_AFCBW, (dccFreq << 5) | (rxbw.mant << 3) | (rxbw.exp << 0));
            }
        }
    }

    /**
     * set operational mode
     */
    async setMode(mode: Mode): Promise<void> {
        // already in mode?
        const cur = await this.read8_(Registers.REG01_OPMODE);
        if (mode == (cur & (7 << 2))) return;

        // set new mode
        await this.write8_(Registers.REG01_OPMODE, mode);

        // wait for mode to change
        const since = process.hrtime.bigint();
        for (;;) {
            if (await this.read8_(Registers.REG27_IRQFLAGS1) & IrqFlags.IRQFLAGS1_MODE_READY) break;
            if ((process.hrtime.bigint() - since) > 1000000000) throw new Error('Timed out waiting for setMode');
            await delay(1);
        }
    }

    /**
     * configure packet engine mode
     */
    async setPacketConfig(config: PacketConfig): Promise<void> {
        // packet config
        await this.write8_(Registers.REG37_PACKETCONFIG1, config.packetConfig);

        // payload length
        await this.write8_(Registers.REG38_PAYLOADLENGTH, config.payloadLength);

        // preamble
        await this.write8_(Registers.REG2C_PREAMBLEMSB, config.preambleSize);

        // sync word
        if (null != config.syncWord) {
            const syncWordSize = Math.min(config.syncWord.length, 8);
            await this.write8_(Registers.REG2E_SYNCCONFIG, 0x80 | ((syncWordSize - 1) << 3));
            for (let i = 0; i < syncWordSize; ++i) {
                await this.write8_(Registers.REG2F_SYNCVALUE1 + i, config.syncWord[i]);
            }
        } else {
            await this.write8_(Registers.REG2E_SYNCCONFIG, 0);
        }
    }

    async setHighPower(): Promise<void> {
        await this.write8_(
            Registers.REG11_PALEVEL,
            (await this.read8_(Registers.REG11_PALEVEL) & 0x1F) | (1 << 6)  | (1 << 5)
        );
        await this.write8_(
            Registers.REG13_OCP,
            (await this.read8_(Registers.REG13_OCP) & 0x7F) // disable OCP
        );
    }

    async available(): Promise<boolean> {
        const flags = await this.read8_(Registers.REG28_IRQFLAGS2);
        return Boolean(flags & IrqFlags.IRQFLAGS2_FIFO_NOT_EMPTY);
    }
    /// @returns next byte from FIFO
    read() : Promise<number> {
        return this.read8_(Registers.REG00_FIFO);
    }
    
    async transmit(pre: Buffer | undefined, buf: Buffer): Promise<void> {
        await this.setMode(Mode.STANDBY);

        if (pre) {
            for (const p of pre) {
                await this.write8_(Registers.REG00_FIFO, p);
            }
        }
        for (const b of buf) {
            await this.write8_(Registers.REG00_FIFO, b);
        }

        await this.setMode(Mode.TX);

        for (const since = process.hrtime.bigint(); ; ) {
            const irqFlags2 = await this.read8_(Registers.REG28_IRQFLAGS2);
            if (irqFlags2 & IrqFlags.IRQFLAGS2_PACKET_SENT) break;
            if ((process.hrtime.bigint() - since) > 1000000000) throw new Error('Timed out waiting for transmit');
            rpio.usleep(1);
        }

        await this.setMode(Mode.STANDBY);
    }

    private async read8_(reg: Registers): Promise<number> {
        const res = await this.transfer_([reg, 0x00]);
        return res[1];
    }

    private async write8_(reg: Registers, byte: number): Promise<void> {
        await this.transfer_([SPI_WNR | reg, byte]);
    }
    private async write16_(reg: Registers, u16: number): Promise<void> {
        await this.transfer_([SPI_WNR | reg, (u16 >> 8) & 0xFF, u16 & 0xff]);
    }

    private async transfer_(data: number[]): Promise<Buffer> {
        if (this.spiTransferInProgress_) {
            console.trace('Transfer already in progress!');
            throw new Error('Transfer already in progress!');
        }
        this.spiTransferInProgress_ = true;

        try {
            rpio.write(Pins.CS, rpio.LOW);

            const buffer = Buffer.from(data);
            const res = await new Promise<Buffer>((resolve, reject) => {
                this.spi_.transfer(buffer, buffer.length, (e: Error, d: Buffer) => {
                    if (e) { reject(e); } else { resolve(d); }
                });
            });
            return res;
        } finally {
            rpio.write(Pins.CS, rpio.HIGH);
            this.spiTransferInProgress_ = false;
        }
    }
}
