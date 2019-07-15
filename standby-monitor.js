'use strict';

/* standby-monitor.js
 * 
 * Runs as a system service and monitors standby button presses. Also
 * controls a (blue) status LED.
 * 
 * The standby button essentially shorts pins 5 & 6 on the Raspberry Pi.
 * When the Pi is in standby, shorting these pins signals a startup. It
 * takes a few seconds to get up to speed, but the status LED lights
 * very quickly. It may also flicker a bit because it's connected to
 * TxD, GPIO14. Status may also flash off briefly as the GPIO pin is
 * initialized, but will be set 'on' before the monitoring loop starts.
 * 
 * The standby button must be held for a bit before the event is
 * registered. See the constants below to fine tune the operation.
 * 
 * This program is started via the standby-monitor service routine
 * which gets installed (copied) to /etc/init.d/.
 */

const { exec } = require('child_process');
const Gpio = require('onoff').Gpio;
const logger = require('logging');

const STANDBY_HOLD_TIME_ms = 1000; // button must be held this long to signal standby
const LBO_HOLD_TIME_ms = 60000; // LBO detected for 1 minute for shutdown

const GPIO_STATUS = 14; // write 1 for on, 0 for off
const GPIO_BUTTON = 3; // detect falling edge on GPIO3
const GPIO_LBO_DETECT = 4; // detect low battery output (LBO); active low

// Set up the status LED and standby button
const status = new Gpio(GPIO_STATUS, 'out');
const button = new Gpio(GPIO_BUTTON, 'in', 'falling', { debounceTimeout: 50 });
const lbo = new Gpio(GPIO_LBO_DETECT, 'in', 'falling', { debounceTimeout: 10 });


// called to halt system
const halt = () => {
	
	// blink status
	const iv = setInterval(() => {
		status.writeSync(status.readSync() ^ 1);
	}, 100);

	setTimeout(() => {

		// stop blinking
		clearInterval(iv);

		// turn status off
		status.writeSync(Gpio.LOW);

		logger.info('halting');

		// execute halt command
		exec('shutdown -h now', (msg) => { 
			logger.info(msg); 
		});

	}, 500);
}

// callback when standby button push detected
const standbyDetector = (err) => {

	if (err) {
		logger.error('Error calling standbyDetector: ' + err);
		throw err;
	}

	// Check button and return if not held (LOW) long enough
	if (button.readSync() === Gpio.HIGH)
		return;

	// Else see how long the button is held
	// and halt if it's held long enough
	logger.info('standby detected');

	let start_ms = Date.now();
	let halting = false;

	while (button.readSync() === Gpio.LOW && !halting) {

		halting = (Date.now() - start_ms) > STANDBY_HOLD_TIME_ms;
	}

	if (halting) {
		halt();
	} else {
		logger.info('standby reset');
	}
}

const lboDetector = (err) => {

	if (err) {
		logger.error('Error calling lboDetector: ' + err);
		throw err;
	}

	// check LBO and return if not LOW
	if (lbo.readSync() === Gpio.HIGH)
		return;

	logger.info('low battery detected');

	let start_ms = Date.now();
	let halting = false;

	while (lbo.readSync() === Gpio.LOW && !halting) {

		halting = (Date.now() - start_ms) > LBO_HOLD_TIME_ms;
	}

	if (halting) {
		halt();
	} else {
		logger.info('low battery reset');
	}
}

// Illuminate status LED (it should be high at
// boot, so it may blink off during init above
// until we set it back high here)
status.writeSync(Gpio.HIGH);

// watch the standby button GPIO interrupt
logger.info('standby detection starting');
button.watch(standbyDetector);

// watch for the LBO signal interrupt
logger.info('LBO detection starting');
lbo.watch(lboDetector);

// listen for system signals and cleanup
['SIGINT', 'SIGTERM', 'SIGHUP'].forEach(signal => process.on(signal, () => {
	logger.info(signal + ' detected - exiting');
	status.unexport();
	button.unexport();
	lbo.unexport();
}));