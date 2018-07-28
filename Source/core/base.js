"use strict";
/**
 * Copyright: Yuriy Ivanov, 2017 e-mail: progr76@gmail.com
 * Created by vtools on 14.12.2017.
 */

require("./library.js");
require("./crypto-library");
const crypto = require('crypto');
const RBTree = require('bintrees').RBTree;
const os = require('os');

global.glStopNode=false;


const MAX_TIME_NETWORK_TRANSPORT=1*1000;//ms
var GlSumUser;
var GlSumSys;
var GlSumIdle;



module.exports = class CCommon
{
    constructor(SetKeyPair,RunIP,RunPort,UseRNDHeader,bVirtual)
    {
        global.SERVER=this;//самый ранний вызов - присваиваем здесь!!!

        this.VirtualMode=bVirtual;

        this.KeyPair=SetKeyPair;
        this.addrArr=SetKeyPair.getPublicKey('','compressed').slice(1);
        this.addrStr=GetHexFromArr(this.addrArr);
        this.HashDBArr=shaarr2(this.KeyPair.getPrivateKey(),[0,0,0,0,0,0,0,1]);


        //this.MetaBuf=new STreeBuffer(MAX_TIME_NETWORK_TRANSPORT,CompareItemHash,"object","PACKETS_LOST");
        //this.MessageReceiveBuf=new STreeBuffer(3600*1000,CompareItemHash,"object");
        this.HistoryBlockBuf=new STreeBuffer(HISTORY_BLOCK_COUNT*1000,CompareItemHashSimple,"string");
        this.TreeKeyBufer=new STreeBuffer(30*1000,CompareItemHash33,"object");

        this.PacketTree=new STreeBuffer(MAX_TIME_NETWORK_TRANSPORT,CompareItemHash32,"object");
        this.LoadedNodes=new STreeBuffer(MAX_TIME_NETWORK_TRANSPORT,CompareItemHash32,"object");
        this.ContextPackets=new STreeBuffer(10*1000,CompareItemHash32,"object");


        // if(!global.ADDRLIST_MODE && !this.VirtualMode)
        // {
        //     setInterval(this.AddStatOnTimer.bind(this),1000);
        // }



    }
    AddStatOnTimer()
    {
        //ToLog("AddStatOnTimer");

        //NET NODES
        var bHasCP=0;
        if(CHECK_POINT.BlockNum)
        {
            var Block=this.ReadBlockHeaderDB(CHECK_POINT.BlockNum);
            if(Block && CompareArr(CHECK_POINT.Hash,Block.Hash)===0)
                bHasCP=1;
        }

        var BufMap={};
        var arr=SERVER.GetActualNodes();
        var Count=0,CountHot=0,CountHotOK=0,CountActualOK=0,SumDeltaHot=0,SumDeltaActual=0,CountCP=0,CountLH=0,CountLevels=0,CountLowLevels=0;
        for(var i=0;i<arr.length;i++)
        {
            var Node=arr[i];
            if(!Node || Node.AddrList)
                continue;
            if(!Node.INFO)
                Node.INFO={};

            if(bHasCP && CHECK_POINT.BlockNum && Node.INFO.CheckPointHashDB && CompareArr(CHECK_POINT.Hash,Node.INFO.CheckPointHashDB)===0)
            {
                CountCP++;
            }
            if(Node.INFO.LoadHistoryMode)
                CountLH++;
            if(Node.Hot && Node.INFO.NodesLevelCount)
                CountLevels+=Node.INFO.NodesLevelCount;
            // if(Node.INFO.NodesLevelCount && Node.INFO.NodesLevelCount<=global.LEV_COUNT)
            //     CountLowLevels++;



            Count++;
            var StrChk=GetCheckAccHash(BufMap,Node.INFO.AccountBlockNum,Node.INFO.AccountsHash);
            var Chck=0;
            if(StrChk.indexOf("=OK=")>=0)
            {
                Chck=1;
            }
            var DeltaTime=Node.DeltaTime;
            if(!DeltaTime)
                DeltaTime=0;

            CountActualOK+=Chck;
            SumDeltaActual+=DeltaTime;

            if(Node.Hot)
            {
                CountHot++;
                CountHotOK+=Chck;
                SumDeltaHot+=DeltaTime;
            }
        }

        ADD_TO_STAT("MAX:ACTUAL_NODES",Count);
        ADD_TO_STAT("MAX:HOT_NODES",CountHot);
        ADD_TO_STAT("MAX:HOT_OK",CountHotOK);
        ADD_TO_STAT("MAX:ACTUAL_OK",CountActualOK);
        ADD_TO_STAT("MAX:CHECK_POINT_OK",CountCP);
        ADD_TO_STAT("MAX:COUNTLH",CountLH);
        // ADD_TO_STAT("MAX:COUNTLOWLEVELS",CountLowLevels);




        if(!CountHot)
            CountHot=0;
        if(!Count)
            Count=0;
        ADD_TO_STAT("MAX:DELTA_TIME_HOT",SumDeltaHot/CountHot);
        ADD_TO_STAT("MAX:DELTA_TIME_ACTUAL",SumDeltaActual/Count);
        ADD_TO_STAT("MAX:HOT_COUNT_LEVELS",CountLevels/CountHot);





        //CPU and MEM
        ADD_TO_STAT("MAX:MEMORY_USAGE",process.memoryUsage().heapTotal/1024/1024);

        var SumUser=0;
        var SumSys=0;
        var SumIdle=0;
        var cpus = os.cpus();
        for(var i=0;i<cpus.length;i++)
        {
            var cpu=cpus[i];
            SumUser+=cpu.times.user;
            SumSys+=cpu.times.sys+cpu.times.irq ;
            SumIdle+=cpu.times.idle ;
        }
        if(GlSumUser!==undefined)
        {
            var maxsum=cpus.length*1000;
            ADD_TO_STAT("MAX:CPU_USER_MODE",Math.min(maxsum,SumUser-GlSumUser));
            ADD_TO_STAT("MAX:CPU_SYS_MODE",Math.min(maxsum,SumSys-GlSumSys));
            ADD_TO_STAT("MAX:CPU_IDLE_MODE",Math.min(maxsum,SumIdle-GlSumIdle));
            ADD_TO_STAT("MAX:CPU",Math.min(maxsum,SumUser+SumSys-GlSumUser-GlSumSys));
        }
        GlSumUser=SumUser;
        GlSumSys=SumSys;
        GlSumIdle=SumIdle;
    }

    //Метки
    GetNewMeta()
    {
        return crypto.randomBytes(32);
    }

    // CreateTimeMeta(Name)
    // {
    //     var Meta=this.GetNewMeta();
    //     var CurTime=GetCurrentTime();
    //     this.MetaBuf.SaveValue(Meta,
    //         {
    //             CurTime:CurTime,
    //             Delta:global.DELTA_CURRENT_TIME,
    //             Name:Name
    //         },CurTime);
    //     //this.MetaBuf.SaveValue(Meta,CurTime);
    //     return Meta;
    // }


}

class SMemBuffer
{
    constructor(MaxTime,CheckName)
    {
        this.MetaMap1={};
        this.MetaMap2={};
        this.CheckName=CheckName;

        setInterval(this.ShiftMapDirect.bind(this),MaxTime);

    }
    GetStrKey(Arr)
    {
        if(typeof Arr==="number" || typeof Arr==="string")
        {
            return Arr;
        }
        else
        {
             return GetHexFromAddres(Arr);
        }

        throw "NOT RET!"
    }

    LoadValue(Arr,bStay)
    {
        if(!Arr)
            return undefined;
        var Key=this.GetStrKey(Arr);

        var Value=this.MetaMap1[Key];
        if(Value!==undefined)
        {
            if(!bStay)
                delete this.MetaMap1[Key];
            return Value;
        }

        Value=this.MetaMap2[Key];
        if(Value!==undefined)
        {
            if(!bStay)
                delete this.MetaMap2[Key];
        }
        return Value;
    }

    SaveValue(Arr,Value)
    {
        var Key=this.GetStrKey(Arr);
        if(Value!==undefined)
            this.MetaMap1[Key]=Value;
    }


    ShiftMapDirect()
    {
        if(glStopNode)
            return;

        if(this.CheckName)
        {
            var Count=0;
            for(var key in this.MetaMap2)
            {
                Count++;
            }
            if(Count)
            {
                ADD_TO_STAT(this.CheckName,1,1);
            }
        }
        this.MetaMap2=this.MetaMap1;
        this.MetaMap1={};
    }
    Clear()
    {
        this.MetaMap2={};
        this.MetaMap1={};
    }
}

//TREE
class STreeBuffer
{
    constructor(MaxTime,CompareFunction,KeyType,CheckName)
    {
        this.KeyType=KeyType;
        this.MetaTree1=new RBTree(CompareFunction);
        this.MetaTree2=new RBTree(CompareFunction);
        this.CheckName=CheckName;

        setInterval(this.ShiftMapDirect.bind(this),MaxTime);

    }


    LoadValue(Hash,bStay)
    {
        if(!Hash)
            return undefined;

        if(typeof Hash!==this.KeyType)
            throw "MUST ONLY HASH ARRAY: "+Hash;

        var element=this.MetaTree1.find({hash:Hash});
        if(element)
        {
            if(!bStay)
                this.MetaTree1.remove(element);
            return element.value;
        }

        element=this.MetaTree2.find({hash:Hash});
        if(element)
        {
            if(!bStay)
                this.MetaTree2.remove(element);
            return element.value;
        }
        return undefined;
    }

    SaveValue(Hash,Value)
    {
        if(typeof Hash!==this.KeyType)
            throw "MUST ONLY HASH ARRAY: "+Hash;

        if(Value!==undefined)
        {
            var element=this.MetaTree1.find({hash:Hash});
            if(element)
                element.value=Value;
            else
                this.MetaTree1.insert({hash:Hash,value:Value});
        }
    }


    ShiftMapDirect()
    {
        //if(glStopNode)            return;

        if(this.CheckName && this.MetaTree2.size)
        {
            ADD_TO_STAT(this.CheckName,this.MetaTree2.size,1);

            var it=this.MetaTree2.iterator(), Item;
            while((Item = it.next()) !== null)
            {
                var Name=Item.value.Name;


                ADD_TO_STAT(this.CheckName+":"+Name,1,1);
            }

        }


        this.MetaTree2.clear();
        var empty_tree=this.MetaTree2;

        this.MetaTree2=this.MetaTree1;
        this.MetaTree1=empty_tree;
    }

    Clear()
    {
        this.MetaTree1.clear();
        this.MetaTree2.clear();
    }



}


function GetCheckAccHash(Map,BlockNum,Hash)
{
    var MyHash=Map[BlockNum];
    if(!MyHash)
    {
        MyHash=DApps.Accounts.GetHashOrUndefined(BlockNum);
        Map[BlockNum]=MyHash;
    }

    if(MyHash)
    {
        if(!Hash)
            return "=ERR:NO="


        if(CompareArr(Hash,MyHash)!==0)
            return "=ERR:BAD="
        else
            return "=OK="

    }
    else
    {
        if(!Hash)
            return "=OK=:NO"
        else
            return "=MY:NO=";
    }

}
