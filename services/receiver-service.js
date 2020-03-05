'use strict';

const bleno = require('@abandonware/bleno');

const receiver = require('./receiver');

// use GPIO13 to enable/disable the receiver
// USB power bus on user connect/disconnect
const Gpio = require('onoff').Gpio;
const GPIO_RX_EN = 13; // Enable/disable the receiver (RX) USB power bus (GPIO PIN33 == GPIO13)
const rcvr_en = new Gpio(GPIO_RX_EN, 'out');

function sleep(ms) {
	return new Promise(resolve => setTimeout(resolve, ms));
}

const RX_PWR_WAIT = 5000;
async function rx_pwr(enable) { 
	rcvr_en.writeSync(enable ? Gpio.HIGH : Gpio.LOW);

	// wait a bit after power up
	if (enable) {

		console.log('Waiting for Rx power up...');
		await sleep(RX_PWR_WAIT);
		console.log('...done waiting for Rx power up.');
	}
}

const RECEIVER_SERVICE_UUID				= '00010000-8d54-11e9-b475-0800200c9a66';

const RECEIVER_INFO_CHAR_UUID			= '00010001-8d54-11e9-b475-0800200c9a66';
const RECEIVER_DATA_CHAR_UUID			= '00010002-8d54-11e9-b475-0800200c9a66';
const RECEIVER_CENTER_FREQ_CHAR_UUID	= '00010003-8d54-11e9-b475-0800200c9a66';
const RECEIVER_SAMPLE_RATE_CHAR_UUID	= '00010004-8d54-11e9-b475-0800200c9a66';

function u16BufToOctet(u16Buf) {
	const str = u16Buf.toString('hex');
	return `<0x ${str.slice(0,2)} ${str.slice(2)}>`;
} 

async function loadCorrectionTable(table) {
	// TODO: Load corrections from file
}

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
				this.logger.error(`[receiver-service][ReceiverInfoCharacteristic.onReadRequest] ${info}`);
				callback(this.RESULT_SUCCESS, Buffer.from('ERROR ' + '100: Receiver failure', 'utf8'));
				return;
			}

			const infoStr = `${info.vendor},${info.product},${info.serial}`;

			this.logger.info(`[receiver-service] Returning receiver information: '${infoStr}'`);
			callback(this.RESULT_SUCCESS, Buffer.from(infoStr, 'utf8'));

		} catch (err) {

			this.logger.error(`[receiver-service][ReceiverInfoCharacteristic.onReadRequest] ${err}`);
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
			
			const fo_Hz = receiver.frequency(); // Hz
			const fo_MHz = fo_Hz / 1e6;
			const fo_buf = Buffer.alloc(2);

			fo_buf.writeUInt16LE(fo_MHz * 10); // MHz * 10

			this.logger.info(`[receiver-service] Returning receiver center frequency: ${u16BufToOctet(fo_buf)} ${fo_MHz} MHz`);

			callback(this.RESULT_SUCCESS, fo_buf);

		} catch (err) {

			this.logger.error(`[receiver-service][ReceiverCenterFreqCharacteristic.onReadRequest] ${err}`);
			callback(this.RESULT_UNLIKELY_ERROR);
		}
	}

	onWriteRequest(data, offset, withoutResponse, callback) {

		const fo = data.readUInt16LE(0); // MHz * 10
		const fo_MHz = fo / 10;
		const fo_Hz = fo * 1e5;
		
		this.logger.info(`[receiver-service] Request to set receiver center frequency => ${u16BufToOctet(data)} ${fo_MHz} MHz`);
		
		if (offset) {
			callback(this.RESULT_ATTR_NOT_LONG);

		} else if (data.length !== 2) {
			callback(this.RESULT_INVALID_ATTRIBUTE_LENGTH);

		} else {

			try {

				const result = receiver.frequency(fo_Hz);

				if (result !== fo_Hz) {
					throw new Error(result);
				}

				this.logger.info(`[receiver-service] Successfully set receiver center frequency => ${u16BufToOctet(data)} ${fo_MHz} MHz`);
				callback(this.RESULT_SUCCESS);

			} catch (err) {

				this.logger.error(`[receiver-service][ReceiverCenterFreqCharacteristic.onWriteRequest] ${err}`);
				callback(this.RESULT_UNLIKELY_ERROR);
			}
	
		}
	}

}

class ReceiverSampleRateCharacteristic extends bleno.Characteristic {
	constructor(logger) {
		super({
			uuid: RECEIVER_SAMPLE_RATE_CHAR_UUID,
			properties: ['read'],
			descriptors: [
				new bleno.Descriptor({
					uuid: '2901',
					value: 'Receiver sample rate, Hz'
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
		this.name = 'receiver_sample_rate';
	}

	onReadRequest(offset, callback) {
		try {
			
			const fs_Hz = receiver.sampleRate(); // Hz

			// Effective sample rate is Fs / decimation factor
			const fsEffective_Hz = fs_Hz / receiver.settings.decimate;

			const fs_kHz = fsEffective_Hz / 1e3;
			const fs_buf = Buffer.alloc(2);

			fs_buf.writeUInt16LE(fs_kHz * 10); // kHz * 10

			this.logger.info(`[receiver-service] Returning receiver sample rate: ${u16BufToOctet(fs_buf)} ${fs_kHz} kHz`);

			callback(this.RESULT_SUCCESS, fs_buf);

		} catch (err) {

			this.logger.error(`[receiver-service][ReceiverSampleRateCharacteristic.onReadRequest] ${err}`);
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
		this.buffer; // allocated in onSubscribe > onData, filled with data, then notify()
		this.endIndex; // set in onSubscribe by the client
	}

	onReadRequest(offset, callback) {
		try {

			callback(this.RESULT_SUCCESS, this.buffer);

		} catch (err) {

			this.logger.error(`[receiver-service][ReceiverDataCharacteristic.onReadRequest] ${err}`);
			callback(this.RESULT_UNLIKELY_ERROR);
		}
	}

	start() {
		this.logger.info('[receiver-service] Starting receiver service');

		// enable the receiver power bus
		this.logger.info('[receiver-service] Enabling receiver power.');
		
		rx_pwr(true)
			.then(() => {
				this.logger.info('[receiver-service] Reciever power enabled.');
				this.logger.info('[receiver-service] Loading corrections table.');
				loadCorrectionTable(receiver.settings.correctionTable)
					.then(() => {
						this.logger.info('[receiver-service] Corrections table loaded.');
					})
					.catch((err) => {
						this.logger.error(`[receiver-service] ${err}`);
						throw err;
					});
			}).catch((err) => {
				this.logger.error(`[receiver-service] ${err}`);
				throw err;
			});

		// set some starting (or constant) receiver settings
		const fs = receiver.sampleRate(2.56e6);

		// Reject here if we don't get a number back
		if (typeof fs === 'string') {
			this.logger.error(`[receiver-service] ${fs}`);
			throw fs;
		}
			
		this.logger.info(`[receiver-service] Sample rate => ${fs} Hz`);

		// receiver hardware settings
		receiver.gainMode(0);
		receiver.agc(0);
		receiver.gain(42);
		receiver.offsetTuning(1);

		// 'soft' settings
		receiver.settings.decimate = 16;
		receiver.settings.averages = 8;
		receiver.settings.chunkDiv = 1;
		receiver.settings.dspBlocks = 2;

		// set initial center frequency and read span and points
		this.frequency = receiver.frequency(725e6);
		this.logger.info(`[receiver-service] Center frequency => ${this.frequency} Hz`);
		
		this.span = receiver.span();
		this.logger.info(`[receiver-service] Frequency span => ${this.span} Hz`);
		
		this.N = receiver.points();
		this.logger.info(`[receiver-service] Number of points => ${this.N}`);
	}

	stop() {
		this.logger.info('[receiver-service] Stopping receiver data characteristic');

		if (this.handle) 
			this.onUnsubscribe();

		// clear receiver correction table
		receiver.settings.correctionTable = [];

		// disable receiver power bus
		rx_pwr(false);
	}

	onSubscribe(maxValueSize, updateValueCallback) {
		this.logger.info(`[receiver-service] Receiver service subscribing, max value size is ${maxValueSize}`);
		this.updateValueCallback = updateValueCallback;
		this.endIndex = maxValueSize + 1; // because we'll use slice() which is exclusive of the end index

		function onEnd() {
			this.logger.info('[receiver-service][onSubscribe > onEnd] Receiver data stream stopped');
		}

		function onData(data) {
			this.buffer = data.slice(0, this.endIndex);
			this.notify();
		}

		receiver.resetBuffer();

		if (receiver.startData(onData.bind(this), onEnd.bind(this), this.logger)) {
			this.logger.error('[receiver-service][onSubscribe] Error starting receiver data stream');
		}
	}

	onUnsubscribe() {
		this.logger.info('[receiver-service] Receiver service unsubscribing');
		this.updateValueCallback = null;

		if (receiver.stopData()) {
			this.logger.error('[receiver-service][onUnsubscribe] Error stopping receiver data stream');
		}
	}

	notify() {
		if (this.updateValueCallback && this.buffer && this.buffer.length) {

			this.updateValueCallback(this.buffer.slice(0, this.endIndex));
		}
	}
}

class ReceiverService extends bleno.PrimaryService {
	constructor(logger) {

		const _rcvrInfo = new ReceiverInfoCharacteristic(logger);
		const _rcvrData = new ReceiverDataCharacteristic(logger);
		const _rcvrCenterFreq = new ReceiverCenterFreqCharacteristic(logger);
		const _rcvrSampleRate = new ReceiverSampleRateCharacteristic(logger);

		super({
			uuid: RECEIVER_SERVICE_UUID,
			characteristics: [ _rcvrInfo, _rcvrData, _rcvrCenterFreq, _rcvrSampleRate ]
		});

		this.name = 'receiver_service';
		this.rcvrInfo = _rcvrInfo;
		this.rcvrData = _rcvrData;
		this.rcvrCenterFreq = _rcvrCenterFreq;
		this.rcvrSampleRate = _rcvrSampleRate;
	}

	start() {
		this.rcvrData.start();
	}

	stop() { 
		this.rcvrData.stop();
	}
}

module.exports = ReceiverService;