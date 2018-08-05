//Copyright: Yuriy Ivanov, 2017-2018 e-mail: progr76@gmail.com



if(window.nw)
{
    window.Open=function (path,iconname,width,height)
    {
        width = width || 840;
        height = height || 1000;
        var params=
            {
                width: width,
                height: height
            };
        if(iconname)
            params.icon="../HTML/PIC/"+iconname+".png";

        window.nw.Window.open(path,params,function(win)
            {
            });
    }

    window.GetData=function(Method, ObjPost, Func)
    {
        if(Func===undefined)
        {
            //old mode
            Func=ObjPost;
            ObjPost=null;
        }
        window.nw.global.RunRPC({path:Method,obj:ObjPost},Func);
     }

    let ServerHTTP=undefined;
    global.RunRPC=function (message,Func)
    {
        if(!ServerHTTP)
            ServerHTTP = require('../core/html-server');

        var reply=ServerHTTP.SendData(message);
        if(Func)
        {
            Func(reply);
            // let FUNC=Func;
            // setTimeout(function ()
            // {
            //     FUNC(reply);
            // },20);
        }
    }
}
// else
// if(window.process)//ELECTRON
// {
//     require("../HTML/JS/client-electron");
// }
else
{
    window.Open=function (path,iconname,width,height)
    {
        var win=window.open(path);
    };

    window.GetData=
    function (Method, ObjPost, Func)
    {

        var StrPost=null;
        if(Func===undefined)
        {
            //old mode
            Func=ObjPost;
            ObjPost=null;
        }

        var serv=new XMLHttpRequest();
        //serv.open("GET", Method, true);

        if(ObjPost!==null)
        {
            StrPost=JSON.stringify(ObjPost);
            serv.open("POST", Method, true);
        }
        else
        {
            serv.open("GET", Method, true);
        }
        serv.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");
        //serv.setRequestHeader("If-Modified-Since", "Sat, 1 Jan 2000 00:00:00 GMT");
        serv.onreadystatechange = function()
        {
            if (serv.readyState == 4)
            {
                if(serv.status == 200)
                {
                    if(Func)
                    {
                        //SetStatus("Method: "+Method+" ObjPost="+ObjPost)

                        //var length=Math.floor(serv.responseText.length/1024);
                        //console.log("responseText="+serv.responseText)
                        //SetStatus2("Method="+serv.responseText.length);
                        Func(JSON.parse(serv.responseText),serv.responseText);
                    }
                }
                else
                {
                    if(Func)
                        Func(undefined);
                }
            }
        }

        serv.send(StrPost);

    };
}




//MONEY

var MAX_SUM_CENT=1e9;



function ADD(Ret,Value2)
{
    Ret.SumTER+=Value2.SumTER;
    Ret.SumCENT+=Value2.SumCENT;

    if(Ret.SumCENT>=MAX_SUM_CENT)
    {
        Ret.SumCENT-=MAX_SUM_CENT;
        Ret.SumTER++;
    }
}
function SUM_TO_STRING(Value,bTerion)
{
    var Str;
    if(Value.SumTER || Value.SumCENT)
        Str=""+Value.SumTER+"."+Rigth("000000000"+Value.SumCENT,9);
    else
        Str="";

    if(bTerion)
    {
        if(Str==="")
            Str="0 TERA";
        else
            Str+=" TERA";
    }
    return Str;
}

//HEX ARR

function GetArrFromHex(Str)
{
    var array=[];
    for(var i=0;Str && i<Str.length/2;i++)
    {
        array[i]=parseInt(Str.substr(i*2,2),16);
    }
    return array;
}

function GetHexFromArr(arr)
{
    if(!(arr instanceof Array) && arr.data)
        arr=arr.data;

    var Str="";
    for(var i=0;arr && i<arr.length;i++)
    {
        if(!arr[i])
            Str+="00";
        else
        {
            var Val=arr[i]&255;
            var A=Val.toString(16);
            if(A.length===1)
                A="0"+A;
            Str=Str+A;
        }
    }

    return Str.toUpperCase();
}

function GetStrFromAddr(arr)
{
    return GetHexFromArr(arr);
}

function GetHexFromArrBlock(Arr,LenBlock)
{
    var Str="";
    var Arr2=[];
    for(var i=0;i<Arr.length;i++)
    {
        Arr2[i%LenBlock]=Arr[i];
        if(Arr2.length>=LenBlock)
        {
            Str+=GetHexFromArr(Arr2)+"\n";
            Arr2=[];
        }
    }
    if(Arr2.length)
    {
        Str+=GetHexFromArr(Arr2);
    }

    return Str;
}


//STRING
function Rigth(Str,Count)
{
    if(Str.length<Count)
        return Str;
    else
        return Str.substr(Str.length-Count);
}




function toUTF8Array(str)
{
    var utf8 = [];
    for (var i=0; i < str.length; i++) {
        var charcode = str.charCodeAt(i);
        if (charcode < 0x80) utf8.push(charcode);
        else if (charcode < 0x800) {
            utf8.push(0xc0 | (charcode >> 6),
                0x80 | (charcode & 0x3f));
        }
        else if (charcode < 0xd800 || charcode >= 0xe000) {
            utf8.push(0xe0 | (charcode >> 12),
                0x80 | ((charcode>>6) & 0x3f),
                0x80 | (charcode & 0x3f));
        }
        // surrogate pair
        else {
            i++;
            // UTF-16 encodes 0x10000-0x10FFFF by
            // subtracting 0x10000 and splitting the
            // 20 bits of 0x0-0xFFFFF into two halves
            charcode = 0x10000 + (((charcode & 0x3ff)<<10)
                | (str.charCodeAt(i) & 0x3ff));
            utf8.push(0xf0 | (charcode >>18),
                0x80 | ((charcode>>12) & 0x3f),
                0x80 | ((charcode>>6) & 0x3f),
                0x80 | (charcode & 0x3f));
        }
    }
    return utf8;
}

function Utf8ArrayToStr(array)
{
    var out, i, len, c;
    var char2, char3;

    out = "";
    len = array.length;
    i = 0;
    while(i < len) {
        c = array[i++];
        switch(c >> 4)
        {
            case 0: case 1: case 2: case 3: case 4: case 5: case 6: case 7:
            // 0xxxxxxx
            out += String.fromCharCode(c);
            break;
            case 12: case 13:
            // 110x xxxx   10xx xxxx
            char2 = array[i++];
            out += String.fromCharCode(((c & 0x1F) << 6) | (char2 & 0x3F));
            break;
            case 14:
                // 1110 xxxx  10xx xxxx  10xx xxxx
                char2 = array[i++];
                char3 = array[i++];
                out += String.fromCharCode(((c & 0x0F) << 12) |
                    ((char2 & 0x3F) << 6) |
                    ((char3 & 0x3F) << 0));
                break;
        }
    }

    for(var i=0;i<out.length;i++)
    {
        if(out.charCodeAt(i)<32)
        {
            out=out.substr(0,i);
            break;
        }
    }
    return out;
}

function GetArr32FromStr(Str)
{
    return GetArrFromStr(Str,32);
}

function GetArrFromStr(Str,Len)
{
    var arr=toUTF8Array(Str);
    for(var i=arr.length;i<Len;i++)
    {
        arr[i]=0;
    }
    return arr.slice(0,Len);
}


//FORMAT WRITE TO ARRAY
function WriteByte(arr,Num)
{
    arr[arr.length]=Num&0xFF;
    //arr.len++;
}
function WriteUint(arr,Num)
{
    var len=arr.length;
    arr[len]=Num&0xFF;
    arr[len+1]=(Num>>>8) & 0xFF;
    arr[len+2]=(Num>>>16) & 0xFF;
    arr[len+3]=(Num>>>24) & 0xFF;

    var NumH=Math.floor(Num/4294967296);
    arr[len+4]=NumH&0xFF;
    arr[len+5]=(NumH>>>8) & 0xFF;

    //arr.len+=6;
}
function WriteUint32(arr,Num)
{
    var len=arr.length;
    arr[len]=Num&0xFF;
    arr[len+1]=(Num>>>8) & 0xFF;
    arr[len+2]=(Num>>>16) & 0xFF;
    arr[len+3]=(Num>>>24) & 0xFF;
    //arr.len+=4;
}
function WriteStr(arr,Str,ConstLength)
{
    if(!Str)
        Str="";
    var arrStr=toUTF8Array(Str);

    var length;
    var len=arr.length;

    if(ConstLength)
    {
        length=ConstLength;
    }
    else
    {
        length=arrStr.length;
        if(length>65535)
            length=65535;

        arr[len]=length&0xFF;
        arr[len+1]=(length>>>8) & 0xFF;
        len+=2;
    }

    for(var i=0;i<length;i++)
    {
        arr[len+i]=arrStr[i];
    }
}

function WriteArr(arr,arr2,ConstLength)
{
    var len=arr.length;
    for(var i=0;i<ConstLength;i++)
    {
        arr[len+i]=arr2[i];
    }
}
//FORMAT READ FROM ARRAY
function ReadUint(arr)
{
    var len=arr.len;
    var value=(arr[len+5]<<23)*2 + (arr[len+4]<<16)  + (arr[len+3]<<8) + arr[len+2];
    value=value*256 + arr[len+1];
    value=value*256 + arr[len];
    arr.len+=6;
    return value;
}
function ReadStr(arr)
{
    var length=arr[arr.len] + arr[arr.len+1]*256;
    arr.len+=2;
    var arr2=arr.slice(arr.len,arr.len+length);
    var Str=Utf8ArrayToStr(arr2);
    arr.len+=length;
    return Str;
}
function ReadArr(arr,length)
{
    var Ret=[];
    var len=arr.len;
    for(var i=0;i<length;i++)
    {
        Ret[i]=arr[len+i];
    }
    arr.len+=length;
    return Ret;
}

//NUMERIC
function ParseNum(Str)
{
    var Res=parseInt(Str)
    if(isNaN(Res))
        Res=0;
    if(!Res)
        Res=0;
    if(Res<0)
        Res=0;
    return Res;
}

//OBJECT
function CopyObjKeys(dest,src)
{
    for(var key in src)
    {
        dest[key]=src[key];
    }
}



//CMART-CONTRACT SERILIZE
function SaveToArr(Arr,Obj)
{
    for(var key in Obj)
    {
        Arr[0]++;
        var Value=Obj[key];
        switch(typeof Value)
        {
            case "number":
                WriteByte(Arr,241);
                WriteUint(Arr,Value);
                break;
            case "string":
                WriteByte(Arr,242);
                WriteStr(Arr,Value);
                break;
            case "object":
                if(Value && (Value.length>0 || Value.length===0) && Value.length<=240)
                {
                    WriteByte(Arr,Value.length);
                    WriteArr(Arr,Value,Value.length);
                    break;
                }
            default:
                WriteByte(Arr,250);
        }
    }
}
function LoadFromArr(Arr,Obj)
{
    if(!Arr.length)
        return false;

    var Count=Arr[0];
    Arr.len=1;
    for(var key in Obj)
    {
        if(!Count)
            break;
        Count--;

        var Type=Arr[Arr.len];Arr.len++;
        switch(Type)
        {
            case 241:
                Obj[key]=ReadUint(Arr);
                break;
            case 242:
                Obj[key]=ReadStr(Arr);
                break;
            default:
                if(Type<=240)
                {
                    var length=Type;
                    Obj[key]=ReadArr(Arr,length);
                    break;
                }
                else
                {
                    Obj[key]=undefined;
                }
        }
    }
    if(Arr[0])
        return true;
    else
        return false;
}

//HTML
var entityMap =
    {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': '&quot;',
        "'": '&#39;',
        "/": '&#x2F;',
        "\n": '<BR>',
        " ": '&nbsp;',
    };
function escapeHtml(string)
{
    return String(string).replace(/[\s\n&<>"'\/]/g, function (s)
    {
        return entityMap[s];
    });
}



//Paginations lib
function ViewCurrent(Def,flag,This)
{
    if(Def.BlockName)
    {
        if(flag)
        {
            SetVisibleBlock(Def.BlockName,!IsVisibleBlock(Def.BlockName));
        }
        else
        {
            SetVisibleBlock(Def.BlockName,true);
        }
        if(!IsVisibleBlock(Def.BlockName))
            return;
    }


    var item=document.getElementById(Def.NumName);
    var Filter="";
    if(Def.FilterName)
    {
        Filter=document.getElementById(Def.FilterName).value;
    }
    if(!Def.Param3)
        Def.Param3="";

    ViewGrid("/"+Def.APIName+"/"+ParseNum(item.value)+"/"+CountViewRows+"/"+Def.Param3+"/"+Filter,Def.TabName,1,Def.TotalSum);

    if(This)
        SetImg(This,Def.BlockName);
}

function ViewPrev(Def)
{
    var item=document.getElementById(Def.NumName);
    var Num=ParseNum(item.value);
    Num-=CountViewRows;
    if(Num<0)
        Num=0;
    item.value=Num;

    ViewCurrent(Def);
}
function ViewNext(Def,MaxNum)
{
    var item=document.getElementById(Def.NumName);
    var Num=ParseNum(item.value);
    Num+=CountViewRows;

    if(Def.FilterName)
    {
        if(document.getElementById(Def.FilterName).value)
        {
            //set max row + 1
            Num=document.getElementById(Def.TabName).MaxNum+1;
        }
    }


    if(Num<MaxNum)
    {
        item.value=Num;
    }
    else
    {
        item.value=MaxNum-MaxNum%CountViewRows;
    }
    ViewCurrent(Def);
}
function ViewBegin(Def)
{
    document.getElementById(Def.NumName).value=0;
    ViewCurrent(Def);
}
function ViewEnd(Def,MaxNum)
{
    document.getElementById(Def.NumName).value=MaxNum-MaxNum%CountViewRows;
    ViewCurrent(Def);
}



function DoStableScroll()
{

    var scrollHeight = Math.max(
        document.body.scrollHeight, document.documentElement.scrollHeight,
        document.body.offsetHeight, document.documentElement.offsetHeight,
        document.body.clientHeight, document.documentElement.clientHeight
    );

    var item=document.getElementById("idStableScroll");
    var itemlHeight = Math.max(item.scrollHeight,item.offsetHeight,item.clientHeight);
    scrollHeight=scrollHeight-itemlHeight;

    //console.log("height="+itemlHeight );
    item.style.top=""+scrollHeight+"px";

}



//GRID
var glWorkNum=0;
function SetGridData(arr,id_name,TotalSum,bclear,revert)
{
    var htmlTable=document.getElementById(id_name);

    if(bclear)
        ClearTable(htmlTable);


    if(!htmlTable.ItemsMap)
        htmlTable.ItemsMap={};

    var map=htmlTable.ItemsMap;

    glWorkNum++;
    var ValueTotal={SumTER:0,SumCENT:0};


    var row0=htmlTable.rows[0];
    var row0cells=row0.cells;
    var colcount=row0cells.length;
    for(var i=0;arr && i<arr.length;i++)
    {
        var Item=arr[i];
        var ID=Item.Num;
        htmlTable.MaxNum=Item.Num;

        var row=map[ID];
        if(!row)
        {
            htmlTable.RowCount++;
            if(revert)
                row=htmlTable.insertRow(1);
            else
                row=htmlTable.insertRow(-1);
            map[ID]=row;
            for(var n=0;n<colcount;n++)
            {
                var cell0=row0cells[n];
                if(cell0.innerText=="")
                    continue;

                var cell=row.insertCell(n);
                cell.className  = cell0.className;
            }
        }
        row.Work=glWorkNum;
        for(var n=0;n<colcount;n++)
        {
            var cell=row.cells[n];
            if(!cell)
                continue;

            var cell0=row0cells[n];

            //TODO оптимизировать!!!!

            var formula=cell0.id;
            if(formula.substr(0,1)==="(")
            {
                var text=eval(formula);
                if(cell.innerHTML!==text)
                    cell.innerHTML=text;
            }
            else
            {
                var text=eval(formula);
                if(cell.innerText!==text)
                    cell.innerText=text;
            }
        }

        if(TotalSum)
            ADD(ValueTotal,Item.Value);
    }


    //delete old
    for(var key in map)
    {
        var row=map[key];
        if(row.Work!==glWorkNum)
        {
            htmlTable.deleteRow(row.rowIndex);
            delete map[key];
        }
    }
    if(TotalSum)
    {
        var id = document.getElementById(TotalSum);
        id.innerText="Total: "+SUM_TO_STRING(ValueTotal,1);

    }

    DoStableScroll();
}

function ClearTable(htmlTable)
{
    for(var i=htmlTable.rows.length-1;i>0;i--)
        htmlTable.deleteRow(i);
    htmlTable.ItemsMap={};
    htmlTable.RowCount=0;
}


function ViewGrid(serverpath,nameid,bClear,TotalSum)
{
    GetData(serverpath, function (Data)
    {
        if(!Data || !Data.result)
            return;
        SetGridData(Data.arr,nameid,TotalSum,bClear);
    });
}

function RetOpenBlock(BlockNum,TrDataLen)
{
    if(BlockNum && TrDataLen)
        return '<INPUT type="button" onclick="ViewTransaction('+BlockNum+')" class="" value="'+BlockNum+'">';
    else
        return BlockNum;
}

function ViewTransaction(BlockNum)
{
    window.Open('./HTML/blockviewer.html#'+BlockNum,'viewer',800,800);
}

function DateFromBlock(BlockNum)
{
    var Str;
    if(window.FIRST_TIME_BLOCK)
    {
        var now=new Date(window.FIRST_TIME_BLOCK+BlockNum*1000);
        Str=now.toISOString();
        Str=Str.substr(0,Str.indexOf("."));
        Str=Str.replace("T"," ");
    }
    else
        Str="";
    return Str;
}


function SetCheckPoint(BlockNum)
{
    if(!BlockNum)
    {
        SetError("Not set BlockNum");
        return;
    }
    GetData("/SetCheckPoint/",BlockNum,function (Data)
    {
        if(Data)
        {
            SetStatus(Data.text,!Data.result);
        }
    });
}


function AddDiagramToArr(Arr,Item)
{
    var bWas=0;
    for(var i=0;i<Arr.length;i++)
    {
        if(Arr[i].name===Item.name)
        {
            Item.Delete=0;
            Arr[i]=Item;
            bWas=1;
            break;
        }
    }

    if(!bWas)
    {
        Item.num=Arr.length;
        Arr.push(Item);
    }

}
