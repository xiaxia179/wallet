//Copyright: Yuriy Ivanov, 2017 e-mail: progr76@gmail.com
//Use:
//require("./log.js");
require("./constant.js");
//const util = require('util');
const fs = require('fs');


var file_name_info      = GetDataPath("info.log");
var file_name_infoPrev  = GetDataPath("info-prev.log");
CheckSizeLogFile(file_name_info,file_name_infoPrev);

var file_name_log       = GetDataPath("log.log");
var file_name_logPrev   = GetDataPath("log-prev.log");
CheckSizeLogFile(file_name_log,file_name_logPrev);


var file_name_error       = GetDataPath("err.log");
var file_name_errorPrev   = GetDataPath("err-prev.log");
CheckSizeLogFile(file_name_error,file_name_errorPrev);


//Logs
//Logs
//Logs
//Logs
global.SmallAddr=function(Str)
{
    return Str.substr(0,5);
}

global.ToLogTrace=function (Str)
{
    ToErrorTrace(Str);
}
global.ToErrorTrace=function (Str)
{
    ToError(""+Str+":"+new Error().stack);
}
global.ToLog=function (Str)
{
    if(global.SendLogToClient)
        ToLogClient(Str,undefined,undefined,1);
    ToLogFile(file_name_log,Str);
}
global.ToInfo=function (Str)
{
    ToLogFile(file_name_info,Str);
}
global.ToError=function (Str)
{
    ToLogFile(file_name_error,Str);
}

function ToLogFile(file_name,Str)
{
    if (Str instanceof Error)
    {
        Str=Str.message+"\n"+Str.stack;
    }

    console.log(""+START_PORT_NUMBER+": "+GetStrOnlyTime()+": "+Str);

    SaveToLogFileSync(file_name,Str)
}



global.ArrLogClient=[];
function ToLogClient(Str,StrKey,bFinal,bNoLog)
{
    if(!Str)
        return;

    if(!bNoLog)
        ToLog(Str);

    if(!StrKey)
        StrKey="";
    ArrLogClient.push(
        {
            text:GetStrTime()+" "+Str,
            key:StrKey,
            final:bFinal,
        });

    if(ArrLogClient.length>10)
        ArrLogClient.shift();
}
global.ToLogClient=ToLogClient;



var StartStatTime;
var CONTEXT_STATS={Total:{},Interval:[]};
var CONTEXT_ERRORS={Total:{},Interval:[]};


global.TO_ERROR_LOG=function (Module,ErrNum,Str,type,data1,data2)
{
    if (Str instanceof Error)
    {
        Str=Str.message+"\n";//+Str.stack;
    }

    if(type==="rinfo")
        Str+=" from: "+data1.address + ':' + data1.port;// + ' data size:' + data2.length;
    else
    if(type==="node")
        Str+=" from: "+data1.ip + ':' + data1.port;// + ' data size:' + data2.length;



    var Key=Module+":"+ErrNum;

    ToError(" ==ERROR== "+Key+" "+Str);


    AddToStatContext(CONTEXT_ERRORS,Key);

    ADD_TO_STAT("ERRORS");
}

//stats

var DefMaxStatPeriod=MAX_STAT_PERIOD*2+2;
var CurStatIndex=0;
function GetCurrentStatIndex()
{
    return CurStatIndex%DefMaxStatPeriod;;
}

global.ADD_TO_STAT=function(Key,Count,bDetail)
{
    if(global.STAT_MODE)
    {
        if(bDetail && global.STAT_MODE!==2)
            return;

        AddToStatContext(CONTEXT_STATS,Key,Count);
    }
}

global.ADD_TO_STAT_TIME=function(Name,startTime,bDetail)
{
    if(global.STAT_MODE)
    {
        if(bDetail && global.STAT_MODE!==2)
            return;

        var Time = process.hrtime(startTime);
        var deltaTime=Time[0]*1000 + Time[1]/1e6;//ms
        ADD_TO_STAT(Name,deltaTime);
    }
}


global.GET_STATS=function(Key)
{

    var now=GetCurrentTime();
    var index=GetCurrentStatIndex();


    var stats=
        {
            Counter:CONTEXT_STATS.Total,
            Counter10S:CalcInterval(CONTEXT_STATS,index,10),
            Counter10M:CalcInterval(CONTEXT_STATS,index,10*60),
            //Counter1H:CalcInterval(CONTEXT_STATS,index,3600)
        };
    var errors=
    {
        Counter:CONTEXT_ERRORS.Total,
        Counter10S:CalcInterval(CONTEXT_ERRORS,index,10),
        Counter10M:CalcInterval(CONTEXT_ERRORS,index,10*60),
        //Counter1H:CalcInterval(CONTEXT_ERRORS,index,3600)
    };

    var Period=(now-StartStatTime)/1000;

    return {stats:stats,errors:errors,period:Period,Confirmation:[]};
}


global.GET_STATDIAGRAMS=function(Keys)
{
    var now=GetCurrentTime();
    var index=GetCurrentStatIndex();

    if(!Keys || !Keys.length)
        return [];

    var Data=[];
    for(var i=0;i<Keys.length;i++)
    {
        var name=Keys[i];
        var Value=GetDiagramData(CONTEXT_STATS,name);
        Data.push({name:name,maxindex:index,arr:Value,starttime:(StartStatTime-0),steptime:1});
    }


    var MinLength=undefined;
    for(var i=0;i<Data.length;i++)
    {
        var arr=Data[i].arr;
        if(arr.length>0 && (MinLength===undefined || arr.length<MinLength))
            MinLength=arr.length;
    }

    const MaxSizeArr=512;

    for(var i=0;i<Data.length;i++)
    {
        var ItemServer=Data[i];

        var arr=ItemServer.arr;
        if(MinLength && arr.length>MinLength)
        {
            arr=arr.slice(arr.length-MinLength);
        }

        if(MinLength)
        if(",MAX:WIN:POWER_MY,MAX:POWER_BLOCKCHAIN,".indexOf(","+ItemServer.name+",")>=0)
        {
            //calc from blockhain stat
            arr=SERVER.GetStatBlockchain(ItemServer.name,MinLength);
        }

        //calc avg
        var AvgValue=0;
        for(var j=0;j<arr.length;j++)
        {
            AvgValue+=arr[j];
        }
        if(arr.length>0)
            AvgValue=AvgValue/arr.length;


        var StepTime=1;
        if(ItemServer.name.substr(0,4)==="MAX:")
        //if(ItemServer.name.indexOf("ERR")>=0)
        {
            while(arr.length>=MaxSizeArr)
            {
                arr=ResizeArrMax(arr);
                //arr=ResizeArr(arr);
                StepTime=StepTime*2;
            }
        }
        else
        {
            while(arr.length>=MaxSizeArr)
            {
                arr=ResizeArrAvg(arr);
                StepTime=StepTime*2;
            }
        }
        ItemServer.AvgValue=AvgValue;
        ItemServer.steptime=StepTime;
        ItemServer.arr=arr.slice(1);
    }

    return Data;
}

global.StartCommonStat=function()
{
    for(var key in CONTEXT_STATS.Total)
        return;
    ClearCommonStat();
}

global.ClearCommonStat=function()
{
    CurStatIndex=0;
    StartStatTime=undefined;
    CONTEXT_STATS={Total:{},Interval:[]};
    CONTEXT_ERRORS={Total:{},Interval:[]};
}


function ResizeArr(arr)
{
    var arr2=[];
    var Count2=Math.trunc(arr.length/2);
    for(var i=0;i<Count2;i++)
    {
        arr2[i]=arr[i*2];
    }
    return arr2;
}


function ResizeArrMax(arr)
{
    var arr2=[];
    var Count2=Math.trunc(arr.length/2);
    for(var i=0;i<Count2;i++)
    {
        arr2[i]=Math.max(arr[i*2],arr[i*2+1]);
    }
    return arr2;
}

function ResizeArrAvg(arr)
{
    var arr2=[];
    var Count2=Math.trunc(arr.length/2);
    for(var i=0;i<Count2;i++)
    {
        arr2[i]=(arr[i*2]+arr[i*2+1])/2;
    }
    return arr2;
}


function GetDiagramData(Context,Key)
{
    var IsMax;
    if(Key.substr(0,4)==="MAX:")
        IsMax=true;
    else
        IsMax=false;


    var delta=MAX_STAT_PERIOD;
    var index2=GetCurrentStatIndex();
    var index1=(index2-delta+DefMaxStatPeriod)%DefMaxStatPeriod;
    var Total=Context.Total;
    var Counter1;

    var arr=[];
    var PrevValue=undefined;
    for(var i=index1;i<index1+delta;i++)
    {
        var index3=i%DefMaxStatPeriod;
        Counter1=Context.Interval[index3];
        if(Counter1)
        {
            var Value=Counter1[Key];
            if(Value!==undefined)
            {
                if(!IsMax)
                {
                    if(PrevValue!==undefined)
                    {
                        arr.push(Value-PrevValue);
                    }
                    else
                    {
                        arr.push(Value);
                    }
                    PrevValue=Value;
                }
                else
                {
                    arr.push(Value);
                }
            }
            else
            {
                arr.push(0);
            }
        }
    }
    return arr;

}

function CalcInterval(Context,index2,delta)
{
    var Res={};
    var index1=(index2-delta+DefMaxStatPeriod)%DefMaxStatPeriod;
    var Total=Context.Total;
    var Counter1;

    for(var i=index1;i<index1+delta;i++)
    {
        var index3=i%DefMaxStatPeriod;
        Counter1=Context.Interval[index3];
        if(Counter1)
            break;
    }
    if(Counter1)
    for(var Key in Total)
    {
        if(Key.substr(0,4)==="MAX:")
            Res[Key]=0;
        else
        {
            if(Counter1[Key]===undefined)
                Res[Key]=Total[Key];
            else
                Res[Key]=Total[Key]-Counter1[Key];
        }
    }
    return Res;
}

function AddToStatContext(Context,Key,AddValue)
{
    if(AddValue===undefined)
        AddValue = 1;

    var Val=Context.Total[Key];
    if(!Val)
        Val=0;
    if(Key.substr(0,4)==="MAX:")
        Val=Math.max(Val,AddValue);
    else
        Val=Val+AddValue;
    Context.Total[Key]=Val;

    if(!StartStatTime)
        StartStatTime=GetCurrentTime(0);
}


function CopyStatInterval(Context,index)
{
    var Counter=Context.Interval[index];
    if(!Counter)
    {
        Counter={};
        Context.Interval[index]=Counter;
    }

    var Total=Context.Total;
    for(var Key in Total)
    {
        Counter[Key]=Total[Key];
        if(Key.substr(0,4)==="MAX:")
            Total[Key]=0;
    }
}




setInterval(function ()
{
    CurStatIndex++;
    var index=GetCurrentStatIndex();
    CopyStatInterval(CONTEXT_STATS,index);
    CopyStatInterval(CONTEXT_ERRORS,index);
},1000);


if(DEBUG_MODE)
global.TO_DEBUG_LOG=function (Str,type,data1,data2)
{
    if(!DEBUG_MODE)
        return;

    if(type==="rinfo")
        Str+=" from: "+data1.address + ':' + data1.port + ' - ' + data2.length;

    ToLog(Str);
}
else
global.TO_DEBUG_LOG=function (Str,type,data1,data2){};


function SaveToLogFileSync(fname,Str)
{
    try
    {
        var StrLog=GetStrTime() +" : "+Str+"\r\n";

        var file_handle=fs.openSync(fname, "a");
        fs.writeSync(file_handle, StrLog, null, 'utf8');
        fs.closeSync(file_handle);
    }
    catch (err)
    {
        console.log(err.message);
    }
}

function SaveToLogFileAsync(fname,Str)
{
    fs.open(fname, "a", undefined, function(err, file_handle)//0644
    {
        if (!err)
        {
            var StrLog=GetStrTime() +" : "+Str+"\r\n";
            fs.write(file_handle, StrLog, null, 'utf8', function(err, written)
            {
                if (!err)
                {
                    console.log(Str);
                    fs.close(file_handle)
                }
                else
                {
                    console.log("Ошибка записи в лог-файл ошибок!");
                }
            });
        }
        else
        {
            console.log("Ошибка открытия лог-файла ошибок");
        }
    });
}


function CheckSizeLogFile(file_name,file_name_prev)
{
    "use strict";

    let FILE_NAME_LOG=file_name;
    let FILE_NAME_LOG_PREV=file_name_prev;
    setInterval(function()
    {
        try {

            var stat = fs.statSync(FILE_NAME_LOG);
            if (stat.size > MAX_SIZE_LOG)
            {

                if(fs.existsSync(FILE_NAME_LOG_PREV))
                {
                    fs.unlinkSync(FILE_NAME_LOG_PREV);
                }

                fs.renameSync(FILE_NAME_LOG,FILE_NAME_LOG_PREV);
                ToLog("truncate logfile ok");
            }

        }
        catch (err)
        {
            //ToLog(err);
        }
        //fs.stat(file_name_log, function(error, stat){

    },60000);
}



global.GetStrTime=function (now)
{
    now = now || GetCurrentTime();

    var Str=""+now.getDate().toStringZ(2);
    Str=Str+"."+(1+now.getMonth()).toStringZ(2);
    Str=Str+"."+now.getFullYear();
    Str=Str+" "+now.getHours().toStringZ(2);
    Str=Str+":"+now.getMinutes().toStringZ(2);
    Str=Str+":"+now.getSeconds().toStringZ(2);
    Str=Str+"."+now.getMilliseconds().toStringZ(3);
    return Str;
}

global.GetStrOnlyTime=function (now)
{
    now = now || GetCurrentTime(0);

    var Str=""+now.getHours().toStringZ(2);
    Str=Str+":"+now.getMinutes().toStringZ(2);
    Str=Str+":"+now.getSeconds().toStringZ(2);
    Str=Str+"."+now.getMilliseconds().toStringZ(3);
    return Str;
}



//TODO: Ввести несколько файлов и разные уровни ошибок: инфо, ошибки

