'use strict';

const SERVER_APP_NAME = 'PIMtector';

const bleno = require('bleno');
const BatteryService = require('./battery-service');


// Set up the service classes...

// Battery Service
// Read only battery level between 0 and 100 percent
const batteryService = new BatteryService();


// Group services and uuid's for easy consumption
const services = [ batteryService ];
const serviceUUIDs = [ batteryService.uuid ];


console.log(`${SERVER_APP_NAME} starting bleno server...`);


// Wait for power on to start advertising our services
bleno.on('stateChange', state => {

	console.log(`[bleno] Adapter changed state to ${state}`);

	if (state === 'poweredOn') {
		
		bleno.startAdvertising(SERVER_APP_NAME, serviceUUIDs, err => {
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

	console.log('Configuring services...');
	
	bleno.setServices(services, err => {
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
	bleno.startAdvertising();
});
