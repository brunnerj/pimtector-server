'use strict';

/* BLE device server service layout (Services, Characteristics, Descriptors):
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
 *	- Service: Receiver Service
 *		- Characteristic: Receiver Level
 *			- Descriptor: Characteristic User Description
 *			- Descriptor: Characteristic Presentation Format (16bit int, decibel)
 */

const bleno = require('@abandonware/bleno');

const logger = require('./logging');

const BatteryService = require('./services/battery-service');
const DeviceInformationService = require('./services/device-information-service');
const ReceiverService = require('./services/receiver-service');


// Create service classes
const batteryService = new BatteryService(logger);
const deviceInformationService = new DeviceInformationService(logger);
const receiverService = new ReceiverService(logger);


const SERVER_APP_NAME = 'PIMtector';

logger.info(`[ble-server] starting BLE peripheral server...`);


const advertise = () => {
	bleno.startAdvertising(SERVER_APP_NAME, [ 
		receiverService.uuid, 
		deviceInformationService.uuid, 
		batteryService.uuid 
	], err => {
		if (err) logger.error(`[ble-server] ${err}`);
	});
}


// Wait for power on to start advertising our services
bleno.on('stateChange', state => {

	logger.info(`[ble-server] Adapter changed state to ${state}`);

	if (state === 'poweredOn') {
		
		advertise();

	} else {
		logger.info(`[ble-server] Stopping advertising since state is ${state} (instead of poweredOn).`);
		bleno.stopAdvertising();
	}
});


// Configure the services when advertising starts
bleno.on('advertisingStart', err => {
	logger.info('[ble-server] advertisingStart')

	if(err) {
		logger.error(`[ble-server] ${err}`);
		return;
	}

	logger.info('[ble-server] Configuring services');
	
	bleno.setServices([
		batteryService,
		deviceInformationService,
		receiverService
	], err => {
		if(err)
			logger.error(`[ble-server] ${err}`);
		else
			logger.info('[ble-server] Services configured');
	});
});

// diagnostic messages
bleno.on('advertisingStartError', err => logger.error('[ble-server] advertisingStartError'));
bleno.on('advertisingStop', err => logger.info('[ble-server] advertisingStop'));

bleno.on('servicesSet', err => logger.info('[ble-server] servicesSet'));
bleno.on('servicesSetError', err => logger.info('[ble-server] servicesSetError'));


// Notify the log that we've accepted a connection
// and stop advertising
bleno.on('accept', function(clientAddress) {
	logger.info(`[ble-server] accept ${clientAddress}`);
	bleno.stopAdvertising();

	// start battery and receiver service updates
	batteryService.start(); 
	receiverService.start();
});


// Notify the log that we have disconnected from a client
// and start advertising
bleno.on('disconnect', function(clientAddress) {
	logger.info(`[ble-server] disconnect ${clientAddress}`);

	// stop battery and receiver service updates
	batteryService.stop(); 
	receiverService.stop();

	// start advertising BLE
	advertise();
});
