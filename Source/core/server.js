//Copyright: Yuriy Ivanov, 2017,2018 e-mail: progr76@gmail.com

const fs = require('fs');
require("./constant");
const crypto = require('crypto');
console.log("DATA DIR: "+global.DATA_PATH);
console.log("PROGRAM DIR: "+global.CODE_PATH);
console.log("USE_AUTO_UPDATE: "+USE_AUTO_UPDATE);
console.log("USE_PARAM_JS: "+USE_PARAM_JS);

if(USE_PARAM_JS)
{
    var PathParams=global.CODE_PATH+"\\..\\params.js";
    if(fs.existsSync(PathParams))
        try{require(PathParams)}catch(e) {console.log(e)};
    if(global.ReturnServeJS)
        return;
}



require("./library");
const cluster = require('cluster');
var CTransport=require("./transport");


var FindList=LoadParams(GetDataPath("finds-server.lst"),undefined);
if(!FindList)
{
    FindList=[{"ip":"194.1.237.94","port":30000},{"ip":"91.235.136.81","port":30000}];
    SaveParams(GetDataPath("finds-server.lst"),FindList);
}


global.SERVER=undefined;
var Worker;



const OnlyOneProcess=1;//TODO - пока один процесс

global.NeedRestart=0;



if(cluster.isMaster)
{
    // var gc = require("gc");
    // gc();
    process.on('error', function (err)
    {
        if(process.send)
            process.send({cmd:"log",message:err});
        ToLog(err.stack);
    });

    process.on('uncaughtException', function (err)
    {
        if(process.send)
            process.send({cmd:"log",message:err});

        TO_ERROR_LOG("APP",666,err);
        ToLog(err.stack);
        if(err.code==="ENOTFOUND")
        {
            //
        }
        else
        {
            process.exit();
        }
    });






    require("./html-server");
    RunServers(false);

    if(global.ADDRLIST_MODE)
    {
        return;
    }

    setInterval(function run()
    {
        FindAddrAll();
    }, 1000);




    if(OnlyOneProcess)
        return;

    //дочерний процесс для POW
    var arr=[];
    for(var i=1;i<process.argv.length;i++)
        arr[i-1]=process.argv[i];
    arr.push("childpow");
    //ToLog(JSON.stringify(arr))
    cluster.settings.args=arr;

    //Worker = child_process.fork("child.js",arr,{shell:false});
    Worker=cluster.fork();
    Worker.on('message',
        function (msg)
        {
            var Node=msg.Node;
            var buf=Buffer.from(msg.buf);
            var Meta=Buffer.from(msg.Meta);


            SERVER.SenData.bind(SERVER)(Node,buf);

            //SERVER.CreateTimeMeta();
            //var CurTime=GetCurrentTime();
            SERVER.MetaBuf.SaveValue(Meta,true);
            //console.log(`Worker: ${msg.buf.data}`);
        });

}
else
{
    RunServers(true);
    process.on('message', (msg) =>
    {
        //ToLog("Get: "+JSON.stringify(msg))

        SERVER.StartHandshake(msg);
    });
}



function FindAddrAll()
{
    if(!SERVER)
        return;
    var keyThisServer=SERVER.ip+":"+SERVER.port;

    for(var n=0;n<FindList.length;n++)
    {
        var item=FindList[n];
        if(!item.CountSend)
            item.CountSend=0;
        if(item.CountSend>100)
             continue;

        var key=item.ip+":"+item.port;
        if(keyThisServer===key)
            continue;

        var Node=SERVER.GrayIPMap[key];
        if(Node && Node.Self)
            continue;

        if(!Node || !Node.White)
        {
            if(Worker)
            {
                item.CountSend++;
                Worker.send(item);
            }
            else
            {
                item.CountSend++;
                FindList[n]=SERVER.StartConnect(item.ip,item.port);
            }
        }
    }


    for(var Key in SERVER.GrayMap)
    {
        var Node=SERVER.GrayMap[Key];
        if(Node && Node.Self)
            continue;
        if(SERVER.addrStr===Node.addrStr)
            continue;

        var keyTest=Node.ip+":"+Node.port;
        if(keyThisServer===keyTest)
            continue;



        if(Node.White)
        {
            SERVER.StartGetNodes(Node);
        }
        else
        {
            SERVER.StartConnect(Node.ip,Node.port);
        }

    }
}


function RunServers(bVirtual)
{
    var KeyPair = crypto.createECDH('secp256k1');
    if(!global.SERVER_PRIVATE_KEY || global.NEW_SERVER_PRIVATE_KEY)
    {
        global.SERVER_PRIVATE_KEY=crypto.randomBytes(32);
        SAVE_CONST(true);
    }
    KeyPair.setPrivateKey(Buffer.from(global.SERVER_PRIVATE_KEY));
    global.SERVER=new CTransport(KeyPair,START_IP, START_PORT_NUMBER,false,bVirtual);

}



