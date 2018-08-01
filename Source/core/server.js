"use strict";
//Copyright: Yuriy Ivanov, 2017 e-mail: progr76@gmail.com

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
global.MAX_CONNECTION_ACTIVE=40;
var MAX_CONNECTION_ANOTHER=40;



const TRAFIC_LIMIT_NODE_1S=MAX_BLOCK_SIZE*1.25;
const TRAFIC_LIMIT_1S=8*TRAFIC_LIMIT_NODE_1S; //+1 for block channel


global.STAT_PERIOD=CONSENSUS_PERIOD_TIME/5;
const TRAFIC_LIMIT_SEND=TRAFIC_LIMIT_1S*STAT_PERIOD/1000;
const TRAFIC_LIMIT_NODE=TRAFIC_LIMIT_NODE_1S*STAT_PERIOD/1000;
const BUF_PACKET_SIZE=16*1024;


global.MAX_PACKET_LENGTH=1.5*1000000;//1Mb

global.FORMAT_POW_TO_CLIENT="{addrArr:hash,HashRND:hash,MIN_POWER_POW_HANDSHAKE:uint,Reserve:arr100}";
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
        SendBytes:uint,\
        PubKeyType:byte,\
        Sign:arr64,\
        Reserve:arr35\
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




//network-library
module.exports = class CTransport extends require("./connect")
{
    constructor(SetKeyPair,RunIP,RunPort,UseRNDHeader,bVirtual)
    {
        super(SetKeyPair,RunIP,RunPort,UseRNDHeader,bVirtual)



        this.UseRNDHeader=UseRNDHeader;

        this.AnotherHostsFlood={Count:0, MaxCount:MAX_CONNECTION_ANOTHER, Time:GetCurrentTime()};
        this.BAN_IP={};    //ip

        this.ip=RunIP;
        this.port=RunPort;




        this.CanSend=0;
        if(global.NET_WORK_MODE)
            this.CanSend++;

        this.SendFormatMap={};

        this.ActualNodes=new RBTree(function (a,b)
        {
            if(a.Prioritet!==b.Prioritet)
                return a.Prioritet-b.Prioritet;
            return CompareArr(a.addrArr,b.addrArr)
        });
        this.SendTrafficFree=0;


        setInterval(this.DoLoadBuf.bind(this),1);
        this.LoadBuf=new RBTree(function (a,b)
        {
            return a.Prioritet-b.Prioritet;
        });


        setInterval(this.DoHardPacketForSend.bind(this),2);
        this.HardPacketForSend=new RBTree(function (a,b)
        {
            return b.PacketNum-a.PacketNum;
        });


        setInterval(this.DoSendPacket.bind(this),2);
        setInterval(this.DoSendBuf.bind(this),1);


        var Map={};
        this.MethodPrioritet=Map;
        MethodPrioritet:
        {
            Map["STARTBLOCK"]=  {Prioritet:10,Period:1000};
            Map["TRANSFER"]=    {Prioritet:10,Period:1000};
            Map["GETTRANSFER"]= {Prioritet:20,Period:1000};
            Map["CONTROLHASH"]= {Prioritet:10,Period:500};
            //Map["OKCONTROLHASH"]= {Prioritet:10,Period:1000};

            Map["PING"]=        {Prioritet:50,Period:1000};
            Map["PONG"]=        {Prioritet:50,Period:0};
            Map["GETNODES"]=    {Prioritet:50,Period:1000};
            Map["RETGETNODES"]= {Prioritet:50,Period:0};

            Map["ADDLEVELCONNECT"]=     {Prioritet:100,Period:1000};
            Map["RETADDLEVELCONNECT"]=  {Prioritet:100,Period:0};
            Map["GETHOTLEVELS"]=        {Prioritet:100,Period:1000};
            Map["RETGETHOTLEVELS"]=     {Prioritet:100,Period:0};
            Map["DISCONNECTHOT"]=       {Prioritet:100,Period:1000};


            Map["GETMESSAGE"]=          {Prioritet:400,Period:1000};
            Map["MESSAGE"]=             {Prioritet:450,Period:1000};
            Map["TRANSACTION"]=         {Prioritet:450,Period:PERIOD_HARD_SEND_TASK};



            //Map["CANBLOCK"]=500;
            Map["GETBLOCKHEADER"]=      {Prioritet:450,Period:PERIOD_HARD_SEND_TASK};
            Map["GETBLOCK"]=            {Prioritet:450,Period:PERIOD_HARD_SEND_TASK};
            Map["GETCODE"]=             {Prioritet:450,Period:PERIOD_HARD_SEND_TASK};



            //Map["BLOCKHEADER"]=800;
            Map["RETBLOCKHEADER"]={Prioritet:900,Period:0};
            Map["RETGETBLOCK"]={Prioritet:950,Period:0};
            Map["RETCODE"]={Prioritet:970,Period:0};
        }




        if(!this.VirtualMode)
            this.StartServer();

        this.CurrentTimeStart=0;
        this.CurrentTimeValues={};


        this.LoadNodesFromFile();
    }

    GetF(Method,bSend)
    {
        var name=Method+"-"+bSend;
        var format=this.SendFormatMap[name];
        if(!format)
        {
            var F=this.constructor[Method+"_F"];
            if(typeof F==="function")
            {
                format=
                    {
                        struct: F(bSend),
                        length: 8096,
                        wrk:{}
                    };
            }
            else
            {
                format="{}";
            }
            this.SendFormatMap[name]=format;
        }
        return format;
    }
    SendF(Node,Info,Length)
    {
        var format=this.GetF(Info.Method,true);
        if(!Length)
            Length=format.length;
        Info.Data=BufLib.GetBufferFromObject(Info.Data,format.struct,Length,format.wrk)

        this.Send(Node,Info,1);
    }
    DataFromF(Info,bSendFormat)
    {
        var format=this.GetF(Info.Method,bSendFormat);
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
        //var HardSendCount=0;
        this.SendTrafficFree=TRAFIC_LIMIT_SEND;
        var it=this.ActualNodes.iterator(), Node;
        while((Node = it.next()) !== null)
        {
            // if(!Node.arrSave)
            //     Node.arrSave=[];
            // Node.arrSave.push(Node.BufWriteLength);


            //Hard
            // var WantHardTraffic=Node.WantHardTraffic;
            // Node.WantHardTraffic=0;
            // Node.CanHardTraffic=0
            // if(HardSendCount<1)
            // {
            //     var arr=Node.WantHardTrafficArr;
            //     arr.push(WantHardTraffic);
            //     if(arr.length>3*Period)
            //     {
            //         arr.shift();
            //         var SumArr=0;
            //         for(var i=0;i<arr.length;i++)
            //             SumArr+=arr[i];
            //         if(SumArr)
            //         {
            //             Node.CanHardTraffic=1;
            //             HardSendCount++;
            //         }
            //     }
            // }
            //
            //
            // if(Node.CanHardTraffic)
            // {
            //     //from extra channel
            //     Node.SendTrafficLimit=TRAFIC_LIMIT_NODE;
            // }
            // else
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
            ADD_TO_STAT("MAX:NODE_TRAFFIC_LIMIT:"+NodeName(Node),1000/STAT_PERIOD*Node.SendTrafficLimit/1024,1);
        }

        //if(!HardSendCount)
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
            TO_DEBUG_LOG("GET:"+Info.Method+Str+" from: Node="+NodeInfo(Info.Node));
        }


        if(global.ADDRLIST_MODE)
        {
            var StrOK=",HAND,GETNODES,";
            if(StrOK.indexOf(","+Info.Method+",")===-1)
                return;
        }


        Info.Node.LastTime=CurTime-0;


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

    GetActualNodes()
    {
        var Arr=[];
        var it=this.ActualNodes.iterator(), Item;
        while((Item = it.next()) !== null)
        {
            if(GetSocketStatus(Item.Socket)>=100)
                Arr.push(Item);
            else
            {
                this.DeleteNodeFromActive(Item);
            }
        }
        return Arr;
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
        if(Node && Node.Active)
        {
            name="Active";
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
        this.BAN_IP[Key]={Errors:1000000,TimeTo:(GetCurrentTime(0)-0)+600*1000,BanDelta:1000};
        ToLog("ADD TO BAN: "+Key);
        ADD_TO_STAT("AddToBanIP");
    }
    AddToBan(Node)
    {
        if(global.NeedRestart)
            return;
        return;

        Node.IsBan=true;
        this.DeleteNodeFromActive(Node);

        var Key=""+Node.ip;
        this.BAN_IP[Key]={Errors:1000000,TimeTo:(GetCurrentTime(0)-0)+600*1000,BanDelta:1000};
        //ToLogTrace("ADD TO BAN: "+Key);
        ToLog("ADD TO BAN: "+NodeName(Node));
        ADD_TO_STAT("AddToBan");
    }
    NodeInBan(Node)
    {
        return this.WasBan({address:Node.ip});
    }

    WasBan(rinfo, decrError)
    {
        var Key=""+rinfo.address;
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
        ToLogClient("Run UDP server on port: "+START_PORT_NUMBER);//+"  for: "+this.addrStr);
        this.CanSend++;
    }



    //TCP


    OnPacketTCP(Meta)
    {
        var startTime=process.hrtime();

        ADD_TO_STAT("USEPACKET");
        var CurTime=GetCurrentTime();
        Meta.Node.LastTime=CurTime-0;
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
            return 0;

        var startTime = process.hrtime();
        ADD_TO_STAT("GETDATA(KB)",buf.length/1024);
        ADD_TO_STAT("GETDATA(KB):"+NodeName(Node),buf.length/1024,1);




        var Buf=this.GetDataFromBuf(buf);
        if(!Buf)
        {
            this.SendCloseSocket(Socket,"FORMAT_PACKET_SEND_TCP");
            return 0;
        }

        var Param=this.MethodPrioritet[Buf.Method];
        if(this.StopDoSendPacket(Param,Node,Buf.Method))
        {
            return 1;
        }



        ADD_TO_STAT("GET:"+Buf.Method);
        ADD_TO_STAT("GET:(KB)"+Buf.Method,buf.length/1024);
        ADD_TO_STAT("GET:"+Buf.Method+":"+NodeName(Node),1,1);

        if(!IsZeroArr(Buf.ContextID))
        {
            Buf.Context=this.ContextPackets.LoadValue(Buf.ContextID);
        }

        if(!Buf.Context)
        {
            if(Param && Param.Period===0 && Buf.Method!=="RETBLOCKHEADER")
            {
                //ToLog("NO Buf.Context "+Buf.Method+" from: "+NodeName(Node)+" context="+GetHexFromArr(Buf.ContextID));
                this.AddCheckErrCount(Node,1);
                return;
            }
            Buf.Context={};
        }
        Buf.Context.ContextID=Buf.ContextID;

        Buf.Node=Node;
        Buf.Socket=Socket;

        if(!global.ADDRLIST_MODE || Param.Prioritet===50)
        {
            this.OnPacketTCP(Buf);
        }

        ADD_TO_STAT_TIME("TIMEDOGETDATA", startTime);
        return 1;
    }


    DoHardPacketForSend()
    {
        this.DoHardPacketForSendNext();
        // if(0)
        // for(var i=0;i<100;i++)
        // {
        //     this.DoHardPacketForSendNext();
        // }
    }
    DoHardPacketForSendNext()
    {
        var Info=this.HardPacketForSend.min();
        if(!Info)
            return;

        if(Info.Node.CanHardTraffic)
        {
            this.HardPacketForSend.remove(Info);
            this.OnPacketTCP(Info);
        }

        while(Info=this.HardPacketForSend.max())
        {
            var DeltaTime=(new Date)-Info.LoadTimeNum;
            if(DeltaTime>PACKET_ALIVE_PERIOD/2 || !Info.Node.Socket || Info.Node.Socket.WasClose)
            {
                this.HardPacketForSend.remove(Info);
                ADD_TO_STAT("DELETE_OLD_HARD_PACKET:"+Info.Method);
                TO_DEBUG_LOG("Delete old load packet: "+Info.Method);
            }
            else
            {
                break;
            }
        }
    }


    StopDoSendPacket(Param,Node,Name)
    {
        return 0;
        var CurTime=GetCurrentTime(0)-0;

        if(!Param)
        {
            ToLog("Not find method: "+Name)
            this.AddCheckErrCount(Node,1);
            return 1;
        }

        var ArrTime=Node.TimeMap[Name];
        if(!ArrTime)
        {
            ArrTime=[0,0,0,0];
            Node.TimeMap[Name]=ArrTime;
        }

        ArrTime.sort(function (a,b) {return a-b;});

        var Delta=CurTime-ArrTime[0];
        if(Delta<Param.Period)
        {
            ADD_TO_STAT("STOP_METHOD");

            var Delta2=CurTime-ArrTime[1];

            ToLog("STOP_METHOD: "+Name+" from "+NodeName(Node)+"  delta: "+Delta+","+Delta2+" ms")
            this.AddCheckErrCount(Node,1);
            return 1;
        }


        ArrTime[0]=CurTime;
        return 0;
    }


    //SEND
    Send(Node,Info,TypeData)
    {
        if(!Node.Socket)
        {
            this.DeleteNodeFromActive(Node);
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
                if(DeltaTime>PACKET_ALIVE_PERIOD/2)//trigger
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

            ADD_TO_STAT("MAX:NODE_BUF_WRITE:"+NodeName(Node),Node.BufWrite.length/1024,1);
            ADD_TO_STAT("MAX:NODE_SEND_BUF_PACKET_COUNT:"+NodeName(Node),Node.SendPacket.size,1);

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
            ADD_TO_STAT("SEND:(KB)"+Info.Method,BufWrite.length/1024);

            ADD_TO_STAT("SEND:"+Info.Method+":"+NodeName(Node),1,1);
            TO_DEBUG_LOG("SEND "+Info.Method+" to "+NodeInfo(Node)+" LENGTH="+BufWrite.length);

            //ToLog("SEND "+Info.Method+"  ContextID="+GetHexFromAddres(Info.ContextID))
        }
        else
        {
            ADD_TO_STAT("SEND_ERROR");
            this.AddCheckErrCount(Node,0.005,"NODE STATUS="+Node.ConnectStatus());
        }
    }


    DoSendBuf()
    {
        this.RecalcSendStatictic();
        //ADD_TO_STAT("DOSENDBUF",1);
        var CountNodeSend=0;
        var it=this.ActualNodes.iterator(), Node;
        NEXT_NODE:
        while((Node = it.next()) !== null)
        if(Node.Socket && Node.ConnectStatus()===100)
        if(Node.BufWrite.length>0)
        {
            CountNodeSend++;

            var CountSend=Math.min(BUF_PACKET_SIZE,Node.BufWrite.length);
            var Value=CountSend/1024;

            if(global.LIMIT_SEND_TRAFIC)
            {
                var CanCountSend=Node.SendTrafficLimit-Node.SendTrafficCurrent;
                if(CanCountSend<CountSend)
                {
                    //ADD_TO_STAT("DO_LIMIT_SENDDATA:"+NodeName(Node),Value);

                    if(this.SendTrafficFree<CountSend)
                    {
                        ADD_TO_STAT("LIMIT_SENDDATA:"+NodeName(Node),Value,1);
                        continue NEXT_NODE;
                    }

                    this.SendTrafficFree-=CountSend;
                }
            }





            //Node.Socket.write(Node.BufWrite.slice(0,CountSend));
            Node.write(Node.BufWrite.slice(0,CountSend));

            Node.SendTrafficCurrent+=CountSend;
            Node.BufWrite=Node.BufWrite.slice(CountSend);



            this.ADD_CURRENT_STAT_TIME("SEND_DATA",Value);
            ADD_TO_STAT("SENDDATA(KB)",Value);
            ADD_TO_STAT("SENDDATA(KB):"+NodeName(Node),Value,1);
        }


        if(!CountNodeSend)
            this.DoCalcPow();
    }


    DoCalcPow()
    {
        if(!this.MiningBlock)
            return;

        if(!global.USE_MINING)
            return;

        if(this.LoadBuf.size)
            return;
        if(this.HardPacketForSend.size)
            return;

        if(this.PrevWasMining)
        {
            this.PrevWasMining=0;
            return;
        }

        this.PrevWasMining=1;
        this.CreatePOWNext(this.MiningBlock,(1<<MIN_POWER_POW_BL));

        ADD_TO_STAT("MINING-COUNT",1);
    }


    CheckPOWTicketConnect(Socket,data)
    {
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

        if(Pow.DEF_NETWORK!==GetNetworkName())
        {
            this.SendCloseSocket(Socket,"DEF_NETWORK="+Pow.DEF_NETWORK+" MUST:"+GetNetworkName());
            //this.AddToBanIP(Socket.remoteAddress);
            return;
        }

        var Node;
        var Hash=shaarr2(this.addrArr,Socket.HashRND);
        var hashPow=GetHashWithValues(Hash,Pow.nonce,0);
        var power=GetPowPower(hashPow);


        if(Pow.Reconnect)
        {
            Node=this.FindRunNodeContext(Pow.addrArr,Pow.FromIP,Pow.FromPort,true);
            if(Node.WaitConnectFromServer)
            {
                Node.NextConnectDelta=1000;
                Node.WaitConnectFromServer=0;
                //Node.DirectIP=1;
                ToLogNet("3. ******************** SERVER OK CONNECT  for client node: "+NodeInfo(Node)+" "+SocketInfo(Socket));
                this.AddNodeToActive(Node);
                Node.Socket=Socket;
                SetSocketStatus(Socket,3);
                SetSocketStatus(Socket,100);
                Socket.Node=Node;

                Socket.write(this.GetBufFromData("POW_CONNECT0","OK",2));
                return;
            }
            if(!Node.Socket)
            {
                CloseSocket(Socket,"Reconnect fail - not prev connection");
                return;
            }


            //TODO - Sign
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
            return;
        }
        else
        {
            // var Result=false;
            // if(Pow.PubKeyType===2 || Pow.PubKeyType===3)
            //     Result=secp256k1.verify(Buffer.from(Hash), Buffer.from(Pow.Sign), Buffer.from([Pow.PubKeyType].concat(Pow.addrArr)));
            // if(!Result)
            // {
            //     ToLog("END: ERROR_SIGN_HANDSHAKE")
            //     Socket.end(this.GetBufFromData("POW_CONNECT8","ERROR_SIGN_HANDSHAKE",2));
            //     CloseSocket(Socket,"ERROR_SIGN_HANDSHAKE");
            //     return;
            // }


            Node=this.FindRunNodeContext(Pow.addrArr,Pow.FromIP,Pow.FromPort,true);


            if(0 && global.NET_WORK_MODE && NET_WORK_MODE.NodeWhiteList)//WhiteConnect by filter
            {
                var Index=NET_WORK_MODE.NodeWhiteList.indexOf(Node.addrStr);


                if(Index>=0)
                {
                    Node.WhiteConnect=1;
                    Node.NextConnectDelta=1000;
                    Node.WaitConnectFromServer=0;
                    //Node.DirectIP=1;
                    ToLogNet("3. ******************** SERVER OK CONNECT  for client node: "+NodeInfo(Node)+" "+SocketInfo(Socket));
                    this.AddNodeToActive(Node);
                    Node.Socket=Socket;
                    SetSocketStatus(Socket,3);
                    SetSocketStatus(Socket,100);
                    Socket.Node=Node;

                    Socket.write(this.GetBufFromData("POW_CONNECT5","OK",2));
                    return;

                }

            }


            ToLogNet("1. -------------------- SERVER OK POW for client node: "+NodeInfo(Node)+" "+SocketInfo(Socket));

            // if(Node.DoubleConnectCount>5 && Node.Socket && !Node.Socket.WasClose)
            // {
            //     CloseSocket(Node.Socket,"Node.DoubleConnectCount>5");
            //     Node.Socket=undefined;
            //     Node.DoubleConnectCount=0;
            // }

            // //Node.NextConnectDelta=1000;
            // if(Node.Socket && !Node.Socket.WasClose)// && Socket!==Node.Socket)
            // {
            //     if(GetSocketStatus(Node.Socket)===100
            //     || (Node.Socket.ConnectToServer && CompareArr(this.addrArr,Node.addrArr)<0))//встречный запрос соединения
            //     {
            //         Node.DoubleConnectCount++;
            //         ToLog("Find double connection *"+Socket.ConnectID+" "+NodeInfo(Node)+" from client  NodeSocketStatus="+GetSocketStatus(Node.Socket))
            //         Socket.write(this.GetBufFromData("POW_CONNECT3","DOUBLE",2));
            //         return;
            //     }
            //     else
            //     {
            //         ToLog("Close double connection *"+Node.Socket.ConnectID+" "+NodeInfo(Node)+" from server NodeSocketStatus="+GetSocketStatus(Node.Socket))
            //         CloseSocket(Node.Socket,"Close double connection");
            //     }
            // }
            // else
            // {
            // }
            // this.AddNodeToActive(Node);
            //
            // if(Node.Socket)
            //     CloseSocket(Node.Socket,"Close prev connection: "+SocketStatistic(Node.Socket)+"  Status:"+GetSocketStatus(Node.Socket));

            Node.FromIP=Pow.FromIP;
            Node.FromPort=Pow.FromPort;

            if(!Node.WasAddToReconnect)
            {
                Node.WasAddToReconnect=1;
                Node.ReconnectFromServer=1;
                global.ArrReconnect.push(Node);
            }
            Socket.write(this.GetBufFromData("POW_CONNECT4","WAIT_CONNECT_FROM_SERVER",2));

        }
    }




    StopServer()
    {
        if(this.Server)
            this.Server.close();
    }
    StartServer()
    {
        if(global.NET_WORK_MODE && !NET_WORK_MODE.UseDirectIP)
        {
            this.CanSend++;
            return;
        }


        let SELF=this;

        this.Server = net.createServer
        ((sock) =>
        {

            if(SELF.WasBan({address:sock.remoteAddress}))
            {
                sock.ConnectID="new";
                CloseSocket(sock,"WAS BAN",true);
                return;
            }


            let SOCKET=sock;
            socketInit(SOCKET,"c");
            SetSocketStatus(SOCKET,0);



            // 'connection' listener
            ToLogNet("Client *"+SOCKET.ConnectID+" connected from "+SOCKET.remoteAddress+":"+SOCKET.remotePort);
            ADD_TO_STAT("ClientConnected");


            SOCKET.HashRND=crypto.randomBytes(32);
            var BufData=BufLib.GetBufferFromObject({addrArr:SELF.addrArr,HashRND:SOCKET.HashRND,MIN_POWER_POW_HANDSHAKE:MIN_POWER_POW_HANDSHAKE, Reserve:[]},FORMAT_POW_TO_CLIENT,300,{});
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
                        SELF.CheckPOWTicketConnect(SOCKET,Buf.Data);
                        SOCKET.ConnectToServer=0;
                        return;//ok or was close
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
                ADD_TO_STAT("ClientEnd");

                var Status=GetSocketStatus(SOCKET);
                if(Status)
                    ToLogNet("Get socket end *"+SOCKET.ConnectID+" from client Stat: "+SocketStatistic(SOCKET));

                var Node=SOCKET.Node;
                if(Node && Status===200)
                {
                    Node.SwapSockets();
                    SOCKET.WasClose=1;
                }

            });
            SOCKET.on('close', (err) =>
            {
                ADD_TO_STAT("ClientClose");

                if(SOCKET.ConnectID && GetSocketStatus(SOCKET))
                    ToLogNet("Get socket close *"+SOCKET.ConnectID+" from client Stat: "+SocketStatistic(SOCKET));

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
                ToError("ERR##2 : socket="+SOCKET.ConnectID+"  SocketStatus="+GetSocketStatus(SOCKET));
                //ToError(err);
            });


        });

        this.Server.on('close', () =>
        {
        });

        this.Server.on('error', (err) =>
        {
            if (err.code === 'EADDRINUSE')
            {
                ToLogClient('Port '+SELF.port+' in use, retrying...');
                SELF.Server.close();
                setTimeout(() =>
                {
                    SELF.RunListenServer();
                }, 5000);
                return;
            }

            ADD_TO_STAT("ERRORS");
            ToError("ERR##3");
            //ToError(err);
        });




        this.RunListenServer();


        if(!global.NET_WORK_MODE)
            this.FindInternetIP();
    }

    RunListenServer()
    {
        if(!START_PORT_NUMBER || START_PORT_NUMBER==="undefined")
            START_PORT_NUMBER=30000;

        let SELF=this;
        SELF.port=START_PORT_NUMBER;
        ToLogClient("Prepare to run TCP server on port: "+SELF.port);
        this.Server.listen(SELF.port, '0.0.0.0', () =>
        {
            if(SELF.CanSend<2)
                ToLogClient("Run TCP server on port: "+SELF.port);
            SELF.CanSend++;
        });

    }



    FindInternetIP()
    {
        let SELF=this;
        const { STUN_BINDING_REQUEST, STUN_ATTR_XOR_MAPPED_ADDRESS } = stun.constants;
        let server = stun.createServer(this.Net4);
        const request = stun.createMessage(STUN_BINDING_REQUEST);



        server.on('error', (err) =>
        {
            SELF.CanSend++;
        });
        server.once('bindingResponse', stunMsg =>
        {
            var value=stunMsg.getAttribute(STUN_ATTR_XOR_MAPPED_ADDRESS).value;
            ToLog("INTERNET IP:"+value.address)
            SELF.CanSend++;
            global.INTERNET_IP_FROM_STUN=value.address;
            if(!SELF.ip)
                SELF.ip=INTERNET_IP_FROM_STUN;

            // SELF.ip=value.address;
            // if(SELF.Net4)//UDP
            // {
            //     SELF.port=value.port;
            //     SELF.Net4.setRecvBufferSize(UDP_BUF_SIZE);
            //     SELF.Net4.setSendBufferSize(UDP_BUF_SIZE);
            // }
            // else
            // {
            //     SELF.port=START_PORT_NUMBER;
            // }
            //
            // if(!global.NET_WORK_MODE)
            //     global.NET_WORK_MODE={};
            // NET_WORK_MODE.StunIP=true;

            server.close()
        })


        var StrStunAddr='stun.l.google.com';
        const dns = require('dns');
        dns.lookup(StrStunAddr, (err, address, family) =>
        {
            if(!err)
                server.send(request, 19302, StrStunAddr);
            else
                SELF.CanSend++;

        });

    }


    CLOSE_SOCKET(Context,CurTime)
    {
        ToLogNet("GET CLOSE_SOCKET *"+Context.Socket.ConnectID+": "+Context.Data.toString())
        CloseSocket(Context.Socket,"CLOSE_SOCKET");
    }

    SendCloseSocket(Socket,Str)
    {
        //var address=Socket.address();
        ToLogNet("CLOSE_SOCKET "+SocketInfo(Socket)+" - "+Str);
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
            ToLogNet("END *"+Socket.ConnectID+": "+Str)
            Socket.end(this.GetBufFromData("CLOSE_SOCKET",Str,2));
        }
        CloseSocket(Socket,Str);
     }

    AddCheckErrCount(Node,Count)
    {
        if(!Node)
            return;
        if(!Count)
            Count=1;

        Node.ErrCount+=Count;
        if(Node.ErrCount>=2)
        {
            Node.ErrCount=0;
            ADD_TO_STAT("ERRORS");


            Node.BlockProcessCount--;
            if(Node.BlockProcessCount<0)
            {
                this.AddToBan(Node);
            }
            else
            {
                this.DeleteNodeFromActive(Node);
            }
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

