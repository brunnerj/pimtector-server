'use strict';

const rtlsdr = require('rtl-sdr');

const { WINDOWS } = require('./dsp/window');
const { signal } = require('./dsp/signal');
const { spectrum } = require('./dsp/spectrum');

const Zo = 50;
const Log_Zo = 20 * Math.log10(Zo);

const settings = {

	Fo: 700e6, // center frequency, Hz
	adcBits: 8, // ADC bit width
	adcFullscaleVolts: 2, // ADC full scale Vpeak-to-peak

	N: 2**13, // number of I/Q points used to process ADC raw data and sets the device buffer length
	Fs: 2.56e6, // ADC sample rate, Hz

	chunkDiv: 2, // Make chunks of N/chunkDiv lengths (1, 2, 4, 8, 16, ...)
	overlap: 0.5, // overlap chunks by this amount (0 to 1 is no overlap to 100%)

	window: WINDOWS.blackman, // time-domain window weighting for the raw ADC data

	blocks: 2, // Each ADC chunk is split into this many blocks (time domain aliasing
	// is used here, as blocks are added, point-by-point yielding an aliased time signal
	// that is N/blocks long).  This is the so-called "Polyphase Filter Bank Technique".
	// See e.g., https://www.embedded.com/dsp-tricks-building-a-practical-spectrum-analyzer/,
	// https://casper.ssl.berkeley.edu/wiki/The_Polyphase_Filter_Bank_Technique, and
	// http://wvurail.org/dspira/labs/05/ (section 5.6).

	decimate: 16, // decimation factor to lower the effective sample rate to narrow the span

	averages: 8 // combine this many spectral traces to make one displayed trace
}

const ERRORS = {

	100: 'device not found',
	200: 'opening device',

	// READ errors
	300: 'reading device info',
	310: 'reading device gains',

	350: 'reading device gain',
	360: 'reading device frequency correction',
	370: 'reading device center frequency',
	380: 'reading device sample rate',
	390: 'reading device offset tuning mode',

	// WRITE errors
	410: 'resetting device buffer',

	420: 'setting device gain mode',
	430: 'setting device AGC mode',

	450: 'setting device gain - check that manual gain mode is set and the gain value is supported by the device',
	460: 'setting device frequency correction',
	470: 'setting device center frequency',
	480: 'setting device sample rate',
	490: 'setting device offset tuning mode',

	// DATA errors
	500: 'starting device acquisition',
	510: 'stopping device acquisition'

}

function error(e, code) {

	if (!e) return;

	if (ERRORS[e] === undefined)
		return `${e}: Unknown error${code ? ' (' + code + ')' : ''}`;

	return `${e}: Error ${ERRORS[e]}${code ? ' (' + code + ')' : ''}`;
}

function bufToString(buf) {
	return buf.toString('utf8', 0, buf.indexOf('\0'));
}

function deviceFound() {
	return !!rtlsdr.get_device_count();
}

let _device = null;
function openDevice() {

	if (!deviceFound()) return error(100);

	if (!_device) {
		_device = rtlsdr.open(0);

		if (typeof _device === 'number') {
			const code = _device;
			_device = null;
			return error(200, code);
		}
	}

	return _device;
}

// Get device vendor, product, and serial number information.
// Returns object with informational strings if device is present
// or empty strings if no device present. If multiple devices are
// connected, this returns only the first (0th) device information.
function info() {

	if (!deviceFound()) return error(100);

	const vendorBuf = Buffer.alloc(256);
	const productBuf = Buffer.alloc(256);
	const serialBuf = Buffer.alloc(256);

	const deviceInfo = {
		vendor: '',
		product: '',
		serial: ''
	}

	const code = rtlsdr.get_device_usb_strings(0, vendorBuf, productBuf, serialBuf);

	if (code) return error(300, code);

	deviceInfo.vendor = bufToString(vendorBuf);
	deviceInfo.product = bufToString(productBuf);
	deviceInfo.serial = bufToString(serialBuf);

	return deviceInfo;
}

// Get device gains available
function gains() {

	const dev = openDevice();
	if (typeof dev === 'string') return dev;

	// Prepare output array for rtl-sdr to write out possible gain
	// values for the device. We set it a large size so it should be
	// possible to accomondate all types of devices:
	const gainsBuf = new Int32Array(100);

	// Populate the gains array and get the actual number of different
	// gains available. This number will be less than the actual size of
	// the array:
	const numgains = rtlsdr.get_tuner_gains(dev, gainsBuf);
	if (numgains < 0) return error(310, numgains);

	// Trim valid gains and return as an Array of gains in dB
	return Array.from(gainsBuf.slice(0, numgains).map(g => g / 10));
}

// Set device gain mode (0 - auto, 1 - manual)
function gainMode(mode) {

	const dev = openDevice();
	if (typeof dev === 'string') return dev;

	const code = rtlsdr.set_tuner_gain_mode(dev, (mode ? 1 : 0));
	if (code) return error(420, code);

	return mode ? 1 : 0;
}

// Set internal AGC (0 - off, 1 - on)
function agc(enable) {
	const dev = openDevice();
	if (typeof dev === 'string') return dev;

	const code = rtlsdr.set_agc_mode(dev, (enable ? 1 : 0));
	if (code) return error(430, code);

	return enable ? 1 : 0;
}

// Reset device internal buffer
function resetBuffer() {
	const dev = openDevice();
	if (typeof dev === 'string') return dev;

	const code = rtlsdr.reset_buffer(dev);
	if (code) return error(410, code);

	return 0;
}

// READ/WRITE
function gain(g_dB) {

	const dev = openDevice();
	if(typeof dev === 'string') return dev;

	if (g_dB === undefined) {

		const gain = rtlsdr.get_tuner_gain(dev); // returns gain in tenths of dB
		if (gain === 0) return error(350);

		return gain / 10;

	} else {

		const code = rtlsdr.set_tuner_gain(dev, g_dB * 10); // gain set in tenths of dB
		if (code) return error(450, code);

		return g_dB;
	}
}

function freqCorrection(f_ppm) {

	const dev = openDevice();
	if (typeof dev === 'string') return dev;

	if (f_ppm === undefined) {

		return rtlsdr.get_freq_correction(dev);

	} else {

		const code = rtlsdr.set_freq_correction(dev, f_ppm);
		if (code) return error(460, code);

		return f_ppm;
	}
}

function frequency(f_Hz) {
	
	const dev = openDevice();
	if (typeof dev === 'string') return dev;

	if (f_Hz === undefined) {

		const freq = rtlsdr.get_center_freq(dev);
		if (freq === 0) return error(370);
		settings.Fo = freq;
		return freq;

	} else {

		const code = rtlsdr.set_center_freq(dev, f_Hz);
		if (code) return error(470, code);
		settings.Fo = f_Hz;
		return f_Hz;
	}
}

// span really sets the decimation factor
// which only has discrete available values
function span(f_Hz) {

	const dev = openDevice();
	if (typeof dev === 'string') return dev;

	const Fs = rtlsdr.get_sample_rate(dev);

	if (f_Hz === undefined) {

		return Fs / settings.decimate;

	} else {

		const goal = rtlsdr.get_sample_rate(dev) / f_Hz;

		// this gets the closest valid decimation factor
		const D = [1, 2, 4, 8, 16, 32].reduce((prev, curr) => {
			return (Math.abs(Fs / curr - goal) < Math.abs(Fs / prev - goal) ? curr : prev);
		});

		settings.decimate = D;
		
		return Fs / D;
	}
}

// Number of points is also a derived
// quantity based on the number of points
// from the raw acquisition (N), the blocks
// used in the time-domain alias processing,
// and the decimation factor (read-only).
function points(n) {

	return settings.N / settings.blocks / settings.decimate;
}


function sampleRate(f_Hz) {
	
	const dev = openDevice();
	if (typeof dev === 'string') return dev;

	if (f_Hz === undefined) {

		const rate = rtlsdr.get_sample_rate(dev);
		if (rate === 0) return error(380);

		settings.Fs = rate;
		return rate;

	} else {

		const code = rtlsdr.set_sample_rate(dev, f_Hz);
		if (code) return error(480, code);

		settings.Fs = f_Hz;

		return f_Hz;
	}
}

// Set offset tuning mode
function offsetTuning(enable) {
	const dev = openDevice();
	if (typeof dev === 'string') return dev;

	if (enable === undefined) {
		const enabled = rtlsdr.get_offset_tuning(dev);
		if (enabled < 0) return error(390);
		return enabled;
	}

	const on = (enable === 0 || enable === false || enable === '0' || /false/i.test(enable)) ? 0 : 1;
	const code = rtlsdr.set_offset_tuning(dev, on);
	if (code) return error(490, code);
	return code;
}



// ASYNC DATA
function startData(onData, onEnd, logger) {

	const dev = openDevice();
	if (typeof dev === 'string') return dev;

	let Fo;
	let chunkDiv;
	let decimate;
	let averages;
	let traces;
	let trace;

	function _onData(data, size) {

		const rawData = new Uint8Array(data);

		if (!traces || 
			averages !== settings.averages || 
			Fo !== settings.Fo || 
			decimate !== settings.decimate || 
			chunkDiv !== settings.chunkDiv) {
			Fo = settings.Fo;
			chunkDiv = settings.chunkDiv;
			decimate = settings.decimate;
			averages = settings.averages;
			traces = [];
		}

		// Process Raw ADC Data
		//
		// Signal is deinterleaved (split I and Q arrays), then scaled and shifted by the ADC
		// bit values (shift from unsigned to signed) and scaled by the ADC LSB value.
		// The entire raw data buffer is split into overlapping chunks by the settings.overlap
		// percentage.  Each chunk is processed independently into a spectral trace and
		// spectral traces can be averaged together.

		// Break up rawData array into overlapping (settings.overlap) chunks according
		// to the settings.chunkDiv.  Number of chunks is then given by:
		const ovl = settings.overlap;
		const chunks = chunkDiv / ovl - 1;
		const Nchunk = settings.N / chunkDiv; // points per chunk

		for (let c = 0; c < chunks; c++) {

			// chunk the raw data 
			const start = c * Nchunk * ovl;
			const end = start + Nchunk; // slice goes up to, but does not include end index

			//console.log(`chunking data from ${start} to ${end - 1}`);
			const chunk = rawData.slice(start, end);

			// Scale, shift, window, etc each frame
			let {I, Q} = signal(chunk, settings);

			// Calculate power spectrum (FFT)
			let ps = spectrum({I, Q});

			// Store stack of spectral traces and shift oldest out
			if (traces.length >= averages) {
				traces.shift();
			} 
			traces.push(ps); // ps);

			// clone the first (oldest) trace to our accumulator
			trace = traces[0].slice(0);

			// average remaining traces in stack
			for (let j = 1; j < traces.length; j++) {

				for (let i = 0; i < traces[j].length; i++) {
					trace[i] += traces[j][i];

					if (j === traces.length - 1) {
						trace[i] /= traces.length;
					}
				}
			}

			// average middle of trace with adjacent points to get rid of LO spike
			const n = trace.length / 2;
			trace[n] = (trace[n - 1] + trace[n + 1]) / 2;
		}

		// bundle trace points with an x-axis value and use decibels for the y-values
		const Fs = settings.Fs / settings.decimate;
		const N = trace.length;
		onData(trace.map((v, i) => {
			
			const freq = settings.Fo + (i * (Fs / (N - 1)) - Fs / 2);
			const power = 20 * Math.log10(v) - Log_Zo;
			
			return [ 
				freq / 1e6, // return freq in MHz
				power // power 
			];
		}));
	}

	function _onEnd() {
		 if (logger) logger.info('[receiver] DAQ stopped');
		onEnd();
	}

	if (logger) logger.info('[receiver] DAQ starting');
	const code = rtlsdr.read_async(dev, _onData, _onEnd, 0, 0);
	if (code) return error(500, code);

	return 0;
}

function stopData() {

	const dev = openDevice();
	if (typeof dev === 'string') return dev;

	const code = rtlsdr.cancel_async(dev);
	if (code) return error(510, code);

	return 0;
}


module.exports = {
	// Settings are read/write
	settings: settings,

	// READ-ONLY
	info: info,
	gains: gains,

	// WRITE-ONLY
	gainMode: gainMode,
	agc: agc,
	resetBuffer: resetBuffer,

	// READ/WRITE
	gain: gain,
	freqCorrection: freqCorrection,
	frequency: frequency,
	span: span,
	points: points,
	sampleRate: sampleRate,
	offsetTuning: offsetTuning,

	// ACQUISITION
	startData: startData,
	stopData: stopData
}