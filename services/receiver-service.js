'use strict';

const bleno = require('bleno');

// use GPIO13 to enable/disable the receiver
// USB power bus on user connect/disconnect
const Gpio = require('onoff').Gpio;
const GPIO_RX_EN = 13; // Enable/disable the receiver (RX) USB power bus (GPIO PIN33 == GPIO13)
const rcvr_en = new Gpio(GPIO_RX_EN, 'out');
const rx_pwr = (enable) => { rcvr_en.writeSync(enable ? Gpio.HIGH : Gpio.LOW) }

const RECEIVER_SERVICE_UUID		= '00010000-8d54-11e9-b475-0800200c9a66';
const RECEIVER_DATA_CHAR_UUID	= '00010001-8d54-11e9-b475-0800200c9a66';


class ReceiverDataCharacteristic extends bleno.Characteristic {
	constructor(logger) {
		super({
			uuid: RECEIVER_DATA_CHAR_UUID,
			properties: ['read', 'notify'],
			descriptors: [
				new bleno.Descriptor({
					uuid: '2901',
					value: 'Received power in decibels above 1mW reference, dBm'
				}),
				new bleno.Descriptor({
					uuid: '2904',
					value: new Buffer.from([ 
						0x0E, // format = int16 (-32,768 to 32,767)
						0xFE, // exponent = -2 (-327.68 to 327.67)
						0x26, // 0x2726: unit = watt (power)
						0x27,
						0x01, // Bluetooth SIG namespace
						0x00, // 0x0000: no description
						0x00 
					])
				})
			]
		});

		this.logger = logger;
		this.name = 'receiver_data';

		this.buffer = new Buffer.alloc(2);
		this.buffer.writeInt16LE(-13000);

	}

	onReadRequest(offset, callback) {
		try {
			this.updateBuffer(true); // force update level on read requests, but don't notify

			this.logger.info(`[receiver-service] Returning receiver result: ${result.toString('hex')} (${level / 100} dBm)`);

			callback(this.RESULT_SUCCESS, this.buffer);

		} catch (err) {

			this.logger.error(`[receiver-service] ${err}`);
			callback(this.RESULT_UNLIKELY_ERROR);
		}
	}

	updateBuffer(suppressNotify) {

		const level = -1 * (Math.floor(Math.random() * (13000 - 8000 + 1)) + 8000); // fake level between -130 and -80 dBm (-13000 to -8000)

		this.buffer.writeInt16LE(level);

		if (!suppressNotify) {
			this.notify();
		}
	}

	start() {
		this.logger.info('[receiver-service] Starting receiver service');

		// enable the receiver power bus
		rx_pwr(true);
	}

	stop() {
		this.logger.info('[receiver-service] Stopping receiver service');

		if (this.handle) 
			this.onUnsubscribe();

		// disable receiver power bus
		rx_pwr(false);
	}

	onSubscribe(maxValueSize, updateValueCallback) {
		this.logger.info(`[receiver-service] Receiver service subscribed, max value size is ${maxValueSize}`);
		this.updateValueCallback = updateValueCallback;

		this.handle = setInterval(() => { 
			this.updateBuffer();
		}, 1000);

	}

	onUnsubscribe() {
		this.logger.info('[receiver-service] Receiver service unsubscribed');
		this.updateValueCallback = null;

		clearInterval(this.handle);
		this.handle = null;
	}

	notify() {
		if (this.updateValueCallback) {

			this.updateValueCallback(this.buffer);
		}
	}
}


class ReceiverService extends bleno.PrimaryService {
	constructor(logger) {

		const _rcvr = new ReceiverDataCharacteristic(logger);

		super({
			uuid: RECEIVER_SERVICE_UUID,
			characteristics: [ _rcvr ]
		});

		this.name = 'receiver_service';
		this.rcvr = _rcvr;
	}

	start() { 
		this.rcvr.start();
	}

	stop() { 
		this.rcvr.stop(); 
	}
}

module.exports = ReceiverService;