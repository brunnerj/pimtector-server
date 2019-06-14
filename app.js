'use strict';

/* PIMtector BLE device server service layout (Services, Characteristics, Descriptors):
 *
 *	- Service: Battery Service
 *		- Characteristic: Battery Level
 *			- Descriptor: Characteristic User Description
 *			- Descriptor: Characteristic Presentation Format (8bit uint, percent)
 *
 *	- Service: Device Information Service
 *		- Characteristic: Manufacturer
 *			- Descriptor: Characteristic User Description
 *			- Descriptor: Characteristic Presentation Format (utf8 string, unitless)
 *		- Characteristic: Model
 *			- Descriptor: Characteristic User Description
 *			- Descriptor: Characteristic Presentation Format (utf8 string, unitless)
 *		- Characteristic: HardwareVersion
 *			- Descriptor: Characteristic User Description
 *			- Descriptor: Characteristic Presentation Format (utf8 string, unitless)
 *		- Characteristic: FirmwareVersion
 *			- Descriptor: Characteristic User Description
 *			- Descriptor: Characteristic Presentation Format (utf8 string, unitless)
 *
 *	- Service: PIMtector Service
 *		- Characteristic: RSSI Level
 *			- Descriptor: Characteristic User Description
 *			- Descriptor: Characteristic Presentation Format (16bit int, decibel)
 */

const bleno = require('bleno');

const SERVER_APP_NAME = 'PIMtector';

const BatteryService = require('./battery-service');
const DeviceInformationService = require('./device-information-service');
const PIMtectorService = require('./pimtector-service');


// Create service classes
const batteryService = new BatteryService();
const deviceInformationService = new DeviceInformationService();
const pimtectorService = new PIMtectorService();


console.log(`${SERVER_APP_NAME} starting BLE peripheral server...`);


// Wait for power on to start advertising our services
bleno.on('stateChange', state => {

	console.log(`[bleno] Adapter changed state to ${state}`);

	if (state === 'poweredOn') {
		
		bleno.startAdvertising(SERVER_APP_NAME, [pimtectorService.uuid], err => {
			if (err) console.error(err);
		});

	} else {
		console.log(`Stopping advertising since state is ${state} (instead of poweredOn).`);
		bleno.stopAdvertising();
	}
});


// Configure the services when advertising starts
bleno.on('advertisingStart', err => {
	console.log('[bleno] advertisingStart')

	if(err) {
		console.error(err);
		return;
	}

	console.log('Configuring services');
	
	bleno.setServices([
		batteryService,
		deviceInformationService,
		pimtectorService
	], err => {
		if(err)
			console.error(err);
		else
			console.log('Services configured');
	});
});

// diagnostic messages
bleno.on('advertisingStartError', err => console.error('[bleno] advertisingStartError'));
bleno.on('advertisingStop', err => console.log('[bleno] advertisingStop'));

bleno.on('servicesSet', err => console.log('[bleno] servicesSet'));
bleno.on('servicesSetError', err => console.log('[bleno] servicesSetError'));


// Notify the console that we've accepted a connection
// and stop advertising
bleno.on('accept', function(clientAddress) {
	console.log(`[bleno] accept ${clientAddress}`);
	bleno.stopAdvertising();
});


// Notify the console that we have disconnected from a client
// and start advertising
bleno.on('disconnect', function(clientAddress) {
	console.log(`[bleno] disconnect ${clientAddress}`);
	bleno.startAdvertising(SERVER_APP_NAME, [pimtectorService.uuid], err => {
		if (err) console.error(err);
	});
});
