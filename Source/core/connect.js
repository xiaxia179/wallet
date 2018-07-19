"use strict";
/**
 * Copyright: Yuriy Ivanov, 2017 e-mail: progr76@gmail.com
 * Created by vtools on 14.12.2017.
 */
//connect


const RBTree = require('bintrees').RBTree;
const crypto = require('crypto');
const CNode=require("./node");

global.PERIOD_FOR_RECONNECT=3600*1000;//ms
//const PERIOD_FOR_RECONNECT=10*1000;//ms

global.CHECK_DELTA_TIME={Num:0,bUse:0,StartBlockNum:0,EndBlockNum:0,bAddTime:0,DeltaTime:0,Sign:[]};
global.CHECK_POINT={BlockNum:0,Hash:[],Sign:[]};
global.CODE_VERSION={BlockNum:0,addrArr:[],LevelUpdate:0,BlockPeriod:0, VersionNum:UPDATE_CODE_VERSION_NUM,Hash:[],Sign:[],StartLoadVersionNum:0};




const MAX_PERIOD_GETNODES=60*1000;

var MAX_PING_FOR_CONNECT=300;//ms
var TIME_AUTOSORT_GRAY_LIST=5000;//ms
var MAX_TIME_CORRECT=3*3600*1000;//ms

global.MAX_WAIT_PERIOD_FOR_HOT=2*CONSENSUS_PERIOD_TIME;
global.MAX_WAIT_PERIOD_FOR_ACTIVE=10*CONSENSUS_PERIOD_TIME;

const PERIOD_FOR_CTAR_CHECK_TIME=300;//sec




module.exports = class CConnect extends require("./transfer-msg")
{
    constructor(SetKeyPair,RunIP,RunPort,UseRNDHeader,bVirtual)
    {
        super(SetKeyPair,RunIP,RunPort,UseRNDHeader,bVirtual)



        this.WasNodesSort=false;
        //this.ReadyConsensus=false;

        this.LevelNodes=[];
        this.LevelNodesCount=0;

        this.NodesArr=[];
        this.NodesMap={};//addr->node (1:1) //by addr string
        this.NodesIPMap={};
        this.WasNodesSort=true;

        this.PerioadAfterCanStart=0;





        if(!global.ADDRLIST_MODE && !this.VirtualMode)
        {

            setInterval(this.StartPingPong.bind(this),1000);
            setInterval(this.StartCheckConnect.bind(this),1000);
            setInterval(this.StartGetLevelsHotConnects.bind(this),5000);

            setInterval(this.DeleteNodeFromActiveByTimer.bind(this),5000);

            setInterval(this.StartReconnect.bind(this),60*1000);
            //setInterval(this.StartReconnect.bind(this),1*1000);

         }

    }

    StartConnectTry(Node)
    {
        var Delta=(new Date)-Node.ConnectStart;

        if(Delta>=Node.NextConnectDelta && this.IsCanConnect(Node))
        {
            if(!GetSocketStatus(Node.Socket))
            {
                Node.ConnectStart=(new Date)-0;
                if(Delta<60*1000)
                    Node.NextConnectDelta=Node.NextConnectDelta*2;
                else
                    Node.NextConnectDelta=Node.NextConnectDelta*1.2;

                Node.CreateConnect();
            }
        }
    }


    FindRunNodeContext(addrArr,ip,port,bUpdate)
    {
        var Node,addrStr;

        addrStr=GetHexFromAddres(addrArr);
        Node=this.NodesMap[addrStr];
        if(!Node)
        {
            var key=""+ip+":"+port;
            Node=this.NodesIPMap[key];
            if(!Node)
            {
                if(addrArr!==undefined)
                    Node=this.GetNewNode(addrStr,ip,port)
                else
                {
                    addrStr=GetHexFromAddres(crypto.randomBytes(32));
                    Node=this.GetNewNode(addrStr,ip,port);
                    Node.addrStrTemp=addrStr;
                }
            }
        }
        if(bUpdate)
        {
            Node.ip=ip;
            Node.port=port;
        }

        return Node;
    }

    StartHandshake(Node)
    {
        return this.StartConnectTry(Node)
    }




    /*
    Ping--->
    time
    <---Pong
     */
    StartPingPong()
    {
        if(glStopNode)
            return;

        if(global.CAN_START)
            this.PerioadAfterCanStart++;

        if(CHECK_DELTA_TIME.bUse)
        {
            var BlockNum=GetCurrentBlockNumByTime();
            if(CHECK_DELTA_TIME.StartBlockNum<=BlockNum && CHECK_DELTA_TIME.EndBlockNum>=BlockNum)
            {
                if(!global.DELTA_CURRENT_TIME)
                    global.DELTA_CURRENT_TIME=0;
                var CorrectTime=0;
                if(CHECK_DELTA_TIME.bAddTime)
                    CorrectTime = CHECK_DELTA_TIME.DeltaTime;
                else
                    CorrectTime = -CHECK_DELTA_TIME.DeltaTime;

                ToLog("************************************************USE CORRECT TIME: "+CHECK_DELTA_TIME.Num+" Delta = "+CorrectTime);

                global.DELTA_CURRENT_TIME += CorrectTime;
                //reset times
                this.ClearTimeStat();
                SAVE_CONST(true);
            }
        }


        var arr=SERVER.GetActualNodes();
        for(var i=0;i<arr.length;i++)
        {
            var Node=arr[i];
            if(this.IsCanConnect(Node))
            {
                if(!Node.PingNumber)
                    Node.PingNumber=0;
                Node.PingNumber++;

                var Context={"StartTime":GetCurrentTime(0),PingNumber:Node.PingNumber};
                this.SendF(Node,
                    {
                        "Method":"PING",
                        "Context":Context,
                        "Data":this.GetPingData()
                    }
                );
                Node.DeltaTime=undefined;
            }
        }
    }
    GetPingData()
    {
        var GrayAddres=0;
        if(global.NET_WORK_MODE && !NET_WORK_MODE.UseDirectIP)
            GrayAddres=1;

        var BlockNumHash=GetCurrentBlockNumByTime()-BLOCK_PROCESSING_LENGTH2;
        var AccountsHash=DApps.Accounts.GetHashOrUndefined(BlockNumHash);

        var Ret=
            {
                VERSIONMAX:DEF_VERSION,
                FIRST_TIME_BLOCK:0,
                PingVersion:2,
                GrayConnect:GrayAddres,
                Reserve2:0,
                Time:(GetCurrentTime()-0),
                BlockNumDB:this.BlockNumDB,
                LoadHistoryMode:this.LoadHistoryMode,
                CanStart:global.CAN_START,
                CheckPoint:CHECK_POINT,
                CodeVersion:CODE_VERSION,
                TrafficFree:this.SendTrafficFree,
                AccountBlockNum:BlockNumHash,
                AccountsHash:AccountsHash,
                MemoryUsage:Math.trunc(process.memoryUsage().heapTotal/1024/1024),
                CheckDeltaTime:CHECK_DELTA_TIME,
                CodeVersion2:CODE_VERSION,
                Reserve:[],
            };

        return Ret;
    }

    static PING_F(bSend)
    {
        return "{\
            VERSIONMAX:str15,\
            PingVersion:byte,\
            GrayConnect:byte,\
            Reserve2:uint32,\
            Time:uint,\
            BlockNumDB:uint,\
            LoadHistoryMode:byte,\
            CanStart:byte,\
            CheckPoint:{BlockNum:uint,Hash:hash,Sign:arr64},\
            CodeVersion:{VersionNum:uint,Hash:hash,Sign:arr64},\
            TrafficFree:uint,\
            AccountBlockNum:uint,\
            AccountsHash:hash,\
            MemoryUsage:uint,\
            CheckDeltaTime:{Num:uint,bUse:byte,StartBlockNum:uint,EndBlockNum:uint,bAddTime:byte,DeltaTime:uint,Sign:arr64},\
            CodeVersion2:{BlockNum:uint,addrArr:arr32,LevelUpdate:byte,BlockPeriod:uint,VersionNum:uint,Hash:hash,Sign:arr64},\
            Reserve:arr40,\
            }";
    }

    static PONG_F(bSend)
    {
       return CConnect.PING_F(bSend);
    }

    PING(Info,CurTime)
    {
        var Data=this.DataFromF(Info);

        Info.Node.VERSIONMAX=Data.VERSIONMAX;
        this.SendF(Info.Node,
            {
                "Method":"PONG",
                "Context":Info.Context,
                "Data":this.GetPingData()
            }
        );
    }


    PONG(Info,CurTime)
    {
        var Data=this.DataFromF(Info);
        var Node=Info.Node;

        //load time from meta
        if(!Info.Context)
            return;
        if(!Info.Context.StartTime)
            return;
        if(Info.Context.PingNumber!==Node.PingNumber)
            return;


        var DeltaTime=GetCurrentTime(0)-Info.Context.StartTime;
        Node.DeltaTime=DeltaTime;
        Node.INFO=Data;
        Node.LoadHistoryMode=Data.LoadHistoryMode;
        if(Data.LoadHistoryMode || !Data.CanStart)
        if(Node.Hot)
        {
            this.DeleteNodeFromHot(Node);
        }

        Node.LastTime=GetCurrentTime();
        Node.NextConnectDelta=1000;//connection is good
        Node.GrayConnect=Data.GrayConnect;



        //Check point
        if(!CREATE_ON_START)
        if(Data.CheckPoint.BlockNum && Data.CheckPoint.BlockNum>CHECK_POINT.BlockNum)
        {
            var SignArr=arr2(Data.CheckPoint.Hash,GetArrFromValue(Data.CheckPoint.BlockNum));
            if(CheckDevelopSign(SignArr,Data.CheckPoint.Sign))
            {
                ToLog("Get new CheckPoint = "+Data.CheckPoint.BlockNum);

                global.CHECK_POINT=Data.CheckPoint;
                var Block=this.ReadBlockHeaderDB(CHECK_POINT.BlockNum);
                if(Block && CompareArr(Block.Hash,CHECK_POINT.Hash)!==0)
                {
                    //reload chains
                    this.BlockNumDB=CHECK_POINT.BlockNum-1;
                    this.TruncateBlockDB(this.BlockNumDB);
                    this.StartLoadHistory(Node);
                }
            }
            else
            {
                Node.NextConnectDelta=60*1000;
                ToLog("Error Sign CheckPoint="+Data.CheckPoint.BlockNum+" from "+NodeInfo(Node));
                this.AddCheckErrCount(Node,1,"Error Sign CheckPoint");
            }
        }



        if(!CODE_VERSION.StartLoadVersionNum)
            CODE_VERSION.StartLoadVersionNum=0;


        //{BlockNum:0,addrArr:[],LevelUpdate:0,BlockPeriod:0, VersionNum:UPDATE_CODE_VERSION_NUM,Hash:[],Sign:[],StartLoadVersionNum:0};

        var CodeVersion=Data.CodeVersion2;
        if(CodeVersion.BlockNum && CodeVersion.BlockNum<=GetCurrentBlockNumByTime() && CodeVersion.BlockNum > CODE_VERSION.BlockNum
            && !IsZeroArr(CodeVersion.Hash)
            && (CodeVersion.VersionNum>CODE_VERSION.VersionNum && CodeVersion.VersionNum>CODE_VERSION.StartLoadVersionNum
                || CodeVersion.VersionNum===CODE_VERSION.VersionNum && IsZeroArr(CODE_VERSION.Hash)))//was restart
        {

            var Level=AddrLevelArr(this.addrArr,CodeVersion.addrArr);
            if(CodeVersion.BlockPeriod)
            {
                var Delta=GetCurrentBlockNumByTime()-CodeVersion.BlockNum;
                Level+=Delta/CodeVersion.BlockPeriod;
            }

            if(Level>=CodeVersion.LevelUpdate)
            {
                var SignArr=arr2(CodeVersion.Hash,GetArrFromValue(CodeVersion.VersionNum));
                if(CheckDevelopSign(SignArr,CodeVersion.Sign))
                {
                    ToLog("Get new CodeVersion = "+CodeVersion.VersionNum+" HASH:"+GetHexFromArr(CodeVersion.Hash));

                    if(CodeVersion.VersionNum>CODE_VERSION.VersionNum && CodeVersion.VersionNum>CODE_VERSION.StartLoadVersionNum)
                    {
                        this.StartLoadCode(Node,CodeVersion);
                    }
                    else
                    if(CodeVersion.VersionNum===CODE_VERSION.VersionNum && IsZeroArr(CODE_VERSION.Hash))//was restart
                    {
                        CODE_VERSION=CodeVersion;
                    }
                }
                else
                {
                    ToLog("Error Sign CodeVersion="+CodeVersion.VersionNum+" from "+NodeInfo(Node)+" HASH:"+GetHexFromArr(CodeVersion.Hash));
                    ToLog(JSON.stringify(CodeVersion));
                    this.AddCheckErrCount(Node,1,"Error Sign CodeVersion");
                    Node.NextConnectDelta=60*1000;
                }
            }
        }

        //if(CodeVersion.VersionNum===CODE_VERSION.VersionNum && !Data.LoadHistoryMode)
        if(CodeVersion.VersionNum>=MIN_CODE_VERSION_NUM && !Data.LoadHistoryMode)
        {
            Node.CanHot=true;

            if(CHECK_POINT.BlockNum && Data.CheckPoint.BlockNum)
            if(CHECK_POINT.BlockNum!==Data.CheckPoint.BlockNum || CompareArr(CHECK_POINT.Hash,Data.CheckPoint.Hash)!==0)
            {
                Node.CanHot=false;
                Node.NextConnectDelta=60*1000;
            }
        }
        else
        {
            Node.CanHot=false;
            if(CodeVersion.VersionNum<CODE_VERSION.VersionNum)
            {
                ToLog("ERR VersionNum="+CodeVersion.VersionNum+" from "+NodeInfo(Node));
                Node.NextConnectDelta=60*1000;
            }
        }

        if(!global.CAN_START)
        {
            ToLog("DeltaTime="+DeltaTime+" ms  -  "+NodeInfo(Node));
            if(DeltaTime>MAX_PING_FOR_CONNECT)
                ToLog("DeltaTime="+DeltaTime+">"+MAX_PING_FOR_CONNECT+" ms  -  "+NodeInfo(Node))
        }


        var Times;
        if(DeltaTime<=MAX_PING_FOR_CONNECT)
        {

            //расчет времени удаленной ноды
            Times=Node.Times;
            if(!Times || Times.Count>=10)
            {
                Times={SumDelta:0,Count:0,AvgDelta:0};
                Node.Times=Times;
            }

            var Time1=Data.Time;
            var Time2=GetCurrentTime();
            var Delta2=Time2-Time1-DeltaTime/2;
            Delta2=-Delta2;


            Times.SumDelta+=Delta2;
            Times.Count++;
            Times.AvgDelta=Times.SumDelta/Times.Count;


            this.CorrectTime();
        }
        else
        {
            //ToLog("DeltaTime="+DeltaTime+" ms  -  "+NodeInfo(Node)+"    PingNumber:"+Info.Context.PingNumber+"/"+Node.PingNumber);
        }
        ADD_TO_STAT("MAX:PING_TIME",DeltaTime);

        if(!global.CAN_START)
        if(Times && Times.Count>=1 && Times.AvgDelta<=200)
        {
            ToLog("*************************************************************************** CAN_START")
            global.CAN_START=true;
        }


        if(global.CAN_START && !CREATE_ON_START)
        {
            if(Data.CheckDeltaTime.Num>CHECK_DELTA_TIME.Num)
            {
                var SignArr=this.GetSignCheckDeltaTime(Data.CheckDeltaTime);
                if(CheckDevelopSign(SignArr,Data.CheckDeltaTime.Sign))
                {
                    ToLog("Get new CheckDeltaTime: "+JSON.stringify(Data.CheckDeltaTime));
                    global.CHECK_DELTA_TIME=Data.CheckDeltaTime;
                }
                else
                {
                    Node.NextConnectDelta=60*1000;
                    ToLog("Error Sign CheckDeltaTime Num="+Data.CheckDeltaTime.Num+" from "+NodeInfo(Node));
                    this.AddCheckErrCount(Node,1,"Error Sign CheckDeltaTime");
                }
            }
        }
    }

    GetSignCheckDeltaTime(Data)
    {
        var Buf=BufLib.GetBufferFromObject(Data,"{Num:uint,bUse:byte,StartBlockNum:uint,EndBlockNum:uint,bAddTime:byte,DeltaTime:uint}",1000,{});
        return shaarr(Buf);
    }







    StartDisconnectHot(Node,StrError)
    {
        this.Send(Node,
            {
                "Method":"DISCONNECTHOT",
                "Data":StrError
            },STR_TYPE
        );
        //this.DeleteNodeFromActive(Node);
    }

    DISCONNECT(Info,CurTime)
    {
        ToLog("FROM "+NodeInfo(Info.Node)+" DISCONNECT: "+Info.Data);
        this.DeleteNodeFromActive(Info.Node);
        this.DeleteNodeFromHot(Info.Node);
    }
    DISCONNECTHOT(Info,CurTime)
    {
        this.DeleteNodeFromHot(Info.Node);
        ToLog("FROM "+NodeInfo(Info.Node)+" DISCONNECTHOT: "+Info.Data);
    }

    DeleteNodeFromHot(Node)
    {
        if(!Node.Stage)
            Node.Stage=0;
        if(Node.Hot)
        {
            Node.Stage++;
            Node.Hot=false;
        }

        Node.CanHot=false;
        for(var i=0;i<this.LevelNodes.length;i++)
        {
            var arr=this.LevelNodes[i];
            for(var n=0;arr && n<arr.length;n++)
            if(arr[n]===Node)
            {
                ADD_TO_STAT("DeleteLevelConnect");
                arr.splice(n,1);
                break;
            }
        }
        this.LevelNodesCount=this.GetNodesLevelCount();
    }
    GetNodesLevelCount()
    {

        var Count=0;
        for(var i=0;i<this.LevelNodes.length;i++)
        {
            var arr=this.LevelNodes[i];
            for(var n=0;arr && n<arr.length;n++)
            if(arr[n].Hot)
            {
                Count++;
                break;
            }
        }
        return Count;
    }


    StartGetNodes(Node)
    {
        if(glStopNode)
            return;

        var Delta=(new Date)-Node.GetNodesStart;

        if(Delta>=Node.NextGetNodesDelta)
        {
            Node.GetNodesStart=(new Date)-0;
            Node.NextGetNodesDelta=Math.min(Node.NextGetNodesDelta*2,MAX_PERIOD_GETNODES);

            this.Send(Node,
                {
                    "Method":"GETNODES",
                    "Data":undefined
                }
            );
        }

    }

    GETNODES(Info,CurTime)
    {
        this.SendF(Info.Node,
            {
                "Method":"RETGETNODES",
                "Context":Info.Context,
                "Data":{arr:this.GetDirectNodesArray(false)}
            },MAX_NODES_RETURN*150+300
        );
    }
    static RETGETNODES_F()
    {
        return "{arr:[\
                        {\
                            addrStr:str64,\
                            ip:str30,\
                            port:uint16,\
                            Reserve:uint16,\
                            LastTime:uint,\
                            DeltaTime:uint\
                        }\
                    ]}";
    }


    RETGETNODES(Info,CurTime)
    {
        var Data=this.DataFromF(Info);
        var arr=Data.arr;
        if(arr && arr.length>0)
        {
            for(var i=0;i<arr.length;i++)
            {
                this.AddToArrNodes(arr[i],true);
            }
        }
        //ToLog("RETGETNODES length="+arr.length);
    }


    GetNewNode(addrStr,ip,port)
    {
        var Node=new CNode(addrStr,ip,port);
        this.AddToArrNodes(Node,false);

        return Node;
    }

    IsCanConnect(Node)
    {
        if(Node.addrStr===this.addrStr
            || Node.IsBan
            //|| (!Node.DirectIP && !Node.WhiteConnect)
            || Node.Self
            || Node.DoubleConnection)
            return false;

        if(Node.ip===this.ip && Node.port===this.port)
            return false;

        if(this.addrStr===Node.addrStr)
            return false;

        return true;
    }

    GetDirectNodesArray(bAll)
    {
        var ret=[];
        var Value=
            {
                addrStr:this.addrStr,
                ip:this.ip,
                port:this.port,
                LastTime:0,
                DeltaTime:0
            };
        ret.push(Value);
        if(global.NET_WORK_MODE && (!NET_WORK_MODE.UseDirectIP))
            return ret;



        var len=this.NodesArr.length;
        var UseRandom=0;
        if(len>MAX_NODES_RETURN && !bAll)
        {
            UseRandom=1;
            len=MAX_NODES_RETURN;
        }
        var mapWasAdd={};

        for(var i=0;i<len;i++)
        {
            var Item;
            if(UseRandom)
            {
                Item=this.NodesArr[random(this.NodesArr.length)];
                if(mapWasAdd[Item.addrStr])
                {
                    continue;
                }
                mapWasAdd[Item.addrStr]=1;
            }
            else
            {
                Item=this.NodesArr[i];
            }


            if(!this.IsCanConnect(Item))
                continue;
            if(Item.GrayConnect)
                continue;

            if(Item.LastTime || Item.NextConnectDelta>10*1000)
            if(Item.LastTime-0<(new Date)-3600*1000)
                continue;

            var Value=
            {
                addrStr:Item.addrStr,
                ip:Item.ip,
                port:Item.port,
                LastTime:Item.LastTime,
                DeltaTime:Item.DeltaTime
            };

            ret.push(Value);
        }

        return ret;
    }

    AddToArrNodes(Item,bFromGetNodes)
    {
        if(Item.addrStr==="" || Item.addrStr===this.addrStr)
            return;
        var Node;
        var key=Item.ip+":"+Item.port;
        Node=this.NodesMap[Item.addrStr];
        if(!Node)
        {
            Node=this.NodesIPMap[key];
        }

        if(!Node)
        {

            if(Item instanceof CNode)
                Node=Item;
            else
                Node=new CNode(Item.addrStr,Item.ip,Item.port);


            //добавляем новые поля
            Node.Stage=1;
            Node.id=this.NodesArr.length;
            Node.addrArr=GetAddresFromHex(Node.addrStr);
            //Node.addrStr2=AddrTo2(Node.addrStr);


            this.NodesMap[Node.addrStr]=Node;
            this.NodesArr.push(Node)

            //ToLog("NEW: "+Node.ip+":"+Node.port)

            ADD_TO_STAT("AddToNodes");
            this.NodesArrSortStart();
        }
        if(bFromGetNodes)
        {
            //Node.DirectIP=true;
        }

        this.NodesMap[Node.addrStr]=Node;
        this.NodesIPMap[key]=Node;

        if(Node.addrArr && CompareArr(Node.addrArr,this.addrArr)===0)
        {
            Node.Self=true;
        }



        return Node;
    }

    NodesArrSortStart()
    {
        if(this.WasNodesSort)
            setTimeout(this.NodesArrSort.bind(this),TIME_AUTOSORT_GRAY_LIST);
        this.WasNodesSort=false;
    }

    NodesArrSort()
    {
        if(!this.WasNodesSort)
        {
            this.WasNodesSort=true;

            this.NodesArr.sort(function (a,b)
            {
                if(a.Active!==b.Active)
                    return b.Active-a.Active;

                return a.LastTime-b.LastTime;
            });



            SaveParams(GetDataPath("nodes.lst"),this.GetDirectNodesArray(true))
        }
    }








    StartAddLevelConnect(Node)
    {
        if(this.LoadHistoryMode || !global.CAN_START)
            return;

        // if(!Node.Stage)
        //     Node.Stage=0;
        Node.Stage++;

        if(Node.Stage>1000 && Node.Active)
        {
            this.DeleteNodeFromActive(Node);
        }



        if(Node.Active && Node.CanHot)
        this.Send(Node,
            {
                "Method":"ADDLEVELCONNECT",
                "Data":undefined
            }
        );
    }

    AddrLevelNode(Node)
    {
        if(Node.GrayConnect)
            return MAX_LEVEL_SPECIALIZATION-1;//TODO с учетом номера серого соединения

        return AddrLevelArr(this.addrArr,Node.addrArr);
    }

    ADDLEVELCONNECT(Info,CurTime)
    {
        var ret;
        var Count;

        if(this.LoadHistoryMode || !global.CAN_START)
            return;

        var Level=this.AddrLevelNode(Info.Node);

        var arr=this.LevelNodes[Level];
        if(!arr)
            Count=0;
        else
            Count=arr.length;


        if(!Info.Node.CanHot || Count>=MAX_CONNECT_CHILD)// || (Count>1 && random(Level+5)!==0))
        {
            ret={result:0,Count:Count};
        }
        else
        {
            this.AddLevelConnect(Info.Node);
            ret={result:1,Count:Count};
        }



        this.SendF(Info.Node,
            {
                "Method":"RETADDLEVELCONNECT",
                "Context":Info.Context,
                "Data":ret
            }
        );
    }
    static RETADDLEVELCONNECT_F()
    {
        return "{result:byte,Count:uint}";
    }

    RETADDLEVELCONNECT(Info,CurTime)
    {
        var Data=this.DataFromF(Info);

        if(Data.result===1)
        {
            this.AddLevelConnect(Info.Node);
            //this.CalcStatus(false);
        }
        else
        {
            Info.Node.Stage++
        }

        Info.Node.CountConnect=Data.Count;
    }



    StartGetLevelsHotConnects()
    {
        if(glStopNode)
            return;
        if(this.LoadHistoryMode || !global.CAN_START)
            return;


        var CurTime=GetCurrentTime();
        for(var n=0;n<this.NodesArr.length;n++)
        {
            var Node=this.NodesArr[n];
            if(!Node.Active || Node.addrStr===this.addrStr)
                continue;

            this.Send(Node,
                {
                    "Method":"GETHOTLEVELS",
                    "Data":undefined
                }
            );
        }
    }

    GETHOTLEVELS(Info,CurTime)
    {
        if(this.LoadHistoryMode || !global.CAN_START)
            return;

        var ArrSend=[];
        for(var i=0;i<this.LevelNodes.length;i++)
        {
            ArrSend[i]=[];
            var arr=this.LevelNodes[i];
            for(var n=0;arr && n<arr.length;n++)
            {
                var Node=arr[n];
                if(Node && Node.Hot && Node.ip)
                {
                    ArrSend[i].push(
                        {
                            addrStr:Node.addrStr,
                            //addrArr:Node.addrArr,
                            ip:Node.ip,
                            port:Node.port,
                            LastTime:Node.LastTime,
                            DeltaTime:Node.DeltaTime
                        }
                    );

                }
            }
        }


        // ToLog("ArrSend:"+ArrSend.length)
        // ToLog(JSON.stringify(ArrSend));

         this.SendF(Info.Node,
            {
                "Method":"RETGETHOTLEVELS",
                "Context":Info.Context,
                "Data":{arr:ArrSend}
            },ArrSend.length*100*MAX_CONNECT_CHILD+300
        );
    }
    static RETGETHOTLEVELS_F()
    {
        return "{arr:[\
                        [{\
                            addrStr:str64,\
                            ip:str30,\
                            port:uint16,\
                            Reserve:uint16,\
                            LastTime:uint,\
                            DeltaTime:uint\
                        }]\
                    ]}";

    }
    RETGETHOTLEVELS(Info,CurTime)
    {
        var Data=this.DataFromF(Info);

        var LevelNodes=Data.arr;
        Info.Node.LevelNodes=LevelNodes;


        for(var i=0;i<LevelNodes.length;i++)
        {
            var arr=LevelNodes[i];
            for(var n=0;arr && n<arr.length;n++)
            {
                var Node=arr[n];
                arr[n]=this.AddToArrNodes(Node,true);
            }
        }
    }


    DeleteAllNodesFromHot(Str)
    {
        for(var i=0;i<this.LevelNodes.length;i++)
        {
            var arr=this.LevelNodes[i];
            for(var n=0;arr && n<arr.length;n++)
            {
                var Node=arr[n];
                if(Node.Hot)
                {
                    this.DeleteNodeFromHot(Node);
                    this.StartDisconnectHot(Node,Str);
                }
            }
        }
    }

    StartCheckConnect()
    {
        if(glStopNode)
            return;
        if(this.LoadHistoryMode || !global.CAN_START)
            return;


        var CurTime=GetCurrentTime();


        //проверяем существующие соединения - время последнего обмена (может был дисконнект?)
        for(var i=0;i<this.LevelNodes.length;i++)
        {
            var arr=this.LevelNodes[i];
            for(var n=0;arr && n<arr.length;n++)
            {
                var Node=arr[n];
                if(!Node.LastTime)
                    Node.LastTime=CurTime;

                var DeltaTime=CurTime-Node.LastTime;
                if(!Node.Hot  || !Node.CanHot || DeltaTime>MAX_WAIT_PERIOD_FOR_HOT)
                {
                    //ToLog("Node.Hot="+Node.Hot+" DeltaTime="+DeltaTime);
                    this.DeleteNodeFromHot(Node);
                    this.StartDisconnectHot(Node,"StartCheckConnect");
                    break;
                }
            }
        }

        //проверяем может ноды могут соединитьcя по другому
        for(var i=0;i<this.LevelNodes.length;i++)
        {
            this.CheckDisconnectChilds(i);
        }

        //проверяем новые соединения (может сеть уже увеличилась?)

        if(0)
        for(var L=0;L<=MAX_LEVEL_SPECIALIZATION;L++)
        {
            var arr=this.LevelNodes[i];
            if(!arr || arr.length!==1)
            {
                var Res=this.FindPair(L);
            }
        }


        this.StatLevels=this.CalcLevels();
        for(var i=0;i<this.StatLevels.length;i++)
        {
            var arr=this.LevelNodes[i];
            if(arr && arr.length>=MIN_CONNECT_CHILD)
                continue;

            if(!this.StatLevels[i])
                continue;

            //требуется соединение
            var Node=this.StatLevels[i].Node;
            this.StartAddLevelConnect(Node);
        }



    }
    DeleteNodeFromActiveByTimer()
    {
        if(glStopNode)
            return;

        var CurTime=GetCurrentTime();

        var arr=SERVER.NodesArr;
        for(var i=0;i<arr.length;i++)
        {
            var Node=arr[i];
            if(Node.Active && GetSocketStatus(Node.Socket)<100)
            {
                var Delta=CurTime-Node.LastTime;
                if(Delta>MAX_WAIT_PERIOD_FOR_ACTIVE)
                {
                    ToLog("Delete node from Active by timer: "+NodeInfo(Node))
                    this.DeleteNodeFromActive(Node);
                }
            }
        }
    }


    CalcLevels()
    {
        var Levels=[];
        for(let n=0;n<this.NodesArr.length;n++)
        {
            let Child=this.NodesArr[n];
            if(!this.IsCanConnect(Child) || Child.Hot)
                continue;

            var Level=this.AddrLevelNode(Child);




            var stat=Levels[Level];

            if(!stat)
                stat={Prioritet:0};
            if(!Child.CountConnect)
                Child.CountConnect=0;
            if(!Child.Stage)
                Child.Stage=0;

            if(Child.CountConnect>=MAX_CONNECT_CHILD)
                continue;

            var Prioritet=1000*Child.Stage+Child.CountConnect;

            if(!stat.Node || Prioritet < stat.Prioritet)
            {
                stat.Node=Child;
                stat.Prioritet=Prioritet;
            }

            Levels[Level]=stat;
        }


        return Levels;
    }



    AddLevelConnect(Node)
    {
        if(this.LoadHistoryMode || !global.CAN_START)
            return;


        //отсоедняем все дочерние узлы, имеющие более одного соединения
        var Level=this.AddrLevelNode(Node);

        this.CheckDisconnectChilds(Level);


        if(Node.Hot)
            return;

        Node.Hot=true;

        var arr=this.LevelNodes[Level];
        if(!arr)
        {
            arr=[];
            this.LevelNodes[Level]=arr;
        }
        arr.push(Node);

        this.LevelNodesCount=this.GetNodesLevelCount();


        this.SendGetMessage(Node);

        ADD_TO_STAT("AddLevelConnect");
        //ToLog("AddLevelConnect: "+Level+"  "+Node.addrStr.substr(0,4)+"  "+Node.ip+":"+Node.port);
    }

    //КРИТЕРИИ НОРМАЛЬНОСТИ СВЯЗЕЙ:
    CheckDisconnectChilds(Level)
    {
        //отсоединяем все дочерние узлы, имеющие более MIN_CONNECT_CHILD соединения
        var bWas=0;
        var arr=this.LevelNodes[Level];
        if(arr)
        {
            var ChildCount=arr.length;
            for(var n=0;n<arr.length;n++)
            {
                var Node=arr[n];
                if(ChildCount>MIN_CONNECT_CHILD && Node.LevelNodes)
                {
                    var arr2=Node.LevelNodes[Level];
                    if(arr2 && arr2.length>MIN_CONNECT_CHILD)
                    {
                        ChildCount--;
                        Node.Hot=false;
                        this.DeleteNodeFromHot(Node);
                        this.StartDisconnectHot(Node,"CheckDisconnectChilds");
                        bWas=1;
                        continue;
                    }
                }
            }
        }
        return bWas;
    }

    FindPair(L)
    {
        for(let n=0;n<this.NodesArr.length;n++)
        {
            let Node=this.NodesArr[n];
            if(Node.addrStr===this.addrStr)
                continue;

            var Level=this.AddrLevelNode(Node);

            if(Level!==L)
                continue;

            if(!Node.LevelNodes)
                continue;

            var arr=Node.LevelNodes[Level];
            if(arr && arr.length>=MAX_CONNECT_CHILD)
                continue;

            var arr_len;
            if(!arr)
                arr_len=0;
            else
                arr_len=arr.length;

            if(arr_len===0)
            {
                this.StartAddLevelConnect(Node);
                return true;
            }



            for(var i=0;i<arr_len;i++)
            {
                var Node2=arr[i];
                if(Node2.addrStr===this.addrStr)
                    continue;
                if(!Node2.LevelNodes)
                    continue;

                var arr2=Node2.LevelNodes[Level];
                if(arr2 && arr2.length>1)
                {
                    this.StartAddLevelConnect(Node);
                    return true;
                }
            }
        }
        return false;
    }

    GetHotTimeNodes()
    {
        if(this.LoadHistoryMode || !global.CAN_START)
            return this.GetActualNodes();

        var ArrNodes=[];
        for(var L=0;L<this.LevelNodes.length;L++)
        {
            var arr=this.LevelNodes[L];
            for(let j=0;arr && j<arr.length;j++)
            {
                ArrNodes.push(arr[j])
            }
        }

        return ArrNodes;
    }

    //TIME TIME TIME
    CorrectTime()
    {
        var ArrNodes=this.GetHotTimeNodes();
        var CountNodes=ArrNodes.length;
        var DeltaArr=[];
        var NodesSet = new Set();
        for(var i=0;i<ArrNodes.length;i++)
        {
            var Node=ArrNodes[i];
            if(!Node.Times)
                continue;
            if(Node.Times.Count<2)
                continue;
            NodesSet.add(Node);
        }

        for(var Node of NodesSet)
        {
            DeltaArr.push(Node.Times.AvgDelta);
        }


        if(DeltaArr.length<1)
            return;
        if(DeltaArr.length<CountNodes/2)
            return;
        if(this.PerioadAfterCanStart>=PERIOD_FOR_CTAR_CHECK_TIME)
        {
            if(DeltaArr.length<3*CountNodes/4)
                return;
        }


        DeltaArr.sort(function (a,b) {return a-b});


        //Calc mediana avg
        var start,finish;
        if(Math.floor(DeltaArr.length/2)===DeltaArr.length/2)
        {
            start=DeltaArr.length/2-1;
            finish=start+1;
        }
        else
        {
            start=Math.floor(DeltaArr.length/2);
            finish=start;
        }
        // start=0;
        // finish=DeltaArr.length-1;

        var Sum=0;
        var Count=0;
        for(var i=start;i<=finish;i++)
        {
            Sum=Sum+DeltaArr[i];
            Count++;
        }

        var AvgDelta=Math.floor(Sum/Count+0.5);


        if(this.PerioadAfterCanStart<PERIOD_FOR_CTAR_CHECK_TIME)
        {
            var KT=(PERIOD_FOR_CTAR_CHECK_TIME-this.PerioadAfterCanStart)/PERIOD_FOR_CTAR_CHECK_TIME;
            //ToLog("AvgDelta="+AvgDelta+ " KT="+KT);
            AvgDelta=AvgDelta*KT;
        }
        else
        {
            MAX_TIME_CORRECT=50;
        }

        if(AvgDelta < (-MAX_TIME_CORRECT))
            AvgDelta=-MAX_TIME_CORRECT;
        else
        if(AvgDelta > MAX_TIME_CORRECT)
            AvgDelta=MAX_TIME_CORRECT;


        // if(Math.abs(AvgDelta)<5)//CONSENSUS_CHECK_TIME
        //     return;


        if(Math.abs(AvgDelta)<25)//CONSENSUS_CHECK_TIME
        {
            return;
        }
        //ToLog("Correct time: Delta="+AvgDelta+"  DELTA_CURRENT_TIME="+DELTA_CURRENT_TIME);
        if(AvgDelta>0)
            ADD_TO_STAT("CORRECT_TIME_UP")
        else
            ADD_TO_STAT("CORRECT_TIME_DOWN")

        global.DELTA_CURRENT_TIME += AvgDelta;


        //reset times
        this.ClearTimeStat();

        SAVE_CONST();
    }
    ClearTimeStat()
    {
        var ArrNodes=this.GetHotTimeNodes();
        for(var Node of ArrNodes)
        {
            Node.Times=undefined;
        }
    }


    //ACTIVE LIST

    SetNodePrioritet(Node,Prioritet)
    {
        if(Node.Prioritet===Prioritet)
            return;

        if(Node.addrArr)
        {
            var Item=this.ActualNodes.find(Node);
            if(Item)
            {
                this.ActualNodes.remove(Node);
                Node.Prioritet=Prioritet;
                this.ActualNodes.insert(Node);
            }
        }
        Node.Prioritet=Prioritet;
    }

    CheckNodeMap(Node)
    {
        if(Node.addrStrTemp && Node.addrStrTemp!==Node.addrStr)
        {
            delete this.NodesMap[Node.addrStrTemp];
            this.NodesMap[Node.addrStr]=Node;
            Node.addrStrTemp=undefined;
        }
    }

    AddNodeToActive(Node)
    {
        // if(!Node.addrArr)
        //     throw "AddNodeToActive !Node.addrArr"

        if(Node.addrArr)
        {
            if(CompareArr(Node.addrArr,this.addrArr)===0)
            {
                return;
            }

            this.CheckNodeMap(Node);


            this.ActualNodes.insert(Node);
        }

        Node.ResetNode();
        Node.Active=true;
        Node.Stage=0;
        Node.NextConnectDelta=1000;


        ADD_TO_STAT("AddToActive");
        //ToLog("AddNodeToActive: "+Node.addrStr)

    }


    DeleteNodeFromActive(Node)
    {
        if(!Node.Stage)
            Node.Stage=0;
        Node.Stage++;
        Node.Active=false;
        Node.Hot=false;

        // if(!Node.addrArr)
        //     throw "DeleteNodeFromActive !Node.addrArr"

        this.ActualNodes.remove(Node);

        //ToLogTrace("DeleteNodeFromActive");

        //Node.CloseNode();
        CloseSocket(Node.Socket,"DeleteNodeFromActive");
        CloseSocket(Node.Socket2,"DeleteNodeFromActive");
        Node.ResetNode();
    }



    StartReconnect()
    {
        //переподсоединяемся к серверам раз в час
        //TODO
        return;


        var arr=this.GetActualNodes();
        for(var i=0;i<arr.length;i++)
        {
            var Node=arr[i];
            if(Node.Socket && Node.Socket.ConnectToServer)
            {
                if(!Node.SocketStart)
                    Node.SocketStart=(new Date)-0;
                var DeltaTime=(new Date)-Node.SocketStart;
                if(DeltaTime>=PERIOD_FOR_RECONNECT)
                {
                    if(random(100)>=90)
                        Node.CreateReconnection();
                }
            }
        }
    }


    IsLocalIP(addr)
    {
        //192.168.0.0 - 192.168.255.255
        //10.0.0.0 - 10.255.255.255
        //100.64.0.0 - 100.127.255.255
        //172.16.0.0 - 172.31.255.255
        if(addr.substr(0,7)==="192.168" || addr.substr(0,3)==="10.")
            return 1;
        else
            return 0;
    }

    GetActualsServerIP(bFlag)
    {
        var arr=this.GetActualNodes();
        var Str="";
        arr.sort(function (a,b)
        {
            if(a.ip>b.ip)
                return -1;
            else
            if(a.ip<b.ip)
                return 1;
            else
            return 0;
        });

        if(bFlag)
            return arr;

        for(var i=0;i<arr.length;i++)
        {
            Str+=arr[i].ip+", ";
        }
        return Str.substr(0,Str.length-2);
    }
}


/*
TODO:
Сортировать NodesArr каждые 5 сек после получения пинга
*/

