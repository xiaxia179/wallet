const fs = require('fs');
const os = require('os');
//global.DATA_PATH=os.homedir()+"\\TERA";
if(!global.DATA_PATH || global.DATA_PATH==="")
    global.DATA_PATH="..\\DATA";
global.CODE_PATH=process.cwd();

require('./core/server');
