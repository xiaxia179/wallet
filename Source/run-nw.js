var Win;
var GlobalRunID=0;
var GlobalRunMap={};

const updater=require("./core/updater.js");

nw.Window.open('./HTML/wallet.html',
    {
        width: 820,
        height: 1000
    }, function(win)
    {
        //win.showDevTools();
        win.Test123=123;
        Win=win;
    });


global.NWMODE=0;

if(global.NWMODE)
    RunNode();
else
    require('./run-nw2.js');

global.RunRPC2=function (message,Func)
{
    const server = require('../core/html-server');
    var reply=server.SendData(message);
    if(Func)
    {
        Func(reply);
        // setTimeout(function ()
        // {
        //     Func(reply);
        // },10);
    }
}

global.RunRPC=function (message,F)
{
    if(!global.ChildWorker)
        return;

    if(F)
    {
        GlobalRunID++;

        try
        {
            global.ChildWorker.send({cmd:"call",id:GlobalRunID, message:message});
            GlobalRunMap[GlobalRunID]=F;
        }
        catch (e)
        {

        }
    }
    else
    {
        global.ChildWorker.send({cmd:"call",id:0, message:message});
    }
}

function RunNode()
{
    const child_process = require('child_process');
    console.log(`Start child process`);

    var arr=[];
    for(var i=1;i<process.argv.length;i++)
        arr.push(process.argv[i]);

    var Worker = child_process.fork("run-nw2.js",arr,{shell:true});
    //console.log(`Worker pid: ${Worker.pid}`);
    Worker.on('online', (worker) =>
    {
        console.log(`worker ${worker.process.pid} online`);
    });


    Worker.on('message',
        function (msg)
        {
            //console.log(`${msg.cmd}  id:${msg.id}  msg:${JSON.stringify(msg.message)}`);
            if(msg.cmd==="log")
            {
                console.log(msg.message);
            }
            else
            if(msg.cmd==="retcall")
            {
                var F=GlobalRunMap[msg.id];
                if(F)
                {
                    delete GlobalRunMap[msg.id];
                    F(msg.message);
                }
            }
            else
            if(msg.cmd==="online")
            {
                GlobalRunMap={};
                global.ChildWorker=Worker;
                CheckTime();
                //console.log(`online pid=${Worker.pid} - ${msg.message}`);
            }
            else
            if(msg.cmd==="update")
            {
                console.log(`update: msg:${JSON.stringify(msg.message)}`);
                global.DATA_PATH=msg.message.DATA_PATH;
                global.CODE_PATH=msg.message.CODE_PATH;
                if(!msg.message.NUM_CODE_COPY)
                    msg.message.NUM_CODE_COPY=0;
                var Num=updater.UpdateCodeFiles(msg.message.NUM_CODE_COPY+1);
                if(Num)
                {
                    //console.log("RESULT COPY = "+Num);
                    global.ChildWorker.send({cmd:"const", restart:1, message:{NUM_CODE_COPY:Num}});
                }

            }

        });

    Worker.on('error', (err) =>
    {
        console.log('Error in worker: '+err);
    });

    Worker.on('close', (code) =>
    {
        global.ChildWorker=undefined;
        console.log(`Child process exited. Start rerun.`);
        setTimeout(function ()
        {
            //RunNode();
            //Win.reload();
        },1000);
    });

}



//Time synchronization
function CheckTime()
{
    var ntpClient = require('ntp-client');
    ntpClient.getNetworkTime("pool.ntp.org", 123, function(err, NetTime)
    {
        if(err)
        {
            console.log("NTP-CLIENT: "+err);
            return;
        }

        var curTime=new Date;
        var DELTA_CURRENT_TIME=NetTime-curTime;

        if(isNaN(DELTA_CURRENT_TIME) || typeof DELTA_CURRENT_TIME!=="number")
            DELTA_CURRENT_TIME=0;
        else
        if(Math.abs(DELTA_CURRENT_TIME)>24*3600*1000)
            DELTA_CURRENT_TIME=0;

        //SAVE_CONST();
        if(global.ChildWorker)
            global.ChildWorker.send({cmd:"const", message:{DELTA_CURRENT_TIME:DELTA_CURRENT_TIME}});

    });

}
