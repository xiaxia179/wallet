const fs = require('fs');
const os = require('os');
//global.DATA_PATH=os.homedir()+"\\TERA";
if(!global.DATA_PATH || global.DATA_PATH==="")
    global.DATA_PATH="..\\DATA";
global.CODE_PATH=process.cwd();


if(process.send)
{
    global.NWMODE=1;
    process.send({cmd:"online",message:"OK"});
}


global.START_IP="127.0.0.1";
global.START_PORT_NUMBER = 30000;
global.HTTP_PORT_NUMBER=0;
global.CREATE_ON_START=0;
global.CREATE_NUM_START=0;
global.LOCAL_RUN=0;
require('./core/server');

const rpc_server=require('./core/html-server');

process.on('message', (msg) =>
{
    //ToLog("Child get: "+JSON.stringify(msg))

    if(msg.cmd==="call")
    {
        var ret=rpc_server.SendData(msg.message);
        process.send({cmd:"retcall", id:msg.id, message:ret});
    }
    else
    if(msg.cmd==="const")
    {
        for(var key in msg.message)
        {
            global[key]=msg.message[key];
        }
        SAVE_CONST(true);

        if(msg.restart)
            RestartNode();
    }
});

