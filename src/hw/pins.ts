/////////////////////////////////////////////////////////////////////////////
/** @file
Adafruit RFM69HCW Transceiver Radio Bonnet I/O pins

\copyright Copyright (c) 2022 Chris Byrne. All rights reserved.
Licensed under the MIT License. Refer to LICENSE file in the project root. */
/////////////////////////////////////////////////////////////////////////////

enum Pins {
    RFM69_RST 	= 22, // GPIO25
    OLED_RST    = 7,  // GPIO4
    BUTTON_1  	= 29, // GPIO5
    BUTTON_2  	= 31, // GPIO6
    BUTTON_3  	= 32, // GPIO12
    CS        	= 26,
}

export default Pins;
