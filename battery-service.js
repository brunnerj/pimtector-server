const bleno = require('bleno');

class BatteryLevelCharacteristic extends bleno.Characteristic {
	constructor() {
		super({
			uuid: '2A19',
			properties: ['read'],
			descriptors: [
				new bleno.Descriptor({
					uuid: '2901',
					value: 'Battery level between 0 and 100 percent'
				}),
				new bleno.Descriptor({
					uuid: '2904',
					value: new Buffer([0x04, 0x01, 0x27, 0xAD, 0x01, 0x00, 0x00 ])
				})
			]
		});

		this.name = 'Battery';
	}

	onReadRequest(offset, callback) {
		try {
			const fakeLevel = Math.floor(Math.random()*(100-30+1)+30); // fake level between 30 and 100 (%)
			const result = new Buffer([ fakeLevel ]);

			console.log(`Returning battery result: ${result}`);

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
			uuid: '180F',
			characteristics: [
				new BatteryLevelCharacteristic()
			]
		});

		this.name = 'Battery';
	}
}

module.exports = BatteryService;