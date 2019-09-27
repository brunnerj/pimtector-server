'use strict';

const http = require('http');
const device = require('./receiver');


http.createServer((request, response) => {

	const command = request.url.substring(1); // strip leading forward slash
	let body = [];
	let result;
	let respObj = {};
	let resp;
	let statusCode = 200;

	console.log(`${request.method} ${command}`);

	request.on('error', (err) => {
		console.error(err);
		response.statusCode = 400;
		response.end();
	}).on('data', (chunk) => {
		body.push(chunk);
	}).on('end', () => {

		if (body.length > 0) {
			body = JSON.parse(Buffer.concat(body).toString());
		}

		response.on('error', (err) => {
			console.error(err);
		});
	
		if (request.method === 'GET') {
			switch (command) {
	
				case 'info':
					result = device.info();
					break;
	
				case 'gains':
					result = device.gains();
					break;

				case 'gain':
					result = device.gain();
					break;

				case 'freqCorrection':
					result = device.freqCorrection();
					break;

				case 'frequency':
					result = device.frequency();
					break;

				default:
					statusCode = 404;
					result = 'Unknown command';
			}

		} else if (request.method === 'POST') {
	
			switch (command) {
				
				case 'gainMode':
					result = device.gainMode(body.gainMode);
					break;
					
				case 'agc': 
					result = device.agc(body.agc);
					break;

				case 'gain':
					result = device.gain(body.gain);
					break;

				case 'freqCorrection':
					result = device.freqCorrection(body.freqCorrection);
					break;

				case 'frequency':
					result = device.frequency(body.frequency);
					break;

				case 'resetBuffer':
					result = device.resetBuffer();
					break;

				default:
					statusCode = 404;
					result = 'Unknown command';
			}
	
		} else {
	
			statusCode = 400;
			result = `Invalid method:  ${request.method}`;
		}
	
		respObj[command] = result;
		resp = JSON.stringify(respObj);

		response.writeHead(statusCode, {'Content-Type': 'application/json'});
		response.statusCode = statusCode;
		response.end(resp);
	
	});
}).listen(80);