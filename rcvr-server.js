'use strict';

const port = 8000;

const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
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
	log(`${req.method} ${req.url}`);
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

app.route('/frames')
	.get((req, res) => {
		res.json(wrapResult('frames', device.settings.frames));
	})
	.post((req, res) => {
		device.settings.frames = req.body.frames;
		res.json(wrapResult('frames', device.settings.frames));
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
const bufferMaxLength = 300;
const pubRate = 10;

io.on('connection', (socket) => {

	let pushInterval = null;

	function onStreamData(data) {
		if (buffer.length < bufferMaxLength) {
			//log(`buffering a ${data.length} point trace`);
			buffer.push(data);
		} else {
			log('SERVER BUFFER OVERFLOW');
		}
		if (!pushInterval) {
			pushInterval = setInterval(() => {
				if (buffer.length > 0) {
					socket.emit('data', buffer.shift());
				}
			}, pubRate);
		}
	}

	function onStreamEnd() {
		running = false;
		if (pushInterval) clearInterval(pushInterval);
		pushInterval = null;
		log('Data stream stopped')
	}

	log('user connected');
	connection = true;

	socket.on('disconnect', () => {
		log('user disconnected');
		connection = false;
		running = false;
		device.stopData();
	});

	socket.on('startData', () => {
		log('Start data stream requested');

		if (!connection || running) return;

		buffer.length = 0;
		if (device.startData(onStreamData, onStreamEnd)) {
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
