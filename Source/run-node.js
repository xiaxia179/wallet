const fs = require('fs');
const os = require('os');
//global.DATA_PATH=os.homedir()+"\\TERA";
global.CODE_PATH=process.cwd();

require('./core/server');
