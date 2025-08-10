const createToolsMiddleware = require('./tools');
const createFilesMiddleware = require('./files');
const createFilesystemMiddleware = require('./filesystem');
const createCurrentMiddleware = require('./current');
const createWriterMiddleware = require('./writer');
const utils = require('./utils');

// Export main function and individual middlewares
module.exports = createFilesystemMiddleware;
module.exports.tools = createToolsMiddleware;
module.exports.files = createFilesMiddleware;
module.exports.current = createCurrentMiddleware;
module.exports.writer = createWriterMiddleware;
module.exports.runFile = require('./runFile');
module.exports.pparse = utils.pparse
