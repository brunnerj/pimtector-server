'use strict';

// Winston logging to Console
const { createLogger, format, transports } = require('winston');

const logger = createLogger({
	level: 'info',
	format: format.combine(
		format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
		format.errors({ stack: true }),
		format.splat(),
		format.json()
	),
	transports: []
});

logger.add(new transports.Console({
	format: format.combine(
		format.colorize(),
		format.printf(info => `${info.level}: ${info.timestamp} ${info.message}`)
	)
}));

// MAX17048 LiPo battery fuel gauge (uses I2C)
const Max17048 = require('./services/max17048');

// init MAX17048 device
const max17048 = new Max17048(logger);

max17048.init(async () => {

	let soc;

	try {
		soc = await max17048.getStateOfCharge();

		// cap between 0 and 100
		const level = Buffer.from([ Math.min(100, Math.max(0, soc * 100)) ]);

		logger.info(`[batcheck] Battery level notification: ${level.readUInt8(0)}%`);

	} catch(err) {
		
		logger.error(`[batcheck] ${err}`);

	}
});
