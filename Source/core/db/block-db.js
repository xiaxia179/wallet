"use strict";
/**
 * Copyright: Yuriy Ivanov, 2018 e-mail: progr76@gmail.com
 */

const fs = require('fs');
const DBLib=require("./db");

global.BlockDB=new DBLib();
global.BLOCK_HEADER_SIZE=150;//144;

const FILE_NAME_HEADER="block-header";
const FILE_NAME_BODY  ="block-body";

module.exports = class CDB extends require("../code")
{
    constructor(SetKeyPair,RunIP,RunPort,UseRNDHeader,bVirtual)
    {
        super(SetKeyPair,RunIP,RunPort,UseRNDHeader,bVirtual)


        this.StartOneProcess();

        //TODO - поиск макс номера:
        this.BodyFileNum=0;
        this.BodyFileNumMax=0;


        this.BlockNumDB=0;

        //this.StatMap={};

    }

    StartOneProcess()
    {
        var path=GetDataPath("DB/run");
        if(fs.existsSync(path))
        {
            fs.unlinkSync(path);
        }
        try
        {
            this.BlockRunFI=BlockDB.OpenDBFile("run");
        }
        catch (e)
        {
            ToLog("********************************************* DETECT START ANOTHER PROCESS *********************************************")
            ToLog("EXIT");
            process.exit();
        }
    }

    LoadMemBlocksOnStart()
    {
        this.CurrentBlockNum=GetCurrentBlockNumByTime();
        for(var i=this.BlockNumDB-BLOCK_COUNT_IN_MEMORY;i<=this.BlockNumDB;i++)
        if(i>=0)
        {
            if(i>=this.BlockNumDB-BLOCK_PROCESSING_LENGTH*5)
                this.GetBlock(i,true,true);
            else
                this.GetBlock(i,true,false);
        }
    }

    FindStartBlockNum()
    {
        //ToLog("FINDSTARTBLOCKNUM");

        var FI=BlockDB.OpenDBFile(FILE_NAME_HEADER);
        var BlockNum=(FI.size/BLOCK_HEADER_SIZE)-1;

        //BlockNum=0;
        BlockNum=this.CheckBlocksOnStartReverse(BlockNum);
        this.BlockNumDB=this.CheckBlocksOnStartFoward(BlockNum-10000,0);
        this.BlockNumDB=this.CheckBlocksOnStartFoward(this.BlockNumDB-100,1);
        if(this.BlockNumDB>=BLOCK_PROCESSING_LENGTH2)
        {
            this.TruncateBlockDB(this.BlockNumDB);
            // var Block=this.ReadBlockHeaderDB(this.BlockNumDB);
            // if(Block)
            // {
            // }

            // var Block=this.ReadBlockHeaderDB(this.BlockNumDB);
            // if(Block)
            // {
            //     this.BodyFileNum=Block.BodyFileNum;
            //     this.BodyFileNumMax=Math.max(this.BodyFileNum,this.BodyFileNumMax);
            // }
            // else
            // {
            //     throw "Block not find!!!"
            // }
        }

        //Rewrite some transactions
        this.ReWriteDAppTransactions(this.BlockNumDB-16);


        ToLog("START_BLOCK_NUM:"+this.BlockNumDB);//+" BODY_FILE_NUM_MAX:"+this.BodyFileNumMax)
    }
    CheckBlocksOnStartReverse(StartNum)
    {
        var delta=1;
        var Count=0;
        var PrevBlock;
        for(var num=StartNum; num>=BLOCK_PROCESSING_LENGTH; num-=delta)
        {
            var Block=this.ReadBlockHeaderDB(num);
            if(!Block || IsZeroArr(Block.SumHash))
            {
                delta++;
                Count=0;
                continue;
            }
            var PrevBlock=this.ReadBlockHeaderDB(num-1);
            if(!PrevBlock || IsZeroArr(PrevBlock.SumHash))
            {
                Count=0;
                continue;
            }

            delta=1;
            var SumHash=shaarr2(PrevBlock.SumHash,Block.Hash);
            if(CompareArr(SumHash,Block.SumHash)===0)
            {
                Count++;
                if(Count>COUNT_BLOCKS_FOR_LOAD/10)
                    return num;
            }
            else
            {
                Count=0;
            }

        }
        return 0;
    }

    CheckBlocksOnStartFoward(StartNum,bCheckBody)
    {
        var PrevBlock;
        if(StartNum<BLOCK_PROCESSING_LENGTH2)
            StartNum=BLOCK_PROCESSING_LENGTH2;
        //StartNum=BLOCK_PROCESSING_LENGTH2;
        var arr=[];
        for(var num=StartNum;true;num++)
        {
            var Block;
            if(bCheckBody)
                Block=this.ReadBlockDB(num);
            else
                Block=this.ReadBlockHeaderDB(num);
            if(!Block)
                return num>0?num-1:0;

            if(bCheckBody)
            {
                var TreeHash=this.CalcTreeHashFromArrBody(Block.arrContent);
                if(CompareArr(Block.TreeHash,TreeHash)!==0)
                {
                    ToLog("BAD TreeHash block="+Block.BlockNum);
                    return num>0?num-1:0;
                }
            }

            if(PrevBlock)
            {
                //предыдущий хеш считается на основании нескольких предыдущих блоков (предыдущие со сдвигом BLOCK_PROCESSING_LENGTH)
                if(arr.length!==BLOCK_PROCESSING_LENGTH)
                {
                    var start=num-BLOCK_PROCESSING_LENGTH2;
                    for(var n=0;n<BLOCK_PROCESSING_LENGTH;n++)
                    {
                        var Prev=this.ReadBlockHeaderDB(start+n);
                        arr.push(Prev.Hash);
                    }
                }
                else
                {
                    arr.shift();
                    var Prev=this.ReadBlockHeaderDB(num-BLOCK_PROCESSING_LENGTH-1);
                    arr.push(Prev.Hash);
                }

                var PrevHash=CalcHashFromArray(arr,true);
                var SeqHash=this.GetSeqHash(Block.BlockNum,PrevHash,Block.TreeHash)
                var Hash=CalcHashFromArray([SeqHash,Block.AddrHash],true);

                if(CompareArr(Hash,Block.Hash)!==0)
                {
                    ToLog("=================== FIND ERR Hash in "+Block.BlockNum+"  bCheckBody="+bCheckBody)
                    return num>0?num-1:0;
                }


                var SumHash=shaarr2(PrevBlock.SumHash,Block.Hash);
                if(CompareArr(SumHash,Block.SumHash)!==0)
                {
                    ToLog("=================== FIND ERR SumHash in "+Block.BlockNum);
                    return num>0?num-1:0;
                }
            }
            PrevBlock=Block;
        }
    }

    GetChainFileNum(chain)
    {
        return 0;
        // //TODO GetChainFileNum
        // if(chain.BodyFileNum===undefined)
        // {
        //     this.BodyFileNumMax++;
        //     chain.BodyFileNum=this.BodyFileNumMax;
        // }
        // return chain.BodyFileNum;
    }

    //Write
    //Write
    //Write

    WriteBlockDB(Block)
    {
        var startTime = process.hrtime();

        //this.BodyFileNum=random(5);
        if(Block.TrCount===0 && !IsZeroArr(Block.TreeHash))
        {
            ToLogTrace("ERROR WRITE TrCount BLOCK:"+Block.BlockNum)
            throw "ERROR WRITE";
        }


        var Ret=this.WriteBodyDB(Block);
        if(Ret)
        {
            Ret=this.WriteBlockDBFinaly(Block);
        }


        ADD_TO_STAT_TIME("MAX:WriteBlockDB",startTime);
        ADD_TO_STAT_TIME("WriteBlockDB",startTime);

        return Ret;
    }
    WriteBlockDBFinaly(Block)
    {
        var Ret=this.WriteKeyDB(Block);
        if(Ret)
        {
            Ret=this.WriteBlockHeaderDB(Block);
            if(Ret)
            {
                if(Block.TrDataLen===0 && !IsZeroArr(Block.TreeHash))
                {
                    ToLogTrace("ERROR WRITE FINAL TrDataLen BLOCK")
                    throw "ERROR WRITE";
                }


                if(USE_CHECK_KEY_DB)
                    this.CheckKeyDB(Block.BlockNum);

                //TODO - may be write to disk after use transactions???
                this.OnWriteBlock(Block);

                this.BlockNumDB=Block.BlockNum;
                Block.bSave=true;
            }
        }
        return Ret;
    }

    SaveDataTreeToDB(Block)
    {
        //предварительная запись в БД
        var Ret=this.WriteBodyDB(Block);
        if(Ret)
        {
            var BufWrite=BufLib.GetNewBuffer(BLOCK_HEADER_SIZE);
            this.BlockHeaderToBuf(BufWrite,Block);
            Ret=this.WriteBufHeaderDB(BufWrite,Block.BlockNum);

        }
        return Ret;
    }


    WriteBodyDB(Block)
    {
        var FileItem=BlockDB.OpenDBFile(FILE_NAME_BODY);
        var FD=FileItem.fd;
        var Position=FileItem.size;
        Block.TrDataPos=Position;

        var arrTr=Block.arrContent;
        if(!arrTr || arrTr.length===0)
        {
            Block.TrCount=0;
            Block.TrDataLen=0;
            return true;
        }
        // var arrTrDapp=Block.arrContentDapp;
        // if(!arrTrDapp)
        //     arrTrDapp=[];


        var TrDataLen=4;
        var arrSize=[];
        for(var i=0;i<arrTr.length;i++)
        {
            var body=arrTr[i];
            arrSize[i]=2+body.length;
            TrDataLen+=arrSize[i];
        }



        var BufWrite=BufLib.GetNewBuffer(TrDataLen);
        BufWrite.Write(arrTr.length,"uint16");
        BufWrite.Write(0,"uint16");
        //BufWrite.Write(arrTrDapp.length,"uint16");
        for(var i=0;i<arrTr.length;i++)
        {
            var body=arrTr[i];
            BufWrite.Write(body,"tr");
        }
        // for(var i=0;i<arrTrDapp.length;i++)
        // {
        //     var body=arrTrDapp[i];
        //     BufWrite.Write(body,"tr");
        // }


        var written=fs.writeSync(FD, BufWrite,0,BufWrite.length, Position);
        if(written!==BufWrite.length)
        {
            TO_ERROR_LOG("DB",240,"Error write to file block-chain : "+written+" <> "+BufWrite.length);
            return false;
        }


        FileItem.size+=TrDataLen;

        Block.TrCount=arrTr.length;
        Block.TrDataLen=TrDataLen;

        return true;
    }

    WriteKeyDB(Block)
    {
        if(!USE_KEY_DB)
            return true;

        var arrTr=Block.arrContent;
        if(!arrTr || arrTr.length===0)
        {
            return true;
        }

        var infoKey=this.GetInfoKeyTransaction();
        var Position=Block.TrDataPos;
        var TrDataLen=4;
        var arrSize=[];
        for(var i=0;i<arrTr.length;i++)
        {
            var body=arrTr[i];
            arrSize[i]=6+2+body.length;
            TrDataLen+=arrSize[i];
        }
        //const startTime = process.hrtime();

        var SumFileSize=Position+4;
        for(var i=0;i<arrTr.length;i++)
        {
            var body=arrTr[i];
            //this.ToLogTime(startTime,"TR"+i+"-S");
            if(!this.WriteNewKeyDB(infoKey,body,SumFileSize,Block.BlockNum))
            {
                TO_ERROR_LOG("DB",250,"Error write key file");
                return false;
            }


            if(USE_CHECK_KEY_DB)
                this.CheckOneHashDB(Block,body);

            //this.ToLogTime(startTime,"TR"+i+"-F");
            SumFileSize+=arrSize[i];
        }
        //this.ToLogTime(startTime,"TR len="+arrTr.length);



        return true;
   }

    CheckOneHashDB(Block,body)
    {
        var findNum=this.FindBlockByHashDB(body);
        if(findNum===Block.BlockNum)
        {

        }
        else
        {
            var buf=Buffer.from(body);
            var Str=buf.toString('utf8',1,buf.length);

            if(findNum!==Block.BlockNum)
            {
                Str+=" ERROR BlockNum  find="+findNum+" must="+Block.BlockNum;
            }

            //ToLog("ERROR   Not found body: "+Str)
            ToLogTrace("Not found body="+Str)






            findNum=this.FindBlockByHashDB(body);

            {
                throw  "===========Not found body="+Str
            }

        }

    }
    CheckKeyDB(BlockNum)
    {
        var BlockDB=this.ReadBlockDB(BlockNum);

        //Check
        for(var i=0;BlockDB && BlockDB.arrContent && i<BlockDB.arrContent.length;i++)
        {
            var body=BlockDB.arrContent[i];
            this.CheckOneHashDB(BlockDB,body);
        }
    }


    WriteBlockHeaderDB(Block)
    {
        if(Block.BlockNum>0)
        {
            var PrevBlock=this.ReadBlockHeaderDB(Block.BlockNum-1);
            if(!PrevBlock)
            {
                ToLogTrace("Cant write header block:"+Block.BlockNum+"  prev block not found")
                throw "ERR: PREV BLOCK NOT FOUND";
                return false;
            }
            Block.SumHash=shaarr2(PrevBlock.SumHash,Block.Hash);
            Block.SumPow=PrevBlock.SumPow+GetPowPower(Block.Hash);

            if(USE_CHECK_SAVE_DB)
            if(!this.CheckSeqHashDB(Block,"WriteBlockHeaderDB"))
                 return false;
        }


        var BufWrite=BufLib.GetNewBuffer(BLOCK_HEADER_SIZE);
        this.BlockHeaderToBuf(BufWrite,Block);
        var Res=this.WriteBufHeaderDB(BufWrite,Block.BlockNum);

        if(Res)
        {
            this.TruncateBlockDBInner(Block,1);
        }

        return Res;
    }

    WriteBufHeaderDB(BufWrite,BlockNum)
    {
        var Position=BlockNum*BLOCK_HEADER_SIZE;
        var FD=BlockDB.OpenDBFile(FILE_NAME_HEADER).fd;


        var written=fs.writeSync(FD, BufWrite,0,BufWrite.length, Position);
        //var written=this.FileBufWrite(this.FileBufHeader, FD,BufWrite, Position);
        if(written!==BufWrite.length)
        {
            TO_ERROR_LOG("DB",260,"Error write to file block-header :" +written+" <> "+Info.key_width);
            return false;
        }
        else
        {
            return true;
        }
    }


    //Read
    ReadBlockDB(Num)
    {
        if(!Num)
            Num=0;
        var Block=this.ReadBlockHeaderDB(Num);
        if(Block && Block.TrDataLen)
        {
            var Ret=this.ReadBlockBodyDB(Block);
            if(!Ret)
                return undefined;
        }
        else
        {
            if(Block && !IsZeroArr(Block.TreeHash))
            {
                ToLogTrace("ERROR arrContent on BlockNum="+Num)
                //throw "ERROR"
                return undefined;
            }
        }
        return Block;
    }

    ReadBlockBodyDB(Block)
    {
        var FileItem=BlockDB.OpenDBFile(FILE_NAME_BODY);
        var FD=FileItem.fd;

        if(Block.TrDataLen>MAX_BLOCK_SIZE*2)
        {
            //TO_ERROR_LOG("DB",270,"Error value TrDataLen, BlockNum="+Block.BlockNum);
            ToLogTrace("Error value TrDataLen, BlockNum="+Block.BlockNum);
            return false;
        }
        var Position=Block.TrDataPos;
        var BufRead=BufLib.GetNewBuffer(Block.TrDataLen);
        var bytesRead=fs.readSync(FD, BufRead,0,BufRead.length, Position);
        if(bytesRead!==BufRead.length)
        {
            //this.AddBlockToLoadBody(Block);

            TO_ERROR_LOG("DB",272,"Error read block-body file: "+FileItem.name+"  from POS:"+Position+"  bytesRead="+bytesRead+" of "+BufRead.length+"  BlockNum="+Block.BlockNum);
            return false;
        }




        Block.arrContent=[];
        //Block.arrContentDapp=[];
        var TrCount=BufRead.Read("uint16");
        var TrCountDapp=BufRead.Read("uint16");
        if(TrCount<=MAX_BLOCK_SIZE/MIN_TRANSACTION_SIZE)
        {
            for(var i=0;i<TrCount;i++)
            {
                var body=BufRead.Read("tr");
                if(!body)
                    break;
                Block.arrContent[i]=body;
            }
            // for(var i=0;i<TrCountDapp;i++)
            // {
            //     var body=BufRead.Read("tr");
            //     if(!body)
            //         break;
            //     Block.arrContentDapp[i]=body;
            // }
        }


        Block.TrCount=Block.arrContent.length;
        //Block.TrCountDapp=Block.arrContentDapp.length;

        return true;
    }

    ReadBlockHeaderDB(Num)
    {
        //TODO: сделать буферизацию чтения (с учетом перезаписи)

        if(Num<0)
        {
            return undefined;
        }

        var BufRead=BufLib.GetNewBuffer(BLOCK_HEADER_SIZE);
        var Position=Num*BLOCK_HEADER_SIZE;
        var FD=BlockDB.OpenDBFile(FILE_NAME_HEADER).fd;


         var bytesRead=fs.readSync(FD, BufRead,0,BufRead.length, Position);
        //var bytesRead=this.FileBufRead(this.FileBufHeader, FD,BufRead,Position);
        if(bytesRead!==BufRead.length)
            return undefined;
        var Block=this.BufToBlockHeader(BufRead,Num);

        if(Block)
        {
            Block.bSave=true;
            Block.Prepared=true;
        }

        return Block;
    }





    SetTruncateBlockDB(Num)
    {
        if(this.UseTruncateBlockDB)
        {
            if(Num<this.UseTruncateBlockDB)
                this.UseTruncateBlockDB=Num;
        }
        else
        {
            this.UseTruncateBlockDB=Num;
        }
    }


    TruncateBlockDB(LastBlockNum)
    {
        this.UseTruncateBlockDB=undefined;
        if(LastBlockNum<BLOCK_PROCESSING_LENGTH2)
        {
            LastBlockNum=BLOCK_PROCESSING_LENGTH2-1;
            this.TruncateBlockBodyDBInner();
        }

        var Block=this.ReadBlockDB(LastBlockNum);
        if(!Block)
        {
            ToLog("************ ERROR TruncateBlockDB - not found block="+LastBlockNum);
            return;
        }
        this.WriteBlockDB(Block);
    }

    //Truncate
    TruncateBlockDBInner(LastBlock)
    {
        var startTime = process.hrtime();
        var FItem1=BlockDB.OpenDBFile(FILE_NAME_HEADER);
        var size=(LastBlock.BlockNum+1)*BLOCK_HEADER_SIZE;
        if(size<0)
            size=0;
        if(FItem1.size>size)
        {
            ToLog("Truncate header after BlockNum="+LastBlock.BlockNum)
            FItem1.size=size;
            fs.ftruncateSync(FItem1.fd,FItem1.size);
        }
        this.TruncateStat(LastBlock.BlockNum);
    }
    TruncateBlockBodyDBInner()
    {

        var FItem2=BlockDB.OpenDBFile(FILE_NAME_BODY);
        var size2=0;
        if(FItem2.size!==size2)
        {
            FItem2.size=size2;
            fs.ftruncateSync(FItem2.fd,FItem2.size);
        }
    }

    TruncateFileBuf(Tree,size)
    {
        while(true)
        {
            var Item=Tree.max();
            if(Item===null)
                break;
            if(Item.Position>=size)
            {
                //ToLog("DELETE TRUNCATE FD:"+Item.FD+"  Position:"+Item.Position)
                Tree.remove(Item);
            }
            else
            {
                break;
            }
        }
    }







    BlockHeaderToBuf(BufWrite,Block)
    {
        if(Block.BodyFileNum===undefined)
            Block.BodyFileNum=this.BodyFileNum;

        var len=BufWrite.len;
        BufWrite.Write(Block.TreeHash,"hash");
        BufWrite.Write(Block.AddrHash,"hash");

        BufWrite.Write(Block.PrevHash,"hash");
        //BufWrite.Write(Block.SeqHash,"hash");
        BufWrite.Write(Block.SumHash,"hash");

        BufWrite.Write(Block.SumPow,"uint");
        BufWrite.Write(Block.BodyFileNum,"uint");
        BufWrite.Write(Block.TrDataPos,"uint");
        BufWrite.Write(Block.TrDataLen,"uint32");
        //BufWrite.Write(Block.Hash,"hash");//общий хеш-блока в конце - при чтении проверка, т.о. это будет обеспечение атомарности записи блока


        BufWrite.len=len+BLOCK_HEADER_SIZE;
        //BufWrite.len=BufWrite.len;
    }


    BufToBlockHeader(BufRead,Num)
    {
        var Block={};
        Block.AddInfo=AddInfoBlock.bind(Block);

        // Block.PROF="B##:"+Math.floor(Num/BLOCK_COUNT_IN_MEMORY);
        // Block.PROF2="B##="+Num;

        Block.Info="";

        var len=BufRead.len;
        Block.TreeHash=BufRead.Read("hash");
        Block.AddrHash=BufRead.Read("hash");
        Block.PrevHash=BufRead.Read("hash");
        //Block.SeqHash=BufRead.Read("hash");
        Block.SumHash=BufRead.Read("hash");
        Block.SumPow=BufRead.Read("uint");

        Block.BodyFileNum=BufRead.Read("uint");
        Block.TrDataPos=BufRead.Read("uint");
        Block.TrDataLen=BufRead.Read("uint32");
        //Block.Hash=BufRead.Read("hash");//общий хеш-блока в конце - при чтении проверка, т.о. это будет обеспечение атомарности записи блока
        Block.TrCount=0;


        BufRead.len=len+BLOCK_HEADER_SIZE;
        Block.BlockNum=Num;

        Block.SeqHash=this.GetSeqHash(Block.BlockNum,Block.PrevHash,Block.TreeHash)
        if(Block.BlockNum>=BLOCK_PROCESSING_LENGTH2)
            Block.Hash=CalcHashFromArray([Block.SeqHash,Block.AddrHash],true);
        else
            Block.Hash=this.GetHashGenesis(Block.BlockNum);

        Block.Power=GetPowPower(Block.Hash);

        if(IsZeroArr(Block.Hash))
            return undefined;

        return Block;
    }


    //Scroll
    GetRows(start,count)
    {
        var arr=[];
        for(var num=start;num<start+count;num++)
        {
            var Block=this.ReadBlockHeaderDB(num);
            if(!Block)
                break;

            Block.Num=Block.BlockNum;
            if(Block.AddrHash)
            {
                //Block.AddrHash.len=0;
                Block.Miner=ReadUintFromArr(Block.AddrHash,0);
            }

            arr.push(Block);
        }
        return arr;
    }

    GetTrRows(BlockNum,start,count)
    {
        var arr=[];
        var Block=this.ReadBlockDB(BlockNum);
        if(Block && Block.arrContent)
        for(var num=start;num<start+count;num++)
        {
            if(num<0)
                continue;
            if(num>=Block.arrContent.length)
                break;

            var Tr={body:Block.arrContent[num]};
            this.CheckCreateTransactionHASH(Tr);

            Tr.Num=num;
            Tr.Type=Tr.body[0];
            Tr.Length=Tr.body.length;
            Tr.Body=[];
            for(var j=0;j<Tr.body.length;j++)
                Tr.Body[j]=Tr.body[j];


            var App=DAppByType[Tr.Type];
            if(App)
            {
                Tr.Script=App.GetScriptTransaction(Tr.body);
            }
            else
            {
                Tr.Script="";
            }

            arr.push(Tr);
        }
        return arr;
    }


    //Stat
    TruncateStat(LastBlockNum)
    {
        if(this.StatMap)
        {
            var LastNumStat=this.StatMap.StartBlockNum+this.StatMap.Length;
            var Delta=LastNumStat-LastBlockNum;
            if(Delta>0)
            {
                this.StatMap.Length-=Delta;
                if(this.StatMap.Length<0)
                    this.StatMap.Length=0;
            }
            this.StatMap.CaclBlockNum=0;
        }
    }

    GetStatBlockchain(name,MinLength)
    {
        var arr=[];
        if(!MinLength)
            return arr;

        const MAX_ARR_PERIOD=MAX_STAT_PERIOD*2+10;

        if(!this.StatMap)//init
        {
            this.StatMap=
                {
                    StartPos:0,
                    StartBlockNum:0,
                    Length:0,
                    "ArrPower":new Uint8Array(MAX_ARR_PERIOD),
                    "ArrPowerMy":new Uint8Array(MAX_ARR_PERIOD),
                };
        }

        //ToLog("this.StatMap.CaclBlockNum="+this.StatMap.CaclBlockNum)
        if(this.StatMap.CaclBlockNum!==this.BlockNumDB || this.StatMap.CalcMinLength!==MinLength)
        {
            //calc
            this.StatMap.CaclBlockNum=this.BlockNumDB;
            this.StatMap.CalcMinLength=MinLength;


            var start=this.BlockNumDB-MinLength+1;
            var finish=this.BlockNumDB+1;


            var StartPos=this.StatMap.StartPos;
            var ArrPower=this.StatMap.ArrPower;
            var ArrPowerMy=this.StatMap.ArrPowerMy;
            var StartNumStat=this.StatMap.StartBlockNum;
            var FinishNumStat=this.StatMap.StartBlockNum+this.StatMap.Length-1;


            var CountReadDB=0;
            var arr=new Array(MinLength);
            var arrmy=new Array(MinLength);
            for(var num=start;num<finish;num++)
            {
                var i=num-start;
                var i2=(StartPos+i)%MAX_ARR_PERIOD;
                if(num>=StartNumStat && num<=FinishNumStat && (num<finish-10))
                {
                    arr[i]=ArrPower[i2];
                    arrmy[i]=ArrPowerMy[i2];
                }
                else
                {
                    CountReadDB++;
                    var Power=0,PowerMy=0;
                    var Block=this.ReadBlockHeaderDB(num);
                    if(Block)
                    {
                        Power=GetPowPower(Block.Hash);
                        var Miner=ReadUintFromArr(Block.AddrHash,0);
                        if(Miner===GENERATE_BLOCK_ACCOUNT)
                        {
                            PowerMy=Power;
                        }
                    }
                    arr[i]=Power;
                    arrmy[i]=PowerMy;

                    ArrPower[i2]=Power;
                    ArrPowerMy[i2]=PowerMy;
                    this.StatMap.StartBlockNum=num-this.StatMap.Length;
                    this.StatMap.Length++;
                    if(this.StatMap.Length>MAX_ARR_PERIOD)
                    {
                        this.StatMap.Length=MAX_ARR_PERIOD;
                        this.StatMap.StartBlockNum++;
                        this.StatMap.StartPos++;
                    }
                }
            }

            //ToLog("CountReadDB="+CountReadDB)

            this.StatMap["MAX:POWER_BLOCKCHAIN"]=arr;
            this.StatMap["MAX:WIN:POWER_MY"]=arrmy;
        }


        var arr=this.StatMap[name];
        if(!arr)
            arr=[];
        return arr;
    }


}


