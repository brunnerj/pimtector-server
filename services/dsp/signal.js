'use strict';

const { window } = require('./window');

const Fili = require('fili');
const firCalculator = new Fili.FirCoeffs();

// Cache these from call to call
let N; // frame length
let w; // window type
let W; // Window data array
let Fs; // sampling rate
let D; // decimation factor
let FilterCoeffs; // low pass filter coefficients

module.exports.signal = function(rawData, settings, frame) {

	// calculate new window if N or window changed or we don't have a window yet
	if (!W || settings.N !== N || settings.window !== w) {
		W = window(settings.N, settings.window);
	}

	// calculate new filter if sampling frequency or cutoff frequency has changed
	if (settings.decimate > 1 && (!FilterCoeffs || settings.Fs !== Fs || settings.decimate !== D)) {

		FilterCoeffs = firCalculator.lowpass({
			order: 80,
			Fs: settings.Fs,
			Fc: settings.Fs / settings.decimate
		});

	}

	// save new cache values
	N = settings.N;
	w = settings.window;
	Fs = settings.Fs;
	D = settings.decimate;

	const M = settings.N / settings.blocks;
	const adcLSB = settings.adcFullscaleVolts / (2 ** settings.adcBits);
	const adcShift = (2 ** settings.adcBits - 1) / 2;

	let I = new Array(M);
	let Q = new Array(M);
	I.fill(0);
	Q.fill(0);

	// Populate and window complex signal from the ADC raw data
	// Real data points are [2 * i] and imaginary are [2 * i + 1]
	for (let i = 0; i < N; i++) {

		// signal is comprised of overlapping blocks of time domain raw
		// data (scaled, shifted and windowed) added point-by-point
		I[i % M]     += W[i] * adcLSB * (rawData[2 * i + frame * N * (1 - settings.overlap)]     - adcShift);
		Q[i % M + 1] += W[i] * adcLSB * (rawData[2 * i + frame * N * (1 - settings.overlap) + 1] - adcShift);

	}

	// Filter and downsample if decimate > 1
	if (D > 1) {

		const FilterI = new Fili.FirFilter(FilterCoeffs);
		const FilterQ = new Fili.FirFilter(FilterCoeffs);

		let Itmp = FilterI.multiStep(I);
		let Qtmp = FilterQ.multiStep(Q);

		I = new Array(M / D);
		Q = new Array(M / D);

		for (let i = 0; i < (M / D); i++) {
			I[i] = Itmp[i * D];
			Q[i] = Qtmp[i * D];
		}
	}

	return { I, Q }
}
