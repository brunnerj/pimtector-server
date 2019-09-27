'use strict';

const rtlsdr = require('rtl-sdr');

const ERRORS = {

	100: 'Device not found',
	200: 'Error opening device',

	// READ errors
	300: 'Error reading device info',
	310: 'Error reading device gains',

	350: 'Error reading device gain',
	360: 'Error reading device frequency correction',
	370: 'Error reading device center frequency',
	380: 'Error reading device sample rate',

	// WRITE errors
	410: 'Error resetting device buffer',

	420: 'Error setting device gain mode',
	430: 'Error setting device AGC mode',

	450: 'Error setting device gain - check that manual gain mode is set and the gain value is supported by the device',
	460: 'Error setting device frequency correction',
	470: 'Error setting device center frequency',
	480: 'Error setting device sample rate',

}

function error(e, code) {

	if (!e) return;

	if (ERRORS[e] === undefined)
		return `${e}: Unknown error${code ? ' (' + code + ')' : ''})`;

	return `${e}: ${ERRORS[e]}${code ? ' (' + code + ')' : ''})`;

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

		return freq;

	} else {

		const code = rtlsdr.set_center_freq(dev, f_Hz);
		if (code) return error(470, code);

		return f_Hz;
	}
}

function sampleRate(f_Hz) {
	
	const dev = openDevice();
	if (typeof dev === 'string') return dev;

	if (f_Hz === undefined) {

		const rate = rtlsdr.get_sample_rate(dev);
		if (rate === 0) return error(380);

		return freq;

	} else {

		const code = rtlsdr.set_sample_rate(dev, f_Hz);
		if (code) return error(480, code);

		return f_Hz;
	}
}



module.exports = {
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
	sampleRate: sampleRate

}



