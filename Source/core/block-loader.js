"use strict";

/**
 * TERA project
 * Copyright: Yuriy Ivanov, 2018 e-mail: progr76@gmail.com
 */



const fs = require("fs");
const crypto = require('crypto');
const RBTree = require('bintrees').RBTree;



const STAT_BLOCK_LOAD_PERIOD=CONSENSUS_PERIOD_TIME/5;



global.COUNT_BLOCKS_FOR_LOAD=600;


global.COUNT_HISTORY_BLOCKS_FOR_LOAD=3000;
global.COUNT_BLOCKS_FOR_CHECK_POW=100;
global.PERCENT_SUM_BLOCKS_FOR_STOP_CHECK_POW=90;

global.MAX_COUNT_CHAIN_LOAD=120;

global.PACKET_ALIVE_PERIOD=4*CONSENSUS_PERIOD_TIME;//ms
global.PACKET_ALIVE_PERIOD_NEXT_NODE=PACKET_ALIVE_PERIOD/2;//ms
//global.MAX_BLOCK_LOAD=128;
global.MAX_BLOCK_SEND=8;
global.COUNT_TASK_FOR_NODE=10;

const Formats=
{
    BLOCK_TRANSFER:
        "{\
        BlockNum:uint,\
        TreeHash:hash,\
        arrContent:[tr],\
        }",
    WRK_BLOCK_TRANSFER:{},
}



module.exports = class CBlock extends require("./db/block-db")
{
    constructor(SetKeyPair,RunIP,RunPort,UseRNDHeader,bVirtual)
    {
        super(SetKeyPair,RunIP,RunPort,UseRNDHeader,bVirtual)

        this.MapMapLoaded={};
        this.BlockChain={};


        this.ChainID=0;
        this.BlockID=0;
        this.TaskNodeIndex=0;
        this.LoadedChainList=[];
        this.LastChainLoad=undefined;

        this.LoadHistoryMode=false;


        this.SetFirstTimeBlock(START_NETWORK_DATE-0);

        setInterval(this.RecalcLoadBlockStatictic.bind(this),STAT_BLOCK_LOAD_PERIOD);

        //setImmediate(this.TestSerilyzeBlock.bind(this),1);

        //автовосстановление данных
        this.MapBlockBodyLoad={};



        if(!global.ADDRLIST_MODE && !this.VirtualMode)
        {
            setTimeout(this.CheckStartedBlocks.bind(this),100);
            setInterval(this.LoopChainLoad.bind(this),100);
            setInterval(this.LoopBlockLoad.bind(this),10);

            setInterval(this.LoopBlockBodyLoad.bind(this),1*1000);


            //setInterval(this.Start.bind(this),1000);
        }
    }

    StopNode()
    {
        global.glStopNode=true;
        //console.trace();
        //this.MemKeyFlush();
    }






    GetHashGenesis(Num)
    {
        return [Num+1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,Num+1];
    }
    GenesisBlockHeaderDB(Num)
    {
        if(Num<0)
            return undefined;

        var Block=
            {
                BlockNum:Num,
                TreeHash:[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
                //AddrHash:[122,161,15,51,83,125,229,81,171,164,241,114,180,152,171,251,32,112,156,178,191,18,183,190,148,136,122,241,74,155,93,184],//code sign
                AddrHash:DEVELOP_PUB_KEY,
                Hash:this.GetHashGenesis(Num),

                PrevHash:[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
                SeqHash: [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
                SumHash: [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
                Comment1:"GENESIS",
                Comment2:"",
                TrCount:0,
                TrDataPos:0,
                TrDataLen:0,
            };

        Block.SeqHash=this.GetSeqHash(Block.BlockNum,Block.PrevHash,Block.TreeHash);

        Block.SumPow=0;
        Block.bSave=true;

        return Block;
    }


    CheckStartedBlocks()
    {
        if(fs.existsSync(GetCodePath("EXPERIMENTAL/_run.js")))
        {
            require(GetCodePath("EXPERIMENTAL/_run.js")).Run();
        }
        else
        if(this.BlockNumDB<BLOCK_PROCESSING_LENGTH2)
        {
            this.CreateGenesisBlocks();
        }
        this.LoadMemBlocksOnStart();
    }

    CreateGenesisBlocks()
    {
        ToLog("====CreateGenesisBlock====");
        var PrevArr=[];
        for(var n=0;n<BLOCK_PROCESSING_LENGTH2;n++)
        {
            var Block=this.GenesisBlockHeaderDB(n);
            PrevArr[n]=Block;
            this.WriteBlockDB(Block);
        }
        return PrevArr;
    }

    CreatePOWNew(Block,CountNonce)
    {
        var Ret=CreateAddrPOW(Block.SeqHash,CountNonce);

        Block.Hash=Ret.Hash;
        Block.AddrHash=Ret.AddrHash;
        Block.Power=GetPowPower(Block.Hash);

        var testHash=this.GetHashFromSeq(Block);
        if(CompareArr(testHash,Ret.Hash)!==0)
        {
            ToLogTrace("NO CompareArr");
            throw "NO CompareArr!";
        }
     }


    //PrevHash
    //PrevHash
    //PrevHash
    GetSeqHash(BlockNum,PrevHash,TreeHash)
    {
        var arr=[GetArrFromValue(BlockNum),PrevHash,TreeHash];
        var SeqHash=CalcHashFromArray(arr,true);
        return SeqHash;
    }
    GetHashFromSeq(Block)
    {
        return CalcHashFromArray([Block.SeqHash,Block.AddrHash],true);
    }
    GetPrevHash(Block)
    {
        var startPrev=Block.BlockNum-BLOCK_PROCESSING_LENGTH2;
        var Sum=0;
        var arr=[];
        for(var i=0;i<BLOCK_PROCESSING_LENGTH;i++)
        {
            var PrevBlock=this.GetBlock(startPrev+i);
            if(PrevBlock && PrevBlock.bSave)
            {
                Sum=Sum+PrevBlock.SumPow;
                arr.push(PrevBlock.Hash);
            }
            else
            {
                //Block.Info+="\nPREV BLOCK: [0,0,0,0]";
                return undefined;
            }
        }
        var PrevHash=CalcHashFromArray(arr,true);
        return PrevHash;
    }




    /////////////////////////////////////////////////////

    //Загрузка блоков из других узлов - вся история от заданного номера (загрузка вперед)
    StartLoadHistory(Node)
    {
        this.FREE_ALL_MEM_CHAINS();

        if(global.CREATE_ON_START)
            return;

        this.RelayMode=true;
        this.LoadHistoryMode=true;
        this.LoadHistoryContext={Node:Node,BlockNum:this.BlockNumDB,MapSend:{},Foward:1,Pause:0,DeltaBlockNum:10};

        this.DeleteAllNodesFromHot("LOAD_HISTORY_MODE");

        ToLog("LOADHISTORYMODE ON")
        ToLogClient("Start synchronization")
    }

    //Загрузка блоков из других узлов - от заданного хеша блока (поиск назад)
    StartLoadBlockHeader(LoadHash,Num,StrInfo,bIsSum)
    {
        if(this.LoadHistoryMode)
            return;

        bIsSum = bIsSum || false;
        var Tree=this.GetHistoryTree("StartLoadBlockHeader");
        if(Tree.find({hash:LoadHash}))
            return false;
        Tree.insert({hash:LoadHash});


        if(Num > this.CurrentBlockNum+TIME_START_SAVE)
            ToLog("!!!!!!!!!!!!!!!!    Num>TIME_START_SAVE  Num="+Num)



        var chain=
            {
                id:0,
                Count:16,
                BlockNum:Num,
                IsSum:bIsSum,
                Hash:LoadHash,
                time:undefined,
                FindBlockDB:false,
                LoadDB:false,
                LoadCountDB:0,
                LoadSumDB:0,
                LoadSum:0,

                ParentChain:undefined,
                RootChain:undefined,

                BlockNumStart:Num,
                HashStart:LoadHash,
                IsSumStart:bIsSum,

                BlockHead:undefined,

                MapSend:{},
                Comment2:"",
                StopSend:false,
                Info:"",
                Error:false,

            };

        // chain.PROF="C##:"+Math.floor(Num/BLOCK_COUNT_IN_MEMORY);
        // chain.PROF2="C##="+Num;

        this.ChainBindMethods(chain);
        chain.AddInfo(StrInfo);

        this.SetChainNum(chain);

        while(this.SendChainNext(chain,false)){};

        return true;
    }

    LoopHistoryLoad()
    {
        var Context=this.LoadHistoryContext;
        if(Context.Pause)
        {
            if(this.LoadedChainList.length)
            {
                return;
            }

            Context.Pause=0;
            Context.BlockNum=this.BlockNumDB;
        }

        var BlockDB=this.ReadBlockHeaderDB(Context.BlockNum);

        if(!BlockDB || this.BlockNumDB>=GetCurrentBlockNumByTime()-BLOCK_PROCESSING_LENGTH2)
        {
            this.LoadHistoryMode=false;
            ToLogClient("Finish synchronization")
            ToLog("LOADHISTORYMODE OFF")

            if(!BlockDB)
                return;
        }



        var Ret=this.GetNextNode(Context,Context.BlockNum,1);
        if(Ret.Result)
        {
            //ToLog(Context.BlockNum)//950639
            var Node=Ret.Node;
            this.SendF(Node,
                {
                    "Method":"GETBLOCKHEADER",
                    "Context":Context,
                    "Data":{Foward:1, BlockNum:Context.BlockNum,Hash:BlockDB.SumHash}
                }
            );
        }
        else
        {
            if(!Ret.timewait)
            {
                if(!Context.RestartGetNextNode)
                {
                    Context.RestartGetNextNode=1;
                    Context.MapSend={};
                }
            }
        }
    }

    SetChainNum(chain)
    {
        if(!chain.id)
        {
            this.ChainID++;
            chain.id=this.ChainID;
        }

        this.LoadedChainList.push(chain);
    }


    LoopChainLoad()
    {
        if(glStopNode)
            return;



        if(this.LoadHistoryMode)
        {
            this.LoopHistoryLoad()
            return;
        }
        if(this.BlockNumDB<this.CurrentBlockNum-BLOCK_PROCESSING_LENGTH*2)
        {


            this.StartLoadHistory();
            return;
        }


        var CountStopSend=0;
        var min_num=this.CurrentBlockNum-MAX_COUNT_CHAIN_LOAD;
        var min_num_load=this.CurrentBlockNum;

        for(var i=0;i<this.LoadedChainList.length;i++)
        {
            var chain=this.LoadedChainList[i];
            if(!chain)// || chain.BlockNumStart<=this.LastLoadedBlockNum)
            {
                this.LoadedChainList.splice(i,1);
                continue;
            }

            //находим и перезаписываем ссылку на корневую цепочку
            var RootChain=chain.GetRootChain();
            if(chain.RootChain)
                chain.RootChain=RootChain;

            if(RootChain.BlockNum<min_num_load)
                min_num_load=RootChain.BlockNum;


            if(!chain.StopSend)
            {
                //УДАЛЕНИЕ ИЗ ОБРАБОТКИ ПРИ УСЛОВИИ:
                //если нет отслеживаемых запросов корневой цепочки и текущий элемент устарел
                if(chain.BlockHead)
                {
                    if(chain.BlockNum<this.CurrentBlockNum-COUNT_HISTORY_BLOCKS_FOR_LOAD)
                    {
                        ToLog("Very long length of blocks to load history, stop chain with id="+chain.id+"  ("+chain.BlockNum+"-"+chain.BlockNumMax+")");
                        chain.StopSend=true;
                        chain.AddInfo("Stop load #1");

                        //TODO:
                        //Проверять что цепочка имеет право на загрузку (у нее высокий POW и ранее это подтверждено загрузкой ее части)

                        this.BlockNumDB=chain.BlockNum;
                        this.TruncateBlockDB(chain.BlockNum);
                        this.StartLoadHistory();
                        return;

                    }
                    else
                    if(chain.BlockNumMax<min_num)
                    {
                        ToLog("Timeout - stop load chain with id="+chain.id+"  ("+chain.BlockNum+"-"+chain.BlockNumMax+")");
                        chain.StopSend=true;
                        chain.AddInfo("Stop load #2");

                        this.ClearChains(chain,true);
                    }
                }
             }




             //если загружена другая цепочка с таким же хешем
            if(chain && !chain.IsSum && !chain.StopSend)
            {
                var StrKey="H:"+GetHexFromArr(chain.Hash);
                var Map=this.GetMapLoadedFromChain(chain);
                var WasBlock=Map[StrKey];
                if(WasBlock && WasBlock.chain!==chain && CompareArr(WasBlock.Hash,chain.Hash)===0 && !WasBlock.chain.Deleted)
                {
                    ToLog("Was hash in chain "+WasBlock.chain.id+" - stop load chain with id="+chain.id+"  ("+chain.BlockNum+")");
                    chain.Comment2="was hash";
                    chain.StopSend=true;
                }
            }
            if(chain  && chain.StopSend)
                CountStopSend++;



            //если загрузка цепочки еще не завершена (нет связки с БД), то отправляем запросы узлу
            chain=this.LoadedChainList[i];
            if(chain && !chain.GetFindDB() && !chain.StopSend)
            {
                this.SendChainNext(chain,true);
            }
        }




        ADD_TO_STAT("MAX:LOADEDCHAINLIST",this.LoadedChainList.length);


        this.FREE_MEM_CHAINS(min_num_load);
        this.LastLoadedBlockNum=0;


        if(this.LoadedChainList.length>COUNT_HISTORY_BLOCKS_FOR_LOAD/3)
        {
            ToLog("LoadedChainList>COUNT_HISTORY_BLOCKS_FOR_LOAD/3 - FREE_ALL_MEM_CHAINS")
            this.FREE_ALL_MEM_CHAINS();
        }
    }


    SendChainNext(chain,checktime)
    {
        var Ret=this.GetNextNode(chain,chain.BlockNum,checktime);
        if(Ret.Result)
        {
            if(!chain.Context)
                chain.Context={Chain:chain};

            var Node=Ret.Node;
            this.SendF(Node,
                {
                    "Method":"GETBLOCKHEADER",
                    "Context":chain.Context,
                    "Data":{Foward:0,BlockNum:chain.BlockNum, Hash:chain.Hash, IsSum:chain.IsSum, Count:chain.Count}
                }
            );
            //ToLog("SEND: "+JSON.stringify({id:chain.id,BlockNum:chain.BlockNum, Hash:chain.Hash, IsSum:chain.IsSum, Count:chain.Count}));


            var DopStr="";
            if(chain.IsSum)
                DopStr="SUM:"
            chain.AddInfo(chain.BlockNum+"/"+DopStr+this.GetStrFromHashShort(chain.Hash)+"->"+GetNodeStrPort(Node));

            return true;
        };
        return false;
    }
    static GETBLOCKHEADER_F()
    {
        return "{\
                Foward:byte,\
                BlockNum:uint,\
                Hash:hash,\
                Count:uint,\
                IsSum:byte\
            }"
    }

    GetNextNode(task,keyid,checktime,BlockNum)
    {
        //Получение ноды для отправки данных:
        //1.Отправка нового запроса
        //2.Переотправка старого запроса (timeout) новой ноде


        var CurTime=GetCurrentTime(0)-0;

       //ADD_TO_STAT("DO_GETNEXTNODE-1");

        if(checktime && task.time)
        {
            var Delta=CurTime-task.time;
            if(Delta<PACKET_ALIVE_PERIOD_NEXT_NODE)
                return {Result:false,timewait:true};
        }
        task.time=undefined;


        /*
         1. Циклический обход массива с ранее запомненного номера
         2. Отправляем пакет ноде
         3. ??? Запоминаем последний номер массива для использования на шаге 1 при следующем входе в алгоритм
         */
        var StartI=0;
        if(task.Node)
            StartI=-1;

        //ADD_TO_STAT("DO_GETNEXTNODE-2");

        var timewait=false;
        var arr=this.GetActualNodes();
        for(var i=StartI;i<arr.length;i++)
        {
            var Node;
            if(i===-1)
            {
                Node=task.Node;
                task.Node=undefined;
            }
            else
            {
                this.TaskNodeIndex++;
                Node=arr[this.TaskNodeIndex % arr.length];
            }
            if(Node.Active && Node.CanHot)
            {
                if(BlockNum!==undefined && Node.INFO && BlockNum>Node.INFO.BlockNumDB)
                {
                    timewait=true;
                    continue;
                }

                if(Node.TaskLastSend)
                {
                     var Delta=CurTime-Node.TaskLastSend;
                     //if(Delta<1000/MAX_CONNECTION_WHITE*2)
                    if(Delta<1000/COUNT_TASK_FOR_NODE)
                     {
                         timewait=true;
                         continue;//wait (not spaming)
                     }
                }





                var keysend=""+Node.addrStr+":"+keyid;
                if(task.MapSend[keysend])
                    continue;

                Node.TaskLastSend=CurTime;
                task.time=CurTime;


                //this.TaskNodeIndex=m+1; - не запоминаем, т.к. всегда начинаем с 0-го элемента - с мин. пингом
                //или:
                //this.TaskNodeIndex=m+1
                // if(this.TaskNodeIndex>19)//первым 19
                //     this.TaskNodeIndex=0;

                //TODO: нужна отправка из Hot списка


                return {Result:true,Node:Node,timewait:timewait};
                //RetFunc(Node);

                //break;
            }
        }

        //TODO:
        // if(!timewait && !task.RestartGetNextNode)
        // {
        //     task.RestartGetNextNode=1;
        //     task.MapSend={};
        //     return {Result:false,timewait:true};
        // }

        return {Result:false,timewait:timewait};
    }

    GETBLOCKHEADER(Info,CurTime)
    {
        var Data=this.DataFromF(Info);


        var arr=[];
        var StartNum;

        var BlockNum;
        var LoadHash=Data.Hash;
        var Foward=Data.Foward;
        if(Foward)
        {
            var BlockDB=this.ReadBlockHeaderDB(Data.BlockNum);
            if(BlockDB && BlockDB.SumHash && CompareArr(BlockDB.SumHash,LoadHash)===0)
            {
                StartNum=Data.BlockNum-BLOCK_PROCESSING_LENGTH2;
                if(StartNum<0)
                    StartNum=0;
                BlockNum=StartNum+COUNT_BLOCKS_FOR_LOAD+BLOCK_PROCESSING_LENGTH2;
                if(BlockNum>this.BlockNumDB)
                    BlockNum=this.BlockNumDB;
            }
            else
            {
                StartNum=undefined;
            }
            //ToLog("FOWARD: Data.BlockNum="+Data.BlockNum+"  this.BlockNumDB="+this.BlockNumDB)
        }
        else
        {
            BlockNum=Data.BlockNum;
            var IsSum=Data.IsSum;
            var Count=Data.Count;
            if(!Count || Count<0 || BlockNum<0)
                return;

            if(Count>COUNT_BLOCKS_FOR_LOAD)
                Count=COUNT_BLOCKS_FOR_LOAD;
            Count+=BLOCK_PROCESSING_LENGTH2;


            var BlockDB=this.ReadBlockHeaderDB(BlockNum);
            if(BlockDB && (BlockDB.Prepared && (!IsSum) && BlockDB.Hash && CompareArr(BlockDB.Hash,LoadHash)===0
                    || BlockDB.bSave && IsSum && BlockDB.SumHash && CompareArr(BlockDB.SumHash,LoadHash)===0))
            {
                StartNum=BlockNum-Count+1;
                if(StartNum<0)
                    StartNum=0;
            }


        }

        //ToLog("From="+StartNum+"  To="+BlockNum)

        /*
        Получаем блоки из БД
        */


        if(StartNum!==undefined)
        {
            var PrevBlock;
            if(StartNum>0)
                PrevBlock=this.ReadBlockHeaderDB(StartNum-1);

            for(var num=StartNum;num<=BlockNum;num++)
            {
                var Block=this.ReadBlockHeaderDB(num);
                if(!Block || !Block.Prepared || !Block.Hash)
                    break;

                if(PrevBlock)
                {
                    if(!PrevBlock.SumHash)
                        break;

                    var SumHash=shaarr2(PrevBlock.SumHash,Block.Hash);
                    // if(CompareArr(SumHash,Block.SumHash)!==0)
                    // {
                    //     var StrSumHash=GetHexFromArr(SumHash);
                    //     var StrSumHashB=GetHexFromArr(Block.SumHash);
                    //     ToLog("Err SumHash on block="+Block.BlockNum+" StrSumHash="+StrSumHash+"  StrSumHashB="+StrSumHashB)
                    // }
                    Block.SumHash=SumHash;
                }

                arr.push(Block)
                PrevBlock=Block;
            }

        }



        //=====================================
        //серилизация BLOCKHEADER
        //Формат:
        //StartNum = 6 байт
        //Count = 4 байт
        //Hash * 16 * 32 байта
        //SumHash * 32 байта
        //SumPow * 6 байт
        //TreeHash+AddrHash * N * 64 байта
        //=====================================
        var CountSend=arr.length-BLOCK_PROCESSING_LENGTH2;
        var BufWrite;
        if(CountSend<0 || StartNum===undefined)
        {
            BufWrite=BufLib.GetNewBuffer(10);
        }
        else
        {
            var StartNum;
            if(arr.length)
                StartNum=arr[0].BlockNum;
            else
                StartNum=0;
            var BufSize=6+4+BLOCK_PROCESSING_LENGTH2*32+32+6 + CountSend*64;
            BufWrite=BufLib.GetNewBuffer(BufSize);
            BufWrite.Write(StartNum,"uint");
            BufWrite.Write(CountSend,"uint32");

            for(var i=0;i<arr.length;i++)
            {
                var Block=arr[i];
                if(i<BLOCK_PROCESSING_LENGTH2)
                {
                    BufWrite.Write(Block.Hash,"hash");
                }
                else
                {
                    if(i===BLOCK_PROCESSING_LENGTH2)
                    {
                        BufWrite.Write(Block.SumHash,"hash");
                        BufWrite.Write(Block.SumPow,"uint");
                    }

                    BufWrite.Write(Block.TreeHash,"hash");
                    BufWrite.Write(Block.AddrHash,"hash");
                }
            }
        }

        //ToLog("Send StartNum="+BlockNum+" len="+arr.length+" find hash="+this.GetStrFromHashShort(LoadHash)+" BlockDB="+BlockDB)
        this.Send(Info.Node,
            {
                "Method":"RETBLOCKHEADER",
                "Context":Info.Context,
                "Data":BufWrite
            },1
        );
    }

    GetBlockArrFromBuffer(BufRead,Info)
    {

        //=====================================
        //десериализация BLOCKHEADER
        //Формат:
        //StartNum = 6 байт
        //Count = 4 байт
        //Hash * 16 * 32 байта
        //SumHash * 32 байта
        //SumPow * 6 байт
        //TreeHash+AddrHash * N * 64 байта
        //=====================================

        if(BufRead.length<10)
            return [];
        var StartNum=BufRead.Read("uint");
        var CountLoad=BufRead.Read("uint32");
        var BufSize=6+4+BLOCK_PROCESSING_LENGTH2*32+32+6 + CountLoad*64;
        if(CountLoad<=0 || BufSize!==BufRead.length)
        {
            return [];
        }


        var PrevBlock;
        var BlockArr=[];
        for(var i=0;i<CountLoad+BLOCK_PROCESSING_LENGTH2;i++)
        {
            var Block={};
            Block.BlockNum=StartNum+i;

            if(i<BLOCK_PROCESSING_LENGTH2)
            {
                Block.Hash=BufRead.Read("hash");
            }
            else
            {
                if(i===BLOCK_PROCESSING_LENGTH2)
                {
                    Block.SumHash=BufRead.Read("hash");
                    Block.SumPow=BufRead.Read("uint");
                }

                Block.TreeHash=BufRead.Read("hash");
                Block.AddrHash=BufRead.Read("hash");


                //предыдущий хеш считается на основании нескольких предыдущих блоков (предыдущие со сдвигом BLOCK_PROCESSING_LENGTH)
                var arr=[];
                var start=i-BLOCK_PROCESSING_LENGTH2;
                for(var n=0;n<BLOCK_PROCESSING_LENGTH;n++)
                {
                    var Prev=BlockArr[start+n];
                    arr.push(Prev.Hash);
                }
                Block.PrevHash=CalcHashFromArray(arr,true);
                Block.SeqHash=this.GetSeqHash(Block.BlockNum,Block.PrevHash,Block.TreeHash)
                Block.Hash=CalcHashFromArray([Block.SeqHash,Block.AddrHash],true);

                Block.Power=GetPowPower(Block.Hash);
                if(PrevBlock)
                {
                    Block.SumHash=shaarr2(PrevBlock.SumHash,Block.Hash);
                    //Block.SumPow=PrevBlock.SumPow+Block.Power;
                }
                PrevBlock=Block;
            }

            // Block.PROF="B##:"+Math.floor(Block.BlockNum/BLOCK_COUNT_IN_MEMORY);
            // Block.PROF2="B##="+Block.BlockNum;
            Block.Info="Loaded from: "+GetNodeStrPort(Info.Node);
            Block.TrCount=0;
            Block.TrDataPos=0;
            Block.TrDataLen=0;

            BlockArr.push(Block);
        }

        //отрезаем пустые блоки (1-е 16)
        for(var i=BlockArr.length-1;i>=0;i--)
        {
            var Block=BlockArr[i];
            if(!Block.SumHash)
            {
                BlockArr=BlockArr.slice(i+1);
                break;
            }
        }
        if(BlockArr.length>0 && BlockArr[0].BlockNum===BLOCK_PROCESSING_LENGTH2)
            BlockArr.unshift(this.ReadBlockHeaderDB(BLOCK_PROCESSING_LENGTH2-1));
        return BlockArr;

    }


    RETBLOCKHEADER_FOWARD(Info,CurTime)
    {
        if(!Info.Context.Foward)
            return;

        var Context=this.LoadHistoryContext;
        Context.time=undefined;// не ждем 1 сек

        //серилизация из буфера
        var BufRead=BufLib.GetReadBuffer(Info.Data);
        var arr=this.GetBlockArrFromBuffer(BufRead,Info);


        var arr2=[];
        var bFindDB=0;
        if(arr.length>1)
        for(var i=0;i<arr.length;i++)
        {
            var Block=arr[i];
            if(Block.BlockNum===CHECK_POINT.BlockNum && !IsZeroArr(CHECK_POINT.Hash))
            {
                if(CompareArr(CHECK_POINT.Hash,Block.Hash)!==0)
                {
                    break;
                }
                //TODO
                Context.FindCheckPoint=true;
            }
            if(Block.BlockNum<SERVER.BlockNumDB)
            {
                //ToLog("*************************************************************************Block.BlockNum<SERVER.BlockNumDB : "+Block.BlockNum+" < "+SERVER.BlockNumDB);
                break;
            }



            if(!bFindDB)
            {
                var BlockDB=this.ReadBlockHeaderDB(Block.BlockNum);
                if(BlockDB && CompareArr(BlockDB.SumHash,Block.SumHash)===0)
                {
                    bFindDB=1;
                    arr2.push(Block);
                }
            }
            else
            if(bFindDB)
            {
                arr2.push(Block);
            }
        }


        if(arr2.length>1)
        {
            Context.WasLoadNum=1;
            var chain={id:0,StopSend:1,WriteToDBAfterLoad:1};
            this.ChainBindMethods(chain);
            //this.LoadedChainList=[chain];
            this.SetChainNum(chain);
            this.PrepareTransactionsForLoad(chain,arr2);
            Context.BlockNum=Block.BlockNum;
            Context.Pause=1;
        }
        else
        {
            if(!Context.WasLoadNum)
            {
                //ищем начало загружаемого блока (идем в начало)
                //ToLog("Not found: "+Context.BlockNum+" from node:"+Info.Node.port);
                Context.BlockNum=Math.floor(Context.BlockNum-Context.DeltaBlockNum);
                Context.DeltaBlockNum=Context.DeltaBlockNum*1.2;
                if(Context.BlockNum<0)
                    Context.BlockNum=0;

                this.BlockNumDB=Context.BlockNum;
                //this.TruncateBlockDB(Context.BlockNum);
            }
            else
            {
                var keysend=""+Info.Node.addrStr+":"+Context.BlockNum;
                Context.MapSend[keysend]=1;
            }
            //следующая отправка другой ноде через 100 мс
        }

    }

    RETBLOCKHEADER(Info,CurTime)
    {
        if(Info.Context.Foward)
            return this.RETBLOCKHEADER_FOWARD(Info,CurTime);

        var chain=Info.Context.Chain;
        if(chain && !chain.StopSend && !chain.Deleted)
        {
            //серилизация из буфера
            var BufRead=BufLib.GetReadBuffer(Info.Data);
            chain.time=undefined;// не ждем 1 сек
            var arr=this.GetBlockArrFromBuffer(BufRead,Info);
            if(arr.length<=1)
            {
                var keysend=""+Info.Node.addrStr+":"+chain.BlockNum;
                chain.MapSend[keysend]=1;

                chain.AddInfo("NO:"+GetNodeStrPort(Info.Node));
                //следующая отправка другой ноде через 100 мс
                return;
            }
            chain.AddInfo("L="+arr.length+" from:"+GetNodeStrPort(Info.Node));
            //ToLog("id="+chain.id+" Get from "+Info.Node.port+"  StartNum="+arr[0].BlockNum+" len="+arr.length);

            //ADD_TO_STAT("HEADER_LOADED",arr.lengt);
            //СОЗДАНИЕ ДЕРЕВА ЦЕПОЧЕК ИЗ ПРИШЕДШИХ БЛОКОВ


            var NextLoadBlock;
            var PrevBlock;
            for(var i=arr.length-1;i>=0;i--)
            {
                var Block=arr[i];
                // if(Block.BlockNum===CHECK_POINT.BlockNum && !IsZeroArr(CHECK_POINT.Hash))
                // {
                //     if(CompareArr(CHECK_POINT.Hash,Block.Hash)!==0)
                //     {
                //
                //     }
                // }


                var StrKey=GetHexFromArr(Block.SumHash);
                var MapBlockLoaded=this.GetMapLoaded(Block.BlockNum);

                var BlockFind=MapBlockLoaded[StrKey];
                if(BlockFind && BlockFind.chain!==chain && BlockFind.chain.Deleted)
                {
                    delete MapBlockLoaded[StrKey];
                    BlockFind=undefined;
                }

                if(!chain.BlockHead)
                    chain.BlockHead=Block;
                if(!chain.BlockNumMax)
                    chain.BlockNumMax=Block.BlockNum;





                var PrevBlock0=PrevBlock;


                if(BlockFind)
                {
                    if(PrevBlock)
                    {
                        PrevBlock.BlockDown=BlockFind;
                        PrevBlock.Send=undefined;
                    }
                    PrevBlock=BlockFind;
                }
                else
                {
                    if(PrevBlock)
                    {
                        PrevBlock.BlockDown=Block;
                        PrevBlock.Send=undefined;
                    }
                    PrevBlock=Block;
                }


                if(BlockFind && BlockFind.chain!==chain)
                {
                    //chain.AddInfo("Find:"+BlockFind.BlockNum+"/"+this.GetStrFromHashShort(BlockFind.SumHash));

                    chain.ParentChain=BlockFind.chain;
                    chain.RootChain=BlockFind.chain.GetRootChain();
                    chain.RootChain.BlockNumMax=chain.BlockHead.BlockNum;//контроль протухания и для условия записи в БД



                    chain.StopSend=true;
                    chain.AddInfo("StopSend - Find load Block");


                    break;
                }
                else
                if(!BlockFind)
                {
                    Block.chain=chain;

                    Block.Node=Info.Node;
                    var StrSumHash=GetHexFromArr(Block.SumHash);
                    MapBlockLoaded[StrSumHash]=Block;
                    var StrHash=GetHexFromArr(Block.Hash);
                    MapBlockLoaded["H:"+StrHash]=Block;
                    var StrTreeHash=GetHexFromArr(Block.TreeHash);
                    MapBlockLoaded["TH:"+StrTreeHash]=Block;



                    var BlockDB=this.ReadBlockHeaderDB(Block.BlockNum);
                    if(BlockDB)
                    {
                        chain.LoadCountDB++;
                        chain.LoadSumDB+=BlockDB.Power;
                        chain.LoadSum+=Block.Power;

                        if(CompareArr(BlockDB.SumHash,Block.SumHash)===0)
                        {
                            //ToLog("FindBlockDB="+Block.BlockNum)
                            Block.FindBlockDB=true;
                            Block.SumPow=BlockDB.SumPow;

                            chain.FindBlockDB=true;
                            chain.StopSend=true;
                            chain.AddInfo("BlockFind - Find Block in DB");

                            NextLoadBlock=undefined;
                            break;
                        }
                    }

                    NextLoadBlock=Block;
                }

            }


            if(NextLoadBlock && !NextLoadBlock.chain.StopSend)
            {
                if(arr.length>=chain.Count)
                {
                    chain.Count=chain.Count*2;
                    if(chain.Count>COUNT_BLOCKS_FOR_LOAD)
                        chain.Count=COUNT_BLOCKS_FOR_LOAD;

                }

                if(chain.LoadCountDB>=COUNT_BLOCKS_FOR_CHECK_POW)
                {
                    if(chain.LoadSumDB*PERCENT_SUM_BLOCKS_FOR_STOP_CHECK_POW/100 > chain.LoadSum)
                    {
                        var Str="Err sum Pow chains: SumDB > Sum loaded from: "+NodeInfo(Info.Node);
                        chain.StopSend=true;
                        chain.AddInfo(Str);
                        ToLog("======================================================"+Str);
                    }
                }

                if(!chain.StopSend)
                    this.BlockChainLoad(NextLoadBlock);
            }

            if(chain.GetFindDB())
                this.CheckToStartLoadBlockData(chain);

        }
    }

    BlockChainLoad(Block)
    {
        var chain=Block.chain;
        Block.Send=undefined;

        chain.BlockNum=Block.BlockNum;
        chain.Hash=Block.SumHash;
        chain.IsSum=true;

        chain.StopSend=false;
        chain.FindBlockDB=false;
        chain.RootChain=undefined;
        chain.ParentChain=undefined;

        chain.AddInfo("SetChainSend:"+chain.BlockNum);
    }


    CheckToStartLoadBlockData(chain)//----------------------------------------------------------------------------------
    {
        if(chain.Deleted)
            return;


        var arr=this.GetArrFromChain(chain)
        if(arr.length<2)
            return;

        var BlockMax=arr[arr.length-1];
        var BlockMin=arr[0];

        // var BlockDBMin=this.ReadBlockHeaderDB(BlockMin.BlockNum);
        // if(!BlockDBMin)
        // {
        //     Str=("1.BlockDBMin=0.   block num=" + BlockMin.BlockNum+"   chain.BlockNum="+chain.BlockNum);
        //     chain.AddInfo(Str);
        //     ToLog("id="+chain.id+"================================================================================="+Str);
        //
        //     throw "BlockDBMin=0"
        //     return;
        // }
        // //BlockMin.bSave=true;
        //
        // if(CompareArr(BlockMin.SumHash,BlockDBMin.SumHash)!==0)
        // {
        //     var Str="2.Bad SumHash, block num=" + BlockMin.BlockNum;
        //     chain.AddInfo(Str);
        //
        //     ToLog("id="+chain.id+"================================================================================="+Str);
        //     throw "2 Bad SumHash"
        //     return;
        // }
        // for(var i=1;i<arr.length;i++)
        // {
        //     var PrevBlock=arr[i-1];
        //     var Block=arr[i];
        //
        //     var SumHash=shaarr2(PrevBlock.SumHash,Block.Hash);
        //     if(CompareArr(SumHash,Block.SumHash)!==0)
        //     {
        //         var Str="3.Bad SumHash: block num=" + Block.BlockNum+"  chainPrev:"+PrevBlock.chain.id+"  chainCur:"+Block.chain.id;
        //         chain.AddInfo(Str);
        //         ToLog("id="+chain.id+"================================================================================="+Str);
        //
        //         throw "3 Bad SumHash"
        //         return;
        //     }
        // }
        //


        //TODO - MERGING блоков подбор лучших (только для последних 4х)
        var startMerge=this.CurrentBlockNum+TIME_START_POW-BLOCK_PROCESSING_LENGTH;
        if(0 && BlockMax.BlockNum>startMerge)
        {
            var delta=BlockMax.BlockNum-startMerge;
            var startindex=arr.length-delta-1;
            if(startindex<1)
                startindex=1;
            //ToLog("Recalc block: "+BlockMax.BlockNum+"  = "+delta+" startindex="+startindex+"/"+arr.length)
            for(var i=startindex;i<arr.length;i++)
            {
                var Block=arr[i];
                var BlockDB=this.ReadBlockHeaderDB(Block.BlockNum);
                if(!BlockDB)
                    break;
                var PrevBlock=arr[i-1];
                if(!PrevBlock)
                {
                    ToLog('throw "!PrevBlock i="+i')
                    throw "!PrevBlock i="+i
                    break;
                }


                if(CompareArr(BlockDB.SeqHash,Block.SeqHash)===0)
                    if(BlockDB.Power>Block.Power)
                    //if(GetPowPower(BlockDB.Hash)>GetPowPower(Block.Hash))
                    {
                        Block=BlockDB;
                        arr[i]=Block;
                        ToLog("*******************************Set block from DB: "+Block.BlockNum)
                    }

                Block.SumPow=PrevBlock.SumPow+Block.Power;
                Block.SumHash=shaarr2(PrevBlock.SumHash,Block.Hash);
            }

        }

        //Calc Sum POW
        var PrevBlock=BlockMin;
        for(var i=1;i<arr.length;i++)
        {
            var Block=arr[i];
            Block.SumPow=PrevBlock.SumPow+Block.Power;
            PrevBlock=Block;
        }
        //Оценка POW
        var BlockNow=this.ReadBlockHeaderDB(BlockMax.BlockNum);
        if(BlockNow && (BlockMax.SumPow<BlockNow.SumPow || BlockMax.SumPow===BlockNow.SumPow && CompareArr(BlockMax.Hash,BlockNow.Hash)<0))
        {
            var Str="Low SumPow";
            //chain.Error=true;
            //ToLog("id="+chain.id+" --------------------------------------"+Str);
            chain.AddInfo(Str);
            return;
        }

        var Str="Start Load blocks: "+(BlockMin.BlockNum+1)+"  -  "+BlockMax.BlockNum;
        chain.AddInfo(Str);

        //Загрузка списка транзакций
        this.PrepareTransactionsForLoad(chain,arr);
    }


    GetArrFromChain(chain)
    {
        var arr=[];
        var Block=chain.BlockHead;
        while(Block)
        {
            arr.unshift(Block)
            if(Block.AddToLoad || Block.FindBlockDB || Block.LoadDBFinaly)
            {
                 break;
            }

            Block=Block.BlockDown;
        }
        return arr;
    }

    CopyBlockToMem(Block,chain)
    {
        var BlockMem=this.BlockChain[Block.BlockNum];
        this.BlockChain[Block.BlockNum]=Block;
        if(BlockMem)
        {
            Block.MaxPOW=BlockMem.MaxPOW;
            Block.MaxSum=BlockMem.MaxSum;
            Block.Info=BlockMem.Info;
            Block.Info+="\n--copy mem--"
        }
        else
        {
            Block.MaxPOW={};
            var POW=Block.MaxPOW;
            POW.SeqHash=Block.SeqHash;
            POW.AddrHash=Block.AddrHash;
            POW.PrevHash=Block.PrevHash;
            POW.TreeHash=Block.TreeHash;
            POW.Hash=Block.Hash;
            POW.SumPow=Block.SumPow;
            POW.port=0;

            Block.MaxSum={};
            POW=Block.MaxSum;
            POW.SeqHash=Block.SeqHash;
            POW.AddrHash=Block.AddrHash;
            POW.PrevHash=Block.PrevHash;
            POW.TreeHash=Block.TreeHash;
            POW.Hash=Block.Hash;
            POW.SumHash=Block.SumHash;
            POW.SumPow=Block.SumPow;
            POW.port=0;
            Block.Info+="\n--create mem--"
        }
        Block.Prepared=true;
        Block.MinTrPow=undefined;

        if(chain)
        AddInfoBlock(Block,"LOAD:"+this.GetStrFromHashShort(Block.SumHash)+"  id:"+chain.id);
        this.AddToStatBlockConfirmation(Block);
    }
    AddToStatBlockConfirmation(Block)
    {
        if(Block.BlockNum>START_BLOCK_RUN+BLOCK_PROCESSING_LENGTH2)
        {
            var TimeDelta=this.CurrentBlockNum-Block.BlockNum;
            ADD_TO_STAT("MAX:BlockConfirmation",TimeDelta);
        }
        else
        {
            ADD_TO_STAT("MAX:BlockConfirmation",BLOCK_PROCESSING_LENGTH);
        }
    }


    PrepareTransactionsForLoad(chain,arr,bNoSlice)
    {
        if(!bNoSlice)
            arr=arr.slice(1);

        chain.arr=arr;
        if(arr.length>0)
        {
            for(var i=0;i<arr.length;i++)
                arr[i].AddToLoad=1;

            chain.CurNumArrLoad=0;
            ToLog("Start blocks load id="+chain.id+" Count="+arr.length+" FROM: "+arr[0].BlockNum+" TO "+arr[arr.length-1].BlockNum);
        }
    }

    LoopBlockLoad()
    {
        if(glStopNode)
            return;

        var CountSend=0;
        for(var num=0;num<this.LoadedChainList.length;num++)
        {
            var chain=this.LoadedChainList[num];
            if(chain && chain.arr && chain.arr.length && chain.StopSend)
            {
                var Count=0;
                for(var i=chain.CurNumArrLoad;i<chain.arr.length;i++)
                {
                    Count++;
                    // if(Count>MAX_BLOCK_LOAD)
                    //      break;

                    var Block=chain.arr[i];
                    if(!IsZeroArr(Block.TreeHash) && !Block.TreeEq && !Block.LoadDBFinaly)
                    {
                        if(!Block.MapSend)
                        {
                            //анализируем необходимость загрузки содержимого транзакций
                            if(!Block.BodyLoad)
                            {
                                var BlockDB=this.ReadBlockHeaderDB(Block.BlockNum);
                                if(BlockDB)
                                {
                                    if(CompareArr(BlockDB.TreeHash,Block.TreeHash)==0)
                                    {
                                        Block.TreeEq=true;
                                        Block.BodyFileNum=BlockDB.BodyFileNum;
                                        Block.TrDataPos=BlockDB.TrDataPos;
                                        Block.TrDataLen=BlockDB.TrDataLen;

                                        //AddInfoBlock(Block,"**TREE EQ**");
                                        //ToLog("Block.TreeEq in "+Block.BlockNum);
                                        continue;
                                    }
                                }
                            }


                            Block.MapSend={};
                        }


                        if(this.SendBlockNext(Block))
                        {
                            CountSend++;
                            if(CountSend>=MAX_BLOCK_SEND)
                                return;
                        }
                    }
                    else
                    if(i===chain.CurNumArrLoad)
                    {
                        chain.CurNumArrLoad++;
                        Block.LoadDBFinaly=true;
                        Count=0;
                    }


                }

                this.CheckAndWriteLoadedChain(chain);

            }
        }


    }


    CheckAndWriteLoadedChain(chain)
    {
        if(chain.CurNumArrLoad>=chain.arr.length)
        {
            //условие завершения цикла загрузки цепочек:
            var Block=chain.arr[chain.arr.length-1];

            //var Hight=GetCurrentBlockNumByTime()-Block.BlockNum;
            //ADD_TO_STAT("MAX:HIGHT",Hight)

            if(chain.WriteToDBAfterLoad || Block.BlockNum>=this.CurrentBlockNum+TIME_START_LOAD)
            {
                //проверяем загрузки предыдущих цепочек
                var bAllLoaded=true;
                if(!chain.WriteToDBAfterLoad)
                {
                    var cur_parent=chain.ParentChain;
                    while(cur_parent)
                    {
                        if(cur_parent.arr && cur_parent.CurNumArrLoad<cur_parent.arr.length)
                        {
                            bAllLoaded=false;
                            break;
                        }

                        cur_parent=cur_parent.ParentChain;
                    }
                }

                if(bAllLoaded)
                {
                    var arr=[];
                    var cur_chain=chain;
                    while(cur_chain)
                    {
                        if(cur_chain.arr)
                            for(var i=cur_chain.arr.length-1;i>=0;i--)
                            {
                                var Block=cur_chain.arr[i];
                                arr.unshift(Block);
                            }
                        cur_chain=cur_chain.ParentChain;
                    }
                    this.WriteLoadedBlockArr(arr);
                }
            }

        }
    }



    WriteLoadedBlockArr(arr)
    {
        if(!arr.length)
            return;

        ToLog("WRITE DATA Count:"+arr.length+"  "+arr[0].BlockNum+"-"+arr[arr.length-1].BlockNum);
        //if(arr[arr.length-1].BlockNum)

        //smart-contracrs
        //Отправляем сигнал об удалении старых блоков
        this.OnTruncate(arr[0]);

        var CurrentBlockNum=GetCurrentBlockNumByTime()

        var Block;
        for(var i=0;i<arr.length;i++)
        {
            Block=arr[i];
            Block.BlockDown=undefined;

            //ToLog("Write: "+Block.BlockNum)
            var Res=0;
            if(Block.TreeEq)
            {
                this.ReadBlockBodyDB(Block);//for smart contracts and mem
                Res=this.WriteBlockDBFinaly(Block);
            }
            else
            {
                if(IsZeroArr(Block.TreeHash))
                {
                    Block.BodyFileNum=0;
                    Res=this.WriteBlockDB(Block);
                }
                else
                {
                    ToLogTrace("IsZeroArr(Block.TreeHash)")
                    throw "IsZeroArr(Block.TreeHash)";
                }
            }
            if(!Res)
            {
                ToLog("ERROR WRITE DB, NUM="+Block.BlockNum);
                this.FREE_ALL_MEM_CHAINS();
                return;
            }
            Block.LoadDB=true;
            if(Block.BlockNum>=CurrentBlockNum-BLOCK_COUNT_IN_MEMORY)
            {
                this.CopyBlockToMem(Block);
            }
            else
            {
                //free mem
                if(Block.arrContent)
                    Block.arrContent.length=0;
                Block.arrContent=undefined;
            }
        }


        //удаляем более поздние блоки как возможно не валидные


        var CurNum=Block.BlockNum+1;
        while(true)
        {
            var BlockMem=this.BlockChain[CurNum];
            if(BlockMem)
            {
                BlockMem.bSave=false;
                this.ReloadTrTable(BlockMem);
                BlockMem.Info+="\n--delete old--"
            }

            if(!BlockMem)
                break;

            CurNum++;
        }







        ADD_TO_STAT("WRITECHAIN_TO_DB_COUNT",arr.length);
        this.FREE_ALL_MEM_CHAINS();

    }





    SendBlockNext(Block)
    {
        var SendResult=0;
        var Key=GetHexFromArr(Block.TreeHash);
        while(true)
        {
            var Ret=this.GetNextNode(Block,Key,true,Block.BlockNum);
            if(Ret.Result)
            {
                //ADD_TO_STAT("DO_SENDBLOCKNEXT");

                var Node=Ret.Node;
                // if(Node.INFO && Block.BlockNum>Node.INFO.BlockNumDB)
                // {
                //
                //     //var keysend=""+Node.addrStr+":"+Key;
                //     //Block.MapSend[keysend]=1;
                //     //Block.time=undefined;
                //     continue;
                // }
                //
                //this.RecalcLoadBlockStatictic();
                // if(Node.LoadBlockCountAll===0)
                // {
                //     if(Node.SendBlockCountAll+Node.SendBlockCount===0)
                //     {
                //         this.SendCanBlock(Node,Block);
                //     }
                //     return 0;
                // }
                // if(Node.CanGetBlocks<=0)
                //     return 0;
                // Node.CanGetBlocks--;


                if(!Block.Context)
                     Block.Context={Block:Block};
                this.SendF(Node,
                    {
                        "Method":"GETBLOCK",
                        "Context":Block.Context,
                        "Data":{BlockNum:Block.BlockNum,TreeHash:Block.TreeHash}

                    }
                );
                Node.SendBlockCount++;
                SendResult=1;
                //ToLog("SEND GETBLOCK:"+Block.BlockNum+" to "+Node.port)

                AddInfoBlock(Block,"SendNext")


                if(Block.chain)
                    Block.chain.AddInfo("QUERY BL:"+Block.BlockNum+"/"+this.GetStrFromHashShort(Block.TreeHash)+" TO:"+GetNodeStrPort(Node));
            }
            else
            {
                if(!Ret.timewait)
                {
                    this.ClearChains(Block.chain,true);
                    //this.FREE_ALL_MEM_CHAINS();
                }
            }
            break;
        }

        return SendResult;
    }
    ClearChains(DeleteChain,bShow)
    {
        if(!DeleteChain)
        {
            this.FREE_ALL_MEM_CHAINS();
            return this.LoadedChainList.length;
        }
        var allsum=this.LoadedChainList.length;

        var Sum=0;
        for(var i=0;i<this.LoadedChainList.length;i++)
        {
            var chain=this.LoadedChainList[i];
            if(chain)
            {
                if(chain===DeleteChain)
                {
                    chain.Deleted=true;
                    this.LoadedChainList[i]=undefined;
                    Sum++;
                }
                if(chain.ParentChain===DeleteChain)
                {
                    Sum+=this.ClearChains(chain);
                }
            }
        }

        if(bShow)
        {
            ToLog("===========ClearChains================= "+DeleteChain.id+" count="+Sum+"/"+allsum)
        }

        return Sum;
    }

    static GETBLOCK_F()
    {
        return "{\
                    BlockNum:uint,\
                    TreeHash:hash\
                }";
    }


    RecalcLoadBlockStatictic()
    {
        return;

        var TimeNum=Math.floor(((new Date)-0)/STAT_BLOCK_LOAD_PERIOD);
        if(this.LoadBlockStatNum===TimeNum)
            return;
        this.LoadBlockStatNum=TimeNum;

        const PeriodSec=5;
        const Period=CONSENSUS_PERIOD_TIME/STAT_BLOCK_LOAD_PERIOD;
        const PeriodCount=PeriodSec*Period;

        var FreeGet=64;
        var it=this.ActualNodes.iterator(), Node;
        while((Node = it.next()) !== null)
        {
            var arr=Node.SendBlockArr;
            arr.push(Node.SendBlockCount);
            if(arr.length>PeriodCount)
            {
                arr.shift();
            }


            arr=Node.LoadBlockArr;
            arr.push(Node.LoadBlockCount);
            if(arr.length>PeriodCount)
            {
                arr.shift();
            }

            var SendPackets=0;
            var LoadPackets=0;
            for(var i=0;i<Node.SendBlockArr.length;i++)
                SendPackets+=Node.SendBlockArr[i];
            for(var i=0;i<Node.LoadBlockArr.length;i++)
                LoadPackets+=Node.LoadBlockArr[i];

            Node.SendBlockCountAll=SendPackets;
            Node.LoadBlockCountAll=LoadPackets;

            var Nuts=Math.floor(LoadPackets/PeriodSec);
            var RestPackets=SendPackets-LoadPackets;
            var CountGet=1+Math.floor(Math.max(0,(Nuts-RestPackets/Period)));
            Node.CanGetBlocks=Math.min(FreeGet,CountGet);
            FreeGet-=Node.CanGetBlocks;
            Node.SendBlockCount=0;
            Node.LoadBlockCount=0;

            ADD_TO_STAT("NODE_CAN_GET:"+NodeName(Node),Node.CanGetBlocks);
        }
    }

    GETBLOCK(Info,CurTime)
    {
        var Data=this.DataFromF(Info);
        var BlockNum=Data.BlockNum;
        var TreeHash=Data.TreeHash;


        if(Info.Context.SendCount)
        {
            return;
        }

        //ToLog("GETBLOCK="+BlockNum);

        var BufWrite;
        var BlockDB;
        if(TreeHash && !IsZeroArr(TreeHash))
            BlockDB=this.ReadBlockDB(BlockNum);
        var StrSend;
        if(BlockDB && CompareArr(BlockDB.TreeHash,TreeHash)===0)
        {

            var BufWrite=BufLib.GetBufferFromObject(BlockDB,Formats.BLOCK_TRANSFER,MAX_PACKET_LENGTH,Formats.WRK_BLOCK_TRANSFER);
            StrSend="OK"

        }
        else
        {
            //ищем среди загруженных в память
            var BlockFind=this.FindBlockInLoadedChain(BlockNum,TreeHash);
            if(BlockFind && CompareArr(BlockFind.TreeHash,TreeHash)===0)
            {
                var Res=this.ReadBlockBodyDB(BlockFind);
                if(Res)
                {
                    var BufWrite=BufLib.GetBufferFromObject(BlockFind,Formats.BLOCK_TRANSFER,MAX_PACKET_LENGTH,Formats.WRK_BLOCK_TRANSFER);
                    StrSend="OK"
                    ADD_TO_STAT("BLOCK_SEND_MEM");
                    //ToLog("BLOCK_SEND_MEM:"+BlockNum+" TreeHash="+GetHexFromArr(TreeHash)+" BlockTreeHash="+GetHexFromArr(BlockFind.TreeHash))
                }
            }
        }

        if(StrSend==="OK")
            ADD_TO_STAT("BLOCK_SEND");
        else
        {
            BufWrite=BufLib.GetNewBuffer(100);
            StrSend="NO"
        }

        // var Block=this.BlockChain[BlockNum];
        // if(Block)
        // {
        //     AddInfoBlock(Block,"GETBLOCK TH:"+this.GetStrFromHashShort(TreeHash)+" "+StrSend)
        // }

        this.Send(Info.Node,
            {
                "Method":"RETGETBLOCK",
                "Context":Info.Context,
                "Data":BufWrite
            },1
        );
    }

    RETGETBLOCK(Info,CurTime)
    {
        var Block=Info.Context.Block;
        // if(Block)
        //     ToLog("BLOCK:"+Block.BlockNum);
        if(Block && Block.TreeEq)
        {
            //ToLog("BLOCK WAS LOAD:"+Block.BlockNum+"  NODE="+Info.Node.port);
            ADD_TO_STAT("DOUBLE_RETGETBLOCK")
        }

        if(Block && !Block.TreeEq)
        {
            var Data=BufLib.GetObjectFromBuffer(Info.Data,Formats.BLOCK_TRANSFER,Formats.WRK_BLOCK_TRANSFER);
            Info.Data=undefined;

             if(Data.BlockNum!==Block.BlockNum || CompareArr(Data.TreeHash,Block.TreeHash)!==0)
            {
                this.SetBlockNOSendToNode(Block,Info.Node,"NO");
                return;
            }

            if(Block.chain)
            {
                Block.chain.AddInfo("Load TR:"+Data.BlockNum+"/"+this.GetStrFromHashShort(Data.TreeHash)+" from:"+GetNodeStrPort(Info.Node));
                AddInfoBlock(Block,"LOAD TR OK")
            }

            var arrContent=Data.arrContent;


            var TreeHash=this.CalcTreeHashFromArrBody(arrContent);
            if(CompareArr(Block.TreeHash,TreeHash)!==0)
            {
                ToLog("BAD CMP TreeHash block="+Block.BlockNum+" from:"+NodeName(Info.Node)+"  TreeHash="+GetHexFromArr(TreeHash)+"  BlockTreeHash="+GetHexFromArr(Block.TreeHash));
                this.SetBlockNOSendToNode(Block,Info.Node,"BAD CMP TreeHash");
                return;
            }

            //DApp check
            if(arrContent.length>0)
            {
                var TR=arrContent[0];
                if(TR[0]===TYPE_TRANSACTION_ACC_HASH)
                {
                    if(!DApps.Accounts.TRCheckAccountHash(TR,Data.BlockNum))
                    {
                        ToLog("BAD ACCOUNT Hash in block="+Block.BlockNum+" from:"+NodeName(Info.Node));
                        this.SetBlockNOSendToNode(Block,Info.Node,"BAD CMP ACC HASH");
                        //this.DeleteNodeFromActive(Info.Node);
                        //this.AddToBan(Info.Node);
                        return;
                    }
                }
            }


            Block.BodyFileNum=this.GetChainFileNum(Block.chain);
            Block.arrContent=arrContent;
            var Ret=this.WriteBodyDB(Block);

            //clear mem:
            Block.TrCount=0;
            Block.arrContent.length=0;
            Block.arrContent=undefined;

            if(!Ret)
            {
                this.SetBlockNOSendToNode(Block,Info.Node,"Error write");
                return;
            }
            Block.TreeEq=true;
            Block.Send=undefined;



            ADD_TO_STAT("BLOCK_LOADED",1);

            Info.Node.LoadBlockCount++;
        }
    }



    SendCanBlock(Node,Block)
    {
        Node.SendBlockCount++;

        if(!Node.INFO.BlockNumDB)
            return;

        if(Node.INFO.BlockNumDB>=Block.BlockNum)
        {
            this.SendF(Node,
                {
                    "Method":"CANBLOCK",
                    "Data":{BlockNum:Block.BlockNum}
                }
            );
        }
    }

    static CANBLOCK_F()
    {
        return "{BlockNum:uint}";
    }

    CANBLOCK(Info,CurTime)
    {
        var Data=this.DataFromF(Info);

        this.SendF(Info.Node,
            {
                "Method":"RETCANBLOCK",
                "Data":{Result:1}
            }
        );
    }
    static RETCANBLOCK_F()
    {
        return "{Result:byte}";
    }

    RETCANBLOCK(Info,CurTime)
    {
        var Data=this.DataFromF(Info);
        if(Data.Result===1)
        {
            Info.Node.LoadBlockCount++;
        }
    }


    SetBlockNOSendToNode(Block,Node,Str)
    {
        //следующая отправка другой ноде через 100 мс
        var Str=GetHexFromArr(Block.TreeHash);
        var Str2=this.GetStrFromHashShort(Block.TreeHash);
        var keysend=""+Node.addrStr+":"+Str;
        Block.MapSend[keysend]=1;
        if(Block.chain)
            Block.chain.AddInfo(""+Block.BlockNum+" "+Str2+"<-"+GetNodeStrPort(Node));
    }


    FindBlockInLoadedChain(BlockNum,TreeHash)
    {
        var StrTreeHash=GetHexFromArr(TreeHash);
        var MapBlockLoaded=this.GetMapLoaded(BlockNum);
        var BlockFind=MapBlockLoaded["TH:"+StrTreeHash];
        if(BlockFind && BlockFind.TreeEq)
            return BlockFind;
        else
            return undefined;
    }


    //CHECK!!
    //CHECK!!
    //CHECK!!

    CheckSeqHashDB(Block,StrError)
    {
        if(Block.BlockNum<BLOCK_PROCESSING_LENGTH2)
            return true;



        for(var i=0;i<BLOCK_PROCESSING_LENGTH2;i++)
        {
            var num=Block.BlockNum-i-1;
            var PrevBlock=this.ReadBlockHeaderDB(num);
            if(!PrevBlock || !PrevBlock.bSave)
            {
                ToLog("-----------------------"+StrError+" ERROR calc hash - block num: "+Block.BlockNum+"  prev block not found: "+num);
                //throw "NO!!!"
                return false;
            }
        }

        var startPrev=Block.BlockNum-BLOCK_PROCESSING_LENGTH2;
        var arr=[];
        for(var i=0;i<BLOCK_PROCESSING_LENGTH;i++)
        {
            var num=startPrev+i;
            var PrevBlock=this.ReadBlockHeaderDB(num);
            arr.push(PrevBlock.Hash);
        }


        var PrevHash=CalcHashFromArray(arr,true);
        var testSeqHash=this.GetSeqHash(Block.BlockNum,PrevHash,Block.TreeHash)
        var testHash=CalcHashFromArray([testSeqHash,Block.AddrHash],true);
        if(CompareArr(testHash,Block.Hash)!==0)
        {
            var Str="-----------------------"+StrError+" ERROR hash - block num: "+Block.BlockNum+"  test PrevHash="+GetHexFromArr(PrevHash)+" test Hash="+GetHexFromArr(testHash);
            this.ToLogBlock(Block,Str);
            //throw "STOP!"
            //throw "ERROR hash!!!"
            //this.ErrorRun()
            return false;
        }

        return true;
    }

    ToLogBlock(Block,StrInfo)
    {
        ToLog("-------------"+StrInfo);
        ToLog("BlockNum="+(Block.BlockNum));
        ToLog("Hash="+GetHexFromArr(Block.Hash));
        ToLog("SeqHash="+GetHexFromArr(Block.SeqHash));
        ToLog("PrevHash="+GetHexFromArr(Block.PrevHash));
        ToLog("TreeHash="+GetHexFromArr(Block.TreeHash));
        ToLog("AddrHash="+GetHexFromArr(Block.AddrHash));
        ToLog("SumHash="+GetHexFromArr(Block.SumHash));
        ToLog("Comment:"+Block.Comment1+"   "+Block.Comment2);
        console.trace();
        process.exit();
    }


    CheckOnTimer()
    {
        var StartNum=GetCurrentBlockNumByTime()-BLOCK_PROCESSING_LENGTH;
        for(var n=16;n>=0;n--)
        {
            var num=StartNum-n;
            var CurBlockDB2=this.ReadBlockHeaderDB(num);
            var BlockMem=this.BlockChain[num];
            var bWasDB=true;
            if(!CurBlockDB2)
            {
                CurBlockDB2=BlockMem;
                bWasDB=false;
            }

            if(!CurBlockDB2 || !CurBlockDB2.bSave)
                break;



            var testSeqHash0=this.GetSeqHash(CurBlockDB2.BlockNum,CurBlockDB2.PrevHash,CurBlockDB2.TreeHash);
            if(CompareArr(testSeqHash0,CurBlockDB2.SeqHash)!==0)
            {
                if(BlockMem)
                    BlockMem.Comment2="NO";

                var Str=(""+n+" DB="+bWasDB+"  +++++++++++++++++++++++++++++++ERROR SeqHash - num="+num+"  test="+GetHexFromArr(testSeqHash0));
                ToLogBlock(CurBlockDB2,Str)
            }
            else
            {
                if(BlockMem)
                    BlockMem.Comment2="OK";
            }

        }

    }


    //MEM GETTERS
    //MEM GETTERS
    //MEM GETTERS

    GetBlock(num,bToMem,bReadBody)
    {
        bToMem = bToMem | true;

        if(num<this.CurrentBlockNum-BLOCK_COUNT_IN_MEMORY)
            bToMem=false;

        var Block=this.BlockChain[num];
        if(!Block)
        {
            if(bReadBody)
                Block=this.ReadBlockDB(num);
            else
                Block=this.ReadBlockHeaderDB(num);

            if(bToMem)
            {
                this.BlockChain[num]=Block;
            }
        }
        return Block;
    }

    GetMapLoaded(num)
    {
        if(num<0)
            num=0;
        var index=Math.floor(num/BLOCK_COUNT_IN_MEMORY);

        var map=this.MapMapLoaded[index];
        if(!map)
        {
            map={};
            this.MapMapLoaded[index]=map;
        }

        return map;
    }
    GetMapLoadedFromChain(chain)
    {
        return this.GetMapLoaded(chain.BlockNumStart);
    }

    FREE_MEM_BLOCKS(NumMax)
    {
        for(var key in this.BlockChain)
        {
            var Block=this.BlockChain[key];
            if(!Block || Block.BlockNum<NumMax)
            {
                delete this.BlockChain[key];
            }


        }
    }
    FREE_MEM_CHAINS(NumMax)
    {
        this.FREE_MEM_BLOCKS(NumMax-BLOCK_COUNT_IN_MEMORY);

        var maxArrMap=Math.floor(NumMax/BLOCK_COUNT_IN_MEMORY)-1;
        if(maxArrMap>=0)
        {
            var nWasCount=0;
            for(var key in this.MapMapLoaded)
            if(key<maxArrMap)
            {
                nWasCount++;
                delete this.MapMapLoaded[key];
            }
        }
    }
    FREE_ALL_MEM_CHAINS()
    {

        this.FREE_MEM_BLOCKS(this.BlockNumDB-BLOCK_COUNT_IN_MEMORY);

        for(var i=0;i<this.LoadedChainList.length;i++)
        {
            var chain=this.LoadedChainList[i];
            if(chain)
            {
                chain.Deleted=true;
                //chain.ParentChain=undefined;
                chain.ChainMax=undefined;
                //chain.BlockHead=undefined;
            }
        }


        if(!this.LoadHistoryMode)
        {
            this.AddValueToHistory("LoadedChainList",this.LoadedChainList);
            this.AddValueToHistory("MapMapLoaded",this.MapMapLoaded);
        }

        this.LoadedChainList=[];
        this.MapMapLoaded={};

        if(typeof gc==="function")//--nouse-idle-notification --expose-gc
            gc();
    }



    AddValueToHistory(typedata,val)
    {
        var Arr=this.HistoryBlockBuf.LoadValue(typedata,1);
        if(!Arr)
        {
            Arr=[];
            this.HistoryBlockBuf.SaveValue(typedata,Arr);
        }
        Arr.push(val)
    }

    GetHistoryTree(typedata)
    {
        var Tree=this.HistoryBlockBuf.LoadValue(typedata,1);
        if(!Tree)
        {
            Tree=new RBTree(CompareItemHash);
            this.HistoryBlockBuf.SaveValue(typedata,Tree);
        }
        return Tree;
    }



    ChainBindMethods(chain)
    {
        function GetRootChain()
        {
            var Count=0;
            var root_chain=this;
            while(root_chain.RootChain)
            {
                Count++;
                root_chain=root_chain.RootChain;
                if(Count>MAX_COUNT_CHAIN_LOAD)
                {
                    TO_ERROR_LOG("BLOCK",10,"Error COUNT GetRootChain");
                    break;
                }
            }
            return root_chain;
        }
        function GetFindDB()
        {
            return this.GetRootChain().FindBlockDB;
        }

        chain.GetRootChain=GetRootChain.bind(chain);
        chain.GetFindDB=GetFindDB.bind(chain);
        chain.AddInfo=AddInfoChain.bind(chain);


    }

    //LIB
    GetMemoryStamp(Str)
    {
        return Str+":##:"+Math.floor(this.CurrentBlockNum/BLOCK_COUNT_IN_MEMORY);//+"  NewB##="+BlockNum;
    }

    GetStrFromHashShort(Hash)
    {
        var Str=GetHexFromArr(Hash);
        if(typeof Str==="string")
            return Str.substr(0,4);
        else
            return "";
    }


    ToLogTime(startTime,Str)
    {
        const Time = process.hrtime(startTime);
        var deltaTime=(Time[0]*1000 + Time[1]/1e6);//ms
        ToLog(Str+" : "+deltaTime+"ms")
    }


    //LOOP LOAD BLOCK BODY
    AddBlockToLoadBody(Block)
    {
        if(!this.MapBlockBodyLoad[Block.BlockNum])
        {
            this.MapBlockBodyLoad[Block.BlockNum]=Block;
        }
    }
    LoopBlockBodyLoad()
    {
        // if(this.LoadHistoryMode)
        //     return;
        var arr=[];
        for(var key in this.MapBlockBodyLoad)
        {
            var Block=this.MapBlockBodyLoad[key];
            if(!Block.BodyLoad)
            {
                Block.BodyLoad=1;
                arr.push(Block);
            }
        }
        this.MapBlockBodyLoad={};
        if(!arr.length)
            return;

        var chain={StopSend:1,WriteToDBAfterLoad:1,BodyLoad:1};
        this.ChainBindMethods(chain);
        this.SetChainNum(chain);
        this.PrepareTransactionsForLoad(chain,arr,1);

     }


}

function AddInfo(Block,Str,BlockNumStart)
{
    if(Block.Info.length<2000)
    {
        var timesend=GetCurrentBlockNumByTime()-BlockNumStart;
        Str=timesend+": "+Str;
        Block.Info+="\n"+Str;
    }
}


global.AddInfoChain=function(Str)
{
    if(this.BlockNumStart>GetCurrentBlockNumByTime()-HISTORY_BLOCK_COUNT)
        AddInfo(this,Str,this.BlockNumStart);
}
global.AddInfoBlock=function(Block,Str)
{
    if(Block && Block.BlockNum && Block.BlockNum>GetCurrentBlockNumByTime()-HISTORY_BLOCK_COUNT)
        AddInfo(Block,Str,Block.BlockNum);
}
global.GetNodeStrPort=function(Node)
{
    if(!Node)
        return "";

    if(LOCAL_RUN)
        return ""+Node.port;
    else
    {
        if(!Node.ip)
            return "";
        var arr=Node.ip.split(".");

        return ""+arr[2]+"."+arr[3];
    }
}



//TODO: скачивать цепочки блоков у нод с минимальным пингом

//GetHexFromArr
//GetStrFromHashShort

//Servise:
//SERVER.ReWriteDAppTransactions(StartNum)
//SERVER.CheckBlocksOnStartFoward(StartNum,0);

