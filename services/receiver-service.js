'use strict';

const bleno = require('@abandonware/bleno');

const receiver = require('./receiver');

// use GPIO13 to enable/disable the receiver
// USB power bus on user connect/disconnect
const Gpio = require('onoff').Gpio;
const GPIO_RX_EN = 13; // Enable/disable the receiver (RX) USB power bus (GPIO PIN33 == GPIO13)
const rcvr_en = new Gpio(GPIO_RX_EN, 'out');
const rx_pwr = (enable) => { rcvr_en.writeSync(enable ? Gpio.HIGH : Gpio.LOW) }

const RECEIVER_SERVICE_UUID				= '00010000-8d54-11e9-b475-0800200c9a66';

const RECEIVER_INFO_CHAR_UUID			= '00010001-8d54-11e9-b475-0800200c9a66';
const RECEIVER_DATA_CHAR_UUID			= '00010002-8d54-11e9-b475-0800200c9a66';
const RECEIVER_CENTER_FREQ_CHAR_UUID	= '00010003-8d54-11e9-b475-0800200c9a66';
const RECEIVER_SPAN_CHAR_UUID			= '00010004-8d54-11e9-b475-0800200c9a66';
const RECEIVER_POINTS_CHAR_UUID			= '00010005-8d54-11e9-b475-0800200c9a66';


class ReceiverInfoCharacteristic extends bleno.Characteristic {
	constructor(logger) {
		super({
			uuid: RECEIVER_INFO_CHAR_UUID,
			properties: ['read'],
			descriptors: [
				new bleno.Descriptor({
					uuid: '2901',
					value: 'Receiver vendor, product and serial number'
				}),
				new bleno.Descriptor({
					uuid: '2904',
					value: Buffer.from([ 
						0x19, // UTF-8 string
						0x00, // 
						0x00, // 2700 = unitless
						0x27,
						0x01, // Bluetooth SIG namespace
						0x00, // 0x0000: no description
						0x00 
					])
				})
			]
		});

		this.logger = logger;
	}

	onReadRequest(offset, callback) {
		try {
			
			const info = receiver.info(); // { vendor, product, serial }

			if (typeof info === 'string') {
				this.logger.error(`[receiver-service] ${info}`);
				callback(this.RESULT_SUCCESS, Buffer.from('ERROR ' + info, 'utf8'));
				return;
			}

			const infoStr = `${info.vendor},${info.product},${info.serial}`;

			this.logger.info(`[receiver-service] Returning receiver information: '${infoStr}'`);

			callback(this.RESULT_SUCCESS, Buffer.from(infoStr, 'utf8'));

		} catch (err) {

			this.logger.error(`[receiver-service] ${err}`);
			callback(this.RESULT_UNLIKELY_ERROR);
		}
	}

}

class ReceiverCenterFreqCharacteristic extends bleno.Characteristic {
	constructor(logger) {
		super({
			uuid: RECEIVER_CENTER_FREQ_CHAR_UUID,
			properties: ['read', 'write'],
			descriptors: [
				new bleno.Descriptor({
					uuid: '2901',
					value: 'Receiver center frequency, Hz'
				}),
				new bleno.Descriptor({
					uuid: '2904',
					value: new Buffer.from([ 
						0x06, // format = uint16 (0 to 65,535)
						0x05, // exponent = 5 (0 to 6,553,500,000 Hz)
						0x22, // 0x2722: unit = Hz
						0x27,
						0x01, // Bluetooth SIG namespace
						0x00, // 0x0000: no description
						0x00 
					])
				})
			]
		});

		this.logger = logger;
		this.name = 'receiver_center_freq';
	}

	onReadRequest(offset, callback) {
		try {
			
			const fo = receiver.frequency(); // Hz
			const fo_buf = Buffer.alloc(2);

			fo_buf.writeInt16LE(fo / 1e5); // MHz * 10

			this.logger.info(`[receiver-service] Returning receiver center frequency: <0x${fo.toString(16).padStart(4, '0')}> ${fo / 1E6} MHz`);

			callback(this.RESULT_SUCCESS, fo_buf);

		} catch (err) {

			this.logger.error(`[receiver-service] ${err}`);
			callback(this.RESULT_UNLIKELY_ERROR);
		}
	}

	onWriteRequest(data, offset, withoutResponse, callback) {

		const fo = data.readUInt16LE(0);

		if (offset) {
			callback(this.RESULT_ATTR_NOT_LONG);

		} else if (data.length !== 2){
			callback(this.RESULT_INVALID_ATTRIBUTE_LENGTH);

		} else {

			try {

				receiver.frequency(fo * 1e5);

				this.logger.info(`[receiver-service] Receiver center frequency set <0x${fo.toString(16).padStart(4, '0')}> ${fo / 10} MHz`);
				callback(this.RESULT_SUCCESS);

			} catch (err) {

				this.logger.error(`[receiver-service] ${err}`);
				callback(this.RESULT_UNLIKELY_ERROR);
			}
	
		}
	}

}

class ReceiverSpanCharacteristic extends bleno.Characteristic {
	constructor(logger) {
		super({
			uuid: RECEIVER_SPAN_CHAR_UUID,
			properties: ['read', 'write'],
			descriptors: [
				new bleno.Descriptor({
					uuid: '2901',
					value: 'Receiver span frequency, Hz'
				}),
				new bleno.Descriptor({
					uuid: '2904',
					value: Buffer.from([ 
						0x06, // format = uint16 (0 to 65,535)
						0x02, // exponent = 2 (0 to 6,553,500 Hz)
						0x22, // 0x2722: unit = Hz
						0x27,
						0x01, // Bluetooth SIG namespace
						0x00, // 0x0000: no description
						0x00 
					])
				})
			]
		});

		this.logger = logger;
		this.name = 'receiver_span';
		
		this.span = Buffer.alloc(2); // 2-byte buffer for span
		this.span.writeInt16LE(1600); // 160 kHz
	}

	onReadRequest(offset, callback) {
		try {
			
			const span = this.span.readInt16LE(0);

			this.logger.info(`[receiver-service] Returning receiver span: <0x${span.toString(16).padStart(4, '0')}> ${span / 10} kHz`);

			callback(this.RESULT_SUCCESS, this.span);

		} catch (err) {

			this.logger.error(`[receiver-service] ${err}`);
			callback(this.RESULT_UNLIKELY_ERROR);
		}
	}

}

class ReceiverPointsCharacteristic extends bleno.Characteristic {
	constructor(logger) {
		super({
			uuid: RECEIVER_POINTS_CHAR_UUID,
			properties: ['read'],
			descriptors: [
				new bleno.Descriptor({
					uuid: '2901',
					value: 'Receiver number of data points'
				}),
				new bleno.Descriptor({
					uuid: '2904',
					value: Buffer.from([ 
						0x06, // format = uint16 (0 to 65,535)
						0x00, // exponent = 0 (0 to 65,535 points)
						0x00, // 0x2700: unitless
						0x27,
						0x01, // Bluetooth SIG namespace
						0x00, // 0x0000: no description
						0x00 
					])
				})
			]
		});

		this.logger = logger;
		this.name = 'receiver_points';
		
		this.points = Buffer.alloc(2); // 2-byte buffer for span
		this.points.writeInt16LE(256); // 256 points
	}

	onReadRequest(offset, callback) {
		try {
			
			const N = this.points.readInt16LE(0);

			this.logger.info(`[receiver-service] Returning receiver points: <0x${N.toString(16).padStart(4, '0')}> (${N} points)`);

			callback(this.RESULT_SUCCESS, this.points);

		} catch (err) {

			this.logger.error(`[receiver-service] ${err}`);
			callback(this.RESULT_UNLIKELY_ERROR);
		}
	}

}

class ReceiverDataCharacteristic extends bleno.Characteristic {
	constructor(logger) {
		super({
			uuid: RECEIVER_DATA_CHAR_UUID,
			properties: ['read', 'notify'],
			descriptors: [
				new bleno.Descriptor({
					uuid: '2901',
					value: 'Received power in decibels above 1mW reference, dBm'
				})
			]
		});

		this.logger = logger;
		this.name = 'receiver_data';

		this.buffer = Buffer.alloc(2); // 2-byte buffer for 16 bit Int
		this.buffer.writeInt16LE(-13000); // start at -130 dBm
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

		let min = -130;
		let max = -80;
		let noise = 1.5;

		const previous = this.buffer.readInt16LE(0) / 100;

		min = Math.max(min, previous - noise);
		max = Math.min(max, previous + noise);
	
		let p = Math.random() * (max - min) + min;
	
		p = Math.max(Math.min(p, max), min);
	
		this.buffer.writeInt16LE(p * 100);

		if (!suppressNotify) {
			this.notify();
		}
	}

	start() {
		this.logger.info('[receiver-service] Starting receiver data characteristic');

		// enable the receiver power bus
		rx_pwr(true);
	}

	stop() {
		this.logger.info('[receiver-service] Stopping receiver data characteristic');

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

		const _rcvrInfo = new ReceiverInfoCharacteristic(logger);
		const _rcvrData = new ReceiverDataCharacteristic(logger);
		const _rcvrCenterFreq = new ReceiverCenterFreqCharacteristic(logger);
		const _rcvrSpan = new ReceiverSpanCharacteristic(logger);
		const _rcvrPoints = new ReceiverPointsCharacteristic(logger);

		super({
			uuid: RECEIVER_SERVICE_UUID,
			characteristics: [ _rcvrInfo, _rcvrData, _rcvrCenterFreq, _rcvrSpan, _rcvrPoints ]
		});

		this.name = 'receiver_service';
		this.rcvrInfo = _rcvrInfo;
		this.rcvrData = _rcvrData;
		this.rcvrCenterFreq = _rcvrCenterFreq;
		this.rcvrSpan = _rcvrSpan;
		this.rcvrPoints = _rcvrPoints;
	}

	start() { 
		this.rcvrData.start();
	}

	stop() { 
		this.rcvrData.stop();
	}
}

module.exports = ReceiverService;