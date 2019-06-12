var server = new(require('bluetooth-serial-port')).BluetoothSerialPortServer();

var CHANNEL = 10; // service channel; defaults to 1 if omitted
var UUID = 'eef4ca20-8d54-11e9-b475-0800200c9a66';

server.on('data', (buffer) => {

	console.log('Received data from client: ' + buffer);

	// ...

	console.log('Sending data to client');
	server.write(Buffer.from('...'), (err, bytesWritten) => {
		if (err) {
			console.error('Error!: ' + err);
		} else {
			console.log('Send ' + bytesWritten + ' to the client!');
		}
	});
});

server.listen((clientAddress) => {

	console.log('Client: ' + clientAddress + ' connected!');

}, (error) => {

	console.error('Something bad happened!: ' + error);

}, { uuid: UUID, channel: CHANNEL} );

