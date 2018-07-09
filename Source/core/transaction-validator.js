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




module.exports = class CSmartContract extends require("./block-exchange")
{
    constructor(SetKeyPair,RunIP,RunPort,UseRNDHeader,bVirtual)
    {
        super(SetKeyPair,RunIP,RunPort,UseRNDHeader,bVirtual)
    }

    CheckCreateTransactionHASH(Tr)
    {
        if(!Tr.hashPow)
        {
            Tr.body.len=Tr.body.length-12;
            Tr.num=ReadUintFromArr(Tr.body);
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
        // if(Tr.power*128/Tr.body.length<MIN_POWER_POW_TR)
        //     return -2;
        if(Tr.power-Math.log2(Tr.body.length/128)<MIN_POWER_POW_TR)
            return -2;

        //2. Валидное время (не из будущего)
        if(Tr.num>BlockNum)
            return -3;

        return 1;
    }

    ReWriteDAppTransactions(StartNum,bToLogClient)
    {
        if(StartNum===undefined)
            return;
        ToLog("Rewrite from: "+StartNum+" to "+this.BlockNumDB,bToLogClient);
        for(var Num=StartNum;Num<=this.BlockNumDB;Num++)
        {
            var Block=this.ReadBlockDB(Num);
            this.OnWriteBlock(Block);
        }
        ToLog("Rewriting complete",bToLogClient);
    }


    //EVENTS
    //EVENTS
    //EVENTS
    OnWriteBlock(Block)
    {
        for(var key in DApps)
        {
            DApps[key].OnWriteBlockStart(Block);
        }

        var BlockNum=Block.BlockNum;
        var arr=Block.arrContent;
        if(arr)
        for(var i=0;i<arr.length;i++)
        {
            var App=DAppByType[arr[i][0]];
            if(App)
            {
                var Result=App.OnWriteTransaction(arr[i],BlockNum,i);
            }
         }

        for(var key in DApps)
        {
            DApps[key].OnWriteBlockFinish(Block);
        }

     }

    OnTruncate(Block)
    {
        for(var key in DApps)
        {
            DApps[key].OnTruncateBlock(Block);
        }
    }






}


