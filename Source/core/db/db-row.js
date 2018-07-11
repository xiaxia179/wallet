"use strict";
/**
 *  Copyright: Yuriy Ivanov, 2018 e-mail: progr76@gmail.com
**/


const fs = require('fs');



module.exports = class CDBState extends require("./db")
{
    constructor(FileName,DataSize,Format)
    {
        super();

        this.FileName=FileName;
        this.DataSize=DataSize;
        this.Format=Format;
        this.WorkStruct={};

        var FI=this.OpenDBFile(this.FileName);
        this.FileNameFull=FI.fname;

        this.LastHash=undefined;
        this.WasUpdate=1;

    }


    GetMaxNum()
    {
        var FI=this.OpenDBFile(this.FileName);
        var Num=Math.floor(FI.size/this.DataSize)-1;
        return Num;
    }

    //Write

    Write(Data)
    {
        this.LastHash=undefined;
        this.WasUpdate=1;

        if(Data.Num===undefined)//new row
            Data.Num=this.GetMaxNum()+1;

        var BufWrite=BufLib.GetBufferFromObject(Data,this.Format,this.DataSize,this.WorkStruct);
        var Position=Data.Num*this.DataSize;
        var FI=this.OpenDBFile(this.FileName);

        var written=fs.writeSync(FI.fd, BufWrite,0,BufWrite.length, Position);
        if(written!==BufWrite.length)
        {
            TO_ERROR_LOG("DB-STATE",10,"Error write to file:" +written+" <> "+BufWrite.length);
            return false;
        }
        else
        {
            if(Position>=FI.size)
            {
                FI.size=Position+this.DataSize;
            }
            return true;
        }
    }


    //Read

    Read(Num,GetBufOnly)
    {
        if(isNaN(Num) || Num<0 || Num>this.GetMaxNum())
        {
            return undefined;
        }

        var BufRead=BufLib.GetNewBuffer(this.DataSize);
        var Position=Num*this.DataSize;
        var FI=this.OpenDBFile(this.FileName);


        var bytesRead=fs.readSync(FI.fd, BufRead,0,BufRead.length, Position);
        if(bytesRead!==BufRead.length)
            return undefined;

        if(GetBufOnly)
        {
            return BufRead;
        }

        try
        {
            var Data=BufLib.GetObjectFromBuffer(BufRead,this.Format,this.WorkStruct);
        }
        catch (e)
        {
            return undefined;
        }


        Data.Num=Num;
        return Data;
    }
    GetHash()
    {
        if(!this.LastHash)
        {
            var FI=this.OpenDBFile(this.FileName);
            if(FI.size)
            {
                var BufRead=BufLib.GetNewBuffer(FI.size);
                this.LastHash=shaarr(BufRead);
            }
            else
            {
                this.LastHash=[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0];
            }
        }
        return this.LastHash;
    }



    //Scroll
    GetRows(start,count)
    {
        var arr=[];
        for(var num=start;num<start+count;num++)
        {
            var Data=this.Read(num);
            if(!Data)
                break;
            arr.push(Data);
        }
        return arr;
    }



    //Truncate

    Truncate(LastNum)
    {
        var Position=(LastNum+1)*this.DataSize;
        if(Position<0)
            Position=0;

        var FI=this.OpenDBFile(this.FileName);
        if(Position<FI.size)
        {
            this.LastHash=undefined;
            this.WasUpdate=1;
            if(LastNum<0)
                ToLog("Truncate "+this.FileName+" from 0")
            else
                ToLog("Truncate "+this.FileName+" after Num="+LastNum)
            FI.size=Position;
            fs.ftruncateSync(FI.fd,FI.size);
        }
    }


    TruncateHistory(BlockNum)
    {
        //must be field BlockNum in def struct

        var MaxNum=this.GetMaxNum();
        if(MaxNum===-1)
            return;

        //return;

        for(var num=MaxNum;num>=0;num--)
        {
            var ItemCheck=this.Read(num);
            if(!ItemCheck)
                break;

            if(ItemCheck.BlockNum<BlockNum)//нашли
            {
                if(num<MaxNum)
                {
                    //ToLog("Truncate "+this.FileName+" after: "+(num));
                    this.Truncate(num);
                }
                return;
            }
        }

        //не нашли
        this.Truncate(-1);
    }


}

