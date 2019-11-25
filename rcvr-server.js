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
		buffer.length = 0;
	});

app.route('/sampleRate')
	.get((req, res) => {
		res.json(wrapResult('sampleRate', device.sampleRate()));
	})
	.post((req, res) => {
		res.json(wrapResult('sampleRate', device.sampleRate(req.body.sampleRate)));
		buffer.length = 0;
	});

app.route('/offsetTuning')
	.get((req, res) => {
		res.json(wrapResult('offsetTuning', device.offsetTuning()));
	})
	.post((req, res) => {
		res.json(wrapResult('offsetTuning', device.offsetTuning(req.body.offsetTuning)));
		buffer.length = 0;
	});


// Settings
app.route('/averages')
	.get((req, res) => {
		res.json(wrapResult('averages', device.settings.averages));
	})
	.post((req, res) => {
		device.settings.averages = req.body.averages;
		res.json(wrapResult('averages', device.settings.averages));
		buffer.length = 0;
	});

app.route('/decimate')
	.get((req, res) => {
		res.json(wrapResult('decimate', device.settings.decimate));
	})
	.post((req, res) => {
		device.settings.decimate = req.body.decimate;
		res.json(wrapResult('decimate', device.settings.decimate));
		buffer.length = 0;
	});

app.route('/chunkDiv')
	.get((req, res) => {
		res.json(wrapResult('chunkDiv', device.settings.chunkDiv));
	})
	.post((req, res) => {
		device.settings.chunkDiv = req.body.chunkDiv;
		res.json(wrapResult('chunkDiv', device.settings.chunkDiv));
		buffer.length = 0;
	});

app.route('/blocks')
	.get((req, res) => {
		res.json(wrapResult('blocks', device.settings.blocks));
	})
	.post((req, res) => {
		device.settings.blocks = req.body.blocks;
		res.json(wrapResult('blocks', device.settings.blocks));
		buffer.length = 0;
	});

// Write-only requests
app.post('/gainMode', (req, res) => { res.json(wrapResult('gainMode', req.body.gainMode)); });
app.post('/agc', (req, res) => { res.json(wrapResult('agc', req.body.agc)); });
app.post('/resetBuffer', (req, res) => { 
	res.json(wrapResult('resetBuffer', device.resetBuffer())); 
	buffer.length = 0;
});

// track connections (only 1 allowed) and data stream running
let connection = false;
let running = false;

// buffer data traces from receiver
const buffer = [];
const bufferLengthMax = 10;

const pushRateMax = 250;
const pushRateMin = 20;
let pushRate = pushRateMin;
let pushTmo;
let overflow = false;

let timestamp;
let actualRate;

io.on('connection', (socket) => {

	const push = () => {

		const bpc = buffer.length / bufferLengthMax;

		const now = new Date();
		if (timestamp) {
			actualRate = now - timestamp;
		}
		timestamp = now;

		const fullWidth = 25;
		const fillWidth = Math.floor(bpc * fullWidth);
		const ovl = overflow ? '\u001b[31m*OVL*\u001b[0m' : '';
		const bar = '[' + '#'.repeat(fillWidth) + ' '.repeat(fullWidth - fillWidth) + '] ';

		process.stdout.write('\u001b[1000D' + bar + (100 * bpc).toFixed(0) + '%, ' + pushRate + ' ms (' + actualRate + ' ms) ' + ovl + '\x1b[K');

		if (connection && running && buffer.length > 0) {
			socket.emit('data', buffer.shift());

			if (bpc > 0.7) {
				pushRate = Math.max(pushRateMin, pushRate - 10);
			} else if (bpc < 0.3) {
				pushRate = Math.min(pushRateMax, pushRate + 10);
			}

		} else {
			pushRate = pushRateMax;
		}

		if (pushTmo) clearTimeout(pushTmo);
		pushTmo = setTimeout(push, pushRate);
	};

	function onStreamData(data) {

		if (!running) return;

		if (buffer.length < bufferLengthMax) {
			overflow = false;
			buffer.push(data);
		
		}  else {

			overflow = true;
		}
	}

	function onStreamEnd() {

		log('Data stream stopped' + (running ? ' - while running!' : ''));

		if (running) {
			log('Attempting to restart data stream');
			
			device.resetBuffer();

			if (device.startData(onStreamData, onStreamEnd, logger)) {
				logger.error('[rcvr-server] Error restarting data stream');
				running = false;
			}
		}
	}

	// enable receiver when user connected
	rx_pwr(true);

	// start push loop
	push();

	log('user connected');
	connection = true;

	socket.on('disconnect', () => {

		log('user disconnected');

		device.stopData();
		clearTimeout(pushTmo);
		connection = false;
		running = false;
		buffer.length = 0;

		// disable receiver when user disconnected
		rx_pwr(false);
	});

	socket.on('startData', () => {

		if (!connection || running) return;

		log('Start data stream requested');

		running = true;
		buffer.length = 0;
		if (device.startData(onStreamData, onStreamEnd, logger)) {
			logger.error('[rcvr-server] Error starting data stream');
			running = false;
		}
	});

	socket.on('stopData', () => {

		if (!running) return;

		log('Stop data stream requested');
		
		running = false;

		if (device.stopData()) {
			logger.error('[rcvr-server] Error stopping data stream');

			onStreamEnd();
		}
	});
});

http.listen(port, () => { log(`Listening on *:${port}...`); });

['SIGINT', 'SIGTERM', 'SIGHUP'].forEach(signal => process.on(signal, () => {
	log(`Got ${signal} - shutting down`);

	device.stopData();
	clearTimeout(pushTmo);
	connection = false;
	running = false;
	buffer.length = 0;

	if (io) io.emit('disconnect');

	http.close(() => { process.exit(0); });
}));