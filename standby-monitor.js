#!/usr/local/bin/node

const Gpio = require('onoff').Gpio;

//const STANDBY_FLAG = false; // set after detecting a standby signal
const STANDBY_HOLD_TIME_ms = 1000; // button must be held this long to signal standby

const GPIO_STATUS = 17; // write 1 for on, 0 for off
const GPIO_STANDBY = 3; // detect falling edge on GPIO3


// Set up the status LED and standby button
const status = new Gpio(GPIO_STATUS, 'out');
const button = new Gpio(GPIO_STANDBY, 'in', 'falling', { debounceTimeout: 50 });


const log = (msg) => {
	console.log('[standby-monitor] ' + msg);
}

const blink = () => {
	const iv = setInterval(() => {
		status.writeSync(status.readSync() ^ 1);
	}, 100);

	setTimeout(() => {
		clearInterval(iv);
		status.writeSync(Gpio.LOW);
	}, 500);
}

const standby = (err, value) => {

	if (err) throw err;

	// Check button and return if not held (LOW) long enough
	if (button.readSync() === Gpio.HIGH)
		return;

	// Else see how long the button is held
	// and go to standby if it's held long enough
	log('standby button push detected');

	let start_ms = Date.now();
	let standingBy = false;

	while (button.readSync() === Gpio.LOW && !standingBy) {

		standingBy = (Date.now() - start_ms) > STANDBY_HOLD_TIME_ms;
	}

	if (standingBy) {
		log('going to standby');
		blink();
	} else {
		log('standby detector reset');
	}
}


button.watch(standby);

process.on('SIGINT', () => {
	status.unexport();
	button.unexport();
});
