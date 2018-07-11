//Copyright: Yuriy Ivanov, 2017 e-mail: progr76@gmail.com
//Use:
//usege: require("./buffer");


module.exports.GetNewBuffer=GetNewBuffer;
module.exports.GetReadBuffer=GetReadBuffer;
module.exports.alloc=GetNewBuffer;
module.exports.from=GetReadBuffer;
module.exports.Write=Write;
module.exports.Read=Read;

module.exports.GetObjectFromBuffer=GetObjectFromBuffer;
module.exports.GetBufferFromObject=GetBufferFromObject;


function Write(buf,data,StringFormat,ParamValue,WorkStruct)
{
    if(typeof StringFormat === "number")
    {
        ToLogTrace("ERRR StringFormat ")
        throw "ERR!!"
        // var length=StringFormat;
        // buf.write(data,buf.len,length);
        // buf.len+=length;
    }
    else
    {
        var format=StringFormat;

        // if(buf.TextMode===true)
        // {
        //     if(format.substr(0,4)==="uint")
        //         format="uintSTR";
        //     else
        //         format=format+"STR";
        // }
        if(format.substr(0,6)==="buffer" && format.length>6)
        {
            ParamValue=parseInt(format.substr(6));
            format="buffer";
        }
        else
        if(format.substr(0,3)==="arr" && format.length>3)
        {
            ParamValue=parseInt(format.substr(3));
            format="arr";
        }
        else
        if(format.substr(0,3)==="str" && format.length>3)
        {
            //Write(buf,data,ParamValue);

            var length=parseInt(format.substr(3));
            if(data)
                buf.write(data,buf.len,length);
            buf.len+=length;
            return;
        }



        switch (format)
        {
            case "str":
            {
                var arr=toUTF8Array(data);
                var length=arr.length;
                if(length>65535)
                    length=0;

                //write length
                buf[buf.len]=length & 255;
                buf[buf.len+1]=(length>>>8) & 255;
                buf.len+=2;

                //write str
                for(var i=0;i<length;i++)
                {
                    buf[buf.len+i]=arr[i];
                }
                buf.len+=length;
                break;
            }

            case "byte":
            {
                if(data<0)
                    data=0;
                buf[buf.len]=data;
                buf.len+=1;
                break;
            }
            case "double":
            {
                buf.writeDoubleLE(data,buf.len,8);
                buf.len+=8;
                break;
            }
            case "uint":
            {
                if(data<0)
                    data=0;
                if(data>=281474976710655)
                    data=0;
                buf.writeUIntLE(data,buf.len,6);
                buf.len+=6;
                break;
            }
            case "uint16":
            {
                if(data<0)
                    data=0;
                buf[buf.len]=data & 255;
                buf[buf.len+1]=(data>>>8) & 255;
                buf.len+=2;
                break;
            }
            case "uint32":
            {
                if(data<0)
                    data=0;
                buf.writeUInt32LE(data,buf.len,4);
                buf.len+=4;
                break;
            }
            case "time":
            {
                var Time = data.valueOf();
                buf.writeUIntLE(Time,buf.len,6);
                // try
                // {
                //     buf.writeUIntLE(Time,buf.len,6);
                // }
                // catch (err)
                // {
                //     ToLog("============================Error write datetime,  Time = "+Time+"   data="+data);
                //     ToLog(err);
                //     throw "NO!"
                // }
                buf.len+=6;
                break;
            }
            case "addres":
            case "hash":
            {
                var length;
                if(data)
                    length=Math.min(32,data.length);
                else
                    length=0;
                for(var i=0;i<length;i++)
                {
                    buf[buf.len+i]=data[i];
                }
                buf.len+=32;
                break;
            }
            case "buffer":
            {
                var length;
                if(ParamValue===undefined)
                    length=data.length;
                else
                    length=Math.min(ParamValue,data.length);

                for(var i=0;i<length;i++)
                {
                    buf[buf.len+i]=data[i];
                }
                buf.len+=ParamValue;
                break;
            }
            case "arr":
            {
                var length;
                if(data)
                    length=Math.min(ParamValue,data.length);
                else
                    length=0;
                for(var i=0;i<length;i++)
                {
                    buf[buf.len+i]=data[i];
                }
                buf.len+=ParamValue;
                break;
            }

            // case "tr":
            // {
            //     var length;
            //     if(data)
            //         length=Math.min(TR_LEN,data.length);
            //     else
            //         length=0;
            //     for(var i=0;i<length;i++)
            //     {
            //         buf[buf.len+i]=data[i];
            //     }
            //     buf.len+=TR_LEN;
            //     break;
            // }
            case "tr":
            {
                var length=data.length;
                if(MAX_TRANSACTION_SIZE>MAX_TRANSACTION_SIZE)
                    length=MAX_TRANSACTION_SIZE;
                buf[buf.len]=length & 255;
                buf[buf.len+1]=(length>>>8) & 255;
                buf.len+=2;
                for(var i=0;i<length;i++)
                {
                    buf[buf.len+i]=data[i];
                }
                buf.len+=length;
                break;
            }

            case "data":
            {
                var length=data.length;
                buf.writeUInt32LE(length,buf.len,4);
                buf.len+=4;
                for(var i=0;i<length;i++)
                {
                    buf[buf.len+i]=data[i];
                }
                buf.len+=length;
                break;
            }
             case "hashSTR":
            {
                var Str=GetHexFromAddres(data);
                buf.write(Str,buf.len,64);
                buf.len+=64;
                break;
            }
            case "uintSTR":
            {
                var Str=data.toString();
                buf.write(Str,buf.len,10);
                buf.len+=10;
                break;
            }
            default:
            {
                WorkStruct = WorkStruct || {};

                var CurFormat=StringFormat.substr(0,1);
                if(CurFormat==="[")
                {
                    //Ex: [{BlockNum:uint,AddrHash:hash,PrevHash:hash,TreeHash:hash}]
                    var length;
                    if(data)
                        length=data.length;
                    var formatNext=GetMiddleString(format);
                    Write(buf,length,"uint32");
                    for(var i=0;i<length;i++)
                    {
                        Write(buf,data[i],formatNext,undefined,WorkStruct);
                    }
                }
                else
                if(CurFormat==="{")
                {
                    //Ex: {BlockNum:uint,AddrHash:hash,PrevHash:hash,TreeHash:hash}

                    var attrs=WorkStruct[format];
                    if(!attrs)
                    {
                        attrs=GetAttributes(GetMiddleString(format));
                        WorkStruct[format]=attrs;
                    }

                    for(var i=0;i<attrs.length;i++)
                    {
                        var type=attrs[i];
                        Write(buf,data[type.Key],type.Value,undefined,WorkStruct);
                    }
                }
                else
                {
                    throw "Bad write type params: "+format;
                }
            }

        }
    }
}

function Read(buf,StringFormat,ParamValue,WorkStruct)
{
    // if(isNaN(buf.len))
    // {
    //     ToLogTrace("NAN");
    // }

    var ret;
    if(typeof StringFormat === "number")
    {
        ToLogTrace("ERR StringFormat")
        throw "ERRR!"
    }
    else
    {
        var format=StringFormat;
        // if(buf.TextMode===true)
        // {
        //     if(format.substr(0,4)==="uint")
        //         format="uintSTR";
        //     else
        //         format=format+"STR";
        // }
        if(format.substr(0,6)==="buffer")
        {
            if(format.length>6)
            {
                ParamValue=parseInt(format.substr(6));
                format="buffer";
            }
            else
            {
                ParamValue=0;
            }
        }
        else
        if(format.substr(0,3)==="arr")
        {
            if(format.length>3)
            {
                ParamValue=parseInt(format.substr(3));
                format="arr";
            }
            else
            {
                ParamValue=0;
            }
        }
        else
        if(format.substr(0,3)==="str")
        {
            if(format.length>3)
            {
                var length=parseInt(format.substr(3));
                ret=buf.toString('utf8',buf.len,buf.len+length);
                buf.len+=length;

                var nEnd=-1;
                for(var i=ret.length-1;i>=0;i--)
                {
                    if(ret.charCodeAt(i)!==0)
                    {
                        nEnd=i;
                        break;
                    }
                }
                if(nEnd>=0)
                    ret=ret.substr(0,i+1);
                else
                    ret="";

                return ret;
            }
            else
            {
                ParamValue=0;
            }
        }

        switch (format)
        {
            case "str":
            {
                var length;
                if(buf.len+2<=buf.length)
                    length=buf[buf.len] + buf[buf.len+1]*256;
                else
                    length=0;

                buf.len+=2;
                var arr=buf.slice(buf.len,buf.len+length);
                ret=Utf8ArrayToStr(arr);
                buf.len+=length;

                break;
            }
            case "byte":
            {
                if(buf.len+1<=buf.length)
                    ret=buf[buf.len];
                else
                    ret=0;
                buf.len+=1;
                break;
            }
            case "double":
            {
                if(buf.len+8<=buf.length)
                    ret=buf.readDoubleLE(buf.len,8);
                else
                    ret=0;
                buf.len+=8;
                break;
            }
            case "uint":
            {
                if(buf.len+6<=buf.length)
                    ret=buf.readUIntLE(buf.len,6);
                else
                    ret=0;
                buf.len+=6;
                break;
            }
            case "uint16":
            {
                if(buf.len+2<=buf.length)
                    ret=buf[buf.len] + buf[buf.len+1]*256;
                else
                    ret=0;
                buf.len+=2;
                break;
            }
            case "uint32":
            {
                if(buf.len+4<=buf.length)
                    ret=buf.readUInt32LE(buf.len,4);
                else
                    ret=0;
                buf.len+=4;
                break;
            }
            case "time":
            {
                if(buf.len+6<=buf.length)
                    ret=buf.readUIntLE(buf.len,6);
                else
                    ret=0;
                ret=new Date(ret);
                buf.len+=6;
                break;
            }
            case "addres":
            case "hash":
            {
                ret=[];
                for(var i=0;i<32;i++)
                {
                    if(buf.len+i<=buf.length)
                        ret[i]=buf[buf.len+i];
                    else
                        ret[i]=0;
                }


                buf.len+=32;
                break;
            }

            case "buffer":
            // {
            //     ret=buf.slice(buf.len,buf.len+ParamValue);
            //     buf.len+=ParamValue;
            //     break;
            // }
            case "arr":
            {
                if(buf.len+ParamValue<=buf.length)
                    ret=buf.slice(buf.len,buf.len+ParamValue);
                else
                    ret=Buffer.alloc(ParamValue);
                buf.len+=ParamValue;
                break;
            }
             case "tr":
            {
                if(buf.len+1>=buf.length)
                {
                    ret=undefined;
                    break;
                }

                var length=buf[buf.len] + buf[buf.len+1]*256;
                buf.len+=2;
                ret=buf.slice(buf.len,buf.len+length);
                buf.len+=length;
                break;
            }
            case "data":
            {
                var length;
                if(buf.len+4<=buf.length)
                    length=buf.readUInt32LE(buf.len,4);
                else
                    length=0;
                if(length>buf.length-buf.len-4)
                     length=0;

                buf.len+=4;
                ret=buf.slice(buf.len,buf.len+length);
                buf.len+=length;
                break;
            }



            case "hashSTR":
            {
                var Str=buf.toString('utf8',buf.len,buf.len+64);
                ret=GetAddresFromHex(Str);
                buf.len+=64;
                break;
            }
            case "uintSTR":
            {
                var Str=buf.toString('utf8',buf.len,buf.len+10);
                ret=parseInt(Str);
                buf.len+=10;
                break;
            }

            default:
            {
                WorkStruct = WorkStruct || {};

                var LStr=format.substr(0,1);
                if(LStr==="[")//array
                {
                    //Ex: [{BlockNum:uint,AddrHash:hash,PrevHash:hash,TreeHash:hash}]

                    ret=[];
                    var formatNext=GetMiddleString(format);
                    var length=Read(buf,"uint32");
                    for(var i=0;i<length;i++)
                    {
                        if(buf.len<=buf.length)
                            ret[i]=Read(buf,formatNext,undefined,WorkStruct);
                        else
                            break;
                    }
                }
                else
                if(LStr==="{")//object
                {
                    //Ex: {BlockNum:uint,AddrHash:hash,PrevHash:hash,TreeHash:hash}

                    var attrs=WorkStruct[format];
                    if(!attrs)
                    {
                        attrs=GetAttributes(GetMiddleString(format));
                        WorkStruct[format]=attrs;
                    }

                    ret={};
                    for(var i=0;i<attrs.length;i++)
                    {
                        var type=attrs[i];
                        ret[type.Key]=Read(buf,type.Value,undefined,WorkStruct);
                    }
                }
                else
                {
                    throw "Bad read type params: "+format;
                }
            }
        }
    }
    return ret;
}


////////////////////////////////////////////////////////////////
function BufWriteByte(value)
{
    this[this.len]=value;
    this.len+=1;
}
function BufWrite(data,StringFormat,ParamValue)
{
    Write(this,data,StringFormat,ParamValue)
}
function BufRead(StringFormat,ParamValue)
{
    return Read(this,StringFormat,ParamValue)
}

function GetNewBuffer(size)
{
    var buf=Buffer.alloc(size);
    buf.Read=BufRead.bind(buf);
    buf.Write=BufWrite.bind(buf);
    // buf.WriteByte=BufWriteByte.bind(buf);



    buf.len=0;
    return buf;
}

function GetReadBuffer(buffer)
{
    var buf=Buffer.from(buffer);
    buf.Read=BufRead.bind(buf);
    buf.Write=BufWrite.bind(buf);
    //buf.WriteByte=BufWriteByte.bind(buf);
    buf.len=0;

    return buf;
}

function GetObjectFromBuffer(buffer,format,WorkStruct)
{
    var buf=Buffer.from(buffer);
    buf.len=0;

    return Read(buf,format,undefined,WorkStruct);
}

function GetBufferFromObject(data,format,size,WorkStruct)
{
    var buf=Buffer.alloc(size);
    buf.len=0;

    Write(buf,data,format,undefined,WorkStruct);

    buf=buf.slice(0,buf.len);
    return buf;
}

////////////////////////////////////////////////////////////////
//LIB LIB
function GetMiddleString(Str)
{
    return Str.substr(1,Str.length-2);
}

function GetMiddleString2(Str,FromStr,ToStr)
{
    var Count=0;
    var Result="";
    for(var i=0;i<Str.length;i++)
    {
        var FStr=Str.substr(i,1);
        if(FStr===" " || FStr==="\n")
        {
            continue;
        }
        if(FStr===FromStr)
        {
            Count++;
            if(Count===1)
                continue;
        }
        if(FStr===ToStr)
        {
            Count--;
            if(Count===0)
                break;
        }
        if(Count)
            Result=Result+FStr;
    }

    return Result;
}
function GetAttributeStrings(Str)
{
    var Count=0;
    var Result=[];
    var Element="";
    for(var i=0;i<Str.length;i++)
    {
        var FStr=Str.substr(i,1);
        if(FStr==="{")
        {
            Count++;
        }
        else
        if(FStr==="}")
        {
            Count--;
        }
        else
        if(FStr==="," && Count===0)
        {
            if(Element.length>0)
                Result.push(Element)
            Element="";
            continue;
        }
        else
        if(FStr===" " || FStr==="\n")
            continue;
        Element=Element+FStr;
    }

    if(Element.length>0)
        Result.push(Element)

    return Result;
}

function GetKeyValueStrings(Str)
{
    var Key="";
    for(var i=0;i<Str.length;i++)
    {
        var FStr=Str.substr(i,1);
        if(FStr===" " || FStr==="\n")
        {
            continue;
        }
        if(FStr===":")
        {
            var Value=Str.substr(i+1);
            return {Key:Key,Value:Value};
        }
        Key=Key+FStr;
    }

    throw "Error format Key:Value = "+Str;
}

function GetAttributes(Str)
{
    var arr=[];
    var attrstr=GetAttributeStrings(Str);
    for(var i=0;i<attrstr.length;i++)
    {
        var type=GetKeyValueStrings(attrstr[i]);
        arr.push(type);
    }
    return arr;
}

