//Copyright: Yuriy Ivanov, 2017 e-mail: progr76@gmail.com

var fs = require('fs');
require("./constant.js");
require("./log.js");

global.BufLib=require("../core/buffer");

//sha
//global.sha = require('js-sha3').keccak512;
require('../HTML/JS/sha3.js');
var jsSHA_CHECK;
//jsSHA_CHECK = require("jssha");
function Sha_CheckStr(arr)
{
    if(!jsSHA_CHECK)
        jsSHA_CHECK = require("jssha");

    var shaObj;
    if(typeof arr==="string")
    {
        shaObj = new jsSHA_CHECK("SHA3-256", "TEXT");
        shaObj.update(arr);
    }
    else
    {
        var Buf=new Uint8Array(arr.length);
        for(var i=0;i<arr.length;i++)
        {
            Buf[i]=arr[i];
        }
        shaObj = new jsSHA_CHECK("SHA3-256", "ARRAYBUFFER");
        shaObj.update(Buf);
    }
    var ret = shaObj.getHash("HEX");
    return ret;
};



//GLOBAL!!!!

Number.prototype.toStringZ=function(count)
{
    var strnum=this.toString();
    if(strnum.length>count)
        count=strnum.length;
    else
        strnum="0000000000"+strnum;
    return strnum.substring(strnum.length-count,strnum.length);
};

String.prototype.right=function(count)
{
    if(this.length>count)
        return this.substr(this.length-count,count);
    else
        return this.substr(0,this.length);
};



global.ReadUintFromArr=function(arr,len)
{
    if(len===undefined)
    {
        len=arr.len;
        arr.len+=6;
    }

    var value=(arr[len+5]<<23)*2 + (arr[len+4]<<16)  + (arr[len+3]<<8) + arr[len+2];
    value=value*256 + arr[len+1];
    value=value*256 + arr[len];
    return value;
}
global.WriteUintToArr=function (arr,Num)
{
    var len=arr.length;
    arr[len]=Num&0xFF;
    arr[len+1]=(Num>>>8) & 0xFF;
    arr[len+2]=(Num>>>16) & 0xFF;
    arr[len+3]=(Num>>>24) & 0xFF;

    var NumH=Math.floor(Num/4294967296);
    arr[len+4]=NumH&0xFF;
    arr[len+5]=(NumH>>>8) & 0xFF;

}

global.WriteUint32ToArr=function (arr,Num)
{
    var len=arr.length;
    arr[len]=Num&0xFF;
    arr[len+1]=(Num>>>8) & 0xFF;
    arr[len+2]=(Num>>>16) & 0xFF;
    arr[len+3]=(Num>>>24) & 0xFF;
}

global.WriteArrToArr=function(arr,arr2,ConstLength)
{
    var len=arr.length;
    for(var i=0;i<ConstLength;i++)
    {
        arr[len+i]=arr2[i];
    }
}

global.ConvertBufferToStr=function(Data)
{
    for(var key in Data)
    {
        var item=Data[key];
        if(item instanceof Buffer)
        {
            Data[key]=GetHexFromArr(item);
        }
        else
        if(typeof item==="object")
            ConvertBufferToStr(item);
    }
}


//var Num=123;ToLog(Num.toStringZ(4));process.exit(0);

// ArrayBuffer.prototype.toString=toString;
// function toString(encode)
// {
//     var Buf=Buffer.from(this);
//     return Buf.toString(encode);
// }


global.DelDir=function (Path)
{
    if(Path.substr(Path.length-1,1)==="/")
        Path=Path.substr(0,Path.length-1);

    if(fs.existsSync(Path))
    {
        var arr=fs.readdirSync(Path)
        //console.log("arr: "+arr);

        for(var i=0;i<arr.length;i++)
        {
            var name=Path+"/"+arr[i];
            if (fs.statSync(name).isDirectory())
            {
                DelDir(name);
                //console.log("DELETE "+name);
                //fs.rmdirSync(name);
            }
            else
            {
                if(name.right(9)=="const.lst")                    continue;
                if(name.right(7)=="log.log")                    continue;


                //console.log("Delete "+name);
                fs.unlinkSync(name);
            }
        }

    };
}




global.SliceArr=function(arr,start,end)
{
    var ret=[];
    for(var i=start;i<end;i++)
    {
        ret[i-start]=arr[i];
    }
    return ret;
}






//rnd
//global.RandomValue=123;
global.RandomValue=Math.floor(123+Math.random()*1000);
global.random=function (max)
{
    return Math.floor(Math.random()*max);

    RandomValue=(RandomValue*63018038201+123)%489133282872437279;
    var ret=1.0*RandomValue/489133282872437279;
    if(max!==undefined)
        ret=Math.floor(ret*max);

    return ret;
}






//степень похожести адресов
global.AddrLevel=function (Addr1,Addr2)
{
    var Level=0;
    //for(var i=0;i<Addr1.length;i++)
    for(var i=0;i<MAX_LEVEL_SPECIALIZATION;i++)
    {
        if(Addr1[i]!==Addr2[i])
            break;

        Level++;
    }

    return Level;
}

global.AddrLevelArrFromStart=function (arr1,arr2)
{
    var Level=0;
    for(var i=0;i<arr1.length;i++)
    {
        var a1=arr1[i];
        var a2=arr2[i];
        for(var b=0;b<8;b++)
        {
            if((a1&128) !== (a2&128))
                return Level;

            a1=a1<<1;
            a2=a2<<1;
            Level++;
        }
    }

    return Level;
}

global.AddrLevelArr=function (arr1,arr2)
{
    var Level=0;
    for(var i=arr1.length-1;i>=0;i--)
    {
        var a1=arr1[i];
        var a2=arr2[i];
        for(var b=0;b<8;b++)
        {
            if((a1&1) !== (a2&1))
                return Level;

            a1=a1>>1;
            a2=a2>>1;
            Level++;
        }
    }

    return Level;
}




global.SaveToFile=function (name,buf)
{
    var fs = require('fs');
    var file_handle=fs.openSync(name, "w");
    fs.writeSync(file_handle, buf,0,buf.length);
    fs.closeSync(file_handle);
}

//Date time
global.GetUTCStrTime=function (now)
{
    if(!now)
        now = GetCurrentTime();
    var Str=""+now.getUTCDate();
    Str=Str+"."+(1+now.getUTCMonth());
    Str=Str+"."+now.getUTCFullYear();
    Str=Str+" "+now.getUTCHours();
    Str=Str+":"+now.getUTCMinutes();
    Str=Str+":"+now.getUTCSeconds();
    Str=Str+"."+now.getUTCMilliseconds().toStringZ(3);
    return Str;
}

global.GetTimeStr=global.GetUTCStrTime;

global.GetTimeOnlyStr=function (now)
{
    if(!now)
        now = GetCurrentTime();
    var Str;
    Str=""+now.getUTCHours();
    Str=Str+":"+now.getUTCMinutes();
    Str=Str+":"+now.getUTCSeconds();
    Str=Str+"."+now.getUTCMilliseconds().toStringZ(3);
    return Str;
}



//Params

global.LoadParams=function(filename,DefaultValue)
{
    try
    {
        if(fs.existsSync(filename))
        {

            var Str = fs.readFileSync(filename);
            if(Str.length>0)
                return JSON.parse(Str);
        }
    }
    catch (err)
    {
        TO_ERROR_LOG("MAINLIB",100,"Error in file:"+filename+"\n"+err);
    }
    return DefaultValue;
}

global.SaveParams=function(filename,data)
{
    SaveToFile(filename,Buffer.from(JSON.stringify(data,"",4)));
}




global.StartTime=function ()
{
    global.TimeStart=GetCurrentTime();
}

global.FinishTime=function (Str)
{
    Str = Str || "";
    var TimeFinish=GetCurrentTime();
    var delta=TimeFinish-TimeStart;

    console.log(Str+" time: "+delta+" ms");
}

// console.time("1");
// console.timeEnd("1");


global.CompareItemBufFD =function(a,b)
{
    if(a.FD!==b.FD)
        return a.FD-b.FD;
    else
        return a.Position-b.Position;
}


global.CompareArr=function (a,b)
{
    for(var i=0;i<a.length;i++)
    {
        if(a[i]!==b[i])
            return a[i]-b[i];
    }
    return 0;
}

global.CompareArr33=function (a,b)
{
    for(var i=0;i<33;i++)
    {
        if(a[i]!==b[i])
            return a[i]-b[i];
    }
    return 0;
}

global.CompareItemHashSimple=function (a,b)
{
    if(a.hash<b.hash)
        return -1;
    else
    if(a.hash>b.hash)
        return 1;
    else
        return 0;
}


global.CompareItemHash=function(a,b)
{
    var hasha=a.hash;
    var hashb=b.hash;
    for(var i=0;i<hasha.length;i++)
    {
        if(hasha[i]!==hashb[i])
            return hasha[i]-hashb[i];
    }
    return 0;
}
global.CompareItemHash32=function(a,b)
{
    var hasha=a.hash;
    var hashb=b.hash;
    for(var i=0;i<32;i++)
    {
        if(hasha[i]!==hashb[i])
            return hasha[i]-hashb[i];
    }
    return 0;
}
global.CompareItemHASH32=function(a,b)
{
    var hasha=a.HASH;
    var hashb=b.HASH;
    for(var i=0;i<32;i++)
    {
        if(hasha[i]!==hashb[i])
            return hasha[i]-hashb[i];
    }
    return 0;
}
global.CompareItemHash33=function(a,b)
{
    var hasha=a.hash;
    var hashb=b.hash;
    for(var i=0;i<33;i++)
    {
        if(hasha[i]!==hashb[i])
            return hasha[i]-hashb[i];
    }
    return 0;
}

global.CompareItemHashPow=function(a,b)
{
    return CompareArr(a.hashPow,b.hashPow);
}
global.CompareItemTimePow=function(a,b)
{
    if(b.TimePow!==a.TimePow)
        return b.TimePow-a.TimePow;
    else
        return CompareArr(a.hashPow,b.hashPow);

}






global.LOAD_CONST=function ()
{
    var Count=0;
    var constants=LoadParams(GetDataPath("const.lst"),{});
    if(constants)
    for(var i=0;i<CONST_NAME_ARR.length;i++)
    {
        var key=CONST_NAME_ARR[i];
        if(constants[key]!==undefined)
        {
            Count++;
            global[key]=constants[key];
        }
    }
    return Count;
};


var WasStartSaveConst=false;
function SaveConst()
{
    var constants={};
    for(var i=0;i<CONST_NAME_ARR.length;i++)
    {
        var key=CONST_NAME_ARR[i];
        if(global[key]!==undefined)
            constants[key]=global[key];
    }
    // console.log(GetDataPath("const.lst"))
    // console.log(JSON.stringify(constants))
    SaveParams(GetDataPath("const.lst"),constants);
    WasStartSaveConst=false;
};

global.SAVE_CONST=function (bForce)
{
    if(bForce)
    {
        SaveConst();
    }
    else
    {
        if(!WasStartSaveConst)
            setTimeout(SaveConst,10*1000);
        WasStartSaveConst=true;
    }
}


//Time synchronization
var ntpClient = require('ntp-client');
function CheckTime()
{
    ntpClient.getNetworkTime("pool.ntp.org", 123, function(err, NetTime)
    {
        if(err)
        {
            TO_ERROR_LOG("MAINLIB",110,err);
            return;
        }

        var curTime=new Date;
        global.DELTA_CURRENT_TIME=NetTime-curTime;

        if(isNaN(global.DELTA_CURRENT_TIME) || typeof global.DELTA_CURRENT_TIME!=="number")
            global.DELTA_CURRENT_TIME=0;
        else
        if(Math.abs(global.DELTA_CURRENT_TIME)>24*3600*1000)
            global.DELTA_CURRENT_TIME=0;

        SAVE_CONST();

        //console.log("DELTA_CURRENT_TIME : "+DELTA_CURRENT_TIME);
        // console.log("pool.ntp.org="+NetTime);
        // console.log("my:"+curTime);
        // console.log("GetCurrentTime:"+GetCurrentTime());

    });
    SAVE_CONST();
}

global.GetDeltaCurrentTime=function ()
{
    // if(isNaN(global.DELTA_CURRENT_TIME) || typeof global.DELTA_CURRENT_TIME!=="number")
    // {
    //     LOAD_CONST();
    //     if(isNaN(global.DELTA_CURRENT_TIME) || typeof global.DELTA_CURRENT_TIME!=="number")
    //     {
    //         global.DELTA_CURRENT_TIME=0;
    //         //TODO CheckTime();
    //     }
    // }

    if(isNaN(global.DELTA_CURRENT_TIME) || typeof global.DELTA_CURRENT_TIME!=="number")
        global.DELTA_CURRENT_TIME=0;
    return global.DELTA_CURRENT_TIME;
}

global.GetCurrentTime=function(Delta_Time)
{
    if(Delta_Time===undefined)
        Delta_Time=GetDeltaCurrentTime();

    var curTime=new Date;
    var Time=new Date(curTime-(-Delta_Time))

    return Time;
}


function CopyObjValue(obj,num)
{
    if(num && num>5)
        return obj;

    var ret={};
    for(var key in obj)
    {
        var val=obj[key];
        if((typeof val === "object") && !(val instanceof Buffer) && !(val instanceof ArrayBuffer) && !(val instanceof Array))
            val=CopyObjValue(val,num+1);

        ret[key]=val;
    }
    return ret;
}
global.CopyObjValue=CopyObjValue;

//DELTA_CURRENT_TIME=Math.random()*5000;
//DELTA_CURRENT_TIME=0;
//setTimeout(CheckTime,100);
//setInterval(CheckTime,2*24*3600*1000*Math.random());

if(!LOAD_CONST() && !global.NWMODE)
{
    CheckTime();
}


//TODO - функция бинарного преобразования пакетов будет содержать валидаторы значений полей, если поле не удовлетворяет заданному диапазону значений - пакет отбрасывается

