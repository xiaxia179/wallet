"use strict";
/**
 * Copyright: Yuriy Ivanov, 2017,2018 e-mail: progr76@gmail.com
 */

require("./library.js");

// require("./crypto-library");
// const crypto = require('crypto');

const RBTree = require('bintrees').RBTree;
const net=require("net");

global.MAX_WAIT_PERIOD_FOR_STATUS=10000;

var ConnectIDCount=1;

module.exports = class CNode
{
    constructor(addrStr,ip,port,LastTime,DeltaTime)
    {
        this.addrStr=addrStr;
        this.ip=ip;
        this.port=port;
        this.UserConnect=0;

        if(LastTime)
        {
            this.LastTime=new Date(LastTime);
            this.DeltaTime=DeltaTime;
        }

        this.TryConnectCount=0;
        this.DirectIP=0;
        this.FromIP=undefined;
        this.FromPort=undefined;

        this.Active=false;
        this.Hot=false;
        this.Stage=0;
        this.CanHot=false;

        this.ResetNode();
    }


    ResetNode()
    {

        this.bInit=1;
        this.INFO={};

        this.DoubleConnectCount=0;

        this.NextConnectDelta=1000;

        this.SendBlockArr=[];
        this.LoadBlockArr=[];
        this.SendBlockCount=0;
        this.LoadBlockCount=0;
        this.SendBlockCountAll=0;
        this.LoadBlockCountAll=0;

        this.WantHardTrafficArr=[];
        this.WantHardTraffic=0;
        this.CanHardTraffic=0;

        this.BufWriteLength=0;
        this.BufWrite=Buffer.alloc(0);
        this.SendPacket=new RBTree(function (a,b)
        {
            return b.PacketNum-a.PacketNum;
        });

        this.ConnectCount=0;


        this.TrafficArr=[];

        this.SendTrafficCurrent=0;
        this.SendTrafficLimit=0;



        this.ErrCount=0;
        var Prioritet=(new Date)-0;
        // if(!this.IsInternetIP())
        // {
        //     Prioritet+=100000000000;
        // }
        SERVER.SetNodePrioritet(this,Prioritet);

        this.SendPacketNum=0;
        this.LoadPacketNum=0;

        this.MaxSendProof=0;
        this.PrevMaxSendProof=0;
        this.SendFragmentH=0;
        this.SendFragmentL=0;
        this.FragmentOverflow=0;
        this.LimitFragmentLightSend=0;
        this.LimitFragmentHardSend=0;
        this.SkipFragmentLightSend=0;
        this.SkipFragmentHardSend=0;



        this.Flood=
            {
                Count:1,
                MaxCount:MAX_CONNECTION_ACTIVE,
                Time:GetCurrentTime(0)
            };

    }


    ConnectStatus()
    {
        if(this.Socket)
            return SocketStatus(this.Socket);
        else
            return 0;
    }

    CalcIPType()
    {
        this.DirectIP=this.IsInternetIP();
    }
    IsInternetIP()
    {
        if(this.Socket)
        {
            if(this.Socket.ConnectToServer)
                return 1;
            else
            if(this.FromIP && this.FromPort)
            {
                //var SockAddr=this.Socket.address();
                //if(this.FromIP===SockAddr.address && this.FromPort===SockAddr.port)
                if(this.FromIP===this.Socket.remoteAddress)
                {
                    return 1;
                }
            }
        }
        return 0;
    }

    CreateConnect()
    {
        let NODE=this;
        if(NODE.ConnectStatus())
        {
            if(NODE.ConnectStatus()===100)
                SERVER.AddNodeToActive(NODE);
            return;
        }

        ToLog("===CreateConnect=== to server: "+NODE.ip+":"+NODE.port);


        CloseSocket(NODE.Socket,"CreateConnect");

        this.TryConnectCount++;
        NODE.SocketStart=(new Date)-0;
        NODE.Socket = net.createConnection(NODE.port, NODE.ip, () =>
        {
            this.TryConnectCount=0;

            socketInit(NODE.Socket,"s");
            ToLog("Connected *"+NODE.Socket.ConnectID+" to server: "+NODE.ip+":"+NODE.port);
            NODE.Socket.ConnectToServer=true;
            SetSocketStatus(NODE.Socket,2);
        });
        SetSocketStatus(NODE.Socket,1);
        NODE.Socket.Node=NODE;
        NODE.Socket.ConnectID="~C"+ConnectIDCount;  ConnectIDCount++;

        this.SetEventsProcessing(NODE.Socket,0);
    }

    CreateReconnection()
    {
        let NODE=this;
        ToLog("===CreateReconnection=== to server: "+NODE.ip+":"+NODE.port);

        CloseSocket(NODE.Socket2,"CreateReconnection");

        NODE.SocketStart=(new Date)-0;
        NODE.Socket2 = net.createConnection(NODE.port, NODE.ip, () =>
        {
            socketInit(NODE.Socket2,"s");
            ToLog("Reconnected *"+NODE.Socket2.ConnectID+" to server: "+NODE.ip+":"+NODE.port);
            NODE.Socket2.ConnectToServer=true;
            SetSocketStatus(NODE.Socket2,2);
        });
        SetSocketStatus(NODE.Socket2,1);
        NODE.Socket2.Node=NODE;
        NODE.Socket2.ConnectID="~R"+ConnectIDCount;  ConnectIDCount++;
        this.SetEventsProcessing(NODE.Socket2,1);


    }


    SwapSockets()
    {
        if(!this.Socket2)
            return;

        //ToLog("========SwapSockets")

        var SocketOld=this.Socket;

        this.Socket=this.Socket2;
        this.Socket2=undefined;

        this.Socket.Node=this;
        SetSocketStatus(this.Socket,100);
        this.Socket.Prioritet=SocketOld.Prioritet+1;
        this.Socket.Buf=SocketOld.Buf;
        SERVER.LoadBuf.remove(SocketOld);
        SERVER.LoadBuf.insert(this.Socket);


        SocketOld.Buf=undefined;
        SocketOld.WasClose=1;
        SocketOld.Node=undefined;


        this.ErrCount=0;

    }


    SetEventsProcessing(Socket,Reconnection)
    {
        let SOCKET=Socket;
        let NODE=this;
        let RECONNECTION=Reconnection;

        SOCKET.on('data', (data) =>
        {
            if(Socket.WasClose)
                return;



            if(SocketStatus(SOCKET)===2)
            {
                SetSocketStatus(SOCKET,3);

                var Buf=SERVER.GetDataFromBuf(data);
                if(Buf)
                {
                    var Res=NODE.SendPOWClient(SOCKET,Buf.Data);
                    if(Res)
                    {
                        NODE.DirectIP=1;
                        return;//ok
                    }
                }

                CloseSocket(SOCKET,Buf?"Method="+Buf.Method:"=CLIENT ON DATA=");
            }
            else
            if(SocketStatus(SOCKET)===3)
            {
                var Buf=SERVER.GetDataFromBuf(data);
                if(Buf)
                {
                    var Str=Buf.Data;
                    if(Str==="WAIT_CONNECT_FROM_SERVER")
                    {
                        ToLog("**********************OK POW CLIENT connect to server: "+NodeInfo(this)+" : WAIT_CONNECT_FROM_SERVER")
                        //SetSocketStatus(SOCKET,0);
                        CloseSocket(SOCKET,"WAIT_CONNECT_FROM_SERVER");
                        NODE.WaitConnectFromServer=1;
                    }
                    else
                    if(Str==="OK")
                    {
                        NODE.NextConnectDelta=1000;
                        SetSocketStatus(SOCKET,100);
                        ToLog("**********************OK POW CLIENT connect to server: "+NodeInfo(this))
                        this.NextConnectDelta=1000;

                        if(RECONNECTION)
                        {
                            if(NODE.Socket)
                                SetSocketStatus(NODE.Socket,200);
                        }
                        else
                        {
                            if(!NODE.Active)
                                SERVER.AddNodeToActive(NODE);
                        }

                        return;//ok
                    }
                    else
                    if(Str==="SELF")
                    {
                        NODE.Self=1;
                    }
                    else
                    if(Str==="DOUBLE")
                    {
                    }
                    else
                    {
                        ToLog("ERROR:"+Str);
                    }
                }

                CloseSocket(SOCKET,Buf?"Method="+Buf.Method+":"+Str:"=CLIENT ON DATA=");
            }
            else
            {
                socketRead(Socket,data);
                SERVER.OnGetFromTCP(NODE,Socket,data)
            }
        });
        SOCKET.on('end', () =>
        {
            if(SocketStatus(SOCKET))
                ToLog("Get socket end *"+SOCKET.ConnectID+" from server "+NodeInfo(NODE)+" Stat: "+SocketStatistic(SOCKET));
            if(SocketStatus(SOCKET)===200)
            {
                NODE.SwapSockets();
                SOCKET.WasClose=1;
            }

        });
        SOCKET.on('close', (err) =>
        {
            if(SOCKET.ConnectID && SocketStatus(SOCKET))
                ToLog("Get socket close *"+SOCKET.ConnectID+" from server "+NodeInfo(NODE)+" Stat: "+SocketStatistic(SOCKET));
            if(!SOCKET.WasClose)
            {
                if(SocketStatus(SOCKET)>=2)
                {

                    CloseSocket(SOCKET,"GET CLOSE");

                }
            }

            SetSocketStatus(SOCKET,0);
        });
        SOCKET.on('error', (err) =>
        {

            if(SocketStatus(SOCKET)>=2)
            {
                SERVER.AddCheckErrCount(NODE,1,"ERR##1 : socket");
                ADD_TO_STAT("ERRORS");
                ToError("ERR##1 : socket="+SOCKET.ConnectID+"  SocketStatus="+SocketStatus(SOCKET));
                ToError(err);
            }
        });

    }










    SendPOWClient(Socket,data)
    {
        var Node=this;

        if(Node.ReconnectFromServer)//Connect from ticket
        {
            Node.ReconnectFromServer=0;

            var Pow=this.GetPOWClientData(0);
            Pow.Reconnect=1;

            var BufWrite=BufLib.GetBufferFromObject(Pow,FORMAT_POW_TO_SERVER,1200,{});
            var BufAll=SERVER.GetBufFromData("POW_CONNECT7",BufWrite,1);
            Socket.write(BufAll);
            return 1;
        }




        try
        {
            var Buf=BufLib.GetObjectFromBuffer(data,FORMAT_POW_TO_CLIENT,{});
        }
        catch (e)
        {
            SERVER.SendCloseSocket(Socket,"FORMAT_POW_TO_CLIENT");
            return 0;
        }

        var addrStr=GetHexFromAddres(Buf.addrArr);
        if(Node.addrStrTemp)
        {
            ToLog("Set Addr = "+addrStr+"  for: "+NodeInfo(Node));
            Node.addrStr=addrStr;
            SERVER.CheckNodeMap(Node);
        }


        if(Buf.MIN_POWER_POW>1+MIN_POWER_POW_HANDSHAKE)
        {
            ToLog("BIG MIN_POWER_POW - NOT CONNECTING")
            return 0;
        }

        var TestNode=SERVER.NodesMap[addrStr];
        if(TestNode && TestNode!==Node)
        {

            if(SocketStatus(TestNode.Socket))
            {
                ToLog("DoubleConnection find for: "+NodeInfo(Node));
                Node.DoubleConnection=true;
                return 0;
            }
            else
            {
                ToLog("DoubleConnection find for: "+NodeInfo(TestNode));
                TestNode.DoubleConnection=true;
            }
        }

        Node.addrArr=Buf.addrArr;
        if(CompareArr(SERVER.addrArr,Node.addrArr)===0)
        {
            Node.Self=1;
            return 0;
        }
        var Hash=shaarr2(Buf.addrArr,Buf.HashRND);
        var nonce=CreateNoncePOWExternMinPower(Hash,0,Buf.MIN_POWER_POW);


        var Pow=this.GetPOWClientData(nonce)


        if(Socket!==this.Socket)//Reconnect
        {
            Pow.Reconnect=1;
            Pow.SendBytes=this.Socket.SendBytes;
            SetSocketStatus(this.Socket,200);
        }
        var BufWrite=BufLib.GetBufferFromObject(Pow,FORMAT_POW_TO_SERVER,1200,{});
        var BufAll=SERVER.GetBufFromData("POW_CONNECT6",BufWrite,1);
        Socket.write(BufAll);
        return 1;
    }

    GetPOWClientData(nonce)
    {
        var Node=this;
        var Pow={};

        Pow.DEF_NETWORK=DEF_NETWORK;
        Pow.DEF_VERSION=DEF_VERSION;
        Pow.DEF_CLIENT=DEF_CLIENT;
        Pow.addrArr=SERVER.addrArr;
        Pow.ToIP=Node.ip;
        Pow.ToPort=Node.port;
        Pow.FromIP=SERVER.ip;
        Pow.FromPort=SERVER.port;
        Pow.nonce=nonce;
        Pow.Reconnect=0;
        Pow.SendBytes=0;
        return Pow;
    }





    write(BufWrite)
    {

        socketWrite(this.Socket,BufWrite);

        try
        {
            this.Socket.write(BufWrite);
        }
        catch (e)
        {
            ToError(e);
            this.Socket.WasClose=1;
            this.Socket.SocketStatus=0;
            this.Socket.Node=undefined;
        }

    }
}


global.socketInit=function(Socket,Str)
{
    Socket.GetBytes=0;
    Socket.SendBytes=0;

    Socket.ConnectID=""+ConnectIDCount+Str;
    ConnectIDCount++;
}

global.socketRead=function(Socket,Buf)
{
    Socket.GetBytes+=Buf.length;
}

global.socketWrite=function(Socket,Buf)
{
    Socket.SendBytes+=Buf.length;
}

global.CloseSocket=function(Socket,StrError,bHide)
{
    if(!Socket || Socket.WasClose)
    {
        if(Socket)
            Socket.SocketStatus=0;
        return;
    }

    if(Socket.Node && Socket.Node.Socket2===Socket && Socket.Node.Socket && Socket.Node.Socket.SocketStatus===200)
        SetSocketStatus(Socket.Node.Socket,100);

    var StrNode=NodeInfo(Socket.Node);
    Socket.WasClose=1;
    Socket.SocketStatus=0;
    Socket.Node=undefined;
    Socket.end();
    //Socket.unref();

    if(!bHide)
        ToLog("CLOSE "+StrNode+"  *"+Socket.ConnectID+" - "+StrError);
    //ToLogTrace("CLOSE *"+Socket.ConnectID+" - "+StrError);
}


function SetSocketStatus(Socket,Status)
{
    if(Socket && Socket.SocketStatus!==Status)
    {
        //ToLog("Set Socket *"+Socket.ConnectID+"  Status from "+Socket.SocketStatus+" to "+Status);
        if(Status===100 && (Socket.SocketStatus!==3 && Socket.SocketStatus!==200))
        {
            ToLogTrace("===================ERROR=================== "+Status)
            return;
        }

        Socket.SocketStatus=Status;
        Socket.TimeStatus=(new Date)-0;
    }
}

function SocketStatus(Socket)
{
    if(Socket && Socket.SocketStatus)
    {
        if(Socket.SocketStatus!==100)
        {
            var Delta=(new Date)-Socket.TimeStatus;
            if(Delta>MAX_WAIT_PERIOD_FOR_STATUS)
            {
                CloseSocket(Socket,"MAX_WAIT_PERIOD_FOR_STATUS = "+Socket.SocketStatus+" time = "+Delta);
            }
        }
        return Socket.SocketStatus;
    }
    else
    {
        return 0;
    }
}

function SocketInfo(Socket)
{
    if(Socket)
        return "*"+Socket.ConnectID;
    else
        return "";
}
function SocketStatistic(Socket)
{
    if(!Socket)
        return "";

    var Str="";
    if(!Socket.SendBytes)
        Socket.SendBytes=0;
    if(!Socket.GetBytes)
        Socket.GetBytes=0;

    if(Socket.SendBytes)
        Str+=" Send="+Socket.SendBytes;
    if(Socket.GetBytes)
        Str+=" Get="+Socket.GetBytes;
    if(SocketStatus(Socket))
        Str+=" SocketStatus="+SocketStatus(Socket);
    if(Str==="")
        Str="0";
    return Str;
}
function NodeInfo(Node)
{
    if(Node)
        return ""+Node.ip+":"+Node.port+" "+SocketInfo(Node.Socket);
    else
        return "";
}
global.SocketStatistic=SocketStatistic;
global.SocketStatus=SocketStatus;
global.SetSocketStatus=SetSocketStatus;
global.NodeInfo=NodeInfo;
global.SocketInfo=SocketInfo;

