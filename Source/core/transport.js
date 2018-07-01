"use strict";
//Copyright: Yuriy Ivanov, 2017 e-mail: progr76@gmail.com
//Use:
//usege: require("./transport");

//TestTest(); process.exit(0);

const net=require("net");
const dgram = require( "dgram");
const stun = require('stun')
const crypto = require('crypto');
const RBTree = require('bintrees').RBTree;

require("./library.js");
require("./crypto-library");

//const CManager=require("./manager");



global.BUF_TYPE=1;
global.STR_TYPE=2;
global.MAX_STR_BUF_DATA=200;

//OLD:
global.MAX_CONNECTION_WHITE=40;
var MAX_CONNECTION_ANOTHER=40;



const TRAFIC_LIMIT_NODE_1S=250*1000;
const TRAFIC_LIMIT_1S=4*TRAFIC_LIMIT_NODE_1S; //+1 for block channel


global.STAT_PERIOD=CONSENSUS_PERIOD_TIME/5;
const TRAFIC_LIMIT_SEND=TRAFIC_LIMIT_1S*STAT_PERIOD/1000;
const TRAFIC_LIMIT_NODE=TRAFIC_LIMIT_NODE_1S*STAT_PERIOD/1000;
const BUF_PACKET_SIZE=16*1024;


global.USE_TCP=1;
global.MAX_PACKET_LENGTH=1.5*1000000;//1Mb
global.FORMAT_POW_TO_CLIENT="{addrArr:hash,HashRND:hash,MIN_POWER_POW:uint}";
global.FORMAT_POW_TO_SERVER=
"{\
    DEF_NETWORK:str15,\
    DEF_VERSION:str9,\
    DEF_CLIENT:str16, \
    addrArr:addres, \
    ToIP:str26,\
    ToPort:uint16, \
    FromIP:str26,\
    FromPort:uint16, \
    nonce:uint,\
    Reconnect:byte,\
    SendBytes:uint\
}";

const WorkStructPacketSend={};
const FORMAT_PACKET_SEND_TCP=
    "{\
    PacketSize:uint,\
    NumXORRND:uint,\
    Method:str25,\
    NodeTime:time,\
    Length:uint,\
    ContextID:hash,\
    TypeData:byte,\
    Hash:hash,\
    Data:data,\
    }";





//UDP constants:
const TRAFIC_LIGHT_LIMIT_SEND=150*STAT_PERIOD/1000;//Kb
const TRAFIC_HARD_LIMIT_SEND=100*STAT_PERIOD/1000;//Kb

const DELTA_TIME_SEND2=20;//ms
const TEST_RANDOM_SEND_PERCENT=100;


const PACKET_LIVE_PERIOD=1000;
const PACKET_LIGHT_LIVE_PERIOD=1000;
const PACKET_HARD_LIVE_PERIOD=300*1000;


const H_PACKET_LIMIT_USE=100;

//константы QOS


global.MAX_FRAGMENT_INFO_ARRAY=4*1400;
const UDP_BUF_SIZE=64000;//BUF_PACKET_SIZE*1;
//const MIN_PACKET_DELTA_TIME_FOR_LOAD=100;//ms - мин время сборки фрагмента (ограничено MAX_TIME_NETWORK_TRANSPORT в модуле node.js)
const MAX_FRAGMENT_COUNT=2000;
if(!USE_TCP)
    global.MAX_PACKET_LENGTH=MAX_FRAGMENT_COUNT*BUF_PACKET_SIZE;


const QOSNUMFRAGMENTPOS=(6+6+1);
const PACKETSIZEPOS=(6);
const MAX_SIZE1=BUF_PACKET_SIZE-300;//252
const FORMAT_PACKET_SEND=
    "{\
    NumXORRND:uint,\
    PacketSize:uint,\
    PacketType: byte,\
    QOSNumFragment:uint,\
    NumFragment: uint16,\
    CountFragment: uint16,\
    PacketNum: uint32,\
    PacketID: hash,\
    SessionID: hash,\
    SessionArr: [{DEF_NETWORK:str15,DEF_VERSION:str9,DEF_CLIENT:str16, addrArr:addres, ToIP:str26,ToPort:uint16, FromIP:str26,FromPort:uint16, nonce:uint}],\
    Data:data,\
    Method:str25,\
    NodeTime:time,\
    TypeData:byte,\
    Length:uint,\
    }";

const MAX_SIZE2=BUF_PACKET_SIZE-(6+6+1+6+2+2+4+32+32+4);
const FORMAT_PACKET_SEND2=
    "{\
    NumXORRND:uint,\
    PacketSize:uint,\
    PacketType: byte,\
    QOSNumFragment:uint,\
    NumFragment: uint16,\
    CountFragment: uint16,\
    PacketNum: uint32,\
    PacketID: hash,\
    SessionID: hash,\
    Data:data,\
    }";
const WorkStructPacketSend2={};

const START_CHECK_PACKET_DELTA_TIME=5;
const CHECK_PACKET_DELTA_TIME=5;
const MAX_CHECK_PACKET_ARRAY=5;
const MAX_CHECK_PACKET_ARRAY2=Math.floor(MAX_SIZE2/2)-20;

const FORMAT_PACKET_SEND3=
    "{\
    NumXORRND:uint,\
    PacketSize:uint,\
    PacketType: byte,\
    QOSNumFragment:uint,\
    NumFragment: uint16,\
    CountFragment: uint16,\
    PacketNum: uint32,\
    PacketID: hash,\
    SessionID: hash,\
    Array:[uint16],\
    }";
const WorkStructPacketSend3={};




//network-library
module.exports = class CTransport extends require("./connect")
{
    constructor(SetKeyPair,RunIP,RunPort,UseRNDHeader,bVirtual)
    {
        super(SetKeyPair,RunIP,RunPort,UseRNDHeader,bVirtual)

        //RunPort = RunPort || START_PORT_NUMBER;

        this.UseRNDHeader=UseRNDHeader;

        this.AnotherHostsFlood={Count:0, MaxCount:MAX_CONNECTION_ANOTHER, Time:GetCurrentTime()};
        this.BAN_IP={};    //ip+ports

        this.ip=RunIP;
        this.port=RunPort;
        this.ip_local=RunIP;
        this.port_local=RunPort;
        this.CanSend=0;
        this.NodeCount=0;


        this.SendFormatMap={};

        //setInterval(this.RecalcSendStatictic.bind(this),STAT_PERIOD);
        this.ActualNodes=new RBTree(function (a,b)
        {
            if(a.Prioritet!==b.Prioritet)
                return a.Prioritet-b.Prioritet;
            return CompareArr(a.addrArr,b.addrArr)
        });
        this.SendTrafficFree=0;


        if(USE_TCP)
        {
            setInterval(this.DoLoadBuf.bind(this),1);
            this.LoadBuf=new RBTree(function (a,b)
            {
                return a.Prioritet-b.Prioritet;
            });


            setInterval(this.DoLoadHardPacket.bind(this),2);
            this.LoadHardPacket=new RBTree(function (a,b)
            {
                return b.PacketNum-a.PacketNum;
            });


            setInterval(this.DoSendPacket.bind(this),2);
            setInterval(this.DoSendBuf.bind(this),1);
        }
        else//UDP
        {
            this.SendPacketMode=0;
            setInterval(this.DoSendPacketUDP.bind(this),1);

            this.LightSendBuf=new RBTree(function (a,b)
            {
                //быстрая приоритетная очередь, выборка через min()
                if(a.NodePrioritet!==b.NodePrioritet)
                    return a.NodePrioritet-b.NodePrioritet;
                else
                if(a.PacketNum!==b.PacketNum)
                    return a.PacketNum-b.PacketNum;
                else
                    return a.NumFragment-b.NumFragment;
            });
            this.HardSendBuf=new RBTree(function (a,b)
            {
                //последовательная приоритетная очередь, выборка через min()
                if(a.NodePrioritet!==b.NodePrioritet)
                    return a.NodePrioritet-b.NodePrioritet;
                if(a.PacketNum!==b.PacketNum)
                    return a.PacketNum-b.PacketNum;
                else
                    return a.NumFragment-b.NumFragment;
            });




            this.UsePacketIdle=0;
            setInterval(this.DoUsePacket.bind(this),10);
            this.QuoteUsePacket=new RBTree(function (a,b)
            {
                //приоритетная очередь, выборка через min()

                if(a.NodePrioritet!==b.NodePrioritet)
                    return a.NodePrioritet-b.NodePrioritet;
                else
                if(a.PacketPrioritet!==b.PacketPrioritet)
                    return a.PacketPrioritet-b.PacketPrioritet;
                else
                if(a.LoadTimeNum!==b.LoadTimeNum)
                    return a.LoadTimeNum-b.LoadTimeNum;
                else
                    return CompareArr(a.PacketID,b.PacketID);
            });

            this.SessionTree=new RBTree(CompareItemHASH32);

            //QOS
            setInterval(this.CheckLoadFragments.bind(this),100);
            //setInterval(this.CheckSendFragments.bind(this),100);
            setInterval(this.CaclLostFragments.bind(this),1000);

            this.SendPacketNum=0;

        }


        MethodPrioritet:
        {
            this.MethodPrioritet={};
            this.MethodPrioritet["PACKETINFO"]=1;

            this.MethodPrioritet["STARTBLOCK"]=10;
            this.MethodPrioritet["TRANSFER"]=10;
            this.MethodPrioritet["OKTRANSFER"]=15;
            this.MethodPrioritet["GETTRANSFER"]=20;
            this.MethodPrioritet["OKCONTROLHASH"]=25;

            this.MethodPrioritet["HAND"]=100;
            this.MethodPrioritet["SHAKE"]=100;
            this.MethodPrioritet["RETADDLEVELCONNECT"]=100;
            this.MethodPrioritet["RETGETNODES"]=100;
            this.MethodPrioritet["PING"]=100;
            this.MethodPrioritet["PONG"]=100;
            this.MethodPrioritet["GETNODES"]=100;
            this.MethodPrioritet["GETHOTLEVELS"]=100;
            this.MethodPrioritet["RETGETHOTLEVELS"]=100;

            this.MethodPrioritet["GETMESSAGE"]=400;
            this.MethodPrioritet["MESSAGE"]=450;


            this.MethodPrioritet["CANBLOCK"]=500;
            this.MethodPrioritet["GETBLOCKHEADER"]=500;
            this.MethodPrioritet["GETBLOCK"]=500;
            this.MethodPrioritet["GETCODE"]=500;



            //this.MethodPrioritet["BLOCKHEADER"]=800;
            this.MethodPrioritet["RETBLOCKHEADER"]=900;
            this.MethodPrioritet["RETGETBLOCK"]=950;
            this.MethodPrioritet["RETCODE"]=970;

        }



        //
        //glStopNode=1;
        // global.TEST_SIZE_SEND=100;//Kb
        // this.MethodPrioritet["TEST"]=200;
        // setInterval(this.SendTestPacket.bind(this),100);

        if(!this.VirtualMode)
            this.StartServer();

        this.CurrentTimeStart=0;
        this.CurrentTimeValues={};
    }

    GetF(Method)
    {
        var format=this.SendFormatMap[Method];
        if(!format)
        {
            var F=this.constructor[Method+"_F"];
            if(typeof F==="function")
            {
                format=
                    {
                        struct: F(),
                        length: 8096,
                        wrk:{}
                    };
            }
            else
            {
                format="{}";
            }
            this.SendFormatMap[Method]=format;
        }
        return format;
    }
    SendF(Node,Info,Length)
    {
        var format=this.GetF(Info.Method);
        if(!Length)
            Length=format.length;
        Info.Data=BufLib.GetBufferFromObject(Info.Data,format.struct,Length,format.wrk)

        this.Send(Node,Info,1);
    }
    DataFromF(Info)
    {
        var format=this.GetF(Info.Method);
        try
        {
            var Data=BufLib.GetObjectFromBuffer(Info.Data,format.struct,format.wrk);
            return Data;
        }
        catch (e)
        {
            ToLog(e);
            return {};
        }
    }


    ADD_CURRENT_STAT_TIME(Key,Value)
    {
        var TimeNum=Math.floor(((new Date)-0)/STAT_PERIOD);
        if(this.CurrentTimeStart!==TimeNum)
            this.CurrentTimeValues={};
        this.CurrentTimeStart=TimeNum;
        if(!this.CurrentTimeValues[Key])
            this.CurrentTimeValues[Key]=0;
        this.CurrentTimeValues[Key]+=Value;
    }
    GET_CURRENT_STAT_TIME(Key)
    {
        var TimeNum=Math.floor(((new Date)-0)/STAT_PERIOD);
        if(this.CurrentTimeStart===TimeNum)
        {
            var Value=this.CurrentTimeValues[Key];
            if(Value===undefined)
                return 0;
            else
                return Value;
        }
        else
        {
            return 0;
        }
    }


    RecalcSendStatictic()
    {
        var TimeNum=Math.floor(((new Date)-0)/STAT_PERIOD);
        if(this.SendStatNum===TimeNum)
            return;
        this.SendStatNum=TimeNum;

        var Period=CONSENSUS_PERIOD_TIME/STAT_PERIOD;
        var HardSendCount=0;
        this.SendTrafficFree=TRAFIC_LIMIT_SEND;
        var it=this.ActualNodes.iterator(), Node;
        while((Node = it.next()) !== null)
        {
            // if(!Node.arrSave)
            //     Node.arrSave=[];
            // Node.arrSave.push(Node.BufWriteLength);


            //Hard
            var WantHardTraffic=Node.WantHardTraffic;
            Node.WantHardTraffic=0;
            Node.CanHardTraffic=0
            if(!HardSendCount)
            {
                var arr=Node.WantHardTrafficArr;
                arr.push(WantHardTraffic);
                if(arr.length>3*Period)
                {
                    arr.shift();
                    var SumArr=0;
                    for(var i=0;i<arr.length;i++)
                        SumArr+=arr[i];
                    if(SumArr)
                    {
                        Node.CanHardTraffic=1;
                        HardSendCount=1;
                    }
                }
            }


            if(Node.CanHardTraffic)
            {
                //from extra channel
                Node.SendTrafficLimit=TRAFIC_LIMIT_NODE;
            }
            else
            {
                var arr=Node.TrafficArr;
                arr.push(Node.BufWriteLength);
                Node.BufWriteLength=0;

                if(arr.length>5*Period)
                {
                    arr.shift();
                }
                else
                {
                    if(arr.length<3*Period)
                        continue;
                }

                var arrAvg=[],arrK=[];
                var valNext=CalcStatArr(arr,arrAvg,arrK,Period);
                valNext=Math.min(valNext,TRAFIC_LIMIT_NODE);
                Node.SendTrafficLimit=Math.min(this.SendTrafficFree,valNext*1.1);
                this.SendTrafficFree-=Node.SendTrafficLimit;
            }


            Node.SendTrafficCurrent=0;
            ADD_TO_STAT("MAX:NODE_TRAFFIC_LIMIT:"+NodeInfo(Node),1000/STAT_PERIOD*Node.SendTrafficLimit/1024);

        }

        if(!HardSendCount)
            this.SendTrafficFree+=TRAFIC_LIMIT_NODE;




        ADD_TO_STAT("SEND_TRAFFIC_FREE",this.SendTrafficFree/1024);
    }



    OnGetMethod(Info,CurTime)
    {



        if(DEBUG_MODE)
        {
            var Str="";
            if(Info.Data && Info.Data.Length)
                Str=" LENGTH="+Info.Data.Length;
            TO_DEBUG_LOG("GET:"+Info.Method+Str+" from: Node="+Info.Node.ip+":"+Info.Node.port);
        }

        // if(Info.Version>DEF_VERSION)
        // {
        //     TO_ERROR_LOG("TRANSPORT",10,"Different versions of protocol","rinfo",rinfo);
        //     Net.AddIpToErrorStat(rinfo);
        //     return;
        // }

        if(global.ADDRLIST_MODE)
        {
            var StrOK=",HAND,GETNODES,";
            if(StrOK.indexOf(","+Info.Method+",")===-1)
                return;
        }


        Info.Node.LastTime=CurTime;


        var F=this[Info.Method.toUpperCase()];
        if(typeof F==="function")
        {
            F.bind(this)(Info,CurTime);
        }
        else
        {
            TO_ERROR_LOG("TRANSPORT",20,"Method '"+Info.Method+"' not found Socket=*"+Info.Socket.ConnectID,"node",Info.Node);
            this.AddCheckErrCount(Info.Node,1,"Method not found");
        }
    }





    //------------------------------------------------------------------------------------------------------------------

    SendUDP(Node,Info,typeData)
    {
        var startTime = process.hrtime();
        ADD_TO_STAT("SEND:"+Info.Method);


        /**  =ФОРМАТ ПАКЕТА=
         *6  - RND инициализация для XOR операции с данными пакета
         *4  - Номер фрагмента, 0 - новый пакет
         *32 - ИД пакета, в т.ч. для ответного пакета это RetMeta
         *   если новый пакет (0):
         *          32 - ИД сессии (информация о заголовке пакета - после HANDSHAKE)
         *          1  - Тип сессии, 1-существующая, 0-новая
         *              Если новая сессия (0):
         *                  300 - Данные заголовка и HANDSHAKE
         *              Если существующая сессия (1):
         *                  300 - Данные шапки пакета (Метод, время, размер данных, число фрагментов...), данные пакета
         *   если продолжение пакета (>0)
         *  4           -   Длина данных
         *  переменная  -   Данные фрагмента
         *
         **/

        // if(this.VirtualMode)
        // {
        //     process.send({id:this.id,Node:Node,buf:buf,Meta:Meta});
        //     return;
        // }
        //
        // if(this.WasBan({address:Node.ip, port:Node.port}))
        //     return;

        var PacketPrioritet=this.MethodPrioritet[Info.Method];
        if(PacketPrioritet===undefined)
            PacketPrioritet=500;



        var BUF={};
        BUF.NumXORRND=0;
        BUF.PacketType=1;
        BUF.QOSNumFragment=0;
        BUF.NumFragment=0;

        if(!Info.Context)
            Info.Context={};
        var Meta=Info.Context;
        Meta.Method=Info.Method;

        if(!Meta.PacketID)
            Meta.PacketID=crypto.randomBytes(32);
        Meta.SendTime=startTime;

        Meta.Node=Node;
        Meta.arrSend=[];
        this.PacketTree.SaveValue(Meta.PacketID,Meta);

        this.SendPacketNum++;
        BUF.PacketNum=this.SendPacketNum;
        BUF.PacketID=Meta.PacketID;




        if(!Node.SessionID || Node.bResetSessionID)
        {
            if(!Node.SessionID)
                Node.SessionID=crypto.randomBytes(32);
            Node.bResetSessionID=0;

            //параметры сессии
            var Session={};
            Session.DEF_NETWORK=DEF_NETWORK;
            Session.DEF_VERSION=DEF_VERSION;
            Session.DEF_CLIENT=DEF_CLIENT;
            Session.addrArr=this.addrArr;
            Session.ToIP=Node.ip;
            Session.ToPort=Node.port;
            Session.FromIP=this.ip;
            Session.FromPort=this.port;
            Session.nonce=CreateNoncePOWExtern(Node.SessionID,0,3*(1<<MIN_POWER_POW_HANDSHAKE));


            BUF.SessionID=Node.SessionID;
            BUF.SessionArr=[Session];//новая сессия
        }
        else
        {
            BUF.SessionID=Node.SessionID;
            BUF.SessionArr=[];//существующая сессия
        }



        var BufData;
        if(typeData)
        {
            BufData=Info.Data;
        }
        else
        {
            BufData=Buffer.from(JSON.stringify(Info.Data));
        }


        BUF.Method=Info.Method;
        BUF.NodeTime=GetCurrentTime();
        BUF.TypeData=typeData;
        BUF.Length=BufData.length;
        BUF.CountFragment=1+Math.floor((BUF.Length-MAX_SIZE1)/MAX_SIZE2+0.999999999);




        var j=0;
        if(BUF.Length>MAX_SIZE1)
        {
            BUF.Data=BufData.slice(0,MAX_SIZE1);
            BufData.len=MAX_SIZE1;
        }
        else
        {
            BUF.Data=BufData;
        }


        var BufMessage=BufLib.GetBufferFromObject(BUF,FORMAT_PACKET_SEND,BUF_PACKET_SIZE,WorkStructPacketSend);


        var BufAll;
        // if(Node.addrArr)
        // {
        //     try
        //     {
        //         BufSignHash=GetSignHash(this,Node,BufMessage);
        //     }
        //     catch (e)
        //     {
        //         TO_ERROR_LOG("TRANSPORT",160,"Error GetSignHash to "+Node.ip+":"+Node.port);
        //         this.AddIpToErrorStat({address:Node.ip,port:Node.port});
        //         return;
        //     }
        //     BufAll=Buffer.concat([BufMessage,Buffer.from(BufSignHash)]);
        // }
        // else
        {
            BufAll=BufMessage;
        }
        //ToLog("LENGTH="+BufData.length);

        BUF.SendTime=startTime;
        BUF.SendTimeNum=(new Date)-0;
        BUF.SendTimeNum2=BUF.SendTimeNum;
        BUF.DeltaTimeSend2=DELTA_TIME_SEND2;

        var NInfo=this.NodeIp(Node);
        BUF.Node=Node;
        BUF.ip=NInfo.ip;
        BUF.port=NInfo.port;

        BUF.buf=BufAll;
        BUF.PacketPrioritet=PacketPrioritet;
        BUF.NodePrioritet=Node.Prioritet;
        if(!BUF.NodePrioritet)
            BUF.NodePrioritet=100;

        Meta.arrSend[0]=BUF;
        this.SendFragment(BUF);


        if(BUF.CountFragment>1)
        {
            //var j=BufData.len;
            var NumFragment=0;
            while(BufData.len<BufData.length)
            {
                NumFragment++;

                var BUF2={};
                BUF2.NumXORRND=0;
                BUF2.PacketType=2;
                BUF2.PacketID=BUF.PacketID;
                BUF2.SessionID=BUF.SessionID;
                BUF2.NumFragment=NumFragment;
                BUF2.QOSNumFragment=0;
                BUF2.CountFragment=BUF.CountFragment;
                BUF2.PacketNum=BUF.PacketNum;

                BUF2.SendTime=BUF.SendTime;
                BUF2.SendTimeNum=BUF.SendTimeNum;
                BUF2.SendTimeNum2=BUF.SendTimeNum2;
                BUF2.DeltaTimeSend2=BUF.DeltaTimeSend2;
                BUF2.Node=BUF.Node;
                BUF2.ip=BUF.ip;
                BUF2.port=BUF.port;
                BUF2.PacketPrioritet=BUF.PacketPrioritet;
                BUF2.NodePrioritet=BUF.NodePrioritet;

                var finish=Math.min(BufData.length,BufData.len+MAX_SIZE2);
                BUF2.Data=BufData.slice(BufData.len,finish);
                BufData.len+=MAX_SIZE2;

                BUF2.buf=BufLib.GetBufferFromObject(BUF2,FORMAT_PACKET_SEND2,BUF_PACKET_SIZE,WorkStructPacketSend2);
                this.SendFragment(BUF2);
                Meta.arrSend[BUF2.NumFragment]=BUF2;
            }
        }

        if(DEBUG_MODE)
        ToLog("SEND "+Info.Method+" to "+NodeInfo(Node)+" NUM:"+BUF.PacketNum+" LENGTH="+BUF.Length);


    }

    //------------------------------------------------------------------------------------------------------------------

    OnGetData(buf, rinfo, Socket)
    {
        var startTime = process.hrtime();
        var StartTimeNum=(new Date)-0;
        var PacketType=buf[12];

        ADD_TO_STAT("GETDATA",buf.length/1024);
        ADD_TO_STAT("LOADFRAGMENT");


        var Format,WorkStruct;
        if(PacketType===1)//основная часть пакета (первый фрагмент)
        {
            Format=FORMAT_PACKET_SEND;
            WorkStruct=WorkStructPacketSend;
        }
        else
        if(PacketType===2)//последующие фрагменты
        {
            Format=FORMAT_PACKET_SEND2;
            WorkStruct=WorkStructPacketSend2;
        }
        else
        {
            return;
        }

        try
        {
            var Buf=BufLib.GetObjectFromBuffer(buf,Format,WorkStruct);
        }
        catch (e)
        {
            //TODO
            TO_ERROR_LOG("TRANSPORT",400,"Error parsing buffer");
            //this.AddIpToErrorStat({address:Node.ip,port:Node.port});
            return;
        }


        var Item=this.SessionTree.find({HASH:Buf.SessionID});
        if(Buf.NumFragment===0)
        {
            //новый пакет
            if(Buf.SessionArr.length>0)
            {
                var Session=Buf.SessionArr[0];
                if(!Item)
                {
                    //check new Session;

                    //...
                    //...


                    Item={HASH:Buf.SessionID};
                    this.SessionTree.insert(Item);

                    var addrStr=GetHexFromAddres(Session.addrArr);
                    var Node=this.GrayMap[addrStr];
                    if(!Node)
                    {
                        Node=this.GetNewNode(addrStr,Session.FromIP,Session.FromPort)
                    }
                    Node.addrArr=Session.addrArr;
                    Node.ip=Session.FromIP;
                    Node.port=Session.FromPort;

                    Item.Node=Node;
                }
                Item.Session=Session;

            }

            if(!Item)
            {
                ToLog("#1 ERROR  :  "+Buf.Method+"  - not session found: PacketType="+PacketType+" from:"+rinfo.port)
                return;
            }

            Item.Node.ip_arrival=rinfo.address;
            Item.Node.port_arrival=rinfo.port;
        }


        //сборка пакетов
        if(!Item)
        {
            ToLog("2 ERROR - not session found!!")
            return;

        }
        var Node=Item.Node;
        if(Socket && Node.Socket && Node.Socket!==Socket)
        {
            ToLog("------------------------Node.Socket!==Socket");
        }
        Node.Socket=Socket;
        if(Socket)
            Socket.Node=Node;



        var Meta=this.PacketTree.LoadValue(Buf.PacketID,true);
        if(!Meta)
        {
            Meta={};
            this.PacketTree.SaveValue(Buf.PacketID,Meta);
        }



        if(Meta.bLoad)
            return;

        if(!Meta.LoadTime)
        {
            Meta.LoadTime=startTime;
            Meta.LoadTimeNum=StartTimeNum;
            Meta.Node=Node;
            Meta.arrGet=[];
            Meta.CheckArr=[];
            Meta.StartCheckPacket=0;
            Meta.CountFragment=Buf.CountFragment;
            Meta.PacketNum=Buf.PacketNum;
            Meta.PacketID=Buf.PacketID;
            Meta.SessionID=Buf.SessionID;

            Meta.ip=rinfo.address;
            Meta.port=rinfo.port;

            Meta.DELTA_TIME_CHECK=CHECK_PACKET_DELTA_TIME;
        }






        if(Buf.NumFragment===0)
        {

            Meta.Method=Buf.Method;
            Meta.NodeTime=Buf.NodeTime;
            Meta.Length=Buf.Length;
            Meta.TypeData=Buf.TypeData;
        }
        if(Buf.CountFragment>MAX_FRAGMENT_COUNT)
        {
            ToLog("#1 ERROR - MAX_FRAGMENT_COUNT, CountFragment = "+Buf.CountFragment)
            return;
        }
        if(Buf.Length>MAX_PACKET_LENGTH)
        {
            ToLog("#2 ERROR - MAX_PACKET_LENGTH, Length = "+Buf.Length)
            return;
        }

        if(Buf.NumFragment>Buf.CountFragment)
        {
            ToLog("#3 ERROR - NumFragment = "+Buf.NumFragment+"  FragmentCount="+Buf.CountFragment);
            return;
        }

        //QOS
        if(!Node.LoadFragmentArr)
        {
            Node.LoadQOSNumFragment=0;
            Node.LoadFragmentArr=new Float64Array(MAX_FRAGMENT_INFO_ARRAY);
        }
        Node.LoadQOSNumFragment=Math.max(Node.LoadQOSNumFragment,Buf.QOSNumFragment);
        Node.LoadFragmentArr[Buf.QOSNumFragment%MAX_FRAGMENT_INFO_ARRAY]=StartTimeNum;
        //this.LoadedNodes.SaveValue(Node.addrArr,Node);


        if(!Meta.arrGet[Buf.NumFragment])
        {
            if(Meta.FragmentLoadCount===undefined)
                Meta.FragmentLoadCount=0;
            Meta.FragmentLoadCount++;
            Meta.arrGet[Buf.NumFragment]=Buf.Data;
        }



        if(Meta.FragmentLoadCount>0 && Meta.FragmentLoadCount===Buf.CountFragment)
        {
            if(Buf.CountFragment===1)
            {
                Meta.Data=Buf.Data;
            }
            else
            {
                var Data=Buffer.alloc(Meta.Length);
                Meta.Data=Data;

                var j=0;
                for(var n=0;n<Meta.FragmentLoadCount;n++)
                {
                    var arr=Meta.arrGet[n];
                    if(!arr)
                    {
                        ToLog("#4 Error data fragment: "+n);
                        return;
                    }
                    for(var i=0;i<arr.length;i++)
                    {
                        Data[j]=arr[i];
                        j++;
                    }

                }
            }
            this.AddToLoadPacket(Meta);
        }

        ADD_TO_STAT_TIME("TIMEDOGETDATA", startTime);
    }

    //------------------------------------------------------------------------------------------------------------------

    GetActualNodes()
    {
        var Arr=[];
        var it=this.ActualNodes.iterator(), Item;
        while((Item = it.next()) !== null)
        {
            Arr.push(Item);
        }
        return Arr;
     }

    CheckLoadFragments()
    {
        //var Count=MAX_FRAGMENT_INFO_ARRAY/2-10;
        var Count=MAX_FRAGMENT_INFO_ARRAY;
        var StartTimeNum=(new Date)-0;


        var ArrNodes=this.GetActualNodes();
        for(var Node of ArrNodes)
        {
            if(!Node.LoadFragmentArr)
                continue;

            var MaxNum=Node.LoadQOSNumFragment;
            var Arr=[];

            var startTime=process.hrtime()
            for(var num=MaxNum-Count;num<MaxNum+Count;num++)
            {
                if(num<0)
                    continue;
                var num2=num%MAX_FRAGMENT_INFO_ARRAY;
                if(num<=MaxNum)
                {
                    var timeLoadNum=Node.LoadFragmentArr[num2];
                    if(timeLoadNum)
                    {
                        var deltaTime=StartTimeNum-timeLoadNum;
                        if(deltaTime<PACKET_LIVE_PERIOD)
                        {
                            Arr.push(num);
                        }
                    }
                }
                else//clear
                {
                    Node.LoadFragmentArr[num2]=0;
                }
            }

            if(Arr.length<1)
                continue;
            Arr.sort(function (a,b) {return a-b});
            var BaseIndex=Arr[0];

            var ArrIndex=[];
            var ArrCount=[];
            var PrevValue=undefined;
            for(var i=0;i<Arr.length;i++)
            {
                var Value=Arr[i]-BaseIndex;
                if(PrevValue===Value-1)
                {
                    ArrCount[ArrCount.length-1]++;
                }
                else
                {
                    if(ArrIndex.length>=MAX_CHECK_PACKET_ARRAY2/2)
                    {
                        break;
                    }

                    ArrIndex.push(Value);
                    ArrCount.push(1);
                }
                PrevValue=Value;
            }

            var BufWrite=BufLib.GetBufferFromObject({BaseIndex:BaseIndex,ArrIndex:ArrIndex,ArrCount:ArrCount},"{BaseIndex:uint,ArrIndex:[uint16],ArrCount:[uint16]}",BUF_PACKET_SIZE,{});
            this.Send(Node,
                {
                    "Method":"PACKETINFO",
                    "Data":BufWrite,
                },1);


        }
    }
    PACKETINFO(Context,CurTime)
    {
        var Node=Context.Node;
        if(!Node.SendFragmentArr)
            return;

        Node.PrevMaxSendProof=Node.MaxSendProof;

        var Item=BufLib.GetObjectFromBuffer(Context.Data,"{BaseIndex:uint,ArrIndex:[uint16],ArrCount:[uint16]}",{});
        for(var i=0;i<Item.ArrIndex.length;i++)
        {
            var num1=Item.ArrIndex[i]+Item.BaseIndex;
            for(var j=0;j<Item.ArrCount[i];j++)
            {
                var num=num1+j;
                Node.MaxSendProof=Math.max(Node.MaxSendProof,num);
                var num2=num%MAX_FRAGMENT_INFO_ARRAY;
                Node.SendFragmentArr[num2]=undefined;
            }
        }
    }

    CheckSendFragments()
    {

        var StartTimeNum=(new Date)-0;
        //var Count=Math.floor(4*MAX_CHECK_PACKET_ARRAY2/4);
        var Count=MAX_CHECK_PACKET_ARRAY2;

        var ArrNodes=this.GetActualNodes();
        for(var Node of ArrNodes)
        {
            if(!Node.SendFragmentArr)
                continue;

            //повторно отправляем данные
            //var MaxNum=Node.SendQOSNumFragment;
            var MaxNum=Node.PrevMaxSendProof;
            for(var num=MaxNum-Count;num<=MaxNum;num++)
            {
                if(num<0)
                    continue;


                var num2=num%MAX_FRAGMENT_INFO_ARRAY;
                var Item=Node.SendFragmentArr[num2];


                if(Item)
                {
                    var deltaTime=StartTimeNum-Item.SendTimeNum;
                    //if(deltaTime>Item.DeltaTimeSend2)// && deltaTime<PACKET_LIVE_PERIOD/2)
                    {

                        var Repeat=this.GET_CURRENT_STAT_TIME("SEND_REPEAT_FRAGMENT");
                        if(100*Repeat/TRAFIC_LIGHT_LIMIT_SEND>10)
                        {
                            continue;
                        }
                        this.ADD_CURRENT_STAT_TIME("SEND_REPEAT_FRAGMENT",Item.buf.length/1024);



                        //Item.DeltaTimeSend2+=5*DELTA_TIME_SEND2;
                        Node.SendFragmentArr[num2]=0;

                        this.SendFragment(Item);
                    }
                }
            }




        }

    }
    CaclLostFragments()
    {
        var SendTimeNum=(new Date)-0;

        var ArrNodes=this.GetActualNodes();
        for(var Node of ArrNodes)
        {
            if(!Node.SendFragmentArr)
                continue;

            for(var num2=0;num2<Node.SendFragmentArr.length;num2++)
            {
                var Item=Node.SendFragmentArr[num2];
                if(Item)
                {
                    var deltaTime=SendTimeNum-Item.SendTimeNum;
                    if(deltaTime>PACKET_LIVE_PERIOD)
                    {
                        ADD_TO_STAT("FRAGMENT_LOST");
                        Node.SendFragmentArr[num2]=null;
                    }
                }
            }




        }
    }



    //------------------------------------------------------------------------------------------------------------------

    NodeIp(Node)
    {
        //return {ip:Node.ip,port:Node.port}
        if(Node.ip_arrival)
        {
            return {ip:Node.ip_arrival,port:Node.port_arrival}
        }
        else
        {
            return {ip:Node.ip,port:Node.port}
        }
    }

    GetQuoteByItem(Item)
    {
        if(Item.PacketPrioritet<600)
            return this.LightSendBuf;
        else
            return this.HardSendBuf;
    }
    SendFragment(Item)
    {
        if(USE_TCP)
        {
            this.SendToNetwork(Item);
        }
        else
        {
            var Quote=this.GetQuoteByItem(Item);
            Quote.insert(Item);
        }
    }


    DoSendPacketLight()
    {
        var SendTimeNum=(new Date)-0;

        while(this.LightSendBuf.size>0)
        {
            var Item=this.LightSendBuf.min();
            var Value=Item.buf.length/1024;

            if(this.GET_CURRENT_STAT_TIME("SENDFRAGMENT_L")>TRAFIC_LIGHT_LIMIT_SEND)
            {
                Item.Node.LimitFragmentLightSend++;

                break;
            }


            this.LightSendBuf.remove(Item);

            var deltaTime=SendTimeNum-Item.SendTimeNum;//ms
            if(deltaTime>PACKET_LIGHT_LIVE_PERIOD)
            {
                ADD_TO_STAT("SKIPFRAGMENTSEND");
                Item.Node.SkipFragmentLightSend++;

                var num2=Item.NumSendFragmentArr;
                Item.Node.SendFragmentArr[num2]=null;


                while(this.LightSendBuf.size>0)
                {
                    Item=this.LightSendBuf.min();
                    var deltaTime=SendTimeNum-Item.SendTimeNum;//ms
                    if(deltaTime>PACKET_LIGHT_LIVE_PERIOD/2)
                    {
                        this.LightSendBuf.remove(Item);

                        ADD_TO_STAT("SKIPFRAGMENTSEND");
                        Item.Node.SkipFragmentLightSend++;

                        var num2=Item.NumSendFragmentArr;
                        Item.Node.SendFragmentArr[num2]=null;
                    }
                    else
                    {
                        break;
                    }
                }


                break;
            }

            this.ADD_CURRENT_STAT_TIME("SENDFRAGMENT_L",Value);
            ADD_TO_STAT("SENDFRAGMENT_L",Value);
            Item.Node.SendFragmentL++;

            this.SendToNetwork(Item);
            break;
        }
    }
    DoSendPacketUDP()
    {
        for(var i=0;i<2;i++)
        {
            this.SendPacketMode++;
            if(this.SendPacketMode%2==0)
                this.DoSendPacketLight();
            else
                this.DoSendPacketHard();
        }
    }


    DoSendPacketHard()
    {
        var SendTimeNum=(new Date)-0;
        var Sender=this.Net4;

        while(this.HardSendBuf.size>0)
        {
            var Item=this.HardSendBuf.min();
            var Value=Item.buf.length/1024;

            if(this.GET_CURRENT_STAT_TIME("SENDFRAGMENT_H")>TRAFIC_HARD_LIMIT_SEND)
            {
                Item.Node.LimitFragmentHardSend++;

                break;
            }

            this.HardSendBuf.remove(Item);

            var deltaTime=SendTimeNum-Item.SendTimeNum;//ms
            if(deltaTime>PACKET_HARD_LIVE_PERIOD)
            {
                ADD_TO_STAT("SKIPFRAGMENTSEND");
                Item.Node.SkipFragmentHardSend++;

                var num2=Item.NumSendFragmentArr;
                Item.Node.SendFragmentArr[num2]=null;


                while(this.HardSendBuf.size>0)
                {
                    Item=this.HardSendBuf.min();
                    var deltaTime=SendTimeNum-Item.SendTimeNum;//ms
                    if(deltaTime>=PACKET_HARD_LIVE_PERIOD)
                    {
                        this.HardSendBuf.remove(Item);

                        ADD_TO_STAT("SKIPFRAGMENTSEND");
                        Item.Node.SkipFragmentHardSend++;

                        var num2=Item.NumSendFragmentArr;
                        Item.Node.SendFragmentArr[num2]=null;
                    }
                    else
                    {
                        break;
                    }
                }


                break;
            }

            ADD_TO_STAT("SENDFRAGMENT_H",Value);
            this.ADD_CURRENT_STAT_TIME("SENDFRAGMENT_H",Value);
            Item.Node.SendFragmentH++;


            this.SendToNetwork(Item);
            break;
        }

    }


    AddToQOSArray(Item)
    {
        var Node=Item.Node;
        if(!Node.SendFragmentArr)
        {
            Node.SendQOSNumFragment=0;
            Node.SendFragmentArr=[];
        }
        Node.SendQOSNumFragment++;
        Item.QOSNumFragment=Node.SendQOSNumFragment;
        var num2=Item.QOSNumFragment%MAX_FRAGMENT_INFO_ARRAY;
        Item.NumSendFragmentArr=num2;

        Item.buf.len=QOSNUMFRAGMENTPOS;
        BufLib.Write(Item.buf,Item.QOSNumFragment,"uint");


        if(Node.SendFragmentArr[num2])
        {
            Node.FragmentOverflow++;
            ADD_TO_STAT("FRAGMENT_OVERFLOW");
        }

        Node.SendFragmentArr[num2]=Item;
    }




    AddToLoadPacket(Meta)
    {
        if(Meta.bLoad)
            return;
        Meta.bLoad=1;

        Meta.PacketPrioritet=this.MethodPrioritet[Meta.Method];
        if(Meta.PacketPrioritet===undefined)
            Meta.PacketPrioritet=500;

        Meta.NodePrioritet=Meta.Node.Prioritet;
        if(!Meta.NodePrioritet)
            Meta.NodePrioritet=100;

        ADD_TO_STAT("LOADPACKET");
        this.QuoteUsePacket.insert(Meta);
    }

    DoUsePacket()
    {
        var StartTimeNum=(new Date)-0;

        var MaxCount=1;
        for(var Count=0;Count<MaxCount;Count++)
        if(this.QuoteUsePacket.size>0)
        {
            this.UsePacketIdle=0;
            var Item=this.QuoteUsePacket.min();
            var Time = process.hrtime(Item.LoadTime);
            var deltaTime=Math.floor(Time[0]*1000 + Time[1]/1e6);//ms

            if(this.GET_CURRENT_STAT_TIME("USE_PACKET")>H_PACKET_LIMIT_USE && Item.PacketPrioritet>=600)
                break;

            if(deltaTime<100 && Item.PacketPrioritet>=600)
            {
                break;
            }

            this.QuoteUsePacket.remove(Item);
            if(Item.PacketPrioritet<=1)//All
            {
                Count--;
            }
            else
            {
                this.ADD_CURRENT_STAT_TIME("USE_PACKET",1);
            }

            if(deltaTime>PACKET_LIVE_PERIOD)
            {
                //ToLog("Skip "+Item.Method+" load deltaTime="+deltaTime)

                ADD_TO_STAT("SKIPFRAGMENTUSE");
                continue;
            }
            else
            {
                this.OnPacket(Item);
            }


        }
        else
        {
            this.UsePacketIdle++;
        }
    }



    SendToNetwork(Item)
    {
        if(Item.Node && this.addrArr && Item.Node.addrArr && CompareArr(this.addrArr,Item.Node.addrArr)===0)
            return;

        var Value=Item.buf.length/1024;
        ADD_TO_STAT("SENDDATA",Value);
        ADD_TO_STAT("SENDFRAGMENT");
        this.ADD_CURRENT_STAT_TIME("SENDFRAGMENT",Value);
        this.AddToQOSArray(Item)

        Item.buf.len=PACKETSIZEPOS;
        BufLib.Write(Item.buf,Item.buf.length,"uint");

        if(random(100)>TEST_RANDOM_SEND_PERCENT)
        {
            return;
        }


        var Sender=this.Net4;
        Sender.send(Item.buf, 0, Item.buf.length, Item.port, Item.ip, function (err,len)
        {
            if(err)
            {
                TO_ERROR_LOG("TRANSPORT",170,"Error send data: "+err.message);
                this.AddCheckErrCount(Item.Node,1,"Error send data");
            }
        });
    }


    OnPacket(Meta)
    {
        var startTime=process.hrtime();

        ADD_TO_STAT("USEPACKET");

        if(Meta.TypeData===STR_TYPE)
        {
            Meta.Data=Meta.Data.toString();
        }


        var CurTime=GetCurrentTime();
        this.OnGetMethod(Meta,CurTime);

        ADD_TO_STAT_TIME("MAX:TIME_USE_PACKET", startTime);
        ADD_TO_STAT_TIME("TIME_USE_PACKET", startTime);
        ADD_TO_STAT_TIME("MAX:TIME_USE_PACKET:"+Meta.Method, startTime);


    }





    SetXORHeader(buf,bForce)
    {
        if(this.UseRNDHeader || bForce)
        {
            var HashHashSign=shaarr(buf.slice(buf.length-32,buf.length));
            for(var i=0;i<32;i++)
                buf[i]=HashHashSign[i]^buf[i];
        }
    }







    CheckMaxCount(Node)//per 5 sec
    {
        var CurTime=GetCurrentTime(0);

        var item;
        var name;
        if(Node && Node.White)
        {
            name="White";
            item=Node.Flood;
        }
        else
        {
            name="Another";
            item=this.AnotherHostsFlood;
        }


        item.Count++;

        if(item.Count<=item.MaxCount)
            return true;

        if(CurTime-item.Time > 1000)//ms
        {
            item.Time=CurTime;
            item.Count=1;
            return true;
        }

        ADD_TO_STAT("TRANSPORT:Flood:"+name);
        return false;
    }

    AddToBanIP(ip)
    {
        var Key=""+ip;
        this.BAN_IP[Key]={Errors:1000000,TimeTo:(GetCurrentTime(0)-0)+1000*24*3600*10,BanDelta:1000};
        ADD_TO_STAT("AddToBanIP");
    }
    AddToBan(Node)
    {
        Node.IsBan=true;
        this.DeleteNodeFromWhite(Node);

        var Key=""+Node.ip;// + ':' + Node.port;
        this.BAN_IP[Key]={Errors:1000000,TimeTo:(GetCurrentTime(0)-0)+1000*24*3600*10,BanDelta:1000};
        ADD_TO_STAT("AddToBan");
    }

    WasBan(rinfo, decrError)
    {
        var Key=""+rinfo.address;// + ':' + rinfo.port;
        var Stat=this.BAN_IP[Key];
        if(Stat)
        {
            if(Stat.TimeTo>(GetCurrentTime(0)-0))//May be was ban?
                return true;

            if(decrError)
            if(Stat.BanDelta>1000)//ms
            {
                Stat.BanDelta=Stat.BanDelta-50;
                //ToLog("Stat.BanDelta="+Stat.BanDelta);
            }
         }

        return false;
    }
    AddIpToErrorStat(rinfo,StrDop)
    {
        var Key=""+rinfo.address + ':' + rinfo.port;
        var Stat=this.BAN_IP[Key];
        if(!Stat)
        {
            this.BAN_IP[Key]={Errors:0,TimeTo:0,BanDelta:1000};
            Stat=this.BAN_IP[Key];
        }
        Stat.Errors=Stat.Errors+1;
        if(Stat.Errors>=5)//2
        {

            var CurDate=GetCurrentTime();
            Stat.TimeTo=new Date(CurDate-(-Stat.BanDelta));

            //TO_DEBUG_LOG("Was ban "+Key+"   id="+this.id+"  to "+GetStrTime(Stat.TimeTo)+" Stat.BanDelta="+Stat.BanDelta);
            StrDop = StrDop || "";
            ADD_TO_STAT("TRANSPORT:Ban"+StrDop);

            Stat.Errors=0;
            Stat.BanDelta=Stat.BanDelta*2;
        }
        //ToLog("Stat.Errors="+Stat.Errors);

    }


    OnError(err)
    {
        TO_ERROR_LOG("TRANSPORT",200,err);
    }
    OnListening()
    {
        //ToLog("Run UDP server on "+this.ip+":"+this.port+"  for: "+this.addrStr);
        ToLog("Run UDP server on port:"+START_PORT_NUMBER+"  for: "+this.addrStr);
        this.CanSend++;
    }



    //TCP


    OnPacketTCP(Meta)
    {
        var startTime=process.hrtime();

        ADD_TO_STAT("USEPACKET");
        var CurTime=GetCurrentTime();
        Meta.Node.LastTime=CurTime;
        this.OnGetMethod(Meta,CurTime);



        ADD_TO_STAT_TIME("MAX:TIME_USE_PACKET", startTime);
        ADD_TO_STAT_TIME("TIME_USE_PACKET", startTime);
        ADD_TO_STAT_TIME("MAX:TIME_USE_PACKET:"+Meta.Method, startTime);


    }


    GetBufFromData(Method,Data,TypeData,ContextID)
    {
        var BufData;
        if(TypeData===BUF_TYPE)
        {
            BufData=Data;
        }
        else
        if(TypeData===STR_TYPE)
        {
            BufData=Buffer.from(Data.substr(0,MAX_STR_BUF_DATA));
        }
        else
        {
            if(Data===undefined)
            {
                TypeData=BUF_TYPE;
                BufData=Buffer.alloc(0);
            }
            else
            {
                throw "ERROR TYPE DATA"
            }
        }


        var BUF={};
        BUF.PacketSize=0;
        BUF.NumXORRND=0;
        BUF.Method=Method;
        BUF.NodeTime=GetCurrentTime();
        BUF.TypeData=TypeData;
        BUF.Length=BufData.length;
        BUF.Data=BufData;
        BUF.ContextID=ContextID;
        BUF.Hash=this.GetHashFromData(BUF);


        var BufWrite=BufLib.GetBufferFromObject(BUF,FORMAT_PACKET_SEND_TCP,BufData.length+300,WorkStructPacketSend);
        //TODO:         BufSignHash=GetSignHash(this,Node,BufMessage);


        BufWrite.len=0;
        BufLib.Write(BufWrite,BufWrite.length,"uint");

        return BufWrite;
    }

    GetDataFromBuf(buf)
    {
        try
        {
            var Meta=BufLib.GetObjectFromBuffer(buf,FORMAT_PACKET_SEND_TCP,WorkStructPacketSend);
        }
        catch (e)
        {
            TO_ERROR_LOG("TRANSPORT",640,"Error parsing Buffer");
            return undefined;
        }
        var Hash=this.GetHashFromData(Meta);
        if(CompareArr(Hash,Meta.Hash)!==0)
        {
            TO_ERROR_LOG("TRANSPORT",645,"Error hash Buffer");
            //console.trace("TRANSPORT 645")
            return undefined;
        }

        if(Meta.TypeData===STR_TYPE)
        {
            Meta.Data=Meta.Data.slice(0,MAX_STR_BUF_DATA).toString();
        }

        return Meta;
    }

    GetHashFromData(Info)
    {
        return shaarr(Info.Method+Info.Length+"-"+(Info.NodeTime-0));
    }



    OnGetFromTCP(Node,Socket,Buf)
    {
        if(!Node)
            return;

        //1.Добавляем в буфер сокета
        //2.Проверяем размер в буфере с требуемым размером.
        //3.Если достаточно данных - то обрабатываем пакет

        if(!Socket.Buf || Socket.Buf.length===0)
        {
            Socket.Buf=Buf;
        }
        else
        {
            Socket.Buf=Buffer.concat([Socket.Buf,Buf]);
        }
        if(!Socket.Prioritet)
        {
            Socket.Prioritet=Node.Prioritet;
        }

        this.LoadBuf.insert(Socket);
    }


    DoLoadBuf()
    {
        var Socket=this.LoadBuf.min();
        if(!Socket)
            return;
        this.LoadBuf.remove(Socket);
        if(Socket.WasClose)
            return;

        while(true)
        {
            if(Socket.Buf && Socket.Buf.length>6)
            {
                ADD_TO_STAT("MAX:BUFFE_LOAD_SIZE", Socket.Buf.length/1024);

                Socket.Buf.len=0;
                var PacketSize=BufLib.Read(Socket.Buf,"uint");
                if(PacketSize>MAX_PACKET_LENGTH)
                {
                    //console.trace("MAX_PACKET_LENGTH PacketSize="+PacketSize)
                    this.SendCloseSocket(Socket,"MAX_PACKET_LENGTH");
                    break;
                }
                else
                if(Socket.Buf.length>=PacketSize)
                {

                    var data=Socket.Buf.slice(0,PacketSize);
                    Socket.Buf=Socket.Buf.slice(PacketSize,Socket.Buf.length);
                    var Res=this.DoDataFromTCP(Socket,data);
                    if(Res)
                        continue;//ok
                }
            }

            break;
        }
    }

    DoDataFromTCP(Socket,buf)
    {
        var Node=Socket.Node;
        if(!Node)
            return;

        var startTime = process.hrtime();
        var StartTimeNum=(new Date)-0;
        ADD_TO_STAT("GETDATA",buf.length/1024);
        ADD_TO_STAT("GETDATA:"+Node.port,buf.length/1024);




        var Buf=this.GetDataFromBuf(buf);
        if(!Buf)
        {
            this.SendCloseSocket(Socket,"FORMAT_PACKET_SEND_TCP");
            return 0;
        }

        ADD_TO_STAT("GET:"+Buf.Method);
        ADD_TO_STAT("GET:"+Buf.Method+":"+Node.port);

        //ToLog("LOAD "+Buf.Method+" ContextID="+GetHexFromAddres(Buf.ContextID));

        if(!IsZeroArr(Buf.ContextID))
        {
            Buf.Context=this.ContextPackets.LoadValue(Buf.ContextID);
        }
        if(!Buf.Context)
            Buf.Context={};
        Buf.Context.ContextID=Buf.ContextID;

        Buf.Node=Node;
        Buf.Socket=Socket;


        var Prioritet=this.MethodPrioritet[Buf.Method];

        if(Prioritet===500)
        {
            Node.WantHardTraffic=1;
            if(!Node.CanHardTraffic)
            {
                TO_DEBUG_LOG(""+Buf.Method+" - ADD TO BUF");

                Node.LoadPacketNum++;
                Buf.PacketNum=Node.LoadPacketNum;
                Buf.LoadTimeNum=(new Date)-0;
                this.LoadHardPacket.insert(Buf);

                return 1;
            }
        }


        this.OnPacketTCP(Buf);


        //this.LoadedNodes.SaveValue(Node.addrArr,Node);
        ADD_TO_STAT_TIME("TIMEDOGETDATA", startTime);

        return 1;
    }
    DoLoadHardPacket()
    {
        var Info=this.LoadHardPacket.min();
        if(!Info)
            return;

        var Node=Info.Node;
        if(Node.CanHardTraffic)
        {
            this.LoadHardPacket.remove(Info);
            this.OnPacketTCP(Info);
        }

        while(Info=this.LoadHardPacket.max())
        {
            var DeltaTime=(new Date)-Info.LoadTimeNum;
            if(DeltaTime>2000 || !Info.Node.Socket || Info.Node.Socket.WasClose)
            {
                this.LoadHardPacket.remove(Info);
                TO_DEBUG_LOG("Delete old load packet: "+Info.Method)
                }
            else
            {
                break;
            }
        }
    }


    //SEND
    Send(Node,Info,TypeData)
    {
        if(!USE_TCP)
            return this.SendUDP(Node,Info,TypeData);


        //var startTime = process.hrtime();
        if(!Node.Socket)
        {
            this.DeleteNodeFromWhite(Node);
            return;
        }



        if(Info.Context)
        {
            Info.ContextID=Info.Context.ContextID;
            if(!Info.ContextID)
            {
                Info.ContextID=crypto.randomBytes(32);
                Info.Context.ContextID=Info.ContextID;
            }
            this.ContextPackets.SaveValue(Info.ContextID,Info.Context);
        }
        else
        {
            Info.ContextID=[];
        }




        Node.SendPacketNum++;
        Info.Node=Node;
        Info.TypeData=TypeData;
        Info.Prioritet=Node.Prioritet;
        Info.PacketNum=Node.SendPacketNum;
        Info.TimeNum=(new Date)-0;

        Node.SendPacket.insert(Info);

    }



    DoSendPacket()
    {

        var TimeNum=(new Date)-0;
        var it=this.ActualNodes.iterator(), Node;
        while((Node = it.next()) !== null)
        if(Node.ConnectStatus()===100)
        {
            var Info=Node.SendPacket.max();
            if(Info && TimeNum-Info.TimeNum>PACKET_ALIVE_PERIOD)
            while(Info=Node.SendPacket.max())
            {
                var DeltaTime=TimeNum-Info.TimeNum;
                if(DeltaTime>PACKET_ALIVE_PERIOD/2)
                {
                    //ToLog("Delete OLD TIME "+Info.Method+" DeltaTime="+DeltaTime+" for:"+Node.port)
                    Node.SendPacket.remove(Info);

                    ADD_TO_STAT("DELETE_OLD_PACKET");
                }
                else
                    break;
            }

            Info=Node.SendPacket.min();
            if(!Info)
                continue;



            //ToLog("Send to "+Node.port+" PacketNum="+Info.PacketNum)

            ADD_TO_STAT("MAX:NODE_BUF_WRITE:"+Node.port,Node.BufWrite.length/1024);
            ADD_TO_STAT("MAX:NODE_SEND_BUF_PACKET_COUNT:"+Node.port,Node.SendPacket.size);

            if(Node.BufWrite.length>2*TRAFIC_LIMIT_1S)
            {
                continue;
            }

            Node.SendPacket.remove(Info);


            if(Info.Context)
            {
                if(!Info.Context.SendCount)
                    Info.Context.SendCount=0;
                Info.Context.SendCount++;
            }
            var BufWrite=this.GetBufFromData(Info.Method,Info.Data,Info.TypeData,Info.ContextID);


            Node.BufWriteLength+=BufWrite.length;

            if(Node.BufWrite.length===0)
                Node.BufWrite=BufWrite;
            else
                Node.BufWrite=Buffer.concat([Node.BufWrite,BufWrite]);

            ADD_TO_STAT("SEND:"+Info.Method);
            ADD_TO_STAT("SEND:"+Info.Method+":"+Node.port);
            TO_DEBUG_LOG("SEND "+Info.Method+" to "+NodeInfo(Node)+" LENGTH="+BufWrite.length);

            //ToLog("SEND "+Info.Method+"  ContextID="+GetHexFromAddres(Info.ContextID))
        }
        else
        {
            ADD_TO_STAT("SEND_ERROR");
            this.AddCheckErrCount(Node,0.01,"NODE STATUS="+Node.ConnectStatus());
        }
    }


    DoSendBuf()
    {
        this.RecalcSendStatictic();
        //ADD_TO_STAT("DOSENDBUF",1);

        var it=this.ActualNodes.iterator(), Node;
        NEXT_NODE:
        while((Node = it.next()) !== null)
        if(Node.Socket && Node.ConnectStatus()===100)
        //while(Node.BufWrite.length)
        if(Node.BufWrite.length>0)
        {

            var CountSend=Math.min(BUF_PACKET_SIZE,Node.BufWrite.length);
            var Value=CountSend/1024;

            var CanCountSend=Node.SendTrafficLimit-Node.SendTrafficCurrent;
            if(CanCountSend<CountSend)
            {
                ADD_TO_STAT("DO_LIMIT_SENDDATA:"+Node.port,Value);

                if(this.SendTrafficFree<CountSend)
                {
                    continue NEXT_NODE;
                }

                this.SendTrafficFree-=CountSend;
            }





            //Node.Socket.write(Node.BufWrite.slice(0,CountSend));
            Node.write(Node.BufWrite.slice(0,CountSend));

            Node.SendTrafficCurrent+=CountSend;
            Node.BufWrite=Node.BufWrite.slice(CountSend);



            this.ADD_CURRENT_STAT_TIME("SEND_DATA",Value);
            ADD_TO_STAT("SENDDATA",Value);
            ADD_TO_STAT("SENDDATA:"+Node.port,Value);
        }

    }




    CheckPOWConnect(Socket,data)
    {
        //data=Buffer.alloc(0)
        //data=Buffer.alloc(data.length)
        //data=crypto.randomBytes(data.length/2);

        try
        {
            var Pow=BufLib.GetObjectFromBuffer(data,FORMAT_POW_TO_SERVER,{});
        }
        catch (e)
        {
            this.SendCloseSocket(Socket,"FORMAT_POW_TO_SERVER");
            return;
        }

        if(CompareArr(Pow.addrArr,this.addrArr)===0)
        {
            this.SendCloseSocket(Socket,"SELF");
            return;
        }

        if(Pow.DEF_NETWORK!==DEF_NETWORK)
        {
            this.SendCloseSocket(Socket,"DEF_NETWORK");
            this.AddToBanIP(Socket.remoteAddress);
            return;
        }

        var Node;
        var Hash=shaarr2(this.addrArr,Socket.HashRND);
        var hashPow=GetHashWithValues(Hash,Pow.nonce,0);
        var power=GetPowPower(hashPow);

        if(Pow.Reconnect)
        {
            //TODO - Sign

            Node=this.FindRunNodeContext(Pow.addrArr,Pow.FromIP,Pow.FromPort);
            Socket.Node=Node;
            Node.Socket2=Socket;
            SetSocketStatus(Socket,3);
            SetSocketStatus(Node.Socket,200);//stop send


            // ToLog("Get reconnect");
            Socket.write(this.GetBufFromData("POW_CONNECT1","OK",2));
            let SOCKET=Node.Socket;
            setTimeout(function ()
            {
                SOCKET.end();
            },100)


            return;
        }


        if(power<MIN_POWER_POW_HANDSHAKE)
        {
            ToLog("END: MIN_POWER_POW_HANDSHAKE")
            Socket.end(this.GetBufFromData("POW_CONNECT2","MIN_POWER_POW_HANDSHAKE",2));
            CloseSocket(Socket,"MIN_POWER_POW_HANDSHAKE");
        }
        else
        {

            Node=this.FindRunNodeContext(Pow.addrArr,Pow.FromIP,Pow.FromPort);

            ToLog("*************************************** OK POW SERVER for client node:"+NodeInfo(Node)+" "+SocketInfo(Socket));

            // if(Node.DoubleConnectCount>5 && Node.Socket && !Node.Socket.WasClose)
            // {
            //     CloseSocket(Node.Socket,"Node.DoubleConnectCount>5");
            //     Node.Socket=undefined;
            //     Node.DoubleConnectCount=0;
            // }

            Node.NextConnectDelta=1000;
            if(Node.Socket && !Node.Socket.WasClose)// && Socket!==Node.Socket)
            {
                if(SocketStatus(Node.Socket)===100
                || (Node.Socket.ConnectToServer && CompareArr(this.addrArr,Node.addrArr)<0))//встречный запрос соединения
                {
                    Node.DoubleConnectCount++;
                    ToLog("Find double connection *"+Socket.ConnectID+" "+NodeInfo(Node)+" from client  NodeSocketStatus="+SocketStatus(Node.Socket))
                    Socket.write(this.GetBufFromData("POW_CONNECT3","DOUBLE",2));
                    return;
                }
                else
                {
                    ToLog("Close double connection *"+Node.Socket.ConnectID+" "+NodeInfo(Node)+" from server NodeSocketStatus="+SocketStatus(Node.Socket))
                    CloseSocket(Node.Socket,"Close double connection");
                }
            }
            else
            {
            }
            this.AddNodeToWhite(Node);

            if(Node.Socket)
                CloseSocket(Node.Socket,"Close prev connection: "+SocketStatistic(Node.Socket)+"  Status:"+SocketStatus(Node.Socket));

            Node.FromIP=Pow.FromIP;
            Node.FromPort=Pow.FromPort;


            Node.Socket=Socket;
            SetSocketStatus(Socket,3);
            SetSocketStatus(Socket,100);
            Socket.Node=Node;

            Socket.write(this.GetBufFromData("POW_CONNECT4","OK",2));

        }
    }



    StartServerUDP()
    {
        let SELF=this;

        var BinData=
            {
                port: START_PORT_NUMBER,
                exclusive: true,
                recvBufferSize:UDP_BUF_SIZE,
                sendBufferSize :UDP_BUF_SIZE,
            };
        this.Net4 = dgram.createSocket("udp4");
        this.Net4.on( "message", this.OnGetData.bind(this));
        this.Net4.on('error', this.OnError);
        this.Net4.on('listening', this.OnListening.bind(this));
        this.Net4.bind(BinData);

        //this.Net6 = dgram.createSocket("udp6");
        //this.Net6.on( "message", this.OnGetData.bind(this));
        //this.Net6.on('error', this.OnError);
        //this.Net6.on('listening', this.OnListening.bind(this));
        //this.Net6.bind(BinData);
        //this.Net4.unref();
        this.FindInternetIP()
    }

    StartServer()
    {
        if(!USE_TCP)
        {
            this.StartServerUDP();
            return
        }

        let SELF=this;

        this.Server = net.createServer
        ((sock) =>
        {



            if(this.WasBan({address:sock.remoteAddress}))
            {
                sock.ConnectID="new";
                CloseSocket(sock,"WAS BAN",true);
                return;
            }


            let SOCKET=sock;
            socketInit(SOCKET,"c");
            SetSocketStatus(SOCKET,0);



            // 'connection' listener
            ToLog("Client *"+SOCKET.ConnectID+" connected from "+SOCKET.remoteAddress+":"+SOCKET.remotePort);


            SOCKET.HashRND=crypto.randomBytes(32);
            var BufData=BufLib.GetBufferFromObject({addrArr:SELF.addrArr,HashRND:SOCKET.HashRND,MIN_POWER_POW:MIN_POWER_POW_HANDSHAKE},FORMAT_POW_TO_CLIENT,300,{});
            var BufWrite=SELF.GetBufFromData("POW_CONNECT5",BufData,1);
            try
            {
                SOCKET.write(BufWrite);
            }
            catch (e)
            {
                ToError(e);
                SOCKET=undefined;
                return;
            }


            SOCKET.on('data', function(data)
            {
                //ToLog("GET:"+data.toString().substr(0,100));
                if(SOCKET.WasClose)
                {
                    return;
                }
                if(!SOCKET.Node)
                {
                    var Buf=SELF.GetDataFromBuf(data);
                    if(Buf)
                    {
                        SELF.CheckPOWConnect(SOCKET,Buf.Data);
                        SOCKET.ConnectToServer=0;
                        return;//ok
                    }
                    CloseSocket(SOCKET,"=SERVER ON DATA=");
                }
                else
                {
                    socketRead(SOCKET,data);
                    SELF.OnGetFromTCP(SOCKET.Node,SOCKET,data);
                }
            });

            SOCKET.on('end', () =>
            {
                if(SocketStatus(SOCKET))
                    ToLog("Get socket end *"+SOCKET.ConnectID+" from client Stat: "+SocketStatistic(SOCKET));

                var Node=SOCKET.Node;
                if(Node && SocketStatus(SOCKET)===200)
                {
                    Node.SwapSockets();
                    SOCKET.WasClose=1;
                }

            });
            SOCKET.on('close', (err) =>
            {
                if(SOCKET.ConnectID && SocketStatus(SOCKET))
                     ToLog("Get socket close *"+SOCKET.ConnectID+" from client Stat: "+SocketStatistic(SOCKET));

                if(!SOCKET.WasClose && SOCKET.Node)
                {
                    //SOCKET.Node.CloseNode();
                    CloseSocket(SOCKET,"GET CLOSE");
                }
                SetSocketStatus(SOCKET,0);
            });
            SOCKET.on('error', (err) =>
            {
                ADD_TO_STAT("ERRORS");
                CloseSocket(SOCKET,"ERRORS");


                if(SOCKET.Node)
                    SELF.AddCheckErrCount(SOCKET.Node,1,"ERR##2 : socket");
                ToError("ERR##2 : socket="+SOCKET.ConnectID+"  SocketStatus="+SocketStatus(SOCKET));
                ToError(err);
            });


        });

        this.Server.on('close', () =>
        {
        });

        this.Server.on('error', (err) =>
        {
            ADD_TO_STAT("ERRORS");
            ToError("ERR##3");
            ToError(err);
        });




        //this.Server.on('error', SELF.OnError);

        this.Server.listen(START_PORT_NUMBER, '0.0.0.0', () =>
        {
            this.CanSend++;
            ToLog("Run TCP server on port:"+START_PORT_NUMBER+"  for: "+SELF.addrStr);
        });

        this.FindInternetIP()

        //throw  new Error("GO!!")

    }



    FindInternetIP()
    {
        //ToLog("USE_GLOBAL_IP:"+USE_GLOBAL_IP)
        if(!USE_GLOBAL_IP)
        {
            this.CanSend++;
            return;
        }



        let SELF=this;
        const { STUN_BINDING_REQUEST, STUN_ATTR_XOR_MAPPED_ADDRESS } = stun.constants;
        const server = stun.createServer(this.Net4);
        const request = stun.createMessage(STUN_BINDING_REQUEST);


        server.on('error', (err) =>
        {
            SELF.CanSend++;
        });
        server.once('bindingResponse', stunMsg =>
        {
            var value=stunMsg.getAttribute(STUN_ATTR_XOR_MAPPED_ADDRESS).value;
            ToLog("INTERNET IP:"+value.address+":"+value.port)
            SELF.ip=value.address;
            SELF.CanSend++;

            if(SELF.Net4)
            {
                SELF.port=value.port;
                SELF.Net4.setRecvBufferSize(UDP_BUF_SIZE);
                SELF.Net4.setSendBufferSize(UDP_BUF_SIZE);
            }
            else
            {
                SELF.port=START_PORT_NUMBER;
            }

            server.close()
        })

        //TODO
        server.send(request, 19302, 'stun.l.google.com')

    }


    CLOSE_SOCKET(Context,CurTime)
    {
        ToLog("GET CLOSE_SOCKET *"+Context.Socket.ConnectID+": "+Context.Data.toString())
        CloseSocket(Context.Socket,"CLOSE_SOCKET");
    }

    SendCloseSocket(Socket,Str)
    {
        //var address=Socket.address();
        TO_ERROR_LOG("TRANSPORT",600,"CLOSE_SOCKET "+Socket.remoteAddress+":"+Socket.remotePort+" - "+Str);
        if(Socket.WasClose)
        {
            return;
        }
        this.AddCheckErrCount(Socket.Node,1,"SendCloseSocket");

        if(Socket.Node && Socket.Node.BufWrite && Socket.Node.BufWrite.length>0)
        {

        }
        else
        {
            ToLog("END *"+Socket.ConnectID+": "+Str)
            Socket.end(this.GetBufFromData("CLOSE_SOCKET",Str,2));
        }
        CloseSocket(Socket,Str);
     }

    AddCheckErrCount(Node,Count,StrError)
    {
        if(!Node)
            return;
        if(!Count)
            Count=1;

        Node.ErrCount+=Count;
        if(Node.ErrCount>=10)
        {

            ToErrorTrace("AddCheckErrCount>10 - CloseSocket, StrError: "+StrError+" "+NodeInfo(Node)+"\n");
            ADD_TO_STAT("ERRORS");


            //TODO - Ban node

            this.DeleteNodeFromWhite(Node);
            Node.ErrCount=0;
        }
    }






};



function CalcStatArr(arr,arrAvg,arrNext,Period)
{
    var arrSum=[arr[0]];
    for(var i=1;i<arr.length;i++)
    {
        arrSum[i]=arrSum[i-1]+arr[i];
    }
//        var Avg=arrSum[arrSum.length-1]/arrSum.length;
//        console.log("Avg="+Avg)

    for(var i=0;i<arrSum.length;i++)
    {
        if(i<Period)
            arrAvg[i]=Math.floor(arrSum[i]/(i+1));
        else
        {
            arrAvg[i]=Math.floor((arrSum[i]-arrSum[i-Period])/Period);
        }
    }
    //console.log("arrAvg="+arrAvg[arrAvg.length-1])

    arrNext[0]=0;
    for(var i=1;i<arrAvg.length;i++)
    {
        var Avg=arrSum[i]/(i+1);
        var minValue=Avg/20;

        var Value1=arrAvg[i-1];
        var Value2=arrAvg[i];
        if(Value1<minValue)
            Value1=minValue;
        if(Value2<minValue)
            Value2=minValue;

        var KLast=Math.floor(100*(Value2-Value1)/Value1)/100;
        var AvgLast=arrAvg[i];
        if(Avg>AvgLast)
            AvgLast=Avg;


        if(KLast>2.0)
            KLast=2.0;
        if(KLast<-0.0)
            KLast=-0.0;


        arrNext[i]=AvgLast*(1+KLast);


        var AvgMax=0;
        if(0)
            if(i>1*Period)
            {
                for(var j=i-Period/2;j<=i;j++)
                    if(arrAvg[j]>AvgMax)
                        AvgMax=arrAvg[j];
            }
        //if(AvgMax>arrNext[i])                arrNext[i]=AvgMax;

    }


    return arrNext[arrNext.length-1];
}


function TestTest()
{
    //var arr=[0,0,54826,0,0,0,544,200,88,0,0,181,54826,0,0,0,544,200,0,0,0,0,55007,0,0,0,544,200,0,0,0,181,54826,256,0,0,544,200,0,0,0,0,54826,0,0,0,544,200,0];
    //var arr=[10,20,10,30,0,0,0,0,0,0,0,0,10,20,50,20,50,10,10];
    //var arr=[0,0,54826,200,0,0,3653,0,861,0,0,0,54826,200,0,0,229,88,877,0,0,0,0,55026,0,0,225,88,891,0,88,0,54826,200,0,0,2240,312,890,0,0,0,54922,200,0,0,0,233,979,0];
    //var arr=[55006,256,0,0,571,0,0,0,0,380,54826,0,0,0,571,0,0,0,0,200,55006,0,0,0,571,0,0,0,0,380,54826,0,0,0,571,0,0,0,0,200,54826,0,0,0,571,0,0,88,0,200];
    var arr=[694,0,55660,296,107554,0,860,0,0,0,248,96,55320,542,107553,0,948,0,0,406,0,593,54826,537,107555,0,860,0,0,0,0,0,55582,392,227,107576,878,0,0,0,0,249,55170,772,225,242,107557];//,926,166,0,0];
    var Period=10;
    var arrAvg=[],arrK=[];
    var valNext=CalcStatArr(arr,arrAvg,arrK,Period);
    console.log(JSON.stringify(arr));
    // console.log(JSON.stringify(arrSum));
    console.log("-----------------");
    console.log(JSON.stringify(arrAvg));
    console.log("-----------------");
    console.log(JSON.stringify(arrK));

    console.log("valNext="+valNext);
    //экстраполяция
    //JSON.stringify(Node.arrSave)

}


