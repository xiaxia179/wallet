"use strict";
//Copyright: Yuriy Ivanov, 2017-2018 e-mail: progr76@gmail.com

require("./crypto-library");
require("./log.js");
const crypto = require('crypto');


//**********************************************************************************************************************
const http = require('http')
    , net = require('net')
    , url = require('url')
    , fs = require('fs')
    , querystring = require('querystring');

// var path="cmd=%63%64%20%2F%76%61%72%2F%74%6D%70%20%26%26%20%65%63%68%6F%20%2D%6E%65%20%5C%5C%78%33%36%31%30%63%6B%65%72%20%3E%20%36%31%30%63%6B%65%72%2E%74%78%74%20%26%26%20%63%61%74%20%36%31%30%63%6B%65%72%2E%";
// var Path=querystring.unescape(path);
// ToLog(Path)
// process.exit();


var HTTPCaller={};
function DoCommand(response,Path,params)
{
    var F=HTTPCaller[params[0]];
    if(F)
    {
        response.writeHead(200, { 'Content-Type': 'application/json','Access-Control-Allow-Origin':'*'});
        response.writeHead(200, { 'Content-Type': 'application/json' });

        var Ret=F(params[1],params[2],params[3]);

        response.end(JSON.stringify(Ret));
        return;
    }




    var method=params[0];
    method=method.toLowerCase();

    switch(method)
    {
        case "":
            SendFileHTML(response,"./HTML/wallet.html");
            break;




        case "sendcommand":
            OnSendCommand(response,params[1],params[2],params[3]);
            break;
        case "getpacketinfosend":
            GetPacketInfoSend(response);
            break;

        case "sendtransaction":
            SendTransaction(response,params[1],params[2],params[3],params[4]);
            break;
        // case "sendtransactionhex":
        //     SendTransactionHex(response,params[1],params[2],params[3]);
        //     break;


        case "createdump":
            CreateDump(response);
            break;

        case "getnetparams":
            GetNetParams(response);
            break;

        case "getblock":
            GetBlockData(response,params[1]);
            break;

        case "getblockheaders":
            GetBlockHeaders(response,params[1],params[2]);
            break;

        case "chain":
            SendFileHTML(response,"./HTML/monitor.html");
            break;

        case "stat":
            SendFileHTML(response,"./HTML/stat.html");
            break;

        default:
        {
            //var path=Path.substr(1);
            var path=params[params.length-1]
            if(typeof path!=="string")
                path="ErrorPath";
            else
            if(path.indexOf("..")>=0 || path.indexOf("\\")>=0 || path.indexOf("/")>=0)
                path="ErrorFilePath";

            if(path.indexOf(".")<0)
                path+=".html";


            var type=Path.substr(Path.length-3,3);
            if(type===".js")
            {
                if(path==="constant.js")
                {
                    path="constant.js";
                }
                else
                {
                    path="./HTML/JS/"+path;
                }
            }
            else
            if(type==="css")
            {
                path="./HTML/CSS/"+path;
            }
            else
            {
                path="./HTML/"+path;
            }

            SendFileHTML(response,path,Path);
            break;
        }
    }
}



//var sessionid="SID:"+random(100000000)+"-"+random(100000000);
var sessionid=GetHexFromAddres(crypto.randomBytes(20));

//WALLET


HTTPCaller.RestartNode=function (id,Param2,Param3)
{
    RestartNode();
    return {result:1};
}

HTTPCaller.TestTest=function (id,Param2,Param3)
{
    DApps.Accounts.TestTest(parseInt(id));
    return {result:1};
}


HTTPCaller.ToLogServer=function (Str,StrKey,Param3)
{
    ToLogClient(Str,StrKey)
    return {result:1};
}

HTTPCaller.FindMyAccounts=function (Str,Param2,Param3)
{
    WALLET.FindMyAccounts();
    return {result:1};
}


HTTPCaller.GetAccount=function (id)
{
    id=parseInt(id);

    var Item=DApps.Accounts.GetAccount(id);
    return {Item:Item,result:1};
}

HTTPCaller.GetAccountsAll=function (id,count,Param3)
{
    id=parseInt(id);
    count=parseInt(count);

    var arr=DApps.Accounts.GetAccountsAll(id,count);
    return {arr:arr,result:1};
}


HTTPCaller.GetActsAll=function (num,count,Param3)
{
    num=parseInt(num);
    count=parseInt(count);

    var arr=DApps.Accounts.GetActsAll(num,count);
    return {arr:arr,result:1};
}

HTTPCaller.GetAct=function (num,count,Direct)
{
    num=parseInt(num);
    count=parseInt(count);

    var arr=WALLET.GetAct(num,count,Direct);
    return {arr:arr,result:1};
}



HTTPCaller.GetWalletInfo=function ()
{
    var Ret=
        {
            result:1,

            WalletOpen:WALLET.WalletOpen,

            VersionNum:Math.max(CODE_VERSION.VersionNum,global.NUM_CODE_COPY),
            RelayMode:SERVER.RelayMode,
            BlockNumDB:SERVER.BlockNumDB,
            CurBlockNum:GetCurrentBlockNumByTime(),
            IsDevelopAccount:(CompareArr(WALLET.PubKeyArr,global.DEVELOP_PUB_KEY)===0),

            MiningAccount:global.GENERATE_BLOCK_ACCOUNT,
            AccountMap:WALLET.AccountMap,

            StartDateBlock:FIRST_TIME_BLOCK,
            ArrLog:ArrLogClient,
            MIN_POWER_POW_ACC_CREATE:MIN_POWER_POW_ACC_CREATE,
            MaxAccID:DApps.Accounts.GetMaxAccount(),


            NeedRestart:global.NeedRestart,

            ip:SERVER.ip,
            port:SERVER.port,
            NET_WORK_MODE:global.NET_WORK_MODE,
        };


    Ret.PrivateKey=WALLET.KeyPair.PrivKeyStr;
    Ret.PublicKey=WALLET.KeyPair.PubKeyStr;

    return Ret;
}
HTTPCaller.GetWalletAccounts=function (Param1,Param2,Param3)
{
    var Ret=
        {
            result:1,
            ArrAcc:DApps.Accounts.GetAccounts(WALLET.AccountMap),
        };

    Ret.PrivateKey=WALLET.KeyPair.PrivKeyStr;
    Ret.PublicKey=WALLET.KeyPair.PubKeyStr;

    return Ret;
}
HTTPCaller.SetWalletKey=function (PrivateKeyStr,Param2,Param3)
{
    WALLET.SetPrivateKey(PrivateKeyStr,true);
    return {result:1};
}

HTTPCaller.SetWalletPasswordNew=function (Password)
{
    WALLET.SetPasswordNew(Password);
    return {result:1};
}
HTTPCaller.OpenWallet=function (Password)
{
    var res=WALLET.OpenWallet(Password);
    return {result:res};
}





HTTPCaller.GetSignTransaction=function (TR,Param2,Param3)
{
    var Sign=WALLET.GetSignTransaction(TR);
    return {Sign:Sign,result:1};
}
HTTPCaller.GetSignFromHEX=function (ValueHex,Param2,Param3)
{
    var Arr=GetArrFromHex(ValueHex);
    var Sign=WALLET.GetSignFromArr(Arr);
    return {Sign:Sign,result:1};
}



var AddTrMap={};
AddTrMap[-3]="Bad time";
AddTrMap[-2]="Bad PoW";
AddTrMap[-1]="Bad length";
AddTrMap[0]="Not add";
AddTrMap[1]="OK";
AddTrMap[2]="Update OK";
AddTrMap[3]="Was send";



// HTTPCaller.SendTransactionHex2=function(Str)
// {
//     var Body=GetArrFromHexTr(Str);
//     const BufLib=require("../core/buffer");
//     var TR=BufLib.GetObjectFromBuffer(Body,FORMAT_MONEY_TRANSFER,{});
//     TR=TR;
//     return 1;
// }

HTTPCaller.SendTransactionHex=function(ValueHex,nonce,Num)
{
    var body=GetArrFromHex(ValueHex);

    var Result={result:1};
    var Res=WALLET.AddTransaction({body:body});
    Result.sessionid=sessionid;
    Result.text=AddTrMap[Res];
    ToLogClient("Send: "+Result.text,GetHexFromArr(shaarr(body)),(Res<1?true:false));
    return Result;
}


HTTPCaller.SendDirectCode=function(StrCommand)
{
    var Result;
    try
    {
        var ret=eval(StrCommand);
        Result=JSON.stringify(ret,"",4);
    }
    catch (e)
    {
        Result=""+e;
    }


    var Struct=
        {
            result:1,
            sessionid:sessionid,
            text:Result
        };
    return Struct;
}



HTTPCaller.SetMining=function (MiningAccount,Param2,Param3)
{
    WALLET.SetMiningAccount(parseInt(MiningAccount));
    return {result:1};
}

HTTPCaller.TruncateBlockChain=function (BlockNum,Param2,Param3)
{
    BlockNum=parseInt(BlockNum);

    if(!BlockNum)
    {
        return {result:0};
    }

    SERVER.BlockNumDB=BlockNum;
    SERVER.TruncateBlockDB(SERVER.BlockNumDB);
    return {result:1,text:"Truncate on BlockNum="+BlockNum};
}


HTTPCaller.SetCheckPoint=function (BlockNum,Param2,Param3)
{
    if(CompareArr(WALLET.PubKeyArr,global.DEVELOP_PUB_KEY)!==0)
    {
        return {result:0};
    }



    if(!BlockNum)
        BlockNum=SERVER.BlockNumDB;
    else
        BlockNum=parseInt(BlockNum);



    var Block=SERVER.ReadBlockHeaderDB(BlockNum);
    var SignArr=arr2(Block.Hash,GetArrFromValue(Block.BlockNum));
    var Sign = secp256k1.sign(shabuf(SignArr), WALLET.KeyPair.getPrivateKey('')).signature;
    global.CHECK_POINT={BlockNum:BlockNum,Hash:Block.Hash,Sign:Sign};

    return {result:1,text:"Set check point on BlockNum="+BlockNum};
}

HTTPCaller.SetNewCodeVersion=function (Num,Param2,Param3)
{
    if(CompareArr(WALLET.PubKeyArr,global.DEVELOP_PUB_KEY)!==0)
    {
        return {result:0};
    }

    Num=parseInt(Num);

    var Ret=SERVER.SetNewCodeVersion(Num,WALLET.KeyPair.getPrivateKey(''));
    return {result:1,text:Ret};
}



HTTPCaller.SetNetMode=function (SetObj)
{
    if(!global.NET_WORK_MODE)
        global.NET_WORK_MODE={};

    for(var key in SetObj)
    {
        global.NET_WORK_MODE[key]=SetObj[key];
    }

    SAVE_CONST(true);


    if(SetObj.RestartNode)
        RestartNode();

    return {result:1};
}



//STATS

HTTPCaller.GetAllCounters=function (SetObj)
{
    var Result=GET_STATS();
    Result.result=1;
    Result.sessionid=sessionid;
    return Result;
}



//MONITOR
HTTPCaller.GetNodes=function ()
{
    var ArrNodes=SERVER.GetActualNodes();

    var res=[];
    for(var Node of ArrNodes)
    {
        res.push({ip:Node.ip,port:Node.port,webport:80,addr:Node.addrStr,Hot:Node.Hot,Active:Node.Active});
    }

    var Result=
        {
            result:1,
            sessionid:sessionid,
            Nodes:res,
            DEF_NETWORK:DEF_NETWORK,
            DEF_VERSION:DEF_VERSION,
            port:SERVER.port,
            webport:HTTP_PORT_NUMBER,
        };
    return Result;
}



//DIAGRAMS

HTTPCaller.GetArrStats=function (Keys)
{
    var arr=GET_STATDIAGRAMS(Keys);
    return {result:1,sessionid:sessionid,arr:arr};
}


//BLOCK CHAIN MONITOR

HTTPCaller.GetBlockChain=function (type)
{
     if(!global.SERVER || !SERVER.LoadedChainList)
    {
        return {result:0};
    }

    var MainChains={};
    for(var i=0;i<SERVER.LoadedChainList.length;i++)
    {
        var chain=SERVER.LoadedChainList[i];
        if(chain && !chain.Deleted)
            MainChains[chain.id]=true;
    }

    var arrBlocks=[];
    var arrLoadedChainList=[];
    var arrLoadedBlocks=[];
    //for(var Block of SERVER.BlockChain)
    for(var key in SERVER.BlockChain)
    {
        var Block=SERVER.BlockChain[key];
        if(Block)
        {
            arrBlocks.push(CopyBlockDraw(Block,MainChains));
        }
    }





    AddChainList(arrLoadedChainList,SERVER.LoadedChainList,true);
    AddMapList(arrLoadedBlocks,type,SERVER.MapMapLoaded,MainChains);

    var ArrLoadedChainList=SERVER.HistoryBlockBuf.LoadValue("LoadedChainList",1);
    if(ArrLoadedChainList)
        for(var List of ArrLoadedChainList)
        {
            AddChainList(arrLoadedChainList,List);
        }

    var ArrMapMapLoaded=SERVER.HistoryBlockBuf.LoadValue("MapMapLoaded",1);
    if(ArrMapMapLoaded)
        for(var List of ArrMapMapLoaded)
        {
            AddMapList(arrLoadedBlocks,type,List);
        }


    var obj=
        {
            CurrentBlockNum:SERVER.CurrentBlockNum,
            LoadedChainList:arrLoadedChainList,
            LoadedBlocks:arrLoadedBlocks,
            BlockChain:arrBlocks,
            port:SERVER.port,
            DELTA_CURRENT_TIME:DELTA_CURRENT_TIME,
            memoryUsage:process.memoryUsage(),
            sessionid:sessionid,
            result:1
        };

    arrBlocks=[];
    arrLoadedChainList=[];
    arrLoadedBlocks=[];

    return obj;
}





//Others

//**********************************************************************************************************************
//**********************************************************************************************************************
//**********************************************************************************************************************


function CreateDump(response)
{
    response.writeHead(200, { 'Content-Type': 'application/json','Access-Control-Allow-Origin':'*'});
    response.writeHead(200, { 'Content-Type': 'application/json' });

    // require('../EXPERIMENTAL/heapdump');
    // MemDump();

    var Result=
        {
            result:1,
            sessionid:sessionid,
        };
    response.end(JSON.stringify(Result));
}

//----------------------------------------------------------------------------------------------------------------------

//проверка константы global.USE_PACKET_STAT
setInterval(function ()
{
    if(global.USE_PACKET_STAT)
    {
        if(!global.USE_PACKET_STAT_TIME)
            global.USE_PACKET_STAT=0;
        else
        {
            var Time = process.hrtime(global.USE_PACKET_STAT_TIME);
            var deltaTime=Math.floor(Time[0]*1000 + Time[1]/1e6);//ms
            if(deltaTime>500*1000)
            {
                SERVER.ArrPacketStat=[];
                global.USE_PACKET_STAT=0;
            }
        }
    }
},500*1000);



function GetPacketInfoSend(response)
{
    response.writeHead(200, { 'Content-Type': 'application/json','Access-Control-Allow-Origin':'*'});
    response.writeHead(200, { 'Content-Type': 'application/json' });


    var Count=Math.min(MAX_FRAGMENT_INFO_ARRAY,1400);
    var ArrStatNode=[];
    var KJ=Count/MAX_FRAGMENT_INFO_ARRAY;

    var ArrNodes=SERVER.GetActualNodes();
    for(var Node of ArrNodes)
    {
        var SendFragmentNum=Node.SendQOSNumFragment;
        if(!SendFragmentNum || !Node.SendFragmentArr)
            continue;

        //получаем предыдущие
        var Arr=[];
        var j=0;

        for(var i=0;i<MAX_FRAGMENT_INFO_ARRAY;i++)
        {
            var num=(SendFragmentNum-MAX_FRAGMENT_INFO_ARRAY+i);
            if(num<0)
                continue;
            var num2=num%MAX_FRAGMENT_INFO_ARRAY;
            var ValArr=Node.SendFragmentArr[num2];
            var Value;
            if(ValArr===undefined)//было подтверждение
                Value=1;
            else
            if(ValArr===0)
                Value=2;
            else
                Value=0;

            var j2=Math.floor(j);
            if(Arr[j2]===undefined)
                Arr[j2]=1;
            Arr[j2] = Arr[j2]*Value;


            j=j+KJ;
        }


         ArrStatNode.push(
             {
                 addrStr:Node.addrStr,
                 ip:Node.ip,
                 port:Node.port,
                 FragmentOverflow:Node.FragmentOverflow,
                 SendFragmentH:Node.SendFragmentH,
                 SendFragmentL:Node.SendFragmentL,
                 LimitFragmentLightSend:Node.LimitFragmentLightSend,
                 LimitFragmentHardSend:Node.LimitFragmentHardSend,
                 SkipFragmentLightSend:Node.SkipFragmentLightSend,
                 SkipFragmentHardSend:Node.SkipFragmentHardSend,
                 SendNum:SendFragmentNum,
                 "Arr":Arr
             });
    }


    var Result=
        {
            result:1,
            sessionid:sessionid,
            ArrStat:ArrStatNode,
        };
    response.end(JSON.stringify(Result));

}


function GetNetParams(response)
{
    response.writeHead(200, { 'Content-Type': 'application/json','Access-Control-Allow-Origin':'*'});
    response.writeHead(200, { 'Content-Type': 'application/json' });

    var Result=
        {
            result:1,
            sessionid:sessionid,
            CurBlockNum:GetCurrentBlockNumByTime(),
            StartDateBlock:FIRST_TIME_BLOCK,
            addrArr:SERVER.addrArr,
            ip:SERVER.ip,
            port:SERVER.port,
            DEF_NETWORK:DEF_NETWORK,
            DEF_VERSION:DEF_VERSION,
            DEF_CLIENT:DEF_CLIENT,
            CONSENSUS_PERIOD_TIME:CONSENSUS_PERIOD_TIME,
            BLOCK_PROCESSING_LENGTH:BLOCK_PROCESSING_LENGTH
        };
    response.end(JSON.stringify(Result));
}

//----------------------------------------------------------------------------------------------------------------------
function GetBlockHeaders(response)
{
    response.writeHead(200, { 'Content-Type': 'application/json','Access-Control-Allow-Origin':'*'});
    response.writeHead(200, { 'Content-Type': 'application/json' });

    var Block,Result;
    var MaxNum=SERVER.CurrentBlockNum;
    var arr=[];
    for(var i=0;i<BLOCK_PROCESSING_LENGTH*2;i++)
    {
        var BlockNum=MaxNum-BLOCK_PROCESSING_LENGTH*2+i;
        Block=SERVER.GetBlock(BlockNum,false);
        if(Block)
        {
            arr.push(GetCopyBlock(Block));
        }
    }

    var Result={};
    Result.ArrBlocks=arr;
    Result.result=1;
    Result.sessionid=sessionid;
    response.end(JSON.stringify(Result));
}

function GetBlockData(response,BlockNum)
{
    response.writeHead(200, { 'Content-Type': 'application/json','Access-Control-Allow-Origin':'*'});
    response.writeHead(200, { 'Content-Type': 'application/json' });

    var Block,Result;
    var MaxNum=SERVER.CurrentBlockNum;
    if(BlockNum!==undefined)
    {
        BlockNum=parseInt(BlockNum);
        if(BlockNum>MaxNum-BLOCK_PROCESSING_LENGTH)
        {
            Block=SERVER.GetBlock(BlockNum,false);
            // if(Block && !Block.arrContent)
            //     Block=undefined;
        }
        else
        if(BlockNum===0 || BlockNum>0 || BlockNum<=MaxNum)
        {
            Block=SERVER.ReadBlockDB(BlockNum);
        }
    }

    if(Block)
    {
        Result=GetCopyBlock(Block);
        Result.result=1;
    }
    else
    {
        Result=
        {
            result:0,
        };
    }
    Result.sessionid=sessionid;
    response.end(JSON.stringify(Result));
}
function GetCopyBlock(Block)
{
    var Result=
        {
            BlockNum:Block.BlockNum,
            bSave:Block.bSave,
            TreeHash:GetHexFromAddres(Block.TreeHash),
            AddrHash:GetHexFromAddres(Block.AddrHash),
            PrevHash:GetHexFromAddres(Block.PrevHash),
            SumHash:GetHexFromAddres(Block.SumHash),

            SumPow:Block.SumPow,
            TrDataPos:Block.TrDataPos,
            TrDataLen:Block.TrDataLen,
            SeqHash:GetHexFromAddres(Block.SeqHash),
            Hash:GetHexFromAddres(Block.Hash),
            Power:Block.Power,

            TrCount:Block.TrCount,
            arrContent:Block.arrContent,

        };
    return Result;
}
//----------------------------------------------------------------------------------------------------------------------



//----------------------------------------------------------------------------------------------------------------------




//**********************************************************************************************************************
//**********************************************************************************************************************



var AddrLength=16;
function GetHexFromAddresShort(Hash)
{
    return GetHexFromAddres(Hash).substr(0,AddrLength);
}
function GetHexFromStrShort(Str)
{
    if(Str===undefined)
        return Str;
    else
        return Str.substr(0,AddrLength);
}

var glid=0;
function GetGUID(Block)
{
    if(!Block)
        return "------";
    if(!Block.guid)
    {
        glid++;
        Block.guid=glid;
    }
    return Block.guid;
}
function CopyBlockDraw(Block,MainChains)
{
    var MinerID=0;
    if(Block.AddrHash)
    {
        Block.AddrHash.len=0;
        MinerID=ReadUintFromArr(Block.AddrHash);
    }

    GetGUID(Block);
    var Item=
        {
            guid:Block.guid,
            Active:Block.Active,
            bSave:Block.bSave,
            Prepared:Block.Prepared,
            BlockNum:Block.BlockNum,
            Hash:GetHexFromAddresShort(Block.Hash),
            SumHash:GetHexFromAddresShort(Block.SumHash),
            SeqHash:GetHexFromAddresShort(Block.SeqHash),
            TreeHash:GetHexFromAddresShort(Block.TreeHash),
            AddrHash:GetHexFromAddresShort(Block.AddrHash),
            Miner1:MinerID,
            Comment1:Block.Comment1,
            Comment2:Block.Comment2,
            SumPow:Block.SumPow,
            Info:Block.Info,
            TreeLoaded:Block.TreeEq,
            AddToLoad:Block.AddToLoad,
            LoadDB:Block.LoadDB,
            FindBlockDB:Block.FindBlockDB,
            TrCount:Block.TrCount,
            ArrLength:0,
            TrDataLen:Block.TrDataLen,
        };
    if(Block.chain)
        Item.chainid=Block.chain.id;
    if(Block.LoadDB!==undefined)
       Item.bSave=Block.LoadDB;
    if(Block.arrContent)
        //Item.ArrLength=Block.arrContent.length;
        Item.TrCount=Block.arrContent.length;


    Item.BlockDown=GetGUID(Block.BlockDown);

    if(MainChains && Item.chainid)
    {
        Item.Main=MainChains[Item.chainid];
    }

    return Item;
}
function CopyChainDraw(Chain,bWasRecursive,bMain)
{
    if(!Chain)
        return Chain;

    GetGUID(Chain);


    var Item=
        {
            guid:Chain.guid,
            id:Chain.id,
            chainid:Chain.id,
            bSave:Chain.LoadDB,
            FindBlockDB:Chain.FindBlockDB,
            GetFindDB:Chain.GetFindDB(),
            BlockNum:Chain.BlockNumStart,
            Hash:GetHexFromAddresShort(Chain.HashStart),
            Comment1:Chain.Comment1,
            Comment2:Chain.Comment2,
            StopSend:Chain.StopSend,
            SumPow:0,
            Info:Chain.Info,
            IsSum:Chain.IsSum,
            //Error:Chain.GetRootChain(Chain).Error,
            Main:bMain,
            //num:Chain.num,
            // CountForLoad:Chain.CountForLoad,
            // CountWasLoad:Chain.CountWasLoad,
        };
    if(Chain.IsSumStart)
    {
        Item.SumHash=Item.Hash;
        Item.Hash="-------";
    }
    if(Chain.RootChain)
    {
        var rootChain=Chain.GetRootChain();
        Item.rootid=rootChain.id;
        if(!bWasRecursive)
            Item.root=CopyChainDraw(rootChain,true);
        //Item.RootInfo=rootChain.Info;
    }
    else
        Item.rootid="";
    if(Chain.BlockHead)
    {
        Item.HashMaxStr=GetGUID(Chain.BlockHead);
        Item.BlockNumMax=Chain.BlockHead.BlockNum;
    }
    else
    {
        Item.HashMaxStr="------";
    }




    return Item;
}

function AddChainList(arrLoadedChainList,LoadedChainList,bMain)
{
    for(var chain of LoadedChainList)
    {
        if(chain)
        {
            arrLoadedChainList.push(CopyChainDraw(chain,false,bMain));
        }
    }
}
function AddMapList(arrLoadedBlocks,type,MapMapLoaded,MainChains)
{
    for(var key in MapMapLoaded)
    {
        var map=MapMapLoaded[key];
        if(map)
        {
            for(var key in map)
            {
                var Block=map[key];
                 if(key.substr(1,1)===":")
                    continue;

                if(!Block.Send || type==="reload")
                {
                    arrLoadedBlocks.push(CopyBlockDraw(Block,MainChains));
                    Block.Send=true;
                }
            }
        }
    }
}


function SendFileHTML(response,name)
{
    let type=name.substr(name.length-3,3);




    fs.readFile("./"+name, function read(err, data)
    {
        if (err)
        {
            if(type==="ico")
            {
                response.writeHead(404, { 'Content-Type': 'text/html'});
                response.end();
                return;
            }


            ToError(err);
            data="Not found: "+name;
        }
        else
        {
            if(type==="ico")
            {
                response.writeHead(200, { 'Content-Type': 'image/vnd.microsoft.icon'});
            }
            else
            if(type===".js")
                response.writeHead(200, { 'Content-Type': 'application/javascript'});
            else
            if(type==="css")
                response.writeHead(200, { 'Content-Type': 'text/css'});
            else
                response.writeHead(200, { 'Content-Type': 'text/html'});

        }

        response.end(data);
    });
}


//**********************************************************************************************************************
// function GetArrFromHexTr(Str)
// {
//     let array=Buffer.alloc(Str.length/2);
//     for(let i=0;i<array.length;i++)
//     {
//         array[i]=parseInt(Str.substr(i*2,2),16);
//     }
//     return array;
// }
//**********************************************************************************************************************
function GetStrTime()
{
    var now = GetCurrentTime(0);
    var Str=""+now.getHours().toStringZ(2);
    Str=Str+":"+now.getMinutes().toStringZ(2);
    Str=Str+":"+now.getSeconds().toStringZ(2);
    return Str;
}


//TRANSFER DATA (CLIENT-SERVER)
function OnGetData(arg)
{
    var Path=arg.path;
    var obj=arg.obj;

    var params=Path.split('/',5);
    params.splice(0,1);


    var Ret;
    var F=HTTPCaller[params[0]];
    if(F)
    {

        if(obj)
            Ret=F(obj);
        else
            Ret=F(params[1],params[2],params[3]);
    }
    else
    {
        Ret={result:0};
    }
    return Ret;
}

//RUN HTTP SERVER
if(HTTP_PORT_NUMBER)
{
    var port = HTTP_PORT_NUMBER;
    var HTTPServer=http.createServer(function (request, response0)
    {
        if(!request.headers)
            return;
        var host=request.headers.host;
        if(typeof host!=="string")
            return;
        if(host.substr(0,4)!=="test" && host!=="localhost")
            return;

        let RESPONSE=response0;
        var response=
            {
                end:function (data)
                {
                    try{RESPONSE.end(data);}catch(e){ToError("H##1");ToError(e);}
                },
                writeHead:function (num, data)
                {
                    try{RESPONSE.writeHead(num,data);}catch(e){ToError("H##2");ToError(e);}
                },
            };

        if(!global.SERVER)
        {
            response.writeHead(404, { 'Content-Type': 'text/html'});
            response.end("");
            return;
        }


        var fromURL = url.parse(request.url);
        var Path=querystring.unescape(fromURL.path);
        //var Path=decodeURIComponent(fromURL.path);//??
        var params=Path.split('/',5);
        params.splice(0,1);
        //ToLog(""+Type+":"+Path)

        var Type=request.method;
        if(Type==="POST")
        {
            let Response=response;
            let Params=params;
            let postData = "";
            request.addListener("data",
                function(postDataChunk)
                {
                    postData += postDataChunk;
                });

            request.addListener("end",
                function()
                {
                    var Data;
                    try
                    {
                        Data=JSON.parse(postData)
                    }
                    catch (e)
                    {
                        ToError("--------Error data parsing : "+Params[0]+" "+postData.substr(0,200))
                        Response.writeHead(405, { 'Content-Type': 'text/html'});
                        Response.end("Error data parsing");

                    }
                    DoCommand(response,Path,[Params[0],Data]);
                });

        }
        else
        {
            DoCommand(response,Path,params);
        }

    }).listen(port);
    ToLog("Run HTTP-server on port:"+port);


    HTTPServer.on('error', (err) =>
    {
        ToError("H##3");
        ToError(err);
    });
}

if(global.ELECTRON)
{
    const {ipcMain} = require('electron');

    ipcMain.on('GetData', (event, arg) =>
    {
        event.returnValue = OnGetData(arg);
    })
}
exports.SendData = OnGetData;

function RunConsole()
{
    var Str = fs.readFileSync("./EXPERIMENTAL/!run-console.js",{encoding : "utf8"});

    try
    {
        var ret=eval(Str);
    }
    catch (e)
    {
        ret=""+e;
    }
    return ret;
}

//GetHexFromArr

