'use strict';

const bleno = require('bleno');


const MANUFACTURER = 'Brunner Technical Services LLC';
const MODEL_NUMBER = 'PT-1000';
const HARDWARE_REV = '1.0';
const FIRMWARE_REV = '1.0';


class ManufacturerNameCharacteristic extends bleno.Characteristic {
	constructor() {
		super({
			uuid: '2a29',
			properties: ['read'],
			value: Buffer.from(MANUFACTURER, 'utf8'),
			descriptors: [
				new bleno.Descriptor({
					uuid: '2901',
					value: 'Manufacturer name'
				})
			]
		});
	}
}

class ModelNumberCharacteristic extends bleno.Characteristic {
	constructor() {
		super({
			uuid: '2a24',
			properties: ['read'],
			value: Buffer.from(MODEL_NUMBER, 'utf8'),
			descriptors: [
				new bleno.Descriptor({
					uuid: '2901',
					value: 'Model number'
				})
			]
		});
	}
}

class HardwareRevisionCharacteristic extends bleno.Characteristic {
	constructor() {
		super({
			uuid: '2a27',
			properties: ['read'],
			value: Buffer.from(HARDWARE_REV, 'utf8'),
			descriptors: [
				new bleno.Descriptor({
					uuid: '2901',
					value: 'Hardware revision'
				})
			]
		});
	}
}

class FirmwareRevisionCharacteristic extends bleno.Characteristic {
	constructor() {
		super({
			uuid: '2a26',
			properties: ['read'],
			value: Buffer.from(FIRMWARE_REV, 'utf8'),
			descriptors: [
				new bleno.Descriptor({
					uuid: '2901',
					value: 'Firmware revision'
				})
			]
		});
	}
}

class DeviceInformationService extends bleno.PrimaryService {
	constructor(logger) {
		super({
			uuid: '180a',
			characteristics: [
				new ManufacturerNameCharacteristic(),
				new ModelNumberCharacteristic(),
				new HardwareRevisionCharacteristic(),
				new FirmwareRevisionCharacteristic()
			]
		});

		this.name = 'device_information_service';
	}
}

module.exports = DeviceInformationService;

