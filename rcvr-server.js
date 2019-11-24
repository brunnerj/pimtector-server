'use strict';

const port = 8000;

const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

let rx_pwr = () => {}; // NOP unless we're on a RPi (linux)
if (process.platform === 'linux') {

	// use GPIO13 to enable/disable the receiver
	// USB power bus on user connect/disconnect
	const Gpio = require('onoff').Gpio;
	const GPIO_RX_EN = 13; // Enable/disable the receiver (RX) USB power bus (GPIO PIN33 == GPIO13)
	const rcvr_en = new Gpio(GPIO_RX_EN, 'out');

	rx_pwr = (enable) => {
		rcvr_en.writeSync(enable ? Gpio.HIGH : Gpio.LOW);
	}
}

const logger = require('./logging');

const device = require('./services/receiver');

const wrapResult = (command, result) => {
	const response = {};

	if (typeof result === 'string') {
		response['error'] = result;
	} else {
		response[command] = result;
	}

	return response;
};

const log = (msg) => {
	logger.info(`[rcvr-server] ${msg}`);
}

app.use(express.static('public'));

// handle POSTed json
app.use(express.json());

// Log all requests
app.use(function (req, res, next) {
	//log(`${req.method} ${req.url}`);
	next();
})

// Read-only requests
app.get('/info', (req, res) => { res.json(wrapResult('info', device.info())); });
app.get('/gains', (req, res) => { res.json(wrapResult('gains', device.gains())); });

// Read/write requests
app.route('/gain')
	.get((req, res) => {
		res.json(wrapResult('gain', device.gain()));
	})
	.post((req, res) => {
		res.json(wrapResult('gain', device.gain(req.body.gain)));
	});

app.route('/freqCorrection')
	.get((req, res) => {
		res.json(wrapResult('freqCorrection', device.freqCorrection()));
	})
	.post((req, res) => {
		res.json(wrapResult('freqCorrection', device.freqCorrection(req.body.freqCorrection)));
	});

app.route('/frequency')
	.get((req, res) => {
		res.json(wrapResult('frequency', device.frequency()));
	})
	.post((req, res) => {
		res.json(wrapResult('frequency', device.frequency(req.body.frequency)));
	});

app.route('/sampleRate')
	.get((req, res) => {
		res.json(wrapResult('sampleRate', device.sampleRate()));
	})
	.post((req, res) => {
		res.json(wrapResult('sampleRate', device.sampleRate(req.body.sampleRate)));
	});

app.route('/offsetTuning')
	.get((req, res) => {
		res.json(wrapResult('offsetTuning', device.offsetTuning()));
	})
	.post((req, res) => {
		res.json(wrapResult('offsetTuning', device.offsetTuning(req.body.offsetTuning)));
	});


// Settings
app.route('/averages')
	.get((req, res) => {
		res.json(wrapResult('averages', device.settings.averages));
	})
	.post((req, res) => {
		device.settings.averages = req.body.averages;
		res.json(wrapResult('averages', device.settings.averages));
	});

app.route('/decimate')
	.get((req, res) => {
		res.json(wrapResult('decimate', device.settings.decimate));
	})
	.post((req, res) => {
		device.settings.decimate = req.body.decimate;
		res.json(wrapResult('decimate', device.settings.decimate));
	});

app.route('/chunkDiv')
	.get((req, res) => {
		res.json(wrapResult('chunkDiv', device.settings.chunkDiv));
	})
	.post((req, res) => {
		device.settings.chunkDiv = req.body.chunkDiv;
		res.json(wrapResult('chunkDiv', device.settings.chunkDiv));
	});

app.route('/blocks')
	.get((req, res) => {
		res.json(wrapResult('blocks', device.settings.blocks));
	})
	.post((req, res) => {
		device.settings.blocks = req.body.blocks;
		res.json(wrapResult('blocks', device.settings.blocks));
	});

// Write-only requests
app.post('/gainMode', (req, res) => { res.json(wrapResult('gainMode', req.body.gainMode)); });
app.post('/agc', (req, res) => { res.json(wrapResult('agc', req.body.agc)); });
app.post('/resetBuffer', (req, res) => { res.json(wrapResult('resetBuffer', device.resetBuffer())); });

// track connections (only 1 allowed) and data stream running
let connection = false;
let running = false;

// buffer data traces from receiver
const buffer = [];
const bufferMaxLength = 10;
const pushRate = 50; // ms

io.on('connection', (socket) => {

	let cycle = 0;
	const pushInterval = setInterval(() => {
		cycle++;

		if (buffer.length > 0 && cycle % 10 == 0) console.log(`BUFFER @ ${100 * (buffer.length / bufferMaxLength)}%`);

		if (connection && running && buffer.length > 0) {
			socket.emit('data', buffer.shift());
		}
	
	}, pushRate);

	function onStreamData(data) {

		if (!running) return;

		if (buffer.length < bufferMaxLength) {

			buffer.push(data);
		
		} else {

			log('SERVER BUFFER OVERFLOW');

		}
	}

	function onStreamEnd() {
		running = false;
		buffer.length = 0;
		log('Data stream stopped');
	}

	// enable receiver when user connected
	rx_pwr(true);

	log('user connected');
	connection = true;

	socket.on('disconnect', () => {

		log('user disconnected');
		device.stopData();
		clearInterval(pushInterval);
		connection = false;
		running = false;
		buffer.length = 0;

		// disable receiver when user disconnected
		rx_pwr(false);
	});

	socket.on('startData', () => {
		log('Start data stream requested');

		if (!connection || running) return;

		buffer.length = 0;
		if (device.startData(onStreamData, onStreamEnd, logger)) {
			logger.error('[rcvr-server] Error starting data stream');
		} else {
			running = true;
		}
	});

	socket.on('stopData', () => {
		log('Stop data stream requested');

		if (!running) return;

		if (device.stopData()) {
			logger.error('[rcvr-server] Error stopping data stream');

			onStreamEnd();
		}
	});
});

http.listen(port, () => { log(`Listening on *:${port}...`); });
