'use strict';

const bleno = require('bleno');

class BatteryLevelCharacteristic extends bleno.Characteristic {
	constructor() {
		super({
			uuid: '2a19',
			properties: ['read', 'notify'],
			descriptors: [
				new bleno.Descriptor({
					uuid: '2901',
					value: 'Battery level between 0 and 100 percent'
				}),
				new bleno.Descriptor({
					uuid: '2904',
					value: new Buffer.from([ 
						0x04, // format = 4 = uint8
						0x00, // exponent = 0 (none)
						0xAD, // 0x27AD: unit = percent
						0x27,
						0x01, // Bluetooth SIG namespace
						0x00, // 0x0000: no description
						0x00 
					])
				})
			]
		});

		this.name = 'battery_level';
		this.level = 100; // init with full charge
		this.time = new Date(); // full charge at this time
		this.updateDelay_ms = 5000; // how long to wait between battery level poll
	}

	updateLevel(suppressNotify) {
		// our battery starts at 100, drains to 0 over an hour,
		// then recharges to 100.
		const now = new Date();
		const seconds_since_charged = (now.getTime() - this.time.getTime()) / 1000;
		const prevLevel = this.level;

		if (seconds_since_charged <= 3600) {
			this.level = 100 - (seconds_since_charged / 36);
		} else {
			console.log('Battery fully charged');
			this.time = new Date();
			this.level = 100;
		}

		if (!suppressNotify && prevLevel !== this.level) {
			this.notify();
		}
	}

	start() {
		console.log('Starting battery service level monitor');

		this.updateLevel();

		this.handle = setInterval(() => { 
			this.updateLevel();
		}, this.updateDelay_ms);
	}

	stop() {
		console.log('Stopping battery service level monitor');

		clearInterval(this.handle);
		this.handle = null;
	}

	onReadRequest(offset, callback) {
		try {
			this.updateLevel(true); // force update level on read requests, but don't notify

			const result = new Buffer.from([ this.level ]);
			console.log(`Returning battery result: ${result.toString('hex')} (${result.readUInt8(0)} %)`);

			callback(this.RESULT_SUCCESS, result);

		} catch (err) {

			console.error(err);
			callback(this.RESULT_UNLIKELY_ERROR);
		}
	}

	onSubscribe(maxValueSize, updateValueCallback) {
		console.log(`Battery level subscribed, max value size is ${maxValueSize}`);
		this.updateValueCallback = updateValueCallback;
	}

	onUnsubscribe() {
		console.log('Battery level unsubscribed');
		this.updateValueCallback = null;
	}

	notify() {
		if (this.updateValueCallback) {
			console.log(`Sending battery level notification with level ${this.level} %`);

			this.updateValueCallback(new Buffer.from([ this.level ]));
		}
	}
}


class BatteryService extends bleno.PrimaryService {

	constructor() {

		const _level = new BatteryLevelCharacteristic();

		super({
			uuid: '180f',
			characteristics: [
				_level
			]
		});

		this.name = 'battery_service';
		this.level = _level;
	}

	start() { 
		this.level.start();
	}

	stop() { 
		this.level.stop(); 
	}
}

module.exports = BatteryService;