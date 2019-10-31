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

const bleno = require('bleno');

const logger = require('./logging');

const BatteryService = require('./services/battery-service');
const DeviceInformationService = require('./services/device-information-service');
const ReceiverService = require('./services/receiver-service');


// Create service classes
const batteryService = new BatteryService(logger);
const deviceInformationService = new DeviceInformationService(logger);
const receiverService = new ReceiverService(logger);


const SERVER_APP_NAME = 'PIMtector';

logger.info(`${SERVER_APP_NAME} starting BLE peripheral server...`);


const advertise = () => {
	bleno.startAdvertising(SERVER_APP_NAME, [ 
		receiverService.uuid, 
		deviceInformationService.uuid, 
		batteryService.uuid 
	], err => {
		if (err) logger.error(err);
	});
}


// Wait for power on to start advertising our services
bleno.on('stateChange', state => {

	logger.info(`[bleno] Adapter changed state to ${state}`);

	if (state === 'poweredOn') {
		
		advertise();

	} else {
		logger.info(`Stopping advertising since state is ${state} (instead of poweredOn).`);
		bleno.stopAdvertising();
	}
});


// Configure the services when advertising starts
bleno.on('advertisingStart', err => {
	logger.info('[bleno] advertisingStart')

	if(err) {
		logger.error(err);
		return;
	}

	logger.info('Configuring services');
	
	bleno.setServices([
		batteryService,
		deviceInformationService,
		receiverService
	], err => {
		if(err)
			logger.error(err);
		else
			logger.info('Services configured');
	});
});

// diagnostic messages
bleno.on('advertisingStartError', err => logger.error('[bleno] advertisingStartError'));
bleno.on('advertisingStop', err => logger.info('[bleno] advertisingStop'));

bleno.on('servicesSet', err => logger.info('[bleno] servicesSet'));
bleno.on('servicesSetError', err => logger.info('[bleno] servicesSetError'));


// Notify the log that we've accepted a connection
// and stop advertising
bleno.on('accept', function(clientAddress) {
	logger.info(`[bleno] accept ${clientAddress}`);
	bleno.stopAdvertising();
	batteryService.start(); // start battery service updates
});


// Notify the log that we have disconnected from a client
// and start advertising
bleno.on('disconnect', function(clientAddress) {
	logger.info(`[bleno] disconnect ${clientAddress}`);
	batteryService.stop(); // stop battery service updates
	advertise();
});
