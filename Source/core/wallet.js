"use strict";

const fs = require('fs');
const crypto = require('crypto');
const RBTree = require('bintrees').RBTree;

require("./library");
require("./crypto-library");


const WalletPath="WALLET";
const DBRow=require("./db/db-row");
const CONFIG_NAME=GetDataPath(WalletPath+"/config.lst");

class CApp
{
    constructor()
    {
        CheckCreateDir(GetDataPath(WalletPath));
        this.DBAct=new DBRow("../"+WalletPath+"/wallet-act",4*6 + 1+200 + 10 + 6,"{BlockNum:uint, FromID:uint, FromOperationID:uint, ToID:uint, Direct:str1, Description:str200, SumTER:uint,SumCENT:uint32, Currency:uint}");

        this.ObservTree=new RBTree(CompareItemHASH32);

        var Params=LoadParams(CONFIG_NAME,undefined);
        if(!Params)
        {
            Params={};
            Params.Key=GetHexFromArr(crypto.randomBytes(32));
            Params.AccountMap={};
            Params.MiningAccount=0;
        }
        if(Params.MiningAccount)
            global.GENERATE_BLOCK_ACCOUNT=Params.MiningAccount;
        this.AccountMap=Params.AccountMap;
        this.KeyPair = crypto.createECDH('secp256k1');
        this.SetPrivateKey(Params.Key,true);
    }
    SetMiningAccount(Account)
    {
        global.GENERATE_BLOCK_ACCOUNT=Account;
        this.SaveWallet();
    }

    AddTransaction(Tr)
    {
        this.ObservTree.insert({HASH:shaarr(Tr.body)});
        return SERVER.AddTransaction(Tr);
    }
    SetPrivateKey(PrivateKeyStr,bSetNew)
    {
        if(PrivateKeyStr && PrivateKeyStr.length===64)//private
        {
            this.KeyPair.setPrivateKey(GetArr32FromHex(PrivateKeyStr));
            this.KeyPair.PubKeyArr=this.KeyPair.getPublicKey('','compressed');
            this.KeyPair.PubKeyStr=GetHexFromArr(this.KeyPair.PubKeyArr);
            this.KeyPair.PrivKeyStr=PrivateKeyStr.toUpperCase();
            this.KeyPair.addrArr=this.KeyPair.PubKeyArr.slice(1);
            this.KeyPair.addrStr=GetHexAddresFromPublicKey(this.KeyPair.addrArr);
            this.KeyPair.addr=this.KeyPair.addrArr;

            this.KeyPair.WasInit=1;
            this.PubKeyArr=this.KeyPair.PubKeyArr;
        }
        else
        {
            this.KeyPair.WasInit=0;
            if(PrivateKeyStr)
            {
                this.PubKeyArr=GetArrFromHex(PrivateKeyStr);
                this.KeyPair.PubKeyStr=GetHexFromArr(this.PubKeyArr);
            }
            else
            {
                this.PubKeyArr=[];
                this.KeyPair.PubKeyStr="";
            }

            this.KeyPair.PrivKeyStr="";
        }



        if(bSetNew)// && DApps.Accounts)
        {
            this.AccountMap=DApps.Accounts.FindAccounts(this.PubKeyArr);
        }

        this.SaveWallet();


    }
    SaveWallet()
    {
        var Params={};
        if(this.KeyPair.WasInit)
            Params.Key=this.KeyPair.PrivKeyStr;
        else
            Params.Key=GetHexFromArr(this.PubKeyArr);

        Params.AccountMap=this.AccountMap;
        Params.MiningAccount=global.GENERATE_BLOCK_ACCOUNT;
        SaveParams(CONFIG_NAME,Params);
    }

    OnDoAct(TR,Data,BlockNum)
    {
        //{BlockNum:uint, FromID:uint, FromOperationID:uint, ToID:uint, Description:str100, SumTER:uint,SumCENT:uint32, Currency:uint};


        var Item=
            {
                Direct:Data.ActDirect,
                BlockNum:BlockNum,
                FromID:TR.FromID,
                ToID:0,
                FromOperationID:TR.OperationID,
                SumTER:Data.ActSumTER,
                SumCENT:Data.ActSumCENT,
                Description:TR.Description,
                Currency:Data.Currency,
            };
        if(Item.Direct==="-")
        {
            if(TR.To.length===1)
            {
                Item.ToID=TR.To[0].ID;
            }
            else
            if(TR.To.length>1)
            {
                Item.ToID=1000000000000;
            }
        }
        else
        if(Item.Direct==="+")
        {
            Item.ToID=Data.Num;
        }

        this.DBAct.Write(Item);

    }

    OnTruncateBlock(BlockNum)
    {
        var MaxNum=this.DBAct.GetMaxNum();
        if(MaxNum===-1)
            return;

        for(var num=MaxNum;num>=0;num--)
        {
            var ItemCheck=this.DBAct.Read(num);
            if(!ItemCheck)
                break;

            if(ItemCheck.BlockNum<BlockNum)//нашли
            {
                if(num<MaxNum)
                {
                    ToLog("**************Truncate wallet act from: "+(num+1))
                    this.DBAct.Truncate(num);
                }
                break;
            }
        }

    }

    OnCreateAccount(Data)
    {
        this.AccountMap[Data.Num]=Data.Num;
    }

    FindMyAccounts()
    {
        if(IsZeroArr(this.PubKeyArr))
            return;

        this.AccountMap=DApps.Accounts.FindAccounts(this.PubKeyArr);
        this.SaveWallet();
    }

    GetSignFromArr(Arr)
    {
        if(!this.KeyPair.WasInit)
            return "00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000";

        var hash=shabuf(Arr);
        var sigObj = secp256k1.sign(hash, this.KeyPair.getPrivateKey());
        return GetHexFromArr(sigObj.signature)
    }

    GetSignTransaction(TR)
    {
        var Buf=BufLib.GetBufferFromObject(TR,FORMAT_MONEY_TRANSFER_BODY,MAX_TRANSACTION_SIZE,{});
        return this.GetSignFromArr(Buf)
    }

    GetAct(id,count,Direct)
    {
        if(count>1000)
            count=1000;

        var arr=[];
        for(var num=this.DBAct.GetMaxNum();num>=0;num--)
        {
            var Item=this.DBAct.Read(num);
            if(!Item)
                break;
            if(Direct!=="" && Direct!==Item.Direct)
                continue;

            if(Item.Direct==="+" && this.AccountMap[Item.ToID]===undefined)
                continue;
            else
            if(Item.Direct==="-" && this.AccountMap[Item.FromID]===undefined)
                continue;

            arr.unshift(Item);
            if(arr.length>count)
                break;
        }
        return arr;
    }

}

//module.exports = CApp;
global.WALLET=new CApp;

