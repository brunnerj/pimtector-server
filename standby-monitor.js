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

//const STANDBY_FLAG = false; // set after detecting a standby signal
const STANDBY_HOLD_TIME_ms = 1000; // button must be held this long to signal standby

const GPIO_STATUS = 14; // write 1 for on, 0 for off
const GPIO_BUTTON = 3; // detect falling edge on GPIO3


// Set up the status LED and standby button
const status = new Gpio(GPIO_STATUS, 'out');
const button = new Gpio(GPIO_BUTTON, 'in', 'falling', { debounceTimeout: 50 });

// logging helper
const log = (msg) => {
	console.log('[standby-monitor] ' + msg);
}

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

		log('halting');

		// execute halt command
		exec('shutdown -h now', (msg) => { log(msg) });

	}, 500);
}


// callback when standby button push detected
const standbyDetector = (err) => {

	if (err) throw err;

	// Check button and return if not held (LOW) long enough
	if (button.readSync() === Gpio.HIGH)
		return;

	// Else see how long the button is held
	// and halt if it's held long enough
	log('standby detected');

	let start_ms = Date.now();
	let halting = false;

	while (button.readSync() === Gpio.LOW && !halting) {

		halting = (Date.now() - start_ms) > STANDBY_HOLD_TIME_ms;
	}

	if (halting) {
		halt();
	} else {
		log('standby reset');
	}
}

log('standby detection starting');

// Illuminate status LED (it should be high at
// boot, so it may blink off during init above
// until we set it back high here)
status.writeSync(Gpio.HIGH);

// infinite watcher - system signals can stop this
button.watch(standbyDetector);

// listen for system signals and cleanup
['SIGINT', 'SIGTERM', 'SIGHUP'].forEach(signal => process.on(signal, () => {
	log(signal + ' detected - exiting');
	status.unexport();
	button.unexport();
}));