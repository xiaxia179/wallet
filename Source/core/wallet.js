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
        this.DBHistory=new DBRow("../"+WalletPath+"/wallet-act",4*6 + 1+200 + 10 + 6,"{BlockNum:uint, FromID:uint, FromOperationID:uint, ToID:uint, Direct:str1, Description:str200, SumTER:uint,SumCENT:uint32, Currency:uint}");

        this.ObservTree=new RBTree(CompareItemHASH32);

        this.Password="";
        this.WalletOpen=undefined;

        var Params=LoadParams(CONFIG_NAME,undefined);
        if(!Params)
        {
            this.WalletOpen=true;

            Params={};
            Params.Key=GetHexFromArr(crypto.randomBytes(32));
            Params.AccountMap={};
            Params.MiningAccount=0;
        }

        if(Params.MiningAccount)
            global.GENERATE_BLOCK_ACCOUNT=Params.MiningAccount;
        this.AccountMap=Params.AccountMap;
        this.KeyPair = crypto.createECDH('secp256k1');

        if(Params.Protect)
        {
            ToLogClient("Wallet protect by password");
            this.KeyXOR=GetArrFromHex(Params.KeyXOR);
            this.WalletOpen=false;

            this.SetPrivateKey(Params.PubKey,true);//TODO
        }
        else
        {
            this.SetPrivateKey(Params.Key,true);//TODO
        }
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
    SetPrivateKey(KeyStr,bSetNew)
    {
        var bGo=1;
        if(this.WalletOpen===false)
        {
            //ToLogClient("Wallet is close by password");
            bGo=0;
        }



        if(KeyStr && KeyStr.length===64 && bGo)//private
        {
            this.KeyPair.setPrivateKey(GetArr32FromHex(KeyStr));
            this.KeyPair.PubKeyArr=this.KeyPair.getPublicKey('','compressed');
            this.KeyPair.PubKeyStr=GetHexFromArr(this.KeyPair.PubKeyArr);
            this.KeyPair.PrivKeyStr=KeyStr.toUpperCase();
            this.KeyPair.addrArr=this.KeyPair.PubKeyArr.slice(1);
            this.KeyPair.addrStr=GetHexAddresFromPublicKey(this.KeyPair.addrArr);
            this.KeyPair.addr=this.KeyPair.addrArr;

            this.KeyPair.WasInit=1;
            this.PubKeyArr=this.KeyPair.PubKeyArr;
        }
        else
        {
            this.KeyPair.WasInit=0;
            if(KeyStr)
            {
                this.PubKeyArr=GetArrFromHex(KeyStr);
                this.KeyPair.PubKeyStr=GetHexFromArr(this.PubKeyArr);
            }
            else
            {
                this.PubKeyArr=[];
                this.KeyPair.PubKeyStr="";
            }

            this.KeyPair.PrivKeyStr="";
        }



        if(bSetNew)
        {
            this.AccountMap=DApps.Accounts.FindAccounts(this.PubKeyArr);
        }

        if(bGo)
            this.SaveWallet();


    }

    OpenWallet(StrPassword)
    {
        if(this.WalletOpen!==false)
        {
            ToLogClient("Wallet was open");
        }


        var Hash=this.HashProtect(StrPassword);
        var TestPrivKey=this.XORHash(this.KeyXOR,Hash);

        this.KeyPair.setPrivateKey(Buffer.from(TestPrivKey));
        var TestPubKey=this.KeyPair.getPublicKey('','compressed');
        if(CompareArr(TestPubKey,this.PubKeyArr)!==0)
        {
            ToLogClient("Wrong password");
            return 0;
        }

        this.Password=StrPassword;
        this.WalletOpen=true;
        this.SetPrivateKey(GetHexFromArr(TestPrivKey),false);

        ToLogClient("Wallet open");
        return 1;
    }

    SetPasswordNew(StrPassword)
    {
        if(this.WalletOpen===false)
        {
            ToLogClient("Wallet is close by password");
            return;
        }

        this.Password=StrPassword;
        this.WalletOpen=true;
        this.SaveWallet();
    }

    HashProtect(Str)
    {
        var arr=shaarr(Str);
        for(var i=0;i<10000;i++)
        {
            arr=shaarr(arr);
        }
        return arr;
    }
    XORHash(arr1,arr2)
    {
        var arr3=[];
        for(var i=0; i<32; i++)
        {
            arr3[i]=arr1[i]^arr2[i];
        }
        return arr3;
    }

    SaveWallet()
    {
        if(this.WalletOpen===false)
        {
            ToLogClient("Wallet is close by password");
            return;
        }


        var Params={};

        if(this.Password)
        {
            Params.Protect=true;
            if(this.KeyPair.WasInit)
            {
                var Hash=this.HashProtect(this.Password);
                Params.KeyXOR=GetHexFromArr(this.XORHash(this.KeyPair.getPrivateKey(),Hash));
            }
            Params.PubKey=GetHexFromArr(this.PubKeyArr);
        }
        else
        {
            if(this.KeyPair.WasInit)
                Params.Key=this.KeyPair.PrivKeyStr;
            else
                Params.Key=GetHexFromArr(this.PubKeyArr);
        }

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

        this.DBHistory.Write(Item);

    }

    OnTruncateBlock(BlockNum)
    {
        this.DBHistory.TruncateHistory(BlockNum);
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
        var Arr;
        if(TR.Version===2)
        {
            Arr=[];
            for(var i=0;i<TR.To.length;i++)
            {
                var Item=TR.To[i];

                var DataTo=DApps.Accounts.ReadValue(Item.ID);
                if(!DataTo)
                    return "Error receiver account ID";
                if(TR.Currency!==DataTo.Currency)
                    return "Error receiver currency";

                for(var j=0;j<33;j++)
                    Arr[Arr.length]=DataTo.PubKey[j];
            }

            var Body=BufLib.GetBufferFromObject(TR,FORMAT_MONEY_TRANSFER_BODY2,MAX_TRANSACTION_SIZE,{});

            for(var j=0;j<Body.length;j++)
                Arr[Arr.length]=Body[j];


        }
        else
        {
            Arr=BufLib.GetBufferFromObject(TR,FORMAT_MONEY_TRANSFER_BODY,MAX_TRANSACTION_SIZE,{});
        }
        return this.GetSignFromArr(Arr)
    }

    GetHistoryMaxNum()
    {
        return this.DBHistory.GetMaxNum();
    }
    GetHistoryAct(start,count,Direct)
    {
        if(count>1000)
            count=1000;

        var arr=[];
        //for(var num=this.GetHistoryMaxNum();num>=0;num--)
        for(var num=start;num<start+count;num++)
        {
            var Item=this.DBHistory.Read(num);
            if(!Item)
                break;
            if(Direct!=="" && Direct!==Item.Direct)
                continue;

            if(Item.Direct==="+" && this.AccountMap[Item.ToID]===undefined)
                continue;
            else
            if(Item.Direct==="-" && this.AccountMap[Item.FromID]===undefined)
                continue;

            //name
            if(Item.ToID!==1000000000000)
            {
                var Account=DApps.Accounts.ReadState(Item.ToID);
                if(Account)
                    Item.ToName=Account.Description;
            }


            arr.push(Item);
            //arr.unshift(Item);
            // if(arr.length>count)
            //     break;
        }
        return arr;
    }

}

//module.exports = CApp;
global.WALLET=new CApp;

