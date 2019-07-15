'use strict';

// Winston logging to Console and File

const { createLogger, format, transports } = require('winston');

const logger = createLogger({
	level: 'info',
	format: format.combine(
		format.timestamp({
			format: 'YYYY-MM-DD HH:mm:ss'
		}),
		format.errors({ stack: true }),
		format.splat(),
		format.json()
	),
	transports: [
		new transports.File({
			filename: '/boot/pti.log',
			handleExceptions: true,
			maxsize: 1048576, // 1MB
			maxFiles: 5
		})
	]
})

if (process.env.NODE_ENV !== 'production') {
	logger.add(new transports.Console({
		format: format.combine(
			format.colorize(),
			format.simple()
		)
	}));
}

module.exports = logger;