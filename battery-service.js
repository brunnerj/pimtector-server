'use strict';

const bleno = require('bleno');

class BatteryLevelCharacteristic extends bleno.Characteristic {
	constructor() {
		super({
			uuid: '2a19',
			properties: ['read'],
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

		this.name = 'Battery';
	}

	onReadRequest(offset, callback) {
		try {
			const level = Math.floor(Math.random()*(100-30+1)+30); // fake level between 30 and 100 (%)
			const result = new Buffer.from([ level ]); // level coerced to uint8 with & 255 operation

			console.log(`Returning battery result: ${result.toString('hex')} (${level} %)`);

			callback(this.RESULT_SUCCESS, result);

		} catch (err) {

			console.error(err);
			callback(this.RESULT_UNLIKELY_ERROR);
		}
	}
}


class BatteryService extends bleno.PrimaryService {
	constructor() {
		super({
			uuid: '180f',
			characteristics: [
				new BatteryLevelCharacteristic()
			]
		});

		this.name = 'battery_service';
	}
}

module.exports = BatteryService;