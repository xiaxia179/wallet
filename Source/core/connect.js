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

global.CHECK_POINT={BlockNum:0,Hash:[],Sign:[]};
global.CODE_VERSION={VersionNum:START_CODE_VERSION_NUM,Hash:[],Sign:[],StartLoadVersionNum:0};


var MAX_PING_FOR_CONNECT=150;//ms
var TIME_AUTOSORT_GRAY_LIST=5000;//ms
var MAX_TIME_CORRECT=10000*1000;//ms TODO сделать настраиваемым, т.е. чем больше времени запущена программа, тем меньше изменение времени. Если более часа и уже была выполнена синхронизация, то макс изменение 250 мс

global.MAX_WAIT_PERIOD_FOR_HOT=2*CONSENSUS_PERIOD_TIME;
global.MAX_WAIT_PERIOD_FOR_ACTIVE=10*CONSENSUS_PERIOD_TIME;

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






        if(!global.ADDRLIST_MODE)
        if(!this.VirtualMode)
        {

            setInterval(this.StartPingPong.bind(this),1000);
            setInterval(this.StartCheckConnect.bind(this),1000);
            setInterval(this.StartGetLevelsHotConnects.bind(this),5000);

            setInterval(this.DeleteNodeFromActiveByTimer.bind(this),5000);

            setInterval(this.StartReconnect.bind(this),60*1000);
            //setInterval(this.StartReconnect.bind(this),1*1000);

         }

    }

    StartConnect(ip,port)
    {
        if(!ip)
            return undefined;

        var Node=this.FindRunNodeContext(undefined,ip,port)
        if(!Node.ConnectStart)
            Node.ConnectStart=0;
        var Delta=(new Date)-Node.ConnectStart;

        if(Node.ReconnectFromServer===1)
        {
            Node.ReconnectFromServer=2;
            Node.CreateConnect();
        }
        else
        if(Delta>=Node.NextConnectDelta)
        {
            // ToLog("Node.Socket="+Node.Socket)
            //if(Node.Socket && (SocketStatus(Node.Socket)===1 || SocketStatus(Node.Socket)===2))
            if(Node.DoubleConnection || Node.Socket && SocketStatus(Node.Socket))
            {

            }
            else
            {
                Node.ConnectStart=(new Date)-0;
                Node.NextConnectDelta=Node.NextConnectDelta*1.5;
                Node.CreateConnect();
            }
        }
        return Node;
    }


    FindRunNodeContext(addrArr,ip,port)
    {
        var Node,addrStr;

        if(addrArr!==undefined)
        {
            addrStr=GetHexFromAddres(addrArr);
            Node=this.NodesMap[addrStr];
        }
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

        return Node;
    }

    StartHandshake(Node)
    {
        return this.StartConnect(Node.ip,Node.port)
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

        var arr=SERVER.GetActualNodes();
        //for(var Key in this.NodesMap)
        for(var i=0;i<arr.length;i++)
        {
            //var Node=this.NodesMap[Key];
            var Node=arr[i];
            if(Node.Active && this.addrStr!==Node.addrStr)
            {

                var Context={"StartTime":GetCurrentTime(0)};
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
        var Ret=
            {
                VERSIONMAX:DEF_VERSION,
                FIRST_TIME_BLOCK:global.FIRST_TIME_BLOCK,//+DELTA_CURRENT_TIME
                Time:(GetCurrentTime()-0),
                BlockNumDB:this.BlockNumDB,
                LoadHistoryMode:this.LoadHistoryMode,
                CanStart:global.CAN_START,
                CheckPoint:CHECK_POINT,
                CodeVersion:CODE_VERSION,
            };
        return Ret;
    }

    static PING_F()
    {
        return "{\
                VERSIONMAX:str15,\
                FIRST_TIME_BLOCK:uint,\
                Time:uint,\
                BlockNumDB:uint,\
                LoadHistoryMode:byte,\
                CanStart:byte,\
                CheckPoint:{BlockNum:uint,Hash:hash,Sign:arr64},\
                CodeVersion:{VersionNum:uint,Hash:hash,Sign:arr64},\
                }"
    }

    static PONG_F()
    {
        return CConnect.PING_F();
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
        if(!Info.Context || !Info.Context.StartTime)
            return;

        var DeltaTime=GetCurrentTime(0)-Info.Context.StartTime;
        Node.DeltaTime=DeltaTime;
        Node.INFO=Data;
        if(Data.LoadHistoryMode)
            Node.Hot=false;
        if(!Data.CanStart)
            Node.Hot=false;

        Node.LastTime=GetCurrentTime();




        //Check point
        if(!CREATE_ON_START)
        if(Data.CheckPoint.BlockNum && Data.CheckPoint.BlockNum>CHECK_POINT.BlockNum)
        {
            var SignArr=arr2(Data.CheckPoint.Hash,GetArrFromValue(Data.CheckPoint.BlockNum));
            if(CheckDevelopSign(SignArr,Data.CheckPoint.Sign))
            {
                ToLog("Get new CheckPoint");

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
                ToLog("Error Sign CheckPoint");
                this.AddCheckErrCount(Node,1,"Error Sign CheckPoint");
            }
        }



        if(!CODE_VERSION.StartLoadVersionNum)
            CODE_VERSION.StartLoadVersionNum=0;
        if(Data.CodeVersion.VersionNum && Data.CodeVersion.VersionNum>CODE_VERSION.VersionNum
            && Data.CodeVersion.VersionNum>CODE_VERSION.StartLoadVersionNum)
        {
            var SignArr=arr2(Data.CodeVersion.Hash,GetArrFromValue(Data.CodeVersion.VersionNum));
            if(CheckDevelopSign(SignArr,Data.CodeVersion.Sign))
            {
                ToLog("Get new CodeVersion");
                this.StartLoadCode(Node,Data.CodeVersion);
            }
            else
            {
                ToLog("Error Sign CodeVersion");
                this.AddCheckErrCount(Node,1,"Error Sign CodeVersion");
            }
        }

        if(Data.CodeVersion.VersionNum===CODE_VERSION.VersionNum)
        {
            Node.CanHot=true;
        }
        else
        if(Data.CodeVersion.VersionNum<CODE_VERSION.VersionNum)
        {
            Node.CanHot=false;
            ToLog("ERR VersionNum="+Data.CodeVersion.VersionNum+" from "+NodeInfo(Node));
        }



        if(DeltaTime<MAX_PING_FOR_CONNECT)
        {

            //расчет времени удаленной ноды
            var Times=Node.Times;
            if(!Times)
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
            if(!global.CAN_START)
                ToLog("DeltaTime="+DeltaTime+">"+MAX_PING_FOR_CONNECT+" ms  -  "+NodeInfo(Node))
        }

        if(!global.CAN_START)
        if(Times && Times.Count>=1 && Times.AvgDelta<=200)
        {
            ToLog("*************************************************************************** CAN_START")
            global.CAN_START=true;
            if(Node.INFO.BlockNumDB>this.BlockNumDB+COUNT_HISTORY_BLOCKS_FOR_LOAD/2)
            {
                if(!this.WasStartLoadHistory)
                    this.StartLoadHistory(Node);
                this.WasStartLoadHistory=1;
            }
        }
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
        Node.Stage++;

        Node.Hot=false;
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

        this.Send(Node,
            {
                "Method":"GETNODES",
                "Data":undefined
            }
        );
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
                            UserConnect:uint16,\
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
            || !Node.DirectIP
            || Node.TryConnectCount>=2
            || Node.Self
            || Node.DoubleConnection)
            return false;

        if(Node.ip===this.ip &&Node.port===this.port)
            return false;

        return true;
    }

    GetDirectNodesArray(bAll)
    {
        var ret=[];
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

            var Value=
            {
                addrStr:Item.addrStr,
                ip:Item.ip,
                port:Item.port,
                UserConnect:Item.UserConnect,
                LastTime:Item.LastTime,
                DeltaTime:Item.DeltaTime
            };

            ret.push(Value);
        }


        var UserConnect=0;
        if(global.NET_WORK_MODE && NET_WORK_MODE.UseIncomeGrayIP)
            UserConnect=1;

        var Value=
            {
                addrStr:this.addrStr,
                ip:this.ip,
                port:this.port,
                UserConnect:UserConnect,
                LastTime:0,
                DeltaTime:0
            };
        ret.push(Value);

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
            Node.DirectIP=true;
            Node.UserConnect=Item.UserConnect;//???? can update??
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

    ADDLEVELCONNECT(Info,CurTime)
    {
        var ret;
        var Count;

        if(this.LoadHistoryMode || !global.CAN_START)
            return;

        var Level=AddrLevelArr(this.addrArr,Info.Node.addrArr);

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
                            UserConnect:uint16,\
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

        var arr=SERVER.GetActualNodes();
        for(var i=0;i<arr.length;i++)
        {
            var Node=arr[i];
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

            var Level=AddrLevelArr(this.addrArr,Child.addrArr);




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
        var Level=AddrLevelArr(this.addrArr,Node.addrArr);

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
        //отсоедняем все дочерние узлы, имеющие более MIN_CONNECT_CHILD соединения
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

            var Level=AddrLevelArr(this.addrArr,Node.addrArr);

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
                return;
            if(Node.Times.Count<2)
                return;
            NodesSet.add(Node);
        }

        for(var Node of NodesSet)
        {
            DeltaArr.push(Node.Times.AvgDelta);
        }


        if(DeltaArr.length<1)
            return;
        if(DeltaArr.length<CountNodes)
            return;

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


        if(WORK_MODE)
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


        if(Math.abs(AvgDelta)>=25)//CONSENSUS_CHECK_TIME
            ToLog("Correct time: Delta="+AvgDelta+"  DELTA_CURRENT_TIME="+DELTA_CURRENT_TIME);
        else
            return;

        global.DELTA_CURRENT_TIME += AvgDelta;


        //reset times
        for(var Node of NodesSet)
        {
            Node.Times=undefined;
        }

        SAVE_CONST();
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
        Node.NextConnectDelta=1;


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
        //return;


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
}


/*
TODO:
Сортировать NodesArr каждые 5 сек после получения пинга

TODO: DeleteNodeFromActive - в т.ч. по таймауту
*/

//SERVER.CorrectTimeOLD=SERVER.CorrectTime;
//SERVER.CorrectTime=function ()
