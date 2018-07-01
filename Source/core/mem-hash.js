"use strict";
/**
 * Created by vtools on 10.04.2018.
 */
//
//require("./mem-hash");
require("./crypto-library");
const RBTree = require('bintrees').RBTree;

const SIZE_UINT32=(1<<30)*4;

class CMemHash
{
    /*
        Буфер элементов - это набор блоков с транзакциями (фиксировано число блоков и максимальное число транзакций)
    */

    constructor(count_blocks,count_lines,meshArr)
    {
        const width_key=32;
        const width_value=width_key+8;

        this.MAX_FIND_COUNT=32;
        var size=count_blocks*count_lines;

        this.COUNT_BLOCKS=count_blocks;
        this.COUNT_LINES=count_lines;
        this.MAX_ITEM=size;
        this.WIDTH_KEY=width_key;
        this.WIDTH_VALUE=width_value;
        this.WIDTH_ITEM=this.WIDTH_VALUE+4;

        this.BUFFERITEM = new ArrayBuffer((1+this.MAX_ITEM)*this.WIDTH_ITEM);
        this.DATAITEM = Buffer.from(this.BUFFERITEM);

        this.Bits=Math.floor(Math.log2(8*size)+0.5);
        this.MAX_POS=(1<<this.Bits)+this.MAX_FIND_COUNT*2;

        this.BUFFERPOS = new ArrayBuffer(this.MAX_POS*4);
        this.DATAPOS = new Uint32Array(this.BUFFERPOS);

        this.meshArr=meshArr;

        this.CountPos=1;
        this.CountFindPos=1;
        this.CountDoublePos=0;
        this.CountDoubleValue=0;

        this.MinBlockNum=0;
        this.TempHashPos=[];


        // this.TestMap={};
        // this.TestBlockMap={};
    }


    //Kernel
    //Kernel
    //Kernel
    MeshMesh(arr1)
    {
        var S=[];
        for(var i=0;i<32;i++)
            S[i]=arr1[i];
        for(var i=32;i<50;i++)
            S[i]=this.meshArr[i-32];
        Mesh(S,8);
        return S;
    }

    GetIndex(arr)
    {
        for(var i=0;i<8;i++)
            this.TempHashPos[i]=arr[i]^arr[i+8]^arr[i+16]^arr[i+24]^this.meshArr[i];

        var Position=0;
        var b=0;
        var mult=1;
        var cur_bits=this.Bits;
        while(cur_bits>0)
        {
            var curByte=this.TempHashPos[b];

            var maska;
            if(cur_bits>=8)
                maska = 255;
            else
                maska = (1<<cur_bits)-1;


            Position += mult*(curByte & maska);
            mult=mult*256;

            cur_bits=cur_bits-8;
            b++;
            // if(b>=8)
            //     throw "ERR!!"
        }

        return Position;
    }

    SetKey(SetKeyIndex)
    {
        this.CountPos++;


        var IndexPos=this.ReadIndexPos(SetKeyIndex);


        var MaxCount=this.MAX_FIND_COUNT;
        while(true)
        {
            this.CountFindPos++;
            var FindKeyIndex=this.DATAPOS[IndexPos];
            if(FindKeyIndex===0)
            {
                this.DATAPOS[IndexPos]=SetKeyIndex;
                return true;
            }

            //Rewrite
            if(FindKeyIndex===SetKeyIndex)
            {
                this.DATAPOS[IndexPos]=SetKeyIndex;
                return true;
            }

            this.CountDoublePos++;

            MaxCount--;
            if(MaxCount<=0)
            {
                console.trace("MaxCount on SETKEY");
                throw "MaxCount on SETKEY"
                return false;
            }

            IndexPos++;
            if(IndexPos>=this.MAX_POS)
            {
                console.trace("MAX_POS on SETKEY");
                throw "MAX_POS on SETKEY"
                return false;
            }
        }
    }
    GetKey(arr)
    {
        this.CountPos++;

        var IndexPos=this.GetIndex(arr);

        var Ret=[];
        var MaxCount=this.MAX_FIND_COUNT;
        while(true)
        {
            this.CountFindPos++;
            var FindKeyIndex=this.DATAPOS[IndexPos];
            if(FindKeyIndex===0)
                return Ret;


            var start=this.WIDTH_ITEM*FindKeyIndex;

            var bEq=true;
            for(var i=0;i<arr.length;i++)
            if(this.DATAITEM[start+i]!==arr[i])
            {
                bEq=false;
                break;
            }

            if(bEq)
            {
                Ret.push(FindKeyIndex);
                //Ret.push(arrFindKey);
            }

            MaxCount--;
            if(MaxCount<=0)
            {
                console.trace("MaxCount on GETKEY");
                throw "MaxCount on GETKEY"
                return Ret;
            }

            IndexPos++;
            if(IndexPos>=this.MAX_POS)
            {
                console.trace("MAX_POS on GETKEY");
                throw "MAX_POS on GETKEY"
                return false;
            }
        }
    }


    DeletePos(IndexPos,MaxCount)
    {
        this.CountFindPos++;
        if(MaxCount<=0)
        {
            console.trace("MaxCount on DELETEPOS");
            throw "MaxCount on DELETEPOS"
            return false;
        }

        var NextIndexPos=IndexPos+1;
        while(true)
        {
            var NextKeyIndex=this.DATAPOS[NextIndexPos];

            if(NextKeyIndex)
            {
                var NextIndexPosByItemTable=this.ReadIndexPos(NextKeyIndex);


                if(NextIndexPosByItemTable<=IndexPos)
                {

                    this.DATAPOS[IndexPos]=NextKeyIndex;
                    this.DeletePos(NextIndexPos,MaxCount-1);
                    return true;
                }
                else
                {
                    NextIndexPos++;
                }
            }
            else
            {
                this.DATAPOS[IndexPos]=0;
                return true;
            }

            MaxCount--;
            if(MaxCount<=0)
            {
                console.trace("MaxCount on DELETEPOS 2");
                throw "MaxCount on DELETEPOS"
                return false;
            }

        }
    }

    DeleteKey(DelKeyIndex)
    {
        this.CountPos++;


        var IndexPos=this.ReadIndexPos(DelKeyIndex);


        var MaxCount=this.MAX_FIND_COUNT;
        while(true)
        {
            this.CountFindPos++;

            var FindKeyIndex=this.DATAPOS[IndexPos];
            if(FindKeyIndex===0)
                return false;


            if(FindKeyIndex===DelKeyIndex)
            {
                //запускаем сдвиг вверх
                this.DeletePos(IndexPos,MaxCount-1);
                return true;
            }



            MaxCount--;
            if(MaxCount<=0)
            {
                console.trace("MaxCount on DELETEKEY");
                throw "MaxCount on DELETEKEY"
                return false;
            }

            IndexPos++;
            if(IndexPos>=this.MAX_POS)
            {
                console.trace("MAX_POS on DELETEKEY");
                throw "MAX_POS on DELETEKEY"
                return false;
            }
        }
    }



    //прикладной уровень
    //прикладной уровень
    //прикладной уровень


    SetValue(BlockNum,TrNum,arr)
    {
        //Test
        if(this.TestMap)
        {
            var StrKey=GetHexFromAddres(arr);
            if(!this.TestMap[StrKey])
                this.TestMap[StrKey]=[];
            this.TestMap[StrKey].push(BlockNum);
            if(!this.TestBlockMap[BlockNum])
                this.TestBlockMap[BlockNum]=[];
            this.TestBlockMap[BlockNum].push(StrKey)
        }



        if(BlockNum<this.MinBlockNum)
        {
            return;
        }
        if(TrNum>=this.COUNT_LINES)
        {
            console.trace("TrNum>this.COUNT_LINES")
            throw "ERR"
        }

        var KeyIndex=1+(BlockNum%this.COUNT_BLOCKS)*this.COUNT_LINES+(TrNum%this.COUNT_LINES);

        var start=this.WIDTH_ITEM*KeyIndex;
        for(var i=0;i<this.WIDTH_KEY;i++)
        {
            this.DATAITEM[start+i]=arr[i];
        }



        var IndexPos=this.GetIndex(arr);
        this.WriteBlockNum(KeyIndex,BlockNum);
        this.WriteIndexPos(KeyIndex,IndexPos);
        this.SetKey(KeyIndex);
    }
    GetValue(arr)
    {
        var Ret=[];
        var ArrKeys=this.GetKey(arr);
        for(var i=0;i<ArrKeys.length;i++)
        {
            var KeyIndex=ArrKeys[i];
            var BlockNum=this.ReadBlockNum(KeyIndex);

            Ret.push(BlockNum);
        }

        if(this.TestMap)
        {
            var StrKey=GetHexFromAddres(arr);
            if(!this.TestMap[StrKey])
                this.TestMap[StrKey]=[];
            var Ret2=this.TestMap[StrKey];

            if(Ret2.length!==Ret.length || CompareArr(Ret,Ret2)!==0)
            {
                console.trace("ERROR GetValue result");
                //return Ret2;
                throw "ERR"
            }
        }

        return Ret;
    }

    SetBlock(Block)
    {
        var arr=Block.arrContent;
        if(!arr)
            return;

        var BlockNum=Block.BlockNum;
        if(BlockNum<this.MinBlockNum)
            return;

        for(var i=0;i<arr.length;i++)
        {
            var hash=shaarr(arr[i]);
            this.SetValue(BlockNum,i,hash);
        }
    }

    DeleteValue(arr,BlockNum)
    {
        var Count=0;
        var ArrKeys=this.GetKey(arr);
        for(var i=0;i<ArrKeys.length;i++)
        {
            var KeyIndex=ArrKeys[i];
            var CurBlockNum=this.ReadBlockNum(KeyIndex);
            if(CurBlockNum===BlockNum)
            {
                if(this.DeleteKey(KeyIndex))
                {
                    this.WriteBlockNum(KeyIndex,0);
                    Count++;
                }
            }
        }
        return Count;
    }

    DeleteBlock(BlockNum)
    {

        if(this.TestMap)
        if(this.TestBlockMap[BlockNum])
        {
            var arr=this.TestBlockMap[BlockNum];
            for(var i=0;i<arr.length;i++)
            {
                var StrKey=arr[i];
                delete this.TestMap[StrKey];
            }
            this.TestBlockMap[BlockNum]=undefined;
        }


        if(BlockNum<this.MinBlockNum)
            return 0;
        var Count=0;
        for(var TrNum=0;TrNum<this.COUNT_LINES;TrNum++)
        {
            var KeyIndex=1+(BlockNum%this.COUNT_BLOCKS)*this.COUNT_LINES+(TrNum%this.COUNT_LINES);

            var CurBlockNum=this.ReadBlockNum(KeyIndex)
            if(CurBlockNum===BlockNum)
            {
                 if(this.DeleteKey(KeyIndex))
                 {
                     this.WriteBlockNum(KeyIndex,0);
                     Count++;
                 }
            }
            else
            {
                //break;
            }
        }

        return Count;
    }
    CheckAlMinimum()
    {
        for(var IndexPos=0;IndexPos<this.MAX_POS;IndexPos++)
        {
            var KeyIndex=this.DATAPOS[IndexPos];
            if(!KeyIndex)
                continue;

            var Num=this.ReadBlockNum(KeyIndex)
            if(Num<this.MinBlockNum)
            {
                ToLog("Find num="+Num)
                throw "ERROR"

            }
        }
    }

    WriteIndexPos(KeyIndex,IndexPos)
    {
        this.DATAITEM.writeUInt32LE(IndexPos,this.WIDTH_ITEM*KeyIndex+this.WIDTH_VALUE,4);
    }
    ReadIndexPos(KeyIndex)
    {
        var IndexPos=this.DATAITEM.readUInt32LE(this.WIDTH_ITEM*KeyIndex+this.WIDTH_VALUE,4);
        return IndexPos;
    }


    WriteBlockNum(KeyIndex,BlockNum)
    {
        this.DATAITEM.writeUIntLE(BlockNum, this.WIDTH_ITEM*KeyIndex+this.WIDTH_KEY,6);
    }
    ReadBlockNum(KeyIndex)
    {
        var CurBlockNum=this.DATAITEM.readUIntLE(this.WIDTH_ITEM*KeyIndex+this.WIDTH_KEY,6);
        return CurBlockNum;
    }

    CalcPosItem()
    {
        var Count=0;
        for(var IndexPos=0;IndexPos<this.MAX_POS;IndexPos++)
        {
            if(this.DATAPOS[IndexPos]!==0)
                Count++;
        }

        return Count;
    }

    CalcMaxPosCluster()
    {
        var Count=0;
        var MaxCount=0;
        for(var IndexPos=0;IndexPos<this.MAX_POS;IndexPos++)
        {
            if(this.DATAPOS[IndexPos]!==0)
                Count++;
            else
                Count=0;
            if(Count>MaxCount)
                MaxCount=Count;
        }

        return MaxCount;
    }

    FF()
    {
        var FF=Math.floor(this.CountFindPos/this.CountPos*10+0.5)/10;
        return FF;
    }

}
module.exports=CMemHash;


class CBufTree extends CMemHash
{
    constructor(count_blocks,count_lines,meshArr)
    {
        super(count_blocks,count_lines,meshArr);

    }
}

function TestTest()
{

    var Test;

    function CheckBlock(Block)
    {
        var arr=Block.arrContent;
        for(var i=0;i<arr.length;i++)
        {
            var hash=shaarr(arr[i]);
            if(Test.GetKey(hash).length!==1)
            {
                throw "ERROR FIND VALUE 0"
            }
        }
    }
    function DeleteBlock(Block)
    {
        var arr=Block.arrContent;
        for(var i=0;i<arr.length;i++)
        {
            var hash=shaarr(arr[i]);
            var Ret=Test.GetKey(hash)
            if(Ret.length!==1)
            {
                console.trace("DeleteBlock 1")
                var IndexPos=Test.GetIndex(hash);
                Ret=Test.GetKey(hash);
                throw "ERROR"
            }

            var bRes=Test.DeleteKey(Ret[0]);
            if(!bRes)
            {
                console.trace("DeleteBlock 2")
                throw "ERROR"
            }
            var Ret=Test.GetKey(hash)
            if(Ret.length>0)
            {
                console.trace("DeleteBlock 3")
                throw "ERROR"
            }
        }
    }

    function OnWriteBlock(Block)
    {
        var MinBlockNum=0;
        if(!Block || Block.BlockNum<MinBlockNum)
            return;

        //добавляем новые транзакции в буфер контроля дублей

        var arr=Block.arrContent;
        if(!arr)
            return;

        var BlockNum=Block.BlockNum;

        for(var i=0;i<arr.length;i++)
        {
            var hash=shaarr(arr[i]);

            if(0)
            if(Test.GetKey(hash).length)
            {
                throw "ERROR FIND VALUE 1"
            }

            Test.SetValue(BlockNum,i,hash);
        }

    }

    var Mem1=process.memoryUsage().heapUsed;
    Test=new CMemHash(1000,1000,shaarr("TEST"));

    console.time("OnWriteBlock")
    var ArrBlocks=[];
    for(var Num=0;Num<100;Num++)
    {
        var arr=[];
        for(var tr=0;tr<1000;tr++)
        {

            var key=shaarr(""+(tr+Num*1000));

            var body=[];
            body[0]=0;  //smart-contract number
            body[64]=0;
            for(var i=0;i<32;i++)
            {
                body[i+1]=key[i];
                body[i+33]=key[i];
            }
            arr.push(body);


        }
        var Block={BlockNum:Num,arrContent:arr};
        //ArrBlocks.push(Block);
        OnWriteBlock(Block);
    }
    //this.Test=Test;
    var Mem2=process.memoryUsage().heapUsed;
    var Delta=(Mem2-Mem1)/1000000;
    console.log("1 Delta="+Delta)
    console.timeEnd("OnWriteBlock");




    console.log("Checking...")

    for(var i=0;i<ArrBlocks.length;i++)
    {
        var Block=ArrBlocks[i];
        CheckBlock(Block);
    }

    console.log("Fill factor="+Test.FF()+" (CountFindPos="+Test.CountFindPos+"  CountPos="+Test.CountPos+")")

    console.log("CalcPosItem="+Test.CalcPosItem());

    // var hash=shaarr("!"+ArrBlocks[0].arrContent[0]);
    // Test.SetValue(150,1,hash);
    // Test.SetValue(150,2,hash);
    //

    // var Ret1=Test.GetValue(hash);
    // var Ret=Test.GetKey(hash);
    // for(var i=1;i<Ret.length;i++)
    // {
    //     Test.DeleteKey(Ret[i]);
    // }
    // var Ret2=Test.GetValue(hash);
    //
    // Test.DeleteBlock(150);
    console.log("CalcPosItem="+Test.CalcPosItem());

    for(var Num=0;Num<1000;Num++)
        Test.DeleteBlock(Num);
    console.log("CalcPosItem="+Test.CalcPosItem());

    var hash=shaarr("Test1");
    var hash2=shaarr("Test2");
    Test.SetValue(150,1,hash);
    Test.SetValue(150,2,hash2);
    Test.DeleteValue(hash,150)
    Test.DeleteValue(hash2,150)

    console.log("Fill factor="+Test.FF()+" (CountFindPos="+Test.CountFindPos+"  CountPos="+Test.CountPos+")")

    // for(var i=0;i<ArrBlocks.length;i++)
    // {
    //     var Block=ArrBlocks[i];
    //     DeleteBlock(Block);
    // }

    console.log("CalcPosItem="+Test.CalcPosItem());

    process.exit(0)
    return;




    console.time("OnWriteBlock2")
    Mem1=process.memoryUsage().heapUsed;
    for(var i=0;i<ArrBlocks.length;i++)
    {
        var Block=ArrBlocks[i];
        OnWriteBlock(Block);
    }
    Mem2=process.memoryUsage().heapUsed;
    Delta=(Mem2-Mem1)/1000000;
    console.timeEnd("OnWriteBlock2")
    console.log("2 Delta="+Delta)



}



function MySHA(Num)
{
    var S=[];
    var RET=[];
    for(var i=0;i<50;i++)
        S[i]=0;
    S[0]=Num;
    Mesh(S,8);
    for(var i=0;i<32;i++)
       RET[i]=S[i]&255;

    return Buffer.from(RET);
}

function TestTest2()
{
    //var Test=new CMemHash(1000+16*4,900,shaarr("TEST"));
    var Test=new CBufTree(1000+16*4,900,shaarr("TEST"));



    console.time("Test")

    var BlockNum=0;
    var glNomer=0;
    for(var Iter=0;Iter<1000;Iter++)
    {
        BlockNum++;

        if(BlockNum>1000)
        {
            var Count=Test.DeleteBlock(BlockNum-1000);
            if(Count!==900)
            {
                Count=Test.DeleteBlock(BlockNum-1000);
                console.trace("ERR Count="+Count);
                throw "ERR"
            }
        }
        var StartTr=glNomer;
        for(var tr=0;tr<900;tr++)
        {
            glNomer++;
            //var HASH=shaarr("TEST:"+glNomer);
            var HASH=MySHA(glNomer);
            Test.SetValue(BlockNum,tr,HASH);
            var Ret=Test.GetValue(HASH);
            if(Ret.length===0)
            {
                console.trace("ERR!!")
                throw "ERR"
            }
            for(var i=0;i<Ret.length;i++)
            if(Ret[i]!==BlockNum)
            {
                console.trace("ERR!!")
                throw "ERR"
            }
        }

        var Count=Test.DeleteBlock(BlockNum);
        if(Count!==900)
        {
            Test.DeleteBlock(BlockNum);
            throw "ERR"
        }
        for(var tr=0;tr<900;tr++)
        {
            StartTr++;
            //var HASH=shaarr("TEST:"+StartTr);
            var HASH=MySHA(StartTr);
            Test.SetValue(BlockNum,tr,HASH);
            var Ret=Test.GetValue(HASH);
            if(Ret.length===0)
            {
                console.trace("ERR!!")
                throw "ERR"
            }
            for(var i=0;i<Ret.length;i++)
                if(Ret[i]!==BlockNum)
                {
                    console.trace("ERR!!")
                    throw "ERR"
                }
        }


        if(Iter%100===0)
        console.log(""+Iter+"-"+BlockNum+". Max="+Test.CalcMaxPosCluster()+" of "+Test.CalcPosItem()+" FF="+Test.FF());
    }
    console.timeEnd("Test")

    //process.exit(0)

}

function TestHash()
{
    ToLog(GetHexFromAddres(MySHA(0)))
    ToLog(GetHexFromAddres(MySHA(1)))
    ToLog(GetHexFromAddres(MySHA(2)))
    ToLog(GetHexFromAddres(MySHA(1123323)))

    var Count=100000;
    console.time("Test1")
    for(var i=0;i<Count;i++)
    {
        var HASH=MySHA(i);
    }
    console.timeEnd("Test1")
    console.time("Test2")
    for(var i=0;i<Count;i++)
    {
        var HASH=shaarr(""+i);
    }
    console.timeEnd("Test2")

}

function TestTest3()
{
    //var Test=new CMemHash(1000+16*4,900,shaarr("TEST"));
    var Test=new CBufTree(1000+16*4,900,shaarr("TEST"));

    var hash1=MySHA(1);
    var hash2=MySHA(2);
    Test.SetValue(1,1,hash1);

    var n0=Test.GetValue(hash1);

    Test.SetValue(2,2,hash2);

    var n1=Test.GetValue(hash1);
    var n2=Test.GetValue(hash2);


}

function TestTestSize()
{
    var Tree = new RBTree(function (a,b)
    {
        return a.adr-b.adr;
    });

    var Mem1=process.memoryUsage().heapUsed;

    //var buf=Buffer.alloc(1000000);

    console.time("Test");
    var Count=900000;
    for(var i=0;i<Count;i++)
    {
        var HASH=MySHA(i);
        //var HASH=buf.slice(i,i+32);
        Tree.insert({adr:i,HASH:HASH});
    }

    console.timeEnd("Test")

    var Mem2=process.memoryUsage().heapUsed;
    var Delta=(Mem2-Mem1)/1000000;
    console.log("Delta="+Delta)

    var Stop=1;

}


//TestTest2();
// TestTestSize();
// process.exit(0)

