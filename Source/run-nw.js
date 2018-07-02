nw.Window.open('./HTML/wallet.html',
    {
        width: 820,
        height: 1000
    }, function(win)
    {
        //win.showDevTools();
    });

if(!global.DATA_PATH || global.DATA_PATH==="")
    global.DATA_PATH="../DATA";
global.CODE_PATH=process.cwd();


global.START_IP="";
global.START_PORT_NUMBER = 30000;
global.HTTP_PORT_NUMBER=0;
global.CREATE_ON_START=0;
global.CREATE_NUM_START=0;
global.LOCAL_RUN=0;
require('./core/server');
