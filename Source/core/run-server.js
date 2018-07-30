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
// const cluster = require('cluster');
// if(!cluster.isMaster)
//     return;



var CServer=require("./server");

global.glCurNumFindArr=0;
global.ArrReconnect=[];
var FindList=LoadParams(GetDataPath("finds-server.lst"),undefined);
if(!FindList)
{
    FindList=[
        {"ip":"194.1.237.94","port":30000},//3
        {"ip":"91.235.136.81","port":30000},//5
        {"ip":"103.102.45.224","port":30000},//12
        {"ip":"185.17.122.144","port":30000},//14
        {"ip":"185.17.122.149","port":30000},//20
        ];

    SaveParams(GetDataPath("finds-server.lst"),FindList);
}





if(global.LOCAL_RUN)
{
    FindList=[{"ip":"127.0.0.1","port":40000},{"ip":"127.0.0.1","port":40002}];
}
// if(global.TEST_DEVELOP_MODE)
//     FindList=[{"ip":"91.235.136.81","port":30002}];


global.SERVER=undefined;
var idRunOnce;
var Worker;



global.NeedRestart=0;



if(global.nw)
process.on('uncaughtException', function (err)
{
    if(process.send)
    {
        process.send({cmd:"log",message:err});
    }

    TO_ERROR_LOG("APP",666,err);
    ToError(err.stack);
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
process.on('error', function (err)
{
    ToError(err.stack);
    ToLog(err.stack);
});






require("./html-server");
RunServer(false);


setInterval(function run1()
{
    ReconnectingFromServer();
}, 100);
setInterval(function run2()
{
    ConnectToNodes();
}, 200);


if(global.ADDRLIST_MODE)
{
    return;
}

//ToLog("global.USE_MINING="+global.USE_MINING);
var ArrWrk=[];
var BlockMining;

function RunStopPOWProcess()
{
    const os = require('os');
    var cpus = os.cpus();
    var CountRun=cpus.length-1;

    if(CountRun<=0)
        return;

    if(global.USE_MINING && ArrWrk.length || (!global.USE_MINING) && ArrWrk.length===0)
        return;

    if(!global.USE_MINING)
    {
        //Stop process
        var Arr=ArrWrk;
        ArrWrk=[];
        for(var i=0;i<Arr.length;i++)
        {
            var CurWorker=Arr[i];
            CurWorker.send(
                {
                    cmd:"Exit"
                });
        }
        return;
    }

    const child_process = require('child_process');
    ToLog("START MINER PROCESS COUNT="+CountRun);
    for(var R=0;R<CountRun;R++)
    {
        let Worker = child_process.fork("./core/pow-process.js");
        console.log(`Worker pid: ${Worker.pid}`);
        ArrWrk.push(Worker);
        Worker.Num=ArrWrk.length;

        Worker.on('message',
            function (msg)
            {
                if(msg.cmd==="log")
                {
                    ToLog(msg.message);
                }
                else
                if(msg.cmd==="online")
                {
                    Worker.bOnline=true;
                    ToLog("RUNING PROCESS:"+Worker.Num+":"+msg.message);
                }
                else
                if(msg.cmd==="POW")
                {
                    //ToLog("POW: "+JSON.stringify(msg))


                    if(BlockMining && BlockMining.Hash && BlockMining.SeqHash
                        && CompareArr(BlockMining.SeqHash,msg.SeqHash)===0
                        && CompareArr(BlockMining.Hash,msg.Hash)>=0)
                    {
                        BlockMining.Hash=msg.Hash;
                        BlockMining.AddrHash=msg.AddrArr;

                        BlockMining.Power=GetPowPower(msg.Hash);
                        //ADD_TO_STAT("MAX:POWER:"+msg.Num,GetPowPower(msg.Hash));
                        ADD_TO_STAT("MAX:POWER",GetPowPower(msg.Hash));

                        SERVER.AddToMaxPOW(BlockMining,
                            {
                                SeqHash:BlockMining.SeqHash,
                                AddrHash:BlockMining.AddrHash,
                                PrevHash:BlockMining.PrevHash,
                                TreeHash:BlockMining.TreeHash,
                            });
                    }
                }
                else
                if(msg.cmd==="HASHRATE")
                {
                    ADD_TO_STAT("HASHRATE",msg.CountNonce);
                    //ADD_TO_STAT("MAX:POWER2",GetPowPower(msg.Hash));

                }

            });

        Worker.on('error', (err) =>
        {
            if(!ArrWrk.length)
                return;
            ToError('ERROR IN PROCESS: '+err);
        });

        Worker.on('close', (code) =>
        {
            ToLog("STOP PROCESS: "+Worker.Num);
            if(!ArrWrk.length)
                return;
            //process.exit();
        });
    }
}
function StartWorker()
{

}


function SetCalcPOW(Block)
{
    if(!global.USE_MINING)
        return;

    if(GENERATE_BLOCK_ACCOUNT<8)
        global.USE_MINING=0;

    BlockMining=Block;
    for(var i=0;i<ArrWrk.length;i++)
    {
        var CurWorker=ArrWrk[i];
        if(!CurWorker.bOnline)
            continue;

        CurWorker.send(
            {
                cmd:"SetBlock",
                Account:GENERATE_BLOCK_ACCOUNT,
                BlockNum:Block.BlockNum,
                SeqHash:Block.SeqHash,
                Hash:Block.Hash,
                Time:new Date()-0,
                Num:i,
                RunPeriod:global.POWRunPeriod,
                RunCount:global.POWRunCount,
                Percent:global.POW_MAX_PERCENT,
            });
    }

}

global.SetCalcPOW=SetCalcPOW;
global.RunStopPOWProcess=RunStopPOWProcess;





function ReconnectingFromServer()
{
    if(!SERVER || SERVER.CanSend<2)
    {
        //ToLog("Not can send")
        return;
    }

    if(global.NET_WORK_MODE && !NET_WORK_MODE.UseDirectIP)
    {
        //ToLog("!UseDirectIP")
        return;
    }

    if(ArrReconnect.length)
    {
        var Node=ArrReconnect.shift();

        if(global.TEST_DEVELOP_MODE)
        {
            if(!Node.StartFindList)
            {
                ToLog("!StartFindList")
                return;
            }
        }

        Node.WasAddToReconnect=undefined;
        Node.CreateConnect();
    }

    //connect to next node on another time (100ms)
}


function ConnectToNodes()
{
    if(!SERVER || SERVER.CanSend<2)
        return;

    if(!SERVER.NodesArrUnSort || !SERVER.NodesArrUnSort.length)
        return;

    var Num=glCurNumFindArr%SERVER.NodesArrUnSort.length;
    var Node=SERVER.NodesArrUnSort[Num];
    if(Num===0)
        glCurNumFindArr=0;
    glCurNumFindArr++;


    if(global.NET_WORK_MODE && !NET_WORK_MODE.UseDirectIP)
    {
        if(!Node.StartFindList)
            return;
    }


    if(GetSocketStatus(Node.Socket)===100)
    {
        if(global.NET_WORK_MODE && !NET_WORK_MODE.UseDirectIP)
            return;

        SERVER.StartGetNodes(Node);
    }
    else
    {
        SERVER.StartConnectTry(Node);
    }


    //connect to next node on another time
}


function RunServer(bVirtual)
{
    idRunOnce=setInterval(RunOnce,1000);
    ToLog("NETWORK: "+GetNetworkName());
    ToLog("VERSION: "+DEF_VERSION);

    if(global.NET_WORK_MODE)// && NET_WORK_MODE.UseDirectIP)
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

        global.SERVER_PRIVATE_KEY_HEX=GetHexFromArr(Arr);
        SAVE_CONST(true);
    }
    KeyPair.setPrivateKey(Buffer.from(GetArrFromHex(global.SERVER_PRIVATE_KEY_HEX)));
    new CServer(KeyPair,START_IP, START_PORT_NUMBER,false,bVirtual);

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
        //Node.DirectIP=1;
        Node.StartFindList=1;
    }
}


function RunOnce()
{
    if(global.SERVER)
    {
        clearInterval(idRunOnce);

        RunOnUpdate();

        setTimeout(function ()
        {
            RunStopPOWProcess();
        },10000)
    }
}

function RunOnUpdate()
{

    if(!UPDATE_NUM_COMPLETE)
        UPDATE_NUM_COMPLETE=0;
    var CurNum=UPDATE_NUM_COMPLETE;
    if(CurNum!==UPDATE_CODE_VERSION_NUM)
    {
        global.UPDATE_NUM_COMPLETE=UPDATE_CODE_VERSION_NUM;
        SAVE_CONST(true);

        global.SendLogToClient=1;
        ToLog("UPDATER Start");
        //DO UPDATE
        //DO UPDATE
        //DO UPDATE
        //----------------------------------------------------------------------------------------------------------

        //CheckRewriteTr(2231780,"D8F4119B89CA0CFC56973B5F5D993D96C251243B0640EBF555AC0ED557ECD8E0",2000000);
        //CheckRewriteTr(2326400,"5D173F58C213C15CF1CDE7A21C50BE979D9C451ACB8841C96852DD2BC85DF02A",2230000);
        //CheckRewriteTr(2334620,"C4F34B512FFD78B603B2C694CEDF7B1D6BF9BC19C421690EAE9599D744D7CE1F",2320000);
        //CheckRewriteTr(2344820,"3EAB02656957C39377C83345B211A4DD90B8B24A4281DC93EB28672F9AA99446",2334620);
        CheckRewriteTr(2488600,"C302D2FF3940E0DE4B334D6DABE13AE34E6F5867663280294321817DCBCFB7C8",2344820);



        // global.UPDATE_NUM_COMPLETE=UPDATE_CODE_VERSION_NUM;
        // SAVE_CONST(true);

        //----------------------------------------------------------------------------------------------------------
        ToLog("UPDATER Finish");
        global.SendLogToClient=0;
    }
}

function CheckRewriteTr(Num,StrHash,StartRewrite)
{
    if(SERVER.BlockNumDB<Num)
        return "NO";

    var AccountsHash=DApps.Accounts.GetHashOrUndefined(Num);
    if(!AccountsHash || GetHexFromArr(AccountsHash) !== StrHash)
    {
        ToLog("START REWRITE ERR ACTS TRANSACTIONS")
        SERVER.ReWriteDAppTransactions(StartRewrite);
        return "Rewrite"
    }
    else
    {
        return "OK"
    }
}
global.CheckRewriteTr=CheckRewriteTr;

