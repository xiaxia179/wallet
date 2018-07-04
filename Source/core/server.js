//Copyright: Yuriy Ivanov, 2017,2018 e-mail: progr76@gmail.com

const fs = require('fs');
require("./constant");
const crypto = require('crypto');


global.DATA_PATH=GetNormalPathString(global.DATA_PATH);
global.CODE_PATH=GetNormalPathString(global.CODE_PATH);

console.log("DATA DIR: "+global.DATA_PATH);
console.log("PROGRAM DIR: "+global.CODE_PATH);
console.log("USE_AUTO_UPDATE: "+USE_AUTO_UPDATE);
console.log("USE_PARAM_JS: "+USE_PARAM_JS);

if(USE_PARAM_JS)
{
    var PathParams=GetCodePath("../params.js");
    if(fs.existsSync(PathParams))
        try{require(PathParams)}catch(e) {console.log(e)};
    if(global.ReturnServeJS)
        return;
}



require("./library");
const cluster = require('cluster');
var CTransport=require("./transport");

global.glCurNumFindArr=0;
global.ArrReconnect=[];
var FindList=LoadParams(GetDataPath("finds-server.lst"),undefined);
if(!FindList)
{
    FindList=[{"ip":"194.1.237.94","port":30000},{"ip":"91.235.136.81","port":30002}];
    SaveParams(GetDataPath("finds-server.lst"),FindList);
}

if(global.LOCAL_RUN)
{
    FindList=[{"ip":"127.0.0.1","port":40000}];
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

    if(global.nw)
    process.on('uncaughtException', function (err)
    {
        if(process.send)
            process.send({cmd:"log",message:err});

        TO_ERROR_LOG("APP",666,err);
        ToLog(err.stack);

        if(err.code==="ENOTFOUND"
        ||err.code==="ECONNRESET")
        {
            //do work
        }
        else
        {
            process.exit();
        }
    });






    require("./html-server");
    RunServer(false);

    if(global.ADDRLIST_MODE)
    {
        return;
    }

    setInterval(function run1()
    {
        ReconnectingFromServer();
    }, 100);
    setInterval(function run2()
    {
        ConnectToNode();
    }, 100);




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
    RunServer(true);
    process.on('message', (msg) =>
    {
        //ToLog("Get: "+JSON.stringify(msg))

        SERVER.StartHandshake(msg);
    });
}


function ReconnectingFromServer()
{
    if(!SERVER || SERVER.CanSend<2)
        return;

    if(!global.NET_WORK_MODE || !NET_WORK_MODE.UseDirectIP)
        return;

    if(ArrReconnect.length)
    {
        var Node=ArrReconnect.shift();
        Node.CreateConnect();
    }

    //connect to next node on another time (100ms)
}


function ConnectToNode()
{
    if(!SERVER || SERVER.CanSend<2)
        return;

    if(!global.NET_WORK_MODE || !NET_WORK_MODE.UseDirectIP)
        return;

    if(!SERVER.NodesArr || !SERVER.NodesArr.length)
        return;

    var Num=glCurNumFindArr%SERVER.NodesArr.length;
    var Node=SERVER.NodesArr[Num];

    if(GetSocketStatus(Node.Socket)===100)
    {
        SERVER.StartGetNodes(Node);
    }
    else
    {
        SERVER.StartConnect(Node);
    }

    if(Num===0)
        glCurNumFindArr=0;

    glCurNumFindArr++;

    //connect to next node on another time
}


function RunServer(bVirtual)
{
    if(global.NET_WORK_MODE && NET_WORK_MODE.UseDirectIP)
    {
        global.START_IP=NET_WORK_MODE.ip;
        global.START_PORT_NUMBER=NET_WORK_MODE.port;
    }

    var KeyPair = crypto.createECDH('secp256k1');
    if(!global.SERVER_PRIVATE_KEY_HEX || global.NEW_SERVER_PRIVATE_KEY)
    {
        while(true)
        {
            var Arr=crypto.randomBytes(32);
            KeyPair.setPrivateKey(Buffer.from(Arr));
            var Arr2=KeyPair.getPublicKey('','compressed');
            if(Arr2[0]===2)
                break;
        }

        global.SERVER_PRIVATE_KEY_HEX=GetHexFromArr(crypto.randomBytes(32));
        SAVE_CONST(true);
    }
    KeyPair.setPrivateKey(Buffer.from(GetArrFromHex(global.SERVER_PRIVATE_KEY_HEX)));
    global.SERVER=new CTransport(KeyPair,START_IP, START_PORT_NUMBER,false,bVirtual);

    DoStartFindList();
}

function DoStartFindList()
{
    var keyThisServer=SERVER.ip+":"+SERVER.port;

    for(var n=0;n<FindList.length;n++)
    {
        var item=FindList[n];
        if(!item.ip)
            continue;

        var key=item.ip+":"+item.port;
        if(keyThisServer===key)
            continue;


        var addrStr=GetHexFromAddres(crypto.randomBytes(32));
        var Node=SERVER.GetNewNode(addrStr,item.ip,item.port);
        Node.addrStrTemp=addrStr;
        Node.DirectIP=1;
    }
}


