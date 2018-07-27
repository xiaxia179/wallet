"use strict";
/**
 * Copyright: Yuriy Ivanov, 2018 e-mail: progr76@gmail.com
 */

require("../dapp/dapp");
require("../dapp/accounts");
require("../dapp/codes");
require("../dapp/messager");
require("../dapp/names");


require("./wallet");


const RBTree = require('bintrees').RBTree;


module.exports = class CSmartContract extends require("./block-exchange")
{
    constructor(SetKeyPair,RunIP,RunPort,UseRNDHeader,bVirtual)
    {
        super(SetKeyPair,RunIP,RunPort,UseRNDHeader,bVirtual);

        this.BufHashTree = new RBTree(CompareArr);
        this.BufHashTree.LastAddNum=0;



        if(!global.ADDRLIST_MODE && !this.VirtualMode)
        {
            setInterval(this.StartRewriteTransaction.bind(this),500);
        }


    }
    AddBlockToHashTree(Block)
    {
        //ToLog("ADD "+Block.BlockNum)
        this.BufHashTree.LastAddNum=Block.BlockNum;
        var arr=Block.arrContent;
        if(arr)
        {
            for(var i=0;i<arr.length;i++)
            {
                var HASH=shaarr(arr[i]);
                this.BufHashTree.insert(HASH);
            }
        }
    }
    DeleteBlockFromHashTree(Block)
    {
        //ToLog("DEL "+Block.BlockNum)
        var arr=Block.arrContent;
        if(arr)
        {
            for(var i=0;i<arr.length;i++)
            {
                var HASH=shaarr(arr[i]);
                this.BufHashTree.remove(HASH);
            }
        }
    }


    //EVENTS
    //EVENTS
    //EVENTS
    OnWriteBlock(Block)
    {
        if(Block.BlockNum<1)
            return;

        var COUNT_MEM_BLOCKS=0;

        //ToLog("BlockNum "+Block.BlockNum)
        var NUM1=1240000;
        var NUM2=1400000;
        if(global.LOCAL_RUN)
        {
            NUM1=15;
            NUM2=100;
        }

        if(Block.BlockNum>NUM1)
        {
            COUNT_MEM_BLOCKS=1;
            if(Block.BlockNum>NUM2)
                COUNT_MEM_BLOCKS=60;


            if(this.BufHashTree.LastAddNum!==Block.BlockNum-1)
            {
                this.BufHashTree.clear();
                for(var num=COUNT_MEM_BLOCKS;num>=1;num--)
                {
                    var Block2=this.ReadBlockDB(Block.BlockNum-num);
                    if(Block2)
                    {
                        this.AddBlockToHashTree(Block2);
                    }
                }
            }
        }



        for(var key in DApps)
        {
            DApps[key].OnWriteBlockStart(Block);
        }




        var BlockNum=Block.BlockNum;
        var arr=Block.arrContent;
        if(arr)
        for(var i=0;i<arr.length;i++)
        {
            var HASH=shaarr(arr[i]);

            if(this.BufHashTree.find(HASH))
            {
                //ToLog("Double !!")
                continue;
            }


            var App=DAppByType[arr[i][0]];
            if(App)
            {
                var Result=App.OnWriteTransaction(arr[i],BlockNum,i);
            }
        }

        if(COUNT_MEM_BLOCKS)
        {
            var Block2=this.ReadBlockDB(Block.BlockNum-COUNT_MEM_BLOCKS);
            if(Block2)
                this.DeleteBlockFromHashTree(Block2);

            this.AddBlockToHashTree(Block);
        }


        for(var key in DApps)
        {
            DApps[key].OnWriteBlockFinish(Block);
        }
     }

    OnDelete(Block)
    {
        this.BufHashTree.LastAddNum=0;

        for(var key in DApps)
        {
            DApps[key].OnDeleteBlock(Block);
        }
    }



    //API
    CheckCreateTransactionHASH(Tr)
    {
        if(!Tr.hashPow)
        {
            //Tr.body.len=Tr.body.length-12;
            Tr.num=ReadUintFromArr(Tr.body,Tr.body.length-12);
            Tr.hashPow=shaarr(Tr.body);
            Tr.HASH=Tr.hashPow;
            // Tr.time=Tr.num;
            Tr.power=GetPowPower(Tr.hashPow);
            Tr.TimePow=Tr.num + Tr.power - Math.log2(Tr.body.length/128);
        }
    }

    IsValidTransaction(Tr,BlockNum)
    {
        //0. Минимальный размер
        if(!Tr.body || Tr.body.length<MIN_TRANSACTION_SIZE || Tr.body.length>MAX_TRANSACTION_SIZE)
            return -1;

        this.CheckCreateTransactionHASH(Tr);


        //1. Минимальный PoW
        if(Tr.power-Math.log2(Tr.body.length/128)<MIN_POWER_POW_TR)
            return -2;

        //2. Валидное время (не из будущего)
        if(Tr.num>BlockNum)
            return -3;

        return 1;
    }

    ReWriteDAppTransactions(StartNum,EndNum)
    {
        if(StartNum===undefined)
            return;
        if(!EndNum)
            EndNum=this.BlockNumDB;
        if(StartNum<0)
            StartNum=0;

        var startTime = process.hrtime();
        ToLog("Rewrite from: "+StartNum+" to "+EndNum);
        for(var Num=StartNum;Num<=EndNum;Num++)
        {
            if(Num>BLOCK_PROCESSING_LENGTH2)
            {
                var Block=this.ReadBlockDB(Num);
                if(Block)
                     this.OnWriteBlock(Block);
            }
        }
        var Time = process.hrtime(startTime);
        var deltaTime=(Time[0]*1000 + Time[1]/1e6)/1000;//s

        ToLog("Rewriting complete: "+deltaTime+" sec");
    }

    StartRewriteTransaction()
    {
        if(this.StartNumRewriteTransactions)
        {
            this.ReWriteDAppTransactions(this.StartNumRewriteTransactions,this.BlockNumDB);
        }

        this.StartNumRewriteTransactions=undefined;
    }
    SetRewriteBlockDB()
    {
        if(!this.LastNumAccountHashOK)//init
        {
            this.LastNumAccountHashOK=this.BlockNumDB;
            this.NexdDeltaAccountNum=100;
        }
        this.StartNumRewriteTransactions=this.LastNumAccountHashOK-this.NexdDeltaAccountNum;
        this.NexdDeltaAccountNum=this.NexdDeltaAccountNum*1.5;
        if(this.StartNumRewriteTransactions<=0)
        {
            this.NexdDeltaAccountNum=100;
        }
    }

    AddDAppTransactions(BlockNum,Arr)
    {
        // if(BlockNum%10 !== 0)//TODO
        //return;

        var BlockNumHash=BlockNum-DELTA_BLOCK_ACCOUNT_HASH;
        if(BlockNumHash<0)
            BlockNumHash=0;

        if(Arr.length)
        {
            var Hash=DApps.Accounts.GetHashOrUndefined(BlockNumHash);
            if(Hash)
            {
                var Body=[TYPE_TRANSACTION_ACC_HASH];
                WriteUintToArr(Body,BlockNumHash);
                WriteArrToArr(Body,Hash,32);
                var Tr={body:Body};
                this.CheckCreateTransactionHASH(Tr);
                Arr.unshift(Tr);
            }
            else
            {
                //ToLogTrace("!Hash  BlockNum:"+BlockNumHash);
            }
        }

    }

}



// setTimeout(function ()
// {
//     console.time("*****************************************************************************ReWriteDAppTransactions")
//     SERVER.ReWriteDAppTransactions(900,1000);
//     console.timeEnd("*****************************************************************************ReWriteDAppTransactions")
//     process.exit()
// },1000)
