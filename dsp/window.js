'use strict';

module.exports.WINDOWS = {
	none:     'none',
	blackman: 'blackman',
	hamming:  'hamming'
}


module.exports.window = function(N, type = 'blackman') {

	const w = new Array(N);

	if (type == 'none') {
		return w.fill(1);
	}

	const Fc = 2 / N;
	let max = 0;

	// This loop applies a Blackman windowed-sinc weighting
	// across the whole time-domain signal block (multiply 
	// signal and window point-by-point).
	for (let i = 0; i < N; i++) {

		// apply sinc
		if (i == N/2) {
			w[i] = 2 * Fc;
		} else {
			w[i] = Math.sin(2 * Math.PI * Fc * (i - N/2)) / (Math.PI * (i - N/2));
		}


		// apply Blackman window
		w[i] = w[i] * (0.42 - 0.5 * Math.cos(2 * Math.PI * i / N) + 0.08 * Math.cos(4 * Math.PI * i / N));

		// track maximum windowed value to normalize
		max = Math.max(max, w[i]);
	}

	// return normalized window
	return w.map(v => v / max);
}
