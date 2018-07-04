"use strict";
/*
 * DATA RIVER project
 * Copyright: Yuriy Ivanov, 2017-2018, e-mail: progr76@gmail.com
*/

const fs = require('fs');
const DBRow=require("../core/db/db-row");

const MAX_SUM_TER=1e9;
const MAX_SUM_CENT=1e9;




global.MAX_ACT_ROW_LENGTH=TRANSACTION_PROOF_COUNT*2;//130Mb (for proof=1 млн)

const TYPE_TRANSACTION_CREATE=100;
//const TYPE_TRANSACTION_CHANGE=102;
const TYPE_TRANSACTION_TRANSFER=105;


global.FORMAT_MONEY_TRANSFER=
    "{\
    Type:byte,\
    Currency:uint,\
    FromID:uint,\
    To:[{ID:uint,SumTER:uint,SumCENT:uint32}],\
    Description:str,\
    OperationID:uint,\
    Sign:arr64,\
    }";//1+6+6+4+2+16*N+64=87+16*N + str
const WorkStructTransfer={};
global.FORMAT_MONEY_TRANSFER_BODY=FORMAT_MONEY_TRANSFER.replace("Sign:arr64,","");




//codes updater
class CApp extends require("./dapp")
{
    constructor()
    {
        super();

        //DB-state (база состояний)
        const FORMAT_ACCOUNT_ROW=
            "{\
            Currency:uint,\
            PubKey:arr33,\
            Description:str40,\
            Value:{SumTER:uint,SumCENT:uint32, OperationID:uint,Reserve:arr84},\
            BlockNumCreate:uint,\
            RefID:uint,\
            Reserve:arr9,\
            }";

        const ACCOUNT_ROW_SIZE=6+33 + 40+(6+4 +6+84) + 6+6+9;
        this.DBState=new DBRow("accounts-state",ACCOUNT_ROW_SIZE,FORMAT_ACCOUNT_ROW);

        //DB-act (база движений)
        this.DBAct=new DBRow("accounts-act",6+6 + (6+4+6+6+84) + 1 + 11,"{ID:uint, BlockNum:uint,PrevValue:{SumTER:uint,SumCENT:uint32, BlockNum:uint, OperationID:uint,Reserve:arr84}, Mode:byte, Reserve: arr11}");
        this.DBActPrev=new DBRow("accounts-act-prev",this.DBAct.DataSize,this.DBAct.Format);


        this.Start();

        setInterval(this.ControlActSize.bind(this),60*1000);

        //ToLog("DEVELOP_KEY: "+DevelopKeyPair.getPrivateKey('hex'))
        // ToLog("DEVELOP_PUB KEY: "+GetHexFromArr(DevelopKeyPair.PubKeyArr))

        //TODO NET TRANSFER
    }


    Start()
    {
        if(this.DBState.GetMaxNum()+1>=BLOCK_PROCESSING_LENGTH2)
            return;

        //genesis state
        this.DBState.Write({Num:0,PubKey:[],Value:{BlockNum:1,SumTER:0.95*TOTAL_TER_MONEY},Description:"System account"});
        for(var i=1;i<8;i++)
            this.DBState.Write({Num:i,PubKey:[],Value:{BlockNum:1},Description:""});

        this.DBState.Write({Num:8,PubKey:GetArrFromHex(ARR_PUB_KEY[0]),Value:{BlockNum:1,SumTER:0.05*TOTAL_TER_MONEY},Description:"Founder account"});
        this.DBState.Write({Num:9,PubKey:GetArrFromHex(ARR_PUB_KEY[1]),Value:{BlockNum:1,SumTER:0},Description:"Developer account"});
        for(var i=10;i<BLOCK_PROCESSING_LENGTH2;i++)
            this.DBState.Write({Num:i,PubKey:GetArrFromHex(ARR_PUB_KEY[i-8]),Value:{BlockNum:1},Description:""});

        ToLog("MAX_NUM:"+this.DBState.GetMaxNum());
    }
    ControlActSize()
    {
        //
        var MaxNum=this.DBAct.GetMaxNum();
        if(MaxNum>=MAX_ACT_ROW_LENGTH)
        {
            ToLog("Rename act files");
            this.DBActPrev.CloseDBFile(this.DBActPrev.FileName);
            this.DBAct.CloseDBFile(this.DBAct.FileName);

            //rename
            if(fs.existsSync(this.DBActPrev.FileNameFull))
            {
                fs.unlinkSync(this.DBActPrev.FileNameFull);
            }

            fs.renameSync(this.DBAct.FileNameFull,this.DBActPrev.FileNameFull);

            ToLog("MAX_NUM PREV:"+this.DBActPrev.GetMaxNum());
            ToLog("MAX_NUM CURR:"+this.DBAct.GetMaxNum());
        }
    }


    OnTruncateBlock(Block)
    {
    }

    SendMoney(FromID,ToID,CoinSum,BlockNum,Description)
    {
        var FromData=this.ReadValue(FromID);

        var OperationID=FromData.Value.OperationID;
        var TR=
            {
                FromID:FromID,
                To:[{ID:ToID,SumTER:CoinSum.SumTer,SumCENT:CoinSum.SumCent}],
                Description:Description,
                OperationID:OperationID
            };

        FromData.PrevValue=CopyObjValue(FromData.Value);
        FromData.ActDirect="-";
        FromData.ActSumTER=CoinSum.SumTER;
        FromData.ActSumCENT=CoinSum.SumCENT;
        var Result=this.SUB(FromData.Value,CoinSum);
        if(!Result)
            return false;
        FromData.Value.OperationID++;
        this.WriteValue(TR,FromData,BlockNum);

        var ToData=this.ReadValue(ToID);
        ToData.PrevValue=CopyObjValue(ToData.Value);
        ToData.ActDirect="+";
        ToData.ActSumTER=CoinSum.SumTER;
        ToData.ActSumCENT=CoinSum.SumCENT;
        this.ADD(ToData.Value,CoinSum);
        this.WriteValue(TR,ToData,BlockNum);
        return true;
    }


    OnWriteBlockStart(Block)
    {
        if(Block.BlockNum<BLOCK_PROCESSING_LENGTH2)
            return;


        this.DeleteAct(Block.BlockNum);


        //do coin base
        this.DoCoinBaseTR(Block);


    }
    OnWriteBlockFinish(Block)
    {
    }



    OnWriteTransaction(Body,BlockNum,TrNum)
    {
        var Type=Body[0];

        var Result;
        switch (Type)
        {
            case TYPE_TRANSACTION_CREATE:
            {
                Result=this.TRCreateAccount(Body,BlockNum);
                break;
            }

            // case TYPE_TRANSACTION_CHANGE:
            // {
            //     Result=this.TRChangeAccount(Body,BlockNum);
            //     break;
            // }

            case TYPE_TRANSACTION_TRANSFER:
            {
                Result=this.TRTransferMoney(Body,BlockNum);
                break;
            }
        }

        var item=WALLET.ObservTree.find({HASH:shaarr(Body)});
        if(item)
        {
            if(Result===true)
                Result="Add to blockchain";
            item.result=Result;
            ToLogClient(Result,GetHexFromArr(item.HASH),true);
        }

        return Result;
    }


    DoCoinBaseTR(Block)
    {
        if(Block.BlockNum<1000000)
            return;

        var SysData=this.ReadValue(0);
        var SysBalance=SysData.Value.SumTER;
        const REF_PERIOD=1000*1000;
        const REF_PERIOD_END=30*REF_PERIOD;
        //const REF_PERIOD=100;
        //const REF_PERIOD_END=4*REF_PERIOD;
        Block.AddrHash.len=0;
        var AccountID=ReadUintFromArr(Block.AddrHash);
        if(AccountID<8)
            return;


        var Data=this.ReadValue(AccountID);
        if(Data && Data.Currency===0 && Data.BlockNumCreate<Block.BlockNum)
        {
            var Sum=Block.Power*Block.Power*SysBalance/TOTAL_TER_MONEY/100;


            var CoinTotal={SumTER:0,SumCENT:0};
            var CoinSum=this.COIN_FROM_FLOAT(Sum);
            if(!this.ISZERO(CoinSum))
            {

                if(Data.RefID>=8 && Block.BlockNum<REF_PERIOD_END)
                {
                    var RefData=this.ReadValue(Data.RefID);
                    if(RefData && RefData.BlockNumCreate<Block.BlockNum-REF_PERIOD)
                    {
                        var K=(REF_PERIOD_END-Block.BlockNum)/(REF_PERIOD_END-REF_PERIOD);
                        var CoinAdv=this.COIN_FROM_FLOAT(Sum*K);

                        this.SendMoney(0,Data.RefID,CoinAdv,Block.BlockNum,"Adviser coin base");
                        this.ADD(CoinTotal,CoinAdv);

                        this.ADD(CoinSum,CoinAdv);
                    }
                }



                this.SendMoney(0,AccountID,CoinSum,Block.BlockNum,"Coin base");
                this.ADD(CoinTotal,CoinSum);

                var CoinDevelop=CopyObjValue(CoinTotal);
                this.DIV(CoinDevelop,100);
                if(!this.ISZERO(CoinDevelop))
                    this.SendMoney(0,9,CoinDevelop,Block.BlockNum,"Developers support");
                // var CoinMarket=CopyObjValue(CoinTotal);
                // this.DIV(CoinMarket,100);
                // if(!this.ISZERO(CoinMarket))
                //     this.SendMoney(0,10,CoinMarket,Block.BlockNum,"Merketing support");
            }
        }
    }


    TRCreateAccount(Body,BlockNum)
    {
        if(Body.length<90)
            return "Error length transaction (retry transaction)";

        var HASH=shaarr(Body);
        var power=GetPowPower(HASH);
        if(power<MIN_POWER_POW_ACC_CREATE)
            return "Error min power POW for create account (update client)";

        const FORMAT_CREATE=
            "{\
            Type:byte,\
            Currency:uint,\
            PubKey:arr33,\
            Description:str40,\
            RefID:uint,\
            Reserve:arr7,\
            }";//1+6+33+40+6+7=93


        try
        {
            var TR=BufLib.GetObjectFromBuffer(Body,FORMAT_CREATE,{});
        }
        catch (e)
        {
            return "Error transaction format (retry transaction)";
        }

        var Data= TR;
        Data.Num=undefined;
        Data.Value={};
        Data.BlockNumCreate=BlockNum;
        if(Data.RefID>this.GetMaxAccount())
            Data.RefID=0;
        this.DBState.Write(Data);
        var Act={ID:Data.Num,BlockNum:BlockNum, PrevValue:{},Mode:1};
        this.DBAct.Write(Act);



        if(CompareArr(Data.PubKey,WALLET.PubKeyArr)===0)
        {
            WALLET.OnCreateAccount(Data);
        }

        return true;
    }

    TRChangeAccount(Body,BlockNum)
    {

        if(Body.length<150)
            return "Error length transaction (retry transaction)";

        const FORMAT_CHANGE=
            "{\
            Type:byte,\
            ID:uint,\
            PubKey:arr33,\
            Description:str40,\
            OperationID:uint,\
            Sign:arr64,\
            }";//1+6+33+40+1+6+64=87+64=151


        try
        {
            var TR=BufLib.GetObjectFromBuffer(Body,FORMAT_CHANGE,{});
        }
        catch (e)
        {
            return "Error transaction format (retry transaction)";
        }

        //find account db
        var Data=this.ReadValue(TR.ID);
        if(!Data)
            return;


        //check sign
        var hash=shabuf(Body.slice(0,Body.length-64-12));
        var Result=0;
        if(Data.PubKey[0]===2 || Data.PubKey[0]===3)
        try{Result=secp256k1.verify(hash, TR.Sign, Data.PubKey);}catch (e){};
        if(!Result)
        {
            return "Error sign";
        }


        var Act={ID:Data.Num,BlockNum:BlockNum};
        Data.PrevValue=CopyObjValue(Data.Value);

        Data.Description=TR.Description;
        Data.PubKey=TR.PubKey;
        //Data.Value.AdviserID=TR.AdviserID;

        this.DBState.Write(Data);
        this.DBAct.Write(Act);
    }


    TRTransferMoney(Body,BlockNum)
    {
        if(Body.length<103)
            return "Error length transaction (retry transaction)";

        try
        {
            var TR=BufLib.GetObjectFromBuffer(Body,FORMAT_MONEY_TRANSFER,WorkStructTransfer);
        }
        catch (e)
        {
            return "Error transaction format (retry transaction)";
        }

        //find account db
        var Data=this.ReadValue(TR.FromID);
        if(!Data)
            return "Error sender account ID";
        if(TR.Currency!==Data.Currency)
            return "Error sender currency";
        if(TR.OperationID!==Data.Value.OperationID)
            return "Error OperationID (expected "+Data.Value.OperationID+"). Create new transaction!";

        //calc sum
        var TotalSum={SumTER:0,SumCENT:0};
        var MapItem={};
        for(var i=0;i<TR.To.length;i++)
        {
            var Item=TR.To[i];
            if(Item.SumTER>MAX_SUM_TER)
                return "Error MAX_SUM_TER";
            if(Item.SumCENT>=MAX_SUM_CENT)
                return "Error MAX_SUM_CENT";

            if(Item.ID===TR.FromID || MapItem[Item.ID])
                continue;
            MapItem[Item.ID]=1;

            this.ADD(TotalSum,Item);
        }



        //check sum
        if(TotalSum.SumTER===0 && TotalSum.SumCENT===0)
            return "No money transaction";

        if(Data.Value.SumTER<TotalSum.SumTER || (Data.Value.SumTER===TotalSum.SumTER && Data.Value.SumCENT<TotalSum.SumCENT))
            return "Not enough money on the account";

        //check sign
        var hash=shabuf(Body.slice(0,Body.length-64-12));
        var Result=0;
        if(Data.PubKey[0]===2 || Data.PubKey[0]===3)
        try{Result=secp256k1.verify(hash, TR.Sign, Data.PubKey);}catch (e){};
        if(!Result)
        {
            return "Error sign transaction";
        }


        //transfer sum
        var arr=[];


        MapItem={};
        for(var i=0;i<TR.To.length;i++)
        {
            var Item=TR.To[i];

            var DataTo=this.ReadValue(Item.ID);
            if(!DataTo)
                return "Error receiver account ID";
            if(TR.Currency!==DataTo.Currency)
                return "Error receiver currency";


            if(Item.ID===TR.FromID || MapItem[Item.ID])
                continue;
            MapItem[Item.ID]=1;


            DataTo.PrevValue=CopyObjValue(DataTo.Value);

            DataTo.ActDirect="+";
            DataTo.ActSumTER=Item.SumTER;
            DataTo.ActSumCENT=Item.SumCENT;

            this.ADD(DataTo.Value,Item);
            arr.push(DataTo);
        }
        if(arr.length===0)
            return "No recipients";


        Data.PrevValue=CopyObjValue(Data.Value);
        Data.ActDirect="-";
        Data.ActSumTER=TotalSum.SumTER;
        Data.ActSumCENT=TotalSum.SumCENT;

        this.SUB(Data.Value,TotalSum);
        arr.push(Data);

        Data.Value.OperationID++;

        arr.sort(function (a,b)
        {
            return a.Num-b.Num;
        });

        for(var i=0;i<arr.length;i++)
        {
            this.WriteValue(TR,arr[i],BlockNum);
        }

        return true;
    }

    ADD(Coin,Value2)
    {
        Coin.SumTER+=Value2.SumTER;
        Coin.SumCENT+=Value2.SumCENT;

        if(Coin.SumCENT>=MAX_SUM_CENT)
        {
            Coin.SumCENT-=MAX_SUM_CENT;
            Coin.SumTER++;
        }

        return true;
    }

    SUB(Coin,Value2)
    {
        Coin.SumTER-=Value2.SumTER;
        if(Coin.SumCENT>=Value2.SumCENT)
        {
            Coin.SumCENT-=Value2.SumCENT;
        }
        else
        {
            Coin.SumCENT=MAX_SUM_CENT+Coin.SumCENT-Value2.SumCENT;
            Coin.SumTER--;
        }
        if(Coin.SumTER<0)
        {
            //TO_ERROR_LOG("ACCOUNT",10,"Coin.SumTER<0");
            return false;
        }
        return true;
    }

    DIV(Coin,Value)
    {
        Coin.SumTER=Coin.SumTER/Value;
        Coin.SumCENT=Math.trunc(Coin.SumCENT/Value);

        var SumTER=Math.trunc(Coin.SumTER);
        var SumCENT=Math.trunc((Coin.SumTER-SumTER)*MAX_SUM_CENT);

        Coin.SumTER=SumTER;
        Coin.SumCENT=Coin.SumCENT+SumCENT;

        if(Coin.SumCENT>=MAX_SUM_CENT)
        {
            Coin.SumCENT-=MAX_SUM_CENT;
            Coin.SumTER++;
        }
        return true;
    }

    COIN_FROM_FLOAT(Sum)
    {
        if(Sum>1e6)
        {
            throw "VERY BIG SUM IN COIN_FROM_FLOAT";
        }

        var SumTER=Math.trunc(Sum);
        var SumCENT=Math.trunc((Sum-SumTER)*MAX_SUM_CENT);
        return {SumTER:SumTER,SumCENT:SumCENT};
    }

    ISZERO(Coin)
    {
        if(Coin.SumTER===0 && Coin.SumCENT===0)
            return true;
        else
            return false;
    }


    WriteState(Data)
    {
        //ToLog(""+Data.Num+". WRITE SumCENT="+Data.Value.SumCENT)

        this.DBState.Write(Data);
    }

    ReadState(Num)
    {
        var Data=this.DBState.Read(Num);
        return Data;
    }

    WriteValue(TR,Data,BlockNum)
    {
        //остатки
        Data.Value.BlockNum=BlockNum;
        this.WriteState(Data);

        //движения
        var Act={Num:undefined, ID:Data.Num, BlockNum:BlockNum, Description:TR.Description, PrevValue:Data.PrevValue};
        this.DBAct.Write(Act);


        if(WALLET.AccountMap[Act.ID]!==undefined)
            WALLET.OnDoAct(TR,Data,BlockNum);

    }

    ReadValue(Num)
    {
        return this.ReadState(Num);
    }

    DeleteAct(BlockNum)
    {
        this.DeleteActOneDB(this.DBAct,BlockNum)
        this.DeleteActOneDB(this.DBActPrev,BlockNum)

        WALLET.OnTruncateBlock(BlockNum);
    }
    DeleteActOneDB(DBAct,BlockNum)
    {
        var MaxNum=DBAct.GetMaxNum();
        if(MaxNum===-1)
            return;

        for(var num=MaxNum;num>=0;num--)
        {
            var ItemCheck=DBAct.Read(num);
            if(!ItemCheck)
            {
                ToLogTrace("!ItemCheck");
                throw "ERRR DeleteActOneDB";
            }

            if(ItemCheck.BlockNum<BlockNum)//нашли
            {
                this.ProcessingDeleteAct(DBAct,num+1);
                return;
            }
        }
        //не нашли
        this.ProcessingDeleteAct(DBAct,0);
    }


    ProcessingDeleteAct(DBAct,StartNum)
    {
        //clear data
        var Map={};
        var bWas=0;
        var NumTruncateState;
        for(var num=StartNum;true;num++)
        {
            var Item=DBAct.Read(num);
            if(!Item)
                break;

            bWas=1;

            if(Map[Item.ID])
                continue;
            Map[Item.ID]=1;

            if(Item.Mode===1)
            {
                //was create
                //but delete now

                if(!NumTruncateState)
                    NumTruncateState=Item.ID-1;
            }
            else
            {
                var Data=this.DBState.Read(Item.ID);
                if(!Data)
                {
                    ToLog("=======!Data  = this.DBState.Read(Item.ID)")
                    continue;
                }

                Data.Value=Item.PrevValue;
                this.WriteState(Data);
            }
        }


        if(bWas)
        {
            if(NumTruncateState)
            {
                ToLog("********DBState Truncate: "+NumTruncateState)
                this.DBState.Truncate(NumTruncateState);
            }
            ToLog("*********"+DBAct.FileName+" Truncate: "+(StartNum));
            DBAct.Truncate(StartNum-1);
        }
    }


    /////////////////////////////
    FindAccounts(PubKeyArr)
    {
        var map={};
        for(var num=0;true;num++)
        {
            var Data=this.ReadState(num);
            if(!Data)
                break;

            if(CompareArr(Data.PubKey,PubKeyArr)===0)
            {
                map[Data.Num]=Data.Num;
            }
        }
        return map;
    }

    GetAccounts(map)
    {
        var arr=[];
        for(var key in map)
        {
            var Num=map[key];
            var Data=this.ReadState(Num);
            if(Data)
            {
                Data.PubKey=GetHexFromArr(Data.PubKey);
                arr.push(Data);
            }
        }
        return arr;
    }

    /////////////////////////////
    /////////////////////////////
    /////////////////////////////

    //API - use: DApps.Accounts.APIMethod1()
    GetAccount(num)
    {
        return this.ReadState(num);
    }
    GetMaxAccount()
    {
        return this.DBState.GetMaxNum();
    }
    GetAccountsAll(id,count)
    {
        if(count>1000)
            count=1000;

        var arr=[];
        for(var num=id;num<=num+count;num++)
        {
            var Data=this.ReadState(num);
            if(!Data)
                break;
            Data.PubKey=GetHexFromArr(Data.PubKey);
            arr.push(Data);
        }
        return arr;
    }


    GetActsAll(num,count)
    {
        if(count>1000)
            count=1000;

        var arr=[];
        for(var num=0;true;num++)
        {
            var Item=this.DBActPrev.Read(num);
            if(!Item)
                break;
            Item.Num="Prev."+Item.Num;
            arr.push(Item);
            if(arr.length>count)
                return arr;
        }
        for(var num=0;true;num++)
        {
            var Item=this.DBAct.Read(num);
            if(!Item)
                break;
            Item.Num=Item.Num;
            arr.push(Item);
            if(arr.length>count)
                return arr;
        }
        return arr;
    }

    /////////////////////////////

    TestTest(BlockNum)
    {
       this.DeleteAct(BlockNum);
    }
}



module.exports = CApp;
var App=new CApp;
DApps["Accounts"]=App;
DAppByType[TYPE_TRANSACTION_CREATE]=App;
DAppByType[TYPE_TRANSACTION_TRANSFER]=App;

