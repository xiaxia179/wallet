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
                FI.size=Position+this.DataSize;

            return true;
        }
    }


    //Read

    Read(Num)
    {
        if(Num<0 || Num>this.GetMaxNum())
        {
            return undefined;
        }

        var BufRead=BufLib.GetNewBuffer(this.DataSize);
        var Position=Num*this.DataSize;
        var FI=this.OpenDBFile(this.FileName);


        var bytesRead=fs.readSync(FI.fd, BufRead,0,BufRead.length, Position);
        if(bytesRead!==BufRead.length)
            return undefined;

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



    //Truncate

    Truncate(LastNum)
    {
        var Position=(LastNum+1)*this.DataSize;

        var FI=this.OpenDBFile(this.FileName);
        if(Position<FI.size)
        {
            FI.size=Position;
            fs.ftruncateSync(FI.fd,FI.size);
        }
    }


}

