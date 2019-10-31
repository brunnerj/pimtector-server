'use strict';

// BLE library
const bleno = require('bleno');

// MAX17048 LiPo battery fuel gauge (uses I2C)
const Max17048 = require('./max17048');


class BatteryLevelCharacteristic extends bleno.Characteristic {
	constructor(logger) {
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

		this.logger = logger;

		// init MAX17048 device
		this.max17048 = new Max17048();

		this.name = 'battery_level';
		this.updateDelay_ms = 30000; // how long to wait between battery level poll
		
		this.updateLevel(true);
	}

	updateLevel(suppressNotify) {

		const prevLevel = this.level.readUInt8(0);
		
		this.logger.info('Reading battery level');

		this.max17048.getStateOfCharge()
			.then(soc => {
				
				// cap between 0 and 100
				const newLevel = Math.min(100, Math.max(0, soc * 100));
				
				this.time = new Date();
				this.level = new Buffer.from([ newLevel ]);

				if (!suppressNotify && prevLevel !== this.level.readUInt8(0)) {
					this.notify();
				}
			})
			.catch(err => { 
				this.logger.error(err);
			});
	}

	start() {
		this.logger.info('Starting battery service level monitor');

		this.updateLevel();

		this.handle = setInterval(async () => { 
			this.updateLevel();
		}, this.updateDelay_ms);
	}

	stop() {
		this.logger.info('Stopping battery service level monitor');

		clearInterval(this.handle);
		this.handle = null;
	}

	onReadRequest(offset, callback) {
		try {
			//this.updateLevel(true); // force update level on read requests, but don't notify

			this.logger.info(`Returning battery result: ${this.level.toString('hex')} (${this.level.readUInt8(0)} %)`);

			callback(this.RESULT_SUCCESS, this.level);

		} catch (err) {

			this.logger.error(err);
			callback(this.RESULT_UNLIKELY_ERROR);
		}
	}

	onSubscribe(maxValueSize, updateValueCallback) {
		this.logger.info(`Battery level subscribed, max value size is ${maxValueSize}`);
		this.updateValueCallback = updateValueCallback;
	}

	onUnsubscribe() {
		this.logger.info('Battery level unsubscribed');
		this.updateValueCallback = null;
	}

	notify() {
		if (this.updateValueCallback) {
			this.logger.info(`Sending battery level notification with level ${this.level.readUInt8(0)} %`);

			this.updateValueCallback(this.level);
		}
	}
}


class BatteryService extends bleno.PrimaryService {

	constructor(logger) {

		const _level = new BatteryLevelCharacteristic(logger);

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