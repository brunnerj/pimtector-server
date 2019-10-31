'use strict';

const FFT = require('fft.js');

const { fftshift } = require('./fftshift');

function complexSpectrum(complexSignal) {

	// calculate the complex spectrum of the signal using FFT
	const N = complexSignal.length / 2;
	const fft = new FFT(N);

	const complexSpectrum = fft.createComplexArray();
	
	fft.transform(complexSpectrum, complexSignal);
	fftshift(complexSpectrum);

	return complexSpectrum;
}


module.exports.spectrum = function({I, Q}) {

	const N = I.length;
	const complexSignal = new Array(2 * N);

	// interleave I/Q for FFT
	for (let i = 0; i < N; i++) {
		complexSignal[2 * i] = I[i];
		complexSignal[2 * i + 1] = Q[i];
	}

	const F = complexSpectrum(complexSignal); 
	const powerSpectrum = new Array(N);

	for (let i = 0; i < N; i++) {

		// calculate magnitude as sqrt(real^2 + imag^2)
		powerSpectrum[i] = (1 / N) * Math.sqrt(Math.pow(F[2 * i], 2) + Math.pow(F[2 * i + 1], 2));

	}

	return powerSpectrum;
}
