"use strict";
/**
 *  Copyright: Yuriy Ivanov, 2018 e-mail: progr76@gmail.com
 *  PapaDB - база данных на основе расширяемых хеш-таблиц
 *  Основые функции работы через групповую функцию обработки (актуально для некэшированного HDD)
 *  this.BulkOperationTrKeyDB(Mode,Arr,Info);
 *  Mode: "Find", "Write", "Delete", "Move"
 *
**/

const RBTree = require('bintrees').RBTree;

const fs = require('fs');
require("../library");
const DBLib=require("./db");
global.BlockDB=new DBLib();

const START_BITS_COUNT=21;//24
var   CUR_BITS_COUNT=START_BITS_COUNT;//TODO - save to params/const
const KEY_BITS_MAX=42;      //(max key count is 1<<42)
const KEY_SHORT_WIDTH=5+4;
const KEY_BUF_WIDTH=KEY_SHORT_WIDTH+6;

const COUNT_ROW_SCAN=35;//+random(5);
const FILL_KEY_PERCENT=75;//+random(10);
const COUNT_ROW_SCAN_MOVE_KEY=COUNT_ROW_SCAN;

const MAX_ITERATION_MOVE_KEY=5;
//const MAX_ITERATION_WRITE_BUF=5000;
const MAX_ITERATION_WRITE_BUF=5000;

const MAX_TRANSACTION_LEN=256;

// ToLog("COUNT_ROW_SCAN="+COUNT_ROW_SCAN)
// ToLog("FILL_KEY_PERCENT="+FILL_KEY_PERCENT)

{
    var TEMP_ARR33=new Uint8Array(33);
    var TEMP_ARR4=new Uint8Array(KEY_SHORT_WIDTH);
}

const DELETE_WRITING_BUF=Buffer.allocUnsafe(KEY_BUF_WIDTH);
DELETE_WRITING_BUF.fill(37);//2-й бит равен 0, данные есть но помечены на удаленние


module.exports = class CDB extends require("../code")
{
    constructor(SetKeyPair,RunIP,RunPort,UseRNDHeader,bVirtual)
    {
        super(SetKeyPair,RunIP,RunPort,UseRNDHeader,bVirtual)

        this.DBMap={};
        if(!USE_KEY_DB)
            return;


        this.CurrentIterationMoveKey=0;

        this.FileBufKey = new RBTree(CompareItemBufFD);


        this.AllScanRow=0;


        this.NumFoFlush=0;
        if(!global.ADDRLIST_MODE && !this.VirtualMode)
        {
            setInterval(this.StartDiskOperations.bind(this),50);
        }



    }


    GetInfoKeyTransaction()
    {
        var infoKey={name:"key-index",row_width:KEY_BUF_WIDTH,key_width:KEY_SHORT_WIDTH,bits:CUR_BITS_COUNT};
        return infoKey;
    }




    //------------------------------------------------------------------------------------------------------------------
    //NEW
    //------------------------------------------------------------------------------------------------------------------

    FindBlockByHashDB(key)
    {
        if(!USE_KEY_DB)
            return null;

        if(!USE_CHECK_KEY_DB)
        {
            var FindBlockNum=this.TreeKeyBufer.LoadValue(key,true)
            if(FindBlockNum!==undefined)
            {
                ADD_TO_STAT("FindItem-YES")
                return FindBlockNum;
            }
            ADD_TO_STAT("FindItem-NO")
        }

        var Info=this.GetInfoKeyTransaction();


        var RetBlockNum=this.DoOperationKeyDB(Info,key,"Find");
        this.TreeKeyBufer.SaveValue(key,RetBlockNum);
        return RetBlockNum;
    }

    //------------------------------------------------------------------------------------------------------------------

    //Запись индекса key
    WriteNewKeyDB(Info,key,SetTrPosition,BlockNum)
    {
        if(!USE_KEY_DB)
            return true;

        this.TreeKeyBufer.SaveValue(key,BlockNum);


        var Ret=this.DoOperationKeyDB(Info,key,"Write",SetTrPosition,"Write");
        return Ret;
    }



    //------------------------------------------------------------------------------------------------------------------

    MoveKeyNextFileOld(DoCountRow)
    {
        var Info=this.GetInfoKeyTransaction();
        var Bits=Info.bits;
        var Name=Info.name+"-"+Bits;
        var FDItem=BlockDB.OpenDBFile(Name);
        var FD=FDItem.fd;
        if(FDItem.StartMoveKey)
        {
            if(!FDItem.WasLog)
            {
                FDItem.WasLog=1;
                ToLog("==========================================================================Start move key: "+Name)
            }

            var startTime = process.hrtime();
            var Info2=this.GetInfoKeyTransaction();
            Info2.bits=Info.bits+1;

            var CountRowScan=COUNT_ROW_SCAN*10;
            var CountRows=FDItem.CountRows;

            var NumRow=FDItem.NumRowMoveKey;
            var RowProcessingCount=0;

            var Arr=[];
            SCANING_TABLE:
            while(NumRow<CountRows)
            {


                //calc position by key value and file max count ( = 1<<Bits)
                var Position=NumRow*KEY_BUF_WIDTH;
                var BufRead=Buffer.alloc(CountRowScan*KEY_BUF_WIDTH);
                FileBufRead(this.FileBufKey, FD,BufRead,Position);



                //scan and seek
                for(var r=0;r<CountRowScan;r++)
                {
                    var PosRow=r*KEY_BUF_WIDTH;

                    BufRead.len=PosRow;
                    var HashShortRead=BufLib.Read(BufRead,"buffer",KEY_SHORT_WIDTH);
                    var TrPosition=BufLib.Read(BufRead,"uint");
                    var HasValidData=HashShortRead[0]&2;



                    if(HasValidData)
                    {
                        //this.DoOperationKeyDB(Info2,HashShortRead,"MoveKey",TrPosition,"MOVE");
                        Arr.push({HashShort:HashShortRead,TrPosition:TrPosition});
                    }

                    //Delete
                    //var BufWrite=Buffer.alloc(KEY_BUF_WIDTH);
                    //BufWrite[0]=1;//2-й бит равен 0, данные есть но помечены на удаленние
                    // BufWrite[1]=Info2.bits;
                    // BufWrite[2]=0;
                    // BufWrite[3]=(TrPosition>>8)&255;;
                    // BufWrite[4]=TrPosition&255;
                    FileBufWrite(this.FileBufKey, FD,DELETE_WRITING_BUF, Position+PosRow);
                    NumRow++;

                    if(DoCountRow)
                    {
                        RowProcessingCount++;
                        if(RowProcessingCount>=DoCountRow)
                            break SCANING_TABLE;
                        continue;
                    }

                    var Time = process.hrtime(startTime);
                    var deltaTime=(Time[0]*1000 + Time[1]/1e6);//ms
                    if(deltaTime>=5)
                    {
                        break SCANING_TABLE;
                    }
                }
            }

            this.BulkOperationTrKeyDB("MoveKey",Arr,Info2);


            FDItem.NumRowMoveKey=NumRow;

            if(FDItem.NumRowMoveKey>=CountRows)
            {
                ToLog("******************************************DELETE TABLE "+Name);
                CUR_BITS_COUNT=Info2.bits;

                //очищаем буфер записи
                ClearTreeByFD(this.FileBufKey,FD);
                BlockDB.CloseDBFile(Name,true)
            }


            ADD_TO_STAT_TIME("MAX:TimeKeyMove",startTime);
            ADD_TO_STAT_TIME("TimeKeyMove",startTime);
        }
    }


    MoveKeyNextFileNew(FCall)
    {
        var Info=this.GetInfoKeyTransaction();
        var Bits=Info.bits;
        var Name=Info.name+"-"+Bits;
        var FDItem=BlockDB.OpenDBFile(Name);
        var FD=FDItem.fd;
        if(FDItem.StartMoveKey && !this.ProcessMoveKey)
        {
            //ToLog("this.CurrentIterationMoveKey="+this.CurrentIterationMoveKey)
            this.CurrentIterationMoveKey=0;


            this.MoveKeyNextFileAsync(FDItem,FCall);
            if(FDItem.NumRowMoveKey>=FDItem.CountRows)
            {
                ToLog("****************************************** DELETE TABLE "+Name+" FD="+FD);
                CUR_BITS_COUNT=Bits+1;

                var startTime = process.hrtime();
                //очищаем буфер записи
                ClearTreeByFD(this.FileBufKey,FD);

                ADD_TO_STAT_TIME("MAX:TimeKeyMove",startTime);
                ADD_TO_STAT_TIME("TimeKeyMove",startTime);

                BlockDB.CloseDBFile(Name,true)
            }
        }
    }

    MoveKeyNextFileAsync(FDItem,FCall)
    {
        if(FDItem.NumRowMoveKey>=FDItem.CountRows)
            return false;

        //calc position by key value and file max count ( = 1<<Bits)
        var Position=FDItem.NumRowMoveKey*KEY_BUF_WIDTH;
        var BufRead=Buffer.alloc(COUNT_ROW_SCAN_MOVE_KEY*KEY_BUF_WIDTH);

        this.ProcessMoveKey=true;
        let SELF=this;
        let FDITEM=FDItem;
        let FCALL=FCall;
        FileBufReadAsync(this.FileBufKey, FDItem.fd,BufRead,Position,function (err,BufRead)
        {
            if(err)
                ToLog(err);
            else
            {
                var startTime = process.hrtime();

                var Info2=SELF.GetInfoKeyTransaction();
                Info2.bits++;

                //scan and seek
                for(var r=0;r<COUNT_ROW_SCAN_MOVE_KEY;r++)
                {
                    var PosRow=r*KEY_BUF_WIDTH;

                    BufRead.len=PosRow;
                    var HashShortRead=BufLib.Read(BufRead,"buffer",KEY_SHORT_WIDTH);
                    var TrPosition=BufLib.Read(BufRead,"uint");
                    var HasValidData=HashShortRead[0]&2;

                    if(HasValidData)
                    {
                        SELF.DoOperationKeyDB(Info2,HashShortRead,"MoveKey",TrPosition,"MOVE");
                    }

                    //Delete
                    var BufWrite=Buffer.alloc(KEY_BUF_WIDTH);
                    BufWrite[0]=1;//2-й бит равен 0, данные есть но помечены на удаленние
                    FileBufWrite(SELF.FileBufKey, FDITEM.fd,BufWrite, Position+PosRow);
                    FDITEM.NumRowMoveKey++;
                }
            }

            ADD_TO_STAT_TIME("MAX:TimeKeyMove",startTime);
            ADD_TO_STAT_TIME("TimeKeyMove",startTime);
            SELF.ProcessMoveKey=false;

            if(SELF.CurrentIterationMoveKey<MAX_ITERATION_MOVE_KEY)
            {
                SELF.CurrentIterationMoveKey++;
                var Ret=SELF.MoveKeyNextFileAsync(FDITEM,FCALL);
                if(!Ret)
                if(FCALL)
                {
                    FCALL(false);
                }
            }
            else
            if(FCALL)
            {
                FCALL(true);
            }
        });

        return true;
    }

    //поиск позиции индекса key (для чтения/записи)
    DoOperationKeyDBOld(Info,key,Mode,NewTrPosition)
    {
        if(!USE_KEY_DB)
            return true;

        ADD_TO_STAT("OPERATION_KEY_DB_"+Mode.toUpperCase());

        if(Mode==="MoveKey")
        {
            var HashShort=key;
            var Hash=key;
        }
        else
        {
            //var Hash=TEMP_ARR33;
            var Hash=new Uint8Array(33);
            for(var j=0;j<33;j++)
                Hash[j]=key[j];

            var HashPos=shaarr2(Hash,this.HashDBArr);//защита от DDoS
            var HashShort=this.GetShortHashData(HashPos);
        }

        var TryHashRows=0;

        var Bits=Info.bits-1;

        SCANING_TABLE:
            while(true)
            {
                Bits+=1;
                if(Bits>KEY_BITS_MAX)
                {
                    ADD_TO_STAT("VERY_BIG_KEY_FILE_SIZE");
                    TO_ERROR_LOG("DB",110,"VERY_BIG_KEY_FILE_SIZE Name="+Name);
                    break;
                }

                var Name=Info.name+"-"+Bits;

                var FDItem=BlockDB.OpenDBFile(Name,(Mode==="Find"));
                if(!FDItem)
                    return null;

                var FD=FDItem.fd;
                //TODO придумать другую статистику для тригера
                if(!FDItem.StartMoveKey && FILL_KEY_PERCENT*(1<<Bits)/100<FDItem.FillRows)
                {
                    FDItem.StartMoveKey=true;
                    FDItem.NumRowMoveKey=0;
                }





                //calc position by key value and file max count ( = 1<<Bits)
                var CurrentRow=this.GetPositionRowFromHash(HashShort,Bits);
                var Position=CurrentRow*KEY_BUF_WIDTH;


                // if(NewTrPosition===109)
                // {
                //     var BufRead2=Buffer.alloc(COUNT_ROW_SCAN*KEY_BUF_WIDTH);
                //     FileBufRead(this.FileBufKey, FD,BufRead2,Position);
                //
                //     var NumTr=BufRead2[3]*256+BufRead2[4];
                //
                //     var Stop=1;
                // }


                var bDoubleScan=false;
                if(FDItem.StartMoveKey)
                {
                    if(CurrentRow <= FDItem.NumRowMoveKey-COUNT_ROW_SCAN)
                        continue;
                    else
                    if(CurrentRow>=FDItem.NumRowMoveKey)
                    {
                        //normal mode
                    }
                    else
                    {
                        bDoubleScan=true;
                    }
                }

                //Хэширование с линейным методом разрешения коллизий:
                //1. Читаем строки (COUNT_ROW_SCAN строк)
                //2. Находим либо совпадающую по хэш либо пустую строку
                //3. Иначе переходим к следующему файлу (bits+1)


                var BufRead=Buffer.alloc(COUNT_ROW_SCAN*KEY_BUF_WIDTH);
                FileBufRead(this.FileBufKey, FD,BufRead,Position);


                var LastNotActualCurPosition=undefined;

                //scan and seek
                SCANING_ROW:
                    for(var r=0;r<COUNT_ROW_SCAN;r++)
                    {
                        TryHashRows++;

                        ADD_TO_STAT("SCAN_ROW_KEY");
                        ADD_TO_STAT("MAX:DOUBLE_FIND_KEY",TryHashRows);

                        var PosRow = r*KEY_BUF_WIDTH;
                        var CurPosition = Position+PosRow;


                        BufRead.len=PosRow;
                        var HashShortRead=BufLib.Read(BufRead,"buffer",KEY_SHORT_WIDTH);
                        var TrPosition=BufLib.Read(BufRead,"uint");


                        var HasData=HashShortRead[0]&1;
                        var HasActual=HashShortRead[0]&2;

                        if(HasData && HasActual===0)
                            LastNotActualCurPosition=CurPosition;

                        if(!HasData || CompareArr(HashShortRead,HashShort)===0)
                        {

                            if(Mode==="Find")
                            {
                                if(!HasData)
                                {
                                    if(bDoubleScan)
                                        break SCANING_ROW;
                                    return null;
                                }



                                var Tr=this.ReadTransactionFromBody(TrPosition)
                                if(Tr && CompareArr33(Hash,Tr.body)===0)
                                    return Tr.BlockNum;
                            }
                            else
                            if(Mode==="Delete")
                            {
                                if(!HasData)
                                {
                                    if(bDoubleScan)
                                        break SCANING_ROW;
                                    return false;
                                }
                                var Tr=this.ReadTransactionFromBody(TrPosition)
                                if(Tr && CompareArr33(Hash,Tr.body)===0)
                                {
                                    var BufWrite=Buffer.allocUnsafe(KEY_BUF_WIDTH);
                                    BufWrite.fill(37);//2-й бит равен 0, данные есть но помечены на удаленние
                                    //BufWrite[0]=1;//2-й бит равен 0, данные есть но помечены на удаленние

                                    FileBufWrite(this.FileBufKey, FD,BufWrite, CurPosition)
                                    return true;
                                }
                            }
                            else
                            if(Mode==="Write" || Mode==="MoveKey")
                            {
                                //check key by Pos
                                if(HasData && Mode==="Write")
                                {
                                    var Tr=this.ReadTransactionFromBody(TrPosition)
                                    if(Tr && CompareArr33(Hash,Tr.body)!==0)
                                    {
                                        var HashPosReadMust=shaarr2(Tr.body,this.HashDBArr);//защита от DDoS
                                        var HashShortReadMust=this.GetShortHashData(HashPosReadMust);

                                        var PositionMust=this.GetPositionRowFromHash(HashShortReadMust,Bits)*KEY_BUF_WIDTH;
                                        if(Position!==PositionMust || CompareArr(HashShortRead,HashShortReadMust)!==0)
                                        {
                                            ADD_TO_STAT("REWRITEKEY");
                                        }
                                        else
                                        {
                                            continue;//занято - перебор следующей строки
                                        }
                                    }
                                }
                                else
                                {
                                    if(!HasData)
                                    {
                                        if(bDoubleScan)
                                            continue;
                                        else
                                        if(!LastNotActualCurPosition)
                                            FDItem.FillRows++;
                                    }
                                }

                                //var BufWrite=Buffer.alloc(KEY_BUF_WIDTH);
                                var BufWrite=Buffer.allocUnsafe(KEY_BUF_WIDTH);
                                BufWrite.len=0;
                                BufLib.Write(BufWrite,HashShort,"buffer",KEY_SHORT_WIDTH);
                                BufLib.Write(BufWrite,NewTrPosition,"uint");

                                if(!HasData && LastNotActualCurPosition && !bDoubleScan)
                                {
                                    FileBufWrite(this.FileBufKey, FD,BufWrite, LastNotActualCurPosition);
                                }
                                else
                                {
                                    FileBufWrite(this.FileBufKey, FD,BufWrite, CurPosition);
                                }

                                FDItem.CountRows=Math.max(FDItem.CountRows,CurrentRow+r+1);


                                return true;
                            }
                            else
                            {
                                throw "ERROR MODE NAME = "+Mode;
                            }
                        }
                    }

                //may be rewrite deleted row
                if(Mode==="Write" && LastNotActualCurPosition && !bDoubleScan && !FDItem.StartMoveKey)
                {
                    var BufWrite=Buffer.allocUnsafe(KEY_BUF_WIDTH);
                    BufWrite.len=0;
                    BufLib.Write(BufWrite,HashShort,"buffer",KEY_SHORT_WIDTH);
                    BufLib.Write(BufWrite,NewTrPosition,"uint");
                    FileBufWrite(this.FileBufKey, FD,BufWrite, LastNotActualCurPosition);
                    FDItem.CountRows=Math.max(FDItem.CountRows,CurrentRow+r+1);
                    return true;
                }
            }

        return null;
    }

    //поиск позиции индекса key (для чтения/записи)
    DoOperationKeyDB(Info,key,Mode,NewTrPosition)
    {
        if(!USE_KEY_DB)
            return true;

        ADD_TO_STAT("OPERATION_KEY_DB_"+Mode.toUpperCase());

        if(Mode==="MoveKey")
        {
            var HashShort=key;
            var Hash=key;
        }
        else
        {
            //var Hash=TEMP_ARR33;
            var Hash=new Uint8Array(33);
            for(var j=0;j<33;j++)
                Hash[j]=key[j];

            var HashPos=shaarr2(Hash,this.HashDBArr);//защита от DDoS
            var HashShort=this.GetShortHashData(HashPos);
        }


        if(Mode==="Write" || Mode==="MoveKey")
        {
            //var BufWrite=Buffer.alloc(KEY_BUF_WIDTH);
            var BufWrite=Buffer.allocUnsafe(KEY_BUF_WIDTH);
            BufWrite.len=0;
            BufLib.Write(BufWrite,HashShort,"buffer",KEY_SHORT_WIDTH);
            BufLib.Write(BufWrite,NewTrPosition,"uint");
        }
        else
        if(Mode==="Delete")
        {
            var BufWrite=DELETE_WRITING_BUF;
        }


        var Context=
            {
                HashShort:HashShort,
                Hash:Hash,
                NewTrPosition:NewTrPosition,
                bDoubleScan:false,
                Row:undefined,
                TryHashRows:0,
            };

        var Bits=Info.bits-1;


        while(true)
        {
            Bits+=1;
            Context.Bits=Bits;

            var Name=Info.name+"-"+Bits;
            if(Bits>KEY_BITS_MAX)
            {
                ADD_TO_STAT("VERY_BIG_KEY_FILE_SIZE");
                TO_ERROR_LOG("DB",110,"VERY_BIG_KEY_FILE_SIZE Name="+Name);
                break;
            }


            var FDItem=BlockDB.OpenDBFile(Name,(Mode==="Find"));
            if(!FDItem)
                break;

            //TODO придумать другую статистику для тригера
            if(!FDItem.StartMoveKey && FILL_KEY_PERCENT*(1<<Bits)/100<FDItem.FillRows)
            {
                FDItem.StartMoveKey=true;
                FDItem.NumRowMoveKey=0;
            }





            //calc position by key value and file max count ( = 1<<Bits)
            Context.StartReadRow=this.GetPositionRowFromHash(HashShort,Bits);
            var Position=Context.StartReadRow*KEY_BUF_WIDTH;

            Context.bDoubleScan=false;
            if(FDItem.StartMoveKey)
            {
                if(Context.StartReadRow <= FDItem.NumRowMoveKey-COUNT_ROW_SCAN)
                    continue;
                else
                if(Context.StartReadRow>=FDItem.NumRowMoveKey)
                {
                    //normal mode
                }
                else
                {
                    Context.bDoubleScan=true;
                }
            }

            var BufRead=Buffer.alloc(COUNT_ROW_SCAN*KEY_BUF_WIDTH);
            FileBufRead(this.FileBufKey, FDItem.fd,BufRead,Position);



            var Retvalue=this.DoOperationOnRowsKeyDB(Mode,Context,BufRead,FDItem, BufWrite);
            if(Retvalue!==undefined)
                return Retvalue;

        }

        return null;
    }


    DoOperationOnRowsKeyDB(Mode,Context,BufRead,FDItem, BufWrite)
    {
        var Position=Context.StartReadRow*KEY_BUF_WIDTH;

        //Хэширование с линейным методом разрешения коллизий:
        //1. Читаем строки (COUNT_ROW_SCAN строк)
        //2. Находим либо совпадающую по хэш либо пустую строку
        //3. Иначе переходим к следующему файлу (bits+1)

        //scan and seek
        var LastNotActualCurPosition=undefined;
        for(var r=0;r<COUNT_ROW_SCAN;r++)
        {
            Context.TryHashRows++;
            Context.Row=r;

            this.AllScanRow++;
            ADD_TO_STAT("SCAN_ROW_KEY");
            ADD_TO_STAT("MAX:DOUBLE_FIND_KEY",Context.TryHashRows);

            var PosRow = r*KEY_BUF_WIDTH;
            var CurPosition = Position+PosRow;

            BufRead.len=PosRow;
            var HashShortRead=BufLib.Read(BufRead,"buffer",KEY_SHORT_WIDTH);
            var TrPosition=BufLib.Read(BufRead,"uint");


            var HasData=HashShortRead[0]&1;
            var HasActual=HashShortRead[0]&2;

            if(HasData && HasActual===0)
                LastNotActualCurPosition=CurPosition;

            if(!HasData || CompareArr(HashShortRead,Context.HashShort)===0)
            {

                if(Mode==="Find")
                {
                    if(!HasData)
                    {
                        if(Context.bDoubleScan)
                            break;
                        return null;
                    }




                    var Tr=this.ReadTransactionFromBody(TrPosition)
                    if(Tr && CompareArr33(Context.Hash,Tr.body)===0)
                        return Tr.BlockNum;
                }
                else
                if(Mode==="Delete")
                {
                    if(!HasData)
                    {
                        if(Context.bDoubleScan)
                            break;
                        return false;
                    }


                    var Tr=this.ReadTransactionFromBody(TrPosition)
                    if(Tr && CompareArr33(Context.Hash,Tr.body)===0)
                    {
                        FileBufWrite(this.FileBufKey, FDItem.fd,BufWrite, CurPosition)
                        return true;
                    }
                }
                else
                if(Mode==="Write" || Mode==="MoveKey")
                {
                    //check key by Pos
                    if(HasData && Mode==="Write")
                    {




                        var Tr=this.ReadTransactionFromBody(TrPosition)
                        if(Tr && CompareArr33(Context.Hash,Tr.body)!==0)
                        {
                            var HashPosReadMust=shaarr2(Tr.body,this.HashDBArr);//защита от DDoS
                            var HashShortReadMust=this.GetShortHashData(HashPosReadMust);

                            var PositionMust=this.GetPositionRowFromHash(HashShortReadMust,Context.Bits)*KEY_BUF_WIDTH;
                            if(Position!==PositionMust || CompareArr(HashShortRead,HashShortReadMust)!==0)
                            {
                                ADD_TO_STAT("REWRITEKEY");
                            }
                            else
                            {
                                continue;//занято - перебор следующей строки
                            }
                        }

                    }
                    else
                    {
                        if(!HasData)
                        {
                            if(Context.bDoubleScan)
                                continue;
                            else
                            if(!LastNotActualCurPosition)
                                FDItem.FillRows++;
                        }
                    }

                    if(!HasData && LastNotActualCurPosition && !Context.bDoubleScan)
                    {
                        FileBufWrite(this.FileBufKey, FDItem.fd,BufWrite, LastNotActualCurPosition);
                    }
                    else
                    {
                        FileBufWrite(this.FileBufKey, FDItem.fd,BufWrite, CurPosition);
                    }

                    FDItem.CountRows=Math.max(FDItem.CountRows,Context.StartReadRow+r+1);


                    return true;
                }
                else
                {
                    throw "ERROR MODE NAME = "+Mode;
                }
            }
        }


        //may be rewrite deleted row
        if(Mode==="Write" && LastNotActualCurPosition && !Context.bDoubleScan && !FDItem.StartMoveKey)
        {
            FileBufWrite(this.FileBufKey, FDItem.fd,BufWrite, LastNotActualCurPosition);
            FDItem.CountRows=Math.max(FDItem.CountRows,Context.StartReadRow+r+1);
            return true;
        }

        return undefined;//next table
    }


    BulkFindTrKeyDB(Arr)
    {
        var Info=this.GetInfoKeyTransaction();
        return this.BulkOperationTrKeyDB("Find",Arr,Info);
    }
    BulkWriteTrKeyDB(Arr)
    {
        var Info=this.GetInfoKeyTransaction();
        return this.BulkOperationTrKeyDB("Write",Arr,Info);
    }

    BulkOperationTrKeyDB(Mode,Arr,Info)
    {
        if(!USE_KEY_DB)
            return true;

        ADD_TO_STAT("OPERATION_KEY_DB_FIND_BULK");

        var Rows=[];
        for(var i=0;i<Arr.length;i++)
        {
            var Item=Arr[i];


            if(Mode==="MoveKey")
            {
                var HashShort=Item.HashShort;//!!!
                var Hash=HashShort;
            }
            else
            {
                var key=Item.body;//!!!
                var Hash=new Uint8Array(33);
                for(var j=0;j<33;j++)
                    Hash[j]=key[j];
                var HashPos=shaarr2(Hash,this.HashDBArr);//защита от DDoS
                var HashShort=this.GetShortHashData(HashPos);
            }

            var Context=
                {
                    Hash:Hash,
                    HashShort:HashShort,
                    bDoubleScan:false,
                    Row:undefined,
                    TryHashRows:0,
                    i:i,
                    DoRun:true,
                 };

            if(Mode==="Write" || Mode==="MoveKey")
            {
                var BufWrite=Buffer.allocUnsafe(KEY_BUF_WIDTH);
                BufWrite.len=0;
                BufLib.Write(BufWrite,HashShort,"buffer",KEY_SHORT_WIDTH);
                BufLib.Write(BufWrite,Item.TrPosition,"uint");//!!!
                Context.BufWrite=BufWrite;
            }
            else
            if(Mode==="Delete")
            {
                Context.BufWrite=DELETE_WRITING_BUF;
            }



            Rows.push(Context);
        }



        var Bits=Info.bits-1;
        while(true)
        {
            Bits+=1;


            var Name=Info.name+"-"+Bits;
            if(Bits>KEY_BITS_MAX)
            {
                ADD_TO_STAT("VERY_BIG_KEY_FILE_SIZE");
                TO_ERROR_LOG("DB",115,"VERY_BIG_KEY_FILE_SIZE Name="+Name);
                break;
            }


            var FDItem=BlockDB.OpenDBFile(Name,(Mode==="Find"));
            if(!FDItem)
                break;

            //TODO придумать другую статистику для тригера
            if(!FDItem.StartMoveKey && FILL_KEY_PERCENT*(1<<Bits)/100<FDItem.FillRows)
            {
                FDItem.StartMoveKey=true;
                FDItem.NumRowMoveKey=0;
            }



            for(var i=0;i<Rows.length;i++)
            {
                var Context=Rows[i];
                if(Context.DoRun)
                {
                    Context.Bits=Bits;
                    Context.continueNext=false;

                    //calc position by key value and file max count ( = 1<<Bits)
                    Context.StartReadRow=this.GetPositionRowFromHash(Context.HashShort,Bits);

                    Context.bDoubleScan=false;
                    if(FDItem.StartMoveKey)
                    {
                        if(Context.StartReadRow <= FDItem.NumRowMoveKey-COUNT_ROW_SCAN)
                            Context.continueNext=true;
                        else
                        if(Context.StartReadRow>=FDItem.NumRowMoveKey)
                        {
                            //normal mode
                        }
                        else
                        {
                            Context.bDoubleScan=true;
                        }
                    }
                }
            }


            //Sort arr by file pos
            Rows.sort(function (a,b)
            {
                return a.StartReadRow-b.StartReadRow;
            })


            var WasNextDoRun=false;
            for(var i=0;i<Rows.length;i++)
            {
                var Context=Rows[i];
                if(Context.DoRun)
                {
                    if(Context.continueNext)
                    {
                        WasNextDoRun=true;
                        continue;
                    }

                    var BufRead=Buffer.alloc(COUNT_ROW_SCAN*KEY_BUF_WIDTH);
                    var Position=Context.StartReadRow*KEY_BUF_WIDTH;

                    FileBufRead(this.FileBufKey, FDItem.fd,BufRead,Position);
                    Context.RetValue=this.DoOperationOnRowsKeyDB(Mode,Context,BufRead,FDItem,Context.BufWrite);

                    if(Context.RetValue!==undefined)
                    {
                        Context.DoRun=false;//stop processing
                    }
                    else
                    {
                        WasNextDoRun=true;
                    }
                }
            }
            if(!WasNextDoRun)
                break;
        }

        return Rows;
    }



    GetShortHashData(HashPos)
    {
        var HashShort=new Uint8Array(KEY_SHORT_WIDTH);
        for(var j=0;j<KEY_SHORT_WIDTH;j++)
            HashShort[j]=HashPos[j];
        HashShort[0] |= 3;//1-й бит - признак данных, 2-й бит признак актуальности (если он равен нулю, то данные удалены)
        return HashShort;
    }


    GetPositionRowFromHash(HashPos,Bits)
    {
        const key_length=KEY_SHORT_WIDTH-1;
        var Position=0;
        var b=Bits;
        var mult=1;
        var cur_bits=Bits;
        while(cur_bits>0)
        {
            var curByte=HashPos[1+(b%key_length)];

            var maska;
            if(cur_bits>=8)
                maska = 255;
            else
                maska = (1<<cur_bits)-1;


            Position += mult*(curByte & maska);
            mult=mult*256;

            cur_bits=cur_bits-8;
            b++;
        }

        return Position;
    }




    //------------------------------------------------------------------------------------------------------------------
    //------------------------------------------------------------------------------------------------------------------
    //------------------------------------------------------------------------------------------------------------------



    TruncateKeyDB(LastBlock)
    {
        this.TreeKeyBufer.Clear();
    }


    StartDiskOperations()
    {

        // this.NumFoFlush++;
        // var Num=this.NumFoFlush%10;
        // if(Num===1)
        // {
        //     this.MemBufFlush(this.FileBufBody,"body");
        //     this.MemBufFlush(this.FileBufHeader,"header");
        // }



        this.MoveKeyNextFileOld();
        this.MemBufFlush(this.FileBufKey,"key");

        // this.MoveKeyNextFileNew();
        // CurrentIterationWriteBuf=0;
        // MemBufFlushAsync(this.FileBufKey);

        ADD_TO_STAT("MAX:CountForFlush",this.FileBufKey.size);

    }


    MemBufFlush(Tree,name)
    {
        var deltaTime=0;
        if(Tree.size)
        {
            var startTime = process.hrtime();
            while(true)
            {
                var Item=Tree.min();
                if(Item===null)
                    break;

                var Time = process.hrtime(startTime);
                deltaTime=(Time[0]*1000 + Time[1]/1e6);//ms

                if(deltaTime>10)
                {
                    break;
                }

                var written=fs.writeSync(Item.FD, Item.buf,0,Item.buf.length, Item.Position);
                //ToLog(""+name+" FD:"+Item.FD+"  Position:"+Item.Position)
                if(written!==Item.buf.length)
                {
                    TO_ERROR_LOG("DB",310,"Error write key file: "+written+" <> "+Item.buf.length);
                }
                else
                {
                    Tree.remove(Item);
                }
            };


            ADD_TO_STAT_TIME("MAX:TimeFlush",startTime);
            ADD_TO_STAT("MAX:CountForFlush",Tree.size);
        }

    }



    ReadTransactionFromBody(TrPosition)//for hash-db
    {
        //TODO

        ADD_TO_STAT("SCAN_BODY");

        //read key data from transaction file
        var FD=BlockDB.OpenDBFile(FILE_NAME_BODY).fd;

        var BufRead=BufLib.GetNewBuffer(6+2+MAX_TRANSACTION_LEN);
        var bytesRead=fs.readSync(FD, BufRead,0,BufRead.length, TrPosition);
        //var bytesRead=this.FileBufRead(this.FileBufBody, FD,BufRead,TrPosition);
        if(bytesRead>6+2)
        {
            var Tr={};
            Tr.BlockNum=BufRead.Read("uint");//6
            var HashLen=BufRead.Read("uint16");//2
            if(HashLen && bytesRead>=6+2+HashLen && HashLen<=MAX_TRANSACTION_LEN)
            {
                Tr.body=BufRead.Read("buffer",HashLen);
                return Tr;
            }
        }
        return undefined;
    }

}

function WriteTreeToBuf(Tree, FD,Buf,Position)
{

    //учитываем буфер записей
    var length=Buf.length;
    var find={FD:FD,Position:Position};

    var it=Tree.lowerBound(find);
    if(!it)
        return;

    //подымаемся вверх - ищем старт
    while(true)
    {
        it.prev();
        var item=it.data();
        if(!item || item.FD!==FD)//забрались слишком высоко
        {
            it.next();
            item=it.data();
            break;
        }

        if(item.Position+item.length-1<Position)
            break;
    }

    //идем вниз и записываем
    while(item)
    {
        if(item.Position>=Position+length)
            break;

        var itemPositionEnd=item.Position+item.length-1;
        if(item.FD===FD && itemPositionEnd>=Position)
        {
            if(item.Position<=Position)
            {
                var startSrc=Position-item.Position;
                item.buf.copy(Buf,0,startSrc);
            }
            else
            if(itemPositionEnd>=Position)
            {
                var startDest=item.Position-Position;
                item.buf.copy(Buf,startDest,0);
            }
        }
        it.next();
        item=it.data();
    }
}



function FileBufReadAsync(Tree, fd,BufRead,Position, Func)
{
    //fs.readSync(fd, BufRead,0,BufRead.length, Position);Func(0,BufRead);return;

    let BUFREAD=BufRead;
    let FD=fd;
    let POSITION=Position;
    let TREE=Tree;
    fs.read(fd, BufRead,0,BufRead.length, Position,function (err,bytesRead,Buf)
    {
        if(err)
            Func(err);
        else
        {
            WriteTreeToBuf(Tree, FD,BUFREAD,POSITION);
            Func(err,BUFREAD);
        }
    });

}

function FileBufRead(Tree, FD,BufRead,Position)
{
    //return  fs.readSync(FD, BufRead,0,BufRead.length, Position);

    var length=BufRead.length;
    fs.readSync(FD, BufRead,0,length, Position);

    WriteTreeToBuf(Tree, FD,BufRead,Position)
}

function FileBufWrite(Tree, FD,BufWrite,Position)
{
    //return fs.writeSync(FD, BufWrite,0,BufWrite.length, Position);


    var written=BufWrite.length;

    var Item=Tree.find({FD:FD,Position:Position});
    if(Item)
    {
        if(Item.buf.length!==BufWrite.length)
            ToLog("------------------------ Item.buf.length===BufWrite.length")
        // if(Item.buf.length===BufWrite.length)
        // {
        //     BufWrite.copy(Item.buf);
        //     Item.length=BufWrite.length;
        // }
        // else
        // if(Item.buf.length>BufWrite.length)
        // {
        //     BufWrite.copy(Item.buf);
        //     Item.length=Item.buf.length;
        // }
        // else
        // {
        //     Item.buf=Buffer.from(BufWrite)
        //     Item.length=BufWrite.length;
        // }

        Item.buf=BufWrite;
        Item.length=BufWrite.length;
    }
    else
    {
        Tree.insert({FD:FD,Position:Position,buf:BufWrite,length:BufWrite.length,wr:1});
    }
    return written;
}

var ProcessMemBufFlushAsync=false;
var CurrentIterationWriteBuf=0;
function MemBufFlushAsync(Tree,FCall)
{
    if(ProcessMemBufFlushAsync)
        return false;


    var Item=Tree.min();
    if(Item && !Item.async)
    {
        //Tree.remove(Item);

        let ITEM=Item;
        let TREE=Tree;
        let FCALL=FCall;

        Item.async=true;
        ProcessMemBufFlushAsync=true;

        var written=fs.write(Item.FD, Item.buf,0,Item.buf.length, Item.Position,function (err,written,buf)
        {
            ProcessMemBufFlushAsync=false;

            if(err)
            {
                if(TREE.find(ITEM))
                    TO_ERROR_LOG("DB",310,""+err+"  FD="+ITEM.FD);
            }
            else
            {
                TREE.remove(ITEM);
                if(FCALL && TREE.size===0)
                {
                    FCALL(false);
                }

                if(CurrentIterationWriteBuf<MAX_ITERATION_WRITE_BUF)
                {
                    CurrentIterationWriteBuf++;
                    var ret=MemBufFlushAsync(TREE,FCALL);
                    if(!ret && FCALL)
                    {
                        FCALL(false);
                    }
                }
                else
                if(FCALL)
                {
                    FCALL(true);
                }

            }
        });

        return true;
    }
    else
    {
        return false;
    }

}

function ClearTreeByFD(Tree,FD)
{
    while(true)
    {
        var it=Tree.lowerBound({FD:FD,Position:0});
        if(!it)
            break;
        var item=it.data();
        if(!item || item.FD!==FD)
            break;
        Tree.remove(item)
    }
}


//TEST
function TestTest()
{
    ToLog("START TEST");

    //CUR_BITS_COUNT=19;
    //DelDir("D:/NODE/");

    global.USE_KEY_DB=1;

    //require("./html-server");
    var CDB=module.exports;
    var KeyPair=GetKeyPairTest("123");
    let Server=new CDB(KeyPair,"192.168.1.39", 30000,false,true);
    ADD_TO_STAT("START-TEST");


    function SaveDBParams()
    {
        var DBParams=
            {
                CUR_BITS_COUNT:CUR_BITS_COUNT,
                DBMap:Server.DBMap,
            };

        SaveParams(GetDataPath("DB/db.lst"),DBParams);

    }
    function LoadDBParams()
    {
        var DBParams=LoadParams(GetDataPath("DB/db.lst"),{});
        if(DBParams.CUR_BITS_COUNT)
            CUR_BITS_COUNT=DBParams.CUR_BITS_COUNT;
        if(DBParams.DBMap)
            Server.DBMap=DBParams.DBMap;
        for(var key in Server.DBMap)
        {
            var FDItem=Server.DBMap[key];
            var fname=GetDataPath("DB/"+FDItem.name);
            FDItem.fd=fs.openSync(fname, "r+");

        }
    }

    function GetInfoKeyTransaction()
    {
        return Server.GetInfoKeyTransaction();
    }

    function GetHash(Num)
    {
        var Hash1=shaarr("Num"+Num);
        var Hash2=[];
        Hash2[0]=1;  //smart-contract number 1
        for(var i=0;i<32;i++)
        {
            Hash2[i+1]=Hash1[i];
            Hash2[32+i]=0;
        }
        return Hash2;
    }
    Server.ReadTransactionFromBody=function(Num)
    {
        var Hash=GetHash(Num);
        return {BlockNum:Num*10,body:Hash};
    }

    function GetArr(Start,End)
    {
        var Arr=[];
        for(var i=Start;i<=End;i++)
        {
            var BlockNum=i*10;
            var Hash=GetHash(i);
            var Tr=
                {
                    body:Hash,
                    BlockNum:BlockNum,
                    TrPosition:i,
                };
            Arr.push(Tr);
        }
        return Arr;
    }

    function Create(Start,End,bLogical)
    {
        var Arr=[];
        if(bLogical===undefined)
            bLogical=true;
        var Info=GetInfoKeyTransaction();
        for(var i=Start;i<=End;i++)
        {
            var BlockNum=i*10;
            var Hash=GetHash(i);
            var Ret=Server.DoOperationKeyDB(Info,Hash,"Write",i);
            if(Ret!==bLogical)
            {
                console.trace("ERROR CREATE ON i="+i);
                throw "Error CREATE on "+i
            }

            var Tr=
                {
                    body:Hash,
                    BlockNum:BlockNum,
                };
            Arr.push(Tr);
        }
        return Arr;
    }
    function Find(Start,End,bLogical)
    {
        if(bLogical===undefined)
            bLogical=true;

        var Info=GetInfoKeyTransaction();
        for(var i=Start;i<=End;i++)
        {
            var BlockNum=i*10;
            var Hash2=GetHash(i);
            var RetBlockNum=Server.DoOperationKeyDB(Info,Hash2,"Find",i);
            if((RetBlockNum===BlockNum)!==bLogical)
            {
                console.trace("ERROR FIND ON i="+i);
                RetBlockNum=Server.DoOperationKeyDB(Info,Hash2,"Find",i);
                throw "Error FIND on "+i
            }
        }
    }
    function Delete(Start,End,bLogical)
    {
        if(bLogical===undefined)
            bLogical=true;

        var Info=GetInfoKeyTransaction();
        for(var i=Start;i<=End;i++)
        {
            var BlockNum=i*10;
            var Hash=GetHash(i);
            var Ret=Server.DoOperationKeyDB(Info,Hash,"Delete",i);
            if(Ret!==bLogical)
            {
                Ret=Server.DoOperationKeyDB(Info,Hash,"Delete",i);
                console.trace("ERROR DELETE ON i="+i);
                throw "Error DELETE on "+i
            }
        }
    }

    function FlushAll()
    {
        while(true)
        {
            if(!Server.FileBufKey.size)
                break;
            Server.MemBufFlush(Server.FileBufKey);
        }
    }


    function CheckZeroDB(bLogical)
    {
        for(var key in Server.DBMap)
        {
            var FDItem=Server.DBMap[key];

            var CountRowScan=FDItem.CountRows;
            var BufRead=Buffer.alloc(CountRowScan*KEY_BUF_WIDTH);
            FileBufRead(Server.FileBufKey, FDItem.fd,BufRead,0);



            //scan and seek
            for(var r=0;r<CountRowScan;r++)
            {
                var PosRow=r*KEY_BUF_WIDTH;
                BufRead.len=PosRow;
                var HashShortRead=BufLib.Read(BufRead,"buffer",KEY_SHORT_WIDTH);
                var TrPosition=BufLib.Read(BufRead,"uint");
                var HasValidData=HashShortRead[0]&2;
                if(HasValidData)
                {
                    console.trace("ERROR CHECK ZERO '"+key+"' ON r="+r+"  TrPosition="+TrPosition);
                    throw "Error CHECK ZERO on "+r
                }
            }


        }

    }

    function Move(Count)
    {
        Server.MoveKeyNextFileOld(Count);
    }
    function Flush(Count)
    {
        for(var i=0;i<Count;i++)
        {
            Server.MemBufFlush(Server.FileBufKey);
            if(!Server.FileBufKey.size)
                break;
        }
    }


    function Test1()
    {

        Create(0,10000);
        Move(4000);
        Flush(1)
        Move(4000);
        Flush(1000)
        Move(1491);
        Find(5000,5000);
        Move(1000);
        Find(5000,5000);
        Move(1000);
        Find(5000,5000);
        Move(1000);
        Flush(1000)
        Find(0,2000);
        Delete(1000,9000);
        Move(5000);
        Move(5000);
        Move(5000);
        Create(1000,10000);
        Flush(1000)
        Find(5034,5034);
        Find(5000,6000);
        Delete(5000,9000);
        Flush(50)
        Move(4000);
        Find(1000,4900);
        Find(5000,9000,false);

        Create(6000,7000);
        Move(100);
        Delete(0,4999);
        Flush(50)
        Find(6000,7000);
        Delete(6000,7000);
        Move(100);
        Flush(50)
    }
    function TestRND()
    {
        for(var i=0;i<50;i++)
        {
            var CountElements=2+random(10000);
            var Rewrite1=1+random(CountElements);
            var Rewrite2=Rewrite1+random(CountElements);
            if(Rewrite2>CountElements)
                Rewrite2=CountElements;
            ToLog("It="+i+"  All="+CountElements+" r1="+Rewrite1+" - r2="+Rewrite2)

            Create(0,CountElements);
            Move(CountElements);Flush(CountElements);
            Create(0,CountElements);
            Move(CountElements);Flush(CountElements);
            Delete(0,CountElements);
            Move(CountElements);Flush(CountElements);
            CheckZeroDB();
            Create(0,CountElements);

            Find(Rewrite1,Rewrite2);
            Move(CountElements);Flush(CountElements);
            Create(Rewrite1,Rewrite2);
            Move(CountElements);Flush(CountElements);
            Create(Rewrite1,Rewrite2);
            Find(0,CountElements);
            Move(Rewrite1);Flush(Rewrite2);
            Delete(Rewrite1,Rewrite2);
            Find(Rewrite1,Rewrite2,false);
            Move(CountElements);Flush(CountElements);
            Find(Rewrite1,Rewrite2,false);
            Create(Rewrite1,Rewrite2);
            Find(Rewrite1,Rewrite2);

            Move(CountElements);Flush(CountElements);
            Delete(0,CountElements);
            Move(CountElements);Flush(CountElements);
            Find(0,CountElements,false);
            Move(CountElements);Flush(CountElements);
            // Move(1000);
            // Flush(1000);
            // Move(1000);
            // Flush(1000);
        }
    }

    function Test2()
    {
        //for(var i=0;i<50;i++)
        {
            //ToLog("It="+i)
            Create(0,1000);
            Move(1000);Flush(1000);
            Find(100,500);
            Create(100,500);
            Find(100,500);
            Delete(0,1000);
            //Move(1000);Flush(1000);
            CheckZeroDB();
            Find(100,500,false);
            //Move(1000);Flush(1000);
            // Move(1000);
            // Flush(1000);
            // Move(1000);
            // Flush(1000);
        }
    }

    function TestAsync()
    {
        function Move(FCall)
        {
             Server.MoveKeyNextFileNew(FCall);

        }
        function Flush(FCall)
        {
            CurrentIterationWriteBuf=0;
            MemBufFlushAsync(Server.FileBufKey,FCall);
        }

        function ResultFlush(bNext)
        {
            //ToLog("ResultFlush: "+bNext)
            if(bNext)
                Flush(ResultFlush);
            else
            {
                Move(ResultMove);
            }
        }

        var CountMove=2;
        function ResultMove(bNext)
        {
            //ToLog("ResultMove: "+bNext)
            if(bNext)
                Move(ResultMove);
            else
            {
                CountMove--;
                if(CountMove>=0)
                {
                    Create(500,1500)
                    Delete(500,1500)
                    Find(1501,4000);
                    Flush(ResultFlush);
                    //Move(ResultMove);
                }
            }
        }

        Create(0,4000);
        Flush(ResultFlush);
    }


    function Test3()
    {
        for(var i=0;i<2;i++)
        {
            //ToLog("It="+i)
            Create(0,1000);
            Move(1000);Flush(1000);
            Find(100,500);
            Create(100,500);
            Find(100,500);
            Delete(0,1000);
            Move(1000);Flush(1000);
            CheckZeroDB();
            Find(100,500,false);
            //Move(1000);Flush(1000);
            // Move(1000);
            // Flush(1000);
            // Move(1000);
            // Flush(1000);
        }
    }

    function Test4()
    {
        for(var i=0;i<100;i++)
        {
            //ToLog("It="+i)
            Create(0,1000);
            Move(1000);Flush(1000);
            Delete(0,1000);
            Move(1000);Flush(1000);
            Create(0,1000);
            Move(1000);Flush(1000);
            Create(100,500);
            Move(1000);Flush(1000);
            //Find(100,500);
            Move(1000);Flush(1000);
            Delete(0,1000);
            //Move(1000);Flush(1000);
            Find(100,500,false);


            Move(1000);Flush(1000);
            Move(1000);Flush(1000);

        }
    }

    var fnameStop=GetDataPath("DB/stop");
    function TestCreateDB(DeltaStart,Count,IterCount)
    {
        //ToLog("CUR_BITS_COUNT="+CUR_BITS_COUNT)
        console.time("AllTest")

        //var Count2=1000;
        var WasLastCreate=-1;
        var Arr;
        for(var It=0;It<IterCount;It++)
        {
            var StrInfo="="+It+" C="+Count;
            var StrC="   Create"+StrInfo;
            var StrM="MoveFlush"+StrInfo;
            var StrF="    Find"+StrInfo;

            var Start=DeltaStart+It*Count;
            var Finish=DeltaStart+(It+1)*Count;
            WasLastCreate=Finish;
            console.time(StrC)
            Server.AllScanRow=0;
            //Create(Start,Finish);

            var Arr=GetArr(Start,Finish);
            Server.BulkWriteTrKeyDB(Arr);

            console.timeEnd(StrC)

            console.time(StrM)
            Move(Count*10);
            FlushAll();
            console.timeEnd(StrM)

            console.time(StrF)
            BulkFind(Arr);
            console.timeEnd(StrF)

            //ToLog("ROWS: "+(WasLastCreate/1000)+" krow   counter="+Math.floor(Server.AllScanRow/Count+0.5))

            if(fs.existsSync(fnameStop))
            {
                ToLog("BREAK ON "+It);
                break;
            }
        }
        return WasLastCreate;
    }


    function TestB2(Start1,Count)
    {
        //CUR_BITS_COUNT=19;

        console.time("AllTest2")

        //Find(0,1);
        //var Count=100000;
        var Start2=Start1-1000000;

        var Finish2=Start2+Count;
        var Finish1=Start1+Count;

        // Start2=Start1;
        // Finish2=Finish1;

        Server.AllScanRow=0;
        console.time("------------------Find")
        Find(Start1,Finish1);
        console.timeEnd("------------------Find")
        var FindF=Math.floor(Server.AllScanRow/Count+0.5);


        Server.AllScanRow=0;
        console.time("=======BulkFindTrKeyDB")
        BulkFind(Start2,Finish2);
        console.timeEnd("=======BulkFindTrKeyDB")
        var FindB=Math.floor(Server.AllScanRow/Count+0.5);

        ToLog("Find:"+FindF)
        ToLog("Bulk:"+FindB)



        console.timeEnd("AllTest2")

    }
    function BulkFind(Start,Finish)
    {
        var Arr=GetArr(Start,Finish);
        var Rows=Server.BulkFindTrKeyDB(Arr);
        for(var i=0;i<Rows.length;i++)
        {
            var Item=Rows[i];
            var Tr=Arr[Item.i];
            if(Tr.BlockNum!==Item.RetValue)
            {
                console.trace("ERROR BulkFindTrKeyDB on Tr.BlockNum="+Tr.BlockNum);
                throw "ERROR";
            }
        }

    }

    //Test1();
    //Test2();
    //Test3();
    //Test4();

    LoadDBParams();
    var ParamsCreate=LoadParams(GetDataPath("DB/create.lst"),{});
    if(!ParamsCreate.bCreate)
    {
        ParamsCreate.bCreate=true;
        ParamsCreate.Num=0;
    }

    // var Arr=GetArr(ParamsCreate.Num+500000,ParamsCreate.Num+500000+100);
    // var Rows=Server.BulkWriteTrKeyDB(Arr);
    // BulkFind(ParamsCreate.Num+500000,ParamsCreate.Num+500000+100);

    //TestB2(ParamsCreate.Num-11000);

    // return;

    //DelDir("D:/NODE/");
    //TestCreateDB(72*1000000,10000,180*100);

    //ParamsCreate.Num=TestCreateDB(ParamsCreate.Num,10000,1000000*100);

    // ParamsCreate.Num=TestCreateDB(ParamsCreate.Num,1000,2);
    //ParamsCreate.Num=TestCreateDB(ParamsCreate.Num,100000,10);
    // ParamsCreate.Num=TestCreateDB(ParamsCreate.Num,100000,4);
    // ParamsCreate.Num=TestCreateDB(ParamsCreate.Num,200000,4);
    //TestCreateDB(ParamsCreate.Num-10000000,10000,10);

    ParamsCreate.Num=1000000;

    //TestB2(10*1000000,10000)
    // ToLog("START")
    //Find(1,100000);
    // ToLog("ENDING")
    // return;
    // for(var i=5;i<10;i++)
    //    TestB2(ParamsCreate.Num-110000*i-10000);

    //TestB2(0,ParamsCreate.Num);
    console.time("=======BulkFindTrKeyDB")
    BulkFind(ParamsCreate.Num-700000-1000,ParamsCreate.Num-700000);
    console.timeEnd("=======BulkFindTrKeyDB")

    //Find(70*1000000,70*1000000+100);
    // ToLog("OK TEST!")
    // return;

    //TestCreateDB(30*1000000,10000,1*100);
    //Find(30*1000000,30*1000000);
    //TestB2(29*1000000-150000);
    //Find(30*1000000,30*1000000);

    //TestRND();
    //TestAsync();


    ToLog("ENDING")
    FlushAll();
    SaveDBParams();
    SaveParams(GetDataPath("DB/create.lst"),ParamsCreate);
    ToLog("OK TEST")
    process.exit(0);
}

//TestTest();



