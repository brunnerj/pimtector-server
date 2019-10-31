'use strict';

// Winston logging to Console and File

const { createLogger, format, transports } = require('winston');

// log to /boot for 'linux' (RPi) platforms
// so it's easier to get at the log file from Windows machines
// (because /boot is FAT32 partition on the SD card)
const logfile = (process.platform === 'linux')
	? '/boot/pti.log'
	: 'pti.log';

const logger = createLogger({
	level: 'info',
	format: format.combine(
		format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
		format.errors({ stack: true }),
		format.splat(),
		format.json()
	),
	transports: [
		new transports.File({
			filename: logfile,
			handleExceptions: true,
			maxsize: 1048576, // 1MB
			maxFiles: 5
		})
	]
})

// this logs to console if we're not a 'production' release
if (process.env.NODE_ENV !== 'production') {
	logger.add(new transports.Console({
		format: format.combine(
			format.colorize(),
			format.printf(info => `${info.level}: ${info.timestamp} ${info.message}`)
		)
	}));
}

module.exports = logger;