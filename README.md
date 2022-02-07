# RFM69HCW Homebridge Plugin

# Local development

```sh
git clone ...
cd ...
sudo npm link
npm run build && homebridge -D
```

# Determining codes

Stop homebridge

```sh
sudo systemctl stop homebridge
```

Navigate to homebridge-rfm69hcw's module directory, install dev dependencies, and then run:

```sh
cd /usr/local/lib/node_modules/homebridge-rfm69hcw
npm install
npm start
```

Select desired device:

```
1 EV1527
2 LIGHTSTRIP
Device type? 1
Listening for Ev1527 packets
```

Pressing a button on the corresponding remote should now output the appropriate code for that button.
