'use strict';

const bleno = require('bleno');


const PIMTECTOR_SERVICE_UUID	= '00010000-8d54-11e9-b475-0800200c9a66';
const RSSI_CHAR_UUID			= '00010001-8d54-11e9-b475-0800200c9a66';


class RSSICharacteristic extends bleno.Characteristic {
	constructor() {
		super({
			uuid: RSSI_CHAR_UUID,
			properties: ['read'],
			descriptors: [
				new bleno.Descriptor({
					uuid: '2901',
					value: 'RSSI power in decibels above 1mW reference, dBm'
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
	}

	onReadRequest(offset, callback) {
		try {
			const level = -1 * (Math.floor(Math.random() * (13000 - 8000 + 1)) + 8000); // fake level between -130 and -80 dBm (-13000 to -8000)
			const result = new Buffer.alloc(2); // 2 bytes, 16 bits for int16
			result.writeInt16LE(level);

			console.log(`Returning RSSI result: ${result} (${level})`);

			callback(this.RESULT_SUCCESS, result);

		} catch (err) {

			console.error(err);
			callback(this.RESULT_UNLIKELY_ERROR);
		}
	}
}


class PIMtectorService extends bleno.PrimaryService {
	constructor() {
		super({
			uuid: PIMTECTOR_SERVICE_UUID,
			characteristics: [
				new RSSICharacteristic()
			]
		});
	}
}

module.exports = PIMtectorService;