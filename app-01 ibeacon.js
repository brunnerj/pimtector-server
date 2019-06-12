const bleno = require("bleno");

const UUID = "00010000-8d54-11e9-b475-0800200c9a66"; // set your own value
const MINOR = 2; // set your own value
const MAJOR = 1; // set your own value
const TX_POWER = -60; // just declare transmit power in dBm

console.log("Starting bleno...");

bleno.on("stateChange", state => {

    if (state === 'poweredOn') {
        console.log("Starting broadcast...");

        bleno.startAdvertisingIBeacon(UUID, MAJOR, MINOR, TX_POWER, err => {
            if(err) {
                console.error(err);
            } else {
                console.log(`Broadcasting as iBeacon uuid:${UUID}, major: ${MAJOR}, minor: ${MINOR}`);
            }
        });
    } else {
        console.log("Stopping broadcast...");
        bleno.stopAdvertising();
    }
});
