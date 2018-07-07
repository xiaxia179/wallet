//Copyright: Yuriy Ivanov, 2017-2018 e-mail: progr76@gmail.com
//Use:
//require("./crypto-library");

//var secp256k1 = require('./../lib/secp256k1.node')

if(global.ELECTRON)
    global.secp256k1 = require('secp256k1/js')
else
    global.secp256k1 = require('secp256k1')

require("./library.js");

const crypto = require('crypto');


global.MAX_SUPER_VALUE_POW=(1<<30)*2;


var BuferForStr=Buffer.alloc(32);
global.GetHexFromAddres=function (arr)
{
    if(!arr)
        return "";

    if(arr.data!==undefined)
        arr=arr.data;
    for(var i=0;i<32;i++)
        BuferForStr[i]=arr[i];

    return BuferForStr.toString('hex').toUpperCase();
}
global.GetArr32FromHex=function (Str)
{
    var array=new Uint8Array(32);
    for(var i=0;i<array.length;i++)
    {
        array[i]=parseInt(Str.substr(i*2,2),16);
    }
    return array;
}
global.GetAddresFromHex=GetArr32FromHex;




global.GetHexAddresFromPublicKey=function (arr)
{
    return Buffer.from(arr.slice(1)).toString('hex').toUpperCase();
}


//////////////////////////////////////////////////
global.GetHexFromArr=function (arr)
{
    return Buffer.from(arr).toString('hex').toUpperCase();
}
function GetArrFromHex(Str)
{
    var array=[];
    for(var i=0;i<Str.length/2;i++)
    {
        array[i]=parseInt(Str.substr(i*2,2),16);
    }
    return array;
}
global.GetArrFromHex=GetArrFromHex;
//////////////////////////////////////////////////




global.GetPublicKeyFromAddres=function (Arr)
{
    var RetArr=new Uint8Array(33);
    RetArr[0]=2;

    for(var i=1;i<33;i++)
        RetArr[i]=Arr[i-1];

    return RetArr;
}


//Sign
//Sign
//Sign


global.GetSign=function (Context, Msg)
{
    var hash=shabuf(Msg);
    var sigObj = secp256k1.sign(hash, Context.KeyPair.getPrivateKey());
    return sigObj.signature;//Uint8Array[64]
}

global.GetVerifySign=function (ContextAddr, Msg, Sign)
{
    var hash=shabuf(Msg);
    if(ContextAddr.publickey===undefined)
        ContextAddr.publickey=GetPublicKeyFromAddres(ContextAddr.addrArr);


    var Result=secp256k1.verify(hash, Sign, ContextAddr.publickey);
    return Result;
}

//DEVELOP SIGN
global.CheckDevelopSign=function (SignArr,Sign)
{
    var hash=shabuf(SignArr);
    var Result=secp256k1.verify(hash, Buffer.from(Sign), DEVELOP_PUB_KEY);
    return Result;
}


//HASH-SIGN
//HASH-SIGN
//HASH-SIGN

global.CheckContextSecret=function (Context, ContextAddrTo)
{
    if(ContextAddrTo.Secret===undefined)
    {
        if(ContextAddrTo.publickey===undefined)
        {
            ContextAddrTo.publickey=GetPublicKeyFromAddres(ContextAddrTo.addrArr);
        }
        ContextAddrTo.Secret = Context.KeyPair.computeSecret(ContextAddrTo.publickey, null);
    }
}

global.GetSignHash=function (Context, ContextAddrTo, Msg)
{

    CheckContextSecret(Context, ContextAddrTo);

    if(typeof Msg==="string")
        Msg=Buffer.from(Msg);

    var Buf=Buffer.concat([Msg, ContextAddrTo.Secret], Msg.length+ContextAddrTo.Secret.length);
    var Arr=shaarr(Buf);
    return Arr;
}

global.GetVerifyHash=function (Context, ContextAddr, Msg, Sign1)
{
    try
    {
        var Sign2=GetSignHash(Context, ContextAddr, Msg);

        for(var i=0;i<Sign1.length;i++)
            if(Sign1[i]!==Sign2[i])
                return false;

        return true;
    }
    catch (e)
    {
        return false;
    }
}


//KEY-PAIR

global.GetKeyPair = function (password,secret,startnonce1,startnonce2)
{
    secret = secret || "low";
    startnonce1 = startnonce1 || 0;
    startnonce2 = startnonce2 || 0;

    var KeyPair = crypto.createECDH('secp256k1');

    //find private key 1

    var private1=shaarr(password);
    var private2=private1;

    var nonce1=0;
    if(secret==="high")
        for(nonce1=startnonce1;nonce1<2000000000;nonce1++)
        {
            private1[31]=nonce1&0xFF;
            private1[30]=(nonce1>>>8) & 0xFF;
            private1[29]=(nonce1>>>16) & 0xFF;
            private1[28]=(nonce1>>>24) & 0xFF;

            private2=shaarr(private1);
            if(private2[0]===0 && private2[1]===0 && private2[2]===0)
            {
                break;
            }
            nonce1++;
        }

    //ToLog("Find1:"+nonce1);

    //find private key 2

    var nonce2;
    for(nonce2=startnonce2;nonce2<2000000000;nonce2++)
    {
        private2[31]=nonce2&0xFF;
        private2[30]=(nonce2>>>8) & 0xFF;
        private2[29]=(nonce2>>>16) & 0xFF;
        private2[28]=(nonce2>>>24) & 0xFF;

        KeyPair.setPrivateKey(Buffer.from(private2));
        var Data=KeyPair.getPublicKey('','compressed');
        if(Data[0]===2 && Data[31]===0 && Data[32]===0)
        //if(Data[0]===2 && Data[31]===0)
        {
            KeyPair.nonce1=nonce1;
            KeyPair.nonce2=nonce2;
            KeyPair.PubKeyArr=KeyPair.getPublicKey('','compressed');
            KeyPair.addrArr=KeyPair.PubKeyArr.slice(1);
            //KeyPair.addrStr=GetHexAddresFromPublicKey(KeyPair.addrArr);
            KeyPair.addrStr=GetHexFromArr(KeyPair.addrArr); //GetHexAddresFromPublicKey(KeyPair.addrArr);
            KeyPair.addr=KeyPair.addrArr;
            return KeyPair;
        }
        nonce2++;//????
    }

    throw "ERROR. Key pair not found. Try another password!";
}


global.GetKeyPairTest = function (password,Power)
{
    var KeyPair = crypto.createECDH('secp256k1');
    var private2=shaarr(password);

    for(var nonce2=0;nonce2<1000000000;nonce2++)
    {
        private2[31]=nonce2&0xFF;
        private2[30]=(nonce2>>8) & 0xFF;
        private2[29]=(nonce2>>16) & 0xFF;
        private2[28]=(nonce2>>24) & 0xFF;

        KeyPair.setPrivateKey(Buffer.from(private2));
        var Data=KeyPair.getPublicKey('','compressed');
        if(Data[0]===2)// && Data[31]===0 && Data[32]===0)
        {
            if(Power)
            {
                var nBits=GetPowPower(Data.slice(1));
                if(nBits<Power)
                    continue;
            }

            KeyPair.PubKeyArr=Data;
            KeyPair.addrArr=KeyPair.PubKeyArr.slice(1);
            KeyPair.addrStr=GetHexFromArr(KeyPair.addrArr); //GetHexAddresFromPublicKey(KeyPair.addrArr);
            KeyPair.addr=KeyPair.addrArr;
            return KeyPair;
        }
    }

    throw "ERROR. Key pair not found. Try another password!";
}




//POW
//POW
//POW


function GetArrFromValue(Num)
{
    var arr=[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0];
    arr[0]=Num&0xFF;
    arr[1]=(Num>>>8) & 0xFF;
    arr[2]=(Num>>>16) & 0xFF;
    arr[3]=(Num>>>24) & 0xFF;

    var NumH=Math.floor(Num/4294967296);
    arr[4]=NumH&0xFF;
    arr[5]=(NumH>>>8) & 0xFF;

    return arr;
}

function GetHashWithNonce(hash0,nonce)
{
    return shaarr2(hash0,GetArrFromValue(nonce));
}

global.GetHashWithValues=GetHashWithValues;
function GetHashWithValues(hash0,value1,value2,bNotCopy)
{
    var hash;
    if(bNotCopy)
        hash=hash0;
    else
        hash=hash0.slice();

    hash[0]=value1&0xFF;
    hash[1]=(value1>>>8) & 0xFF;
    hash[2]=(value1>>>16) & 0xFF;
    hash[3]=(value1>>>24) & 0xFF;

    hash[4]=value2&0xFF;
    hash[5]=(value2>>>8) & 0xFF;
    hash[6]=(value2>>>16) & 0xFF;
    hash[7]=(value2>>>24) & 0xFF;

    //hash.writeUIntLE(nonce,0,6);

    var arrhash=shaarr(hash);
    return arrhash;
}


function GetPowPower(arrhash)
{
    var SumBit=0;
    for(var i=0;i<arrhash.length;i++)
    {
        var CurSum=Math.clz32(arrhash[i])-24;
        SumBit+=CurSum;
        if(CurSum!==8)
            break;
    }
    return SumBit;
}


function GetPowValue(arrhash)
{
    //чем меньше значение, тем больше сила
    var value=(arrhash[0]<<23)*2 + (arrhash[1]<<16)  + (arrhash[2]<<8) + arrhash[3];
    value=value*256 + arrhash[4];
    value=value*256 + arrhash[5];

    return value;
}






//external nonce
global.CreateNoncePOWExtern=CreateNoncePOWExtern;
function CreateNoncePOWExtern(arr0,BlockNum,count,startnone)
{
    var arr=[];
    for(var i=0;i<arr0.length;i++)
        arr[i]=arr0[i];
    if(!startnone)
        startnone=0;

    var maxnonce=0;
    var supervalue=MAX_SUPER_VALUE_POW;
    for(var nonce=startnone;nonce<=startnone+count;nonce++)
    {
        var arrhash=GetHashWithValues(arr,nonce,BlockNum,true);
        var value=GetPowValue(arrhash);

        if(value<supervalue)
        {
            maxnonce=nonce;
            supervalue=value;
        }
    }
    return maxnonce;
}
global.CreateNoncePOWExternMinPower=CreateNoncePOWExternMinPower;
function CreateNoncePOWExternMinPower(arr0,BlockNum,MinPow)
{
    var arr=[];
    for(var i=0;i<arr0.length;i++)
        arr[i]=arr0[i];

    var nonce=0;
    while(1)
    {
        var arrhash=GetHashWithValues(arr,nonce,BlockNum,true);
        var power=GetPowPower(arrhash);
        if(power>=MinPow)
        {
            return nonce;
        }
        nonce++;
    }
}



//inner nonce
global.CreateNoncePOWInner=function(arr0,count)
{
    var Hash;
    var arr=arr0.slice();
    var maxnonce=0;
    var supervalue=MAX_SUPER_VALUE_POW;
    for(var nonce=0;nonce<count;nonce++)
    {
        var hashTest=GetHashWithNonce(arr,nonce);
        var value=GetPowValue(hashTest);

        if(value<supervalue)
        {
            maxnonce=nonce;
            supervalue=value;
            Hash=hashTest;
        }
    }
    return {nonce:maxnonce,Hash:Hash};
}

global.CreateAddrPOW=function (SeqHash,CountNonce)
{
    //global.CalcStat=1;
    var Arr=GetArrFromValue(GENERATE_BLOCK_ACCOUNT);
    var MaxHash=shaarr2(SeqHash,Arr);
    var MaxNonce=0;

    for(var nonce=1;nonce<CountNonce;nonce++)
    {
        Arr[6]=nonce&0xFF;
        Arr[7]=(nonce>>>8) & 0xFF;
        Arr[8]=(nonce>>>16) & 0xFF;
        Arr[9]=(nonce>>>24) & 0xFF;

        var HashTest=shaarr2(SeqHash,Arr);
        if(CompareArr(MaxHash,HashTest)>0)
        {
            MaxHash=HashTest;
            MaxNonce=nonce;
        }
    }

    Arr[6]=MaxNonce&0xFF;
    Arr[7]=(MaxNonce>>>8) & 0xFF;
    Arr[8]=(MaxNonce>>>16) & 0xFF;
    Arr[9]=(MaxNonce>>>24) & 0xFF;

    //global.CalcStat=0;
    return {AddrHash:Arr,Hash:MaxHash};
}



//HASH ARRAY
//HASH ARRAY
//HASH ARRAY


function IsZeroArr(arr)
{
    for(var i=0;i<arr.length;i++)
    {
        if(arr[i])
            return false;
    }
    return true;

}

function CalcHashFromArray(ArrHashes,bOriginalSeq)
{
    //расчет хэша массива
    if(bOriginalSeq===undefined)
        ArrHashes.sort(CompareArr);


    var Buf=[];
    for(var i=0;i<ArrHashes.length;i++)
    {
        var Value=ArrHashes[i];
        //if(!IsZeroArr(Value))
        {
            for(var n=0;n<Value.length;n++)
                Buf.push(Value[n]);
        }
    }
    if(Buf.length===0)
        return [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0];
    else
    if(Buf.length===32)
        return Buf;

    var Hash=shaarr(Buf);
    return Hash;
}
function CalcMerklFromArray(Arr,Tree0)
{
    var Tree;
    if(Tree0)
    {
        Tree = Tree0
    }
    else
    {
        Tree={Levels:[],Full:true};
    }
    Tree.Levels.push(Arr);

    if(Arr.length<2)
    {
        if(Arr.length===0)
            Tree.Root=[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0];
        else
        {
            if(Arr[0].length===32)
                Tree.Root=Arr[0];
            else
                Tree.Root=shaarr(Arr[0]);
        }

        return Tree;
    }

    if(!Tree0)
        Arr.sort(CompareArr);

    //var Buf=[];
    var Arr2=[];
    var len=Math.floor(Arr.length/2);
    for(var i=0;i<len;i++)
    {
        var Hash=shaarr2(Arr[i*2],Arr[i*2+1]);
        Arr2.push(Hash);
    }
    if(len*2!==Arr.length)
    {
        Arr2.push(Arr[Arr.length-1]);
    }

    return CalcMerklFromArray(Arr2,Tree);
}

function arr2(Value1,Value2)
{
    var Buf=[];

    for(var n=0;n<Value1.length;n++)
        Buf.push(Value1[n])

    for(var n=0;n<Value2.length;n++)
        Buf.push(Value2[n])

    return Buf;
}

function shaarr2(Value1,Value2)
{
    return shaarr(arr2(Value1,Value2));
}


var RC = [1, 0, 32898, 0, 32906, 2147483648, 2147516416, 2147483648, 32907, 0, 2147483649,
    0, 2147516545, 2147483648, 32777, 2147483648, 138, 0, 136, 0, 2147516425, 0,
    2147483658, 0, 2147516555, 0, 139, 2147483648, 32905, 2147483648, 32771,
    2147483648, 32770, 2147483648, 128, 2147483648, 32778, 0, 2147483658, 2147483648,
    2147516545, 2147483648, 32896, 2147483648, 2147483649, 0, 2147516424, 2147483648];

function Mesh(s,Count)
{
    var h, l, n, c0, c1, c2, c3, c4, c5, c6, c7, c8, c9,
        b0, b1, b2, b3, b4, b5, b6, b7, b8, b9, b10, b11, b12, b13, b14, b15, b16, b17,
        b18, b19, b20, b21, b22, b23, b24, b25, b26, b27, b28, b29, b30, b31, b32, b33,
        b34, b35, b36, b37, b38, b39, b40, b41, b42, b43, b44, b45, b46, b47, b48, b49;
    for (n = 0; n < Count; n += 2)//48
    {
        c0 = s[0] ^ s[10] ^ s[20] ^ s[30] ^ s[40];
        c1 = s[1] ^ s[11] ^ s[21] ^ s[31] ^ s[41];
        c2 = s[2] ^ s[12] ^ s[22] ^ s[32] ^ s[42];
        c3 = s[3] ^ s[13] ^ s[23] ^ s[33] ^ s[43];
        c4 = s[4] ^ s[14] ^ s[24] ^ s[34] ^ s[44];
        c5 = s[5] ^ s[15] ^ s[25] ^ s[35] ^ s[45];
        c6 = s[6] ^ s[16] ^ s[26] ^ s[36] ^ s[46];
        c7 = s[7] ^ s[17] ^ s[27] ^ s[37] ^ s[47];
        c8 = s[8] ^ s[18] ^ s[28] ^ s[38] ^ s[48];
        c9 = s[9] ^ s[19] ^ s[29] ^ s[39] ^ s[49];

        h = c8 ^ ((c2 << 1) | (c3 >>> 31));
        l = c9 ^ ((c3 << 1) | (c2 >>> 31));
        s[0] ^= h;
        s[1] ^= l;
        s[10] ^= h;
        s[11] ^= l;
        s[20] ^= h;
        s[21] ^= l;
        s[30] ^= h;
        s[31] ^= l;
        s[40] ^= h;
        s[41] ^= l;
        h = c0 ^ ((c4 << 1) | (c5 >>> 31));
        l = c1 ^ ((c5 << 1) | (c4 >>> 31));
        s[2] ^= h;
        s[3] ^= l;
        s[12] ^= h;
        s[13] ^= l;
        s[22] ^= h;
        s[23] ^= l;
        s[32] ^= h;
        s[33] ^= l;
        s[42] ^= h;
        s[43] ^= l;
        h = c2 ^ ((c6 << 1) | (c7 >>> 31));
        l = c3 ^ ((c7 << 1) | (c6 >>> 31));
        s[4] ^= h;
        s[5] ^= l;
        s[14] ^= h;
        s[15] ^= l;
        s[24] ^= h;
        s[25] ^= l;
        s[34] ^= h;
        s[35] ^= l;
        s[44] ^= h;
        s[45] ^= l;
        h = c4 ^ ((c8 << 1) | (c9 >>> 31));
        l = c5 ^ ((c9 << 1) | (c8 >>> 31));
        s[6] ^= h;
        s[7] ^= l;
        s[16] ^= h;
        s[17] ^= l;
        s[26] ^= h;
        s[27] ^= l;
        s[36] ^= h;
        s[37] ^= l;
        s[46] ^= h;
        s[47] ^= l;
        h = c6 ^ ((c0 << 1) | (c1 >>> 31));
        l = c7 ^ ((c1 << 1) | (c0 >>> 31));
        s[8] ^= h;
        s[9] ^= l;
        s[18] ^= h;
        s[19] ^= l;
        s[28] ^= h;
        s[29] ^= l;
        s[38] ^= h;
        s[39] ^= l;
        s[48] ^= h;
        s[49] ^= l;

        b0 = s[0];
        b1 = s[1];
        b32 = (s[11] << 4) | (s[10] >>> 28);
        b33 = (s[10] << 4) | (s[11] >>> 28);
        b14 = (s[20] << 3) | (s[21] >>> 29);
        b15 = (s[21] << 3) | (s[20] >>> 29);
        b46 = (s[31] << 9) | (s[30] >>> 23);
        b47 = (s[30] << 9) | (s[31] >>> 23);
        b28 = (s[40] << 18) | (s[41] >>> 14);
        b29 = (s[41] << 18) | (s[40] >>> 14);
        b20 = (s[2] << 1) | (s[3] >>> 31);
        b21 = (s[3] << 1) | (s[2] >>> 31);
        b2 = (s[13] << 12) | (s[12] >>> 20);
        b3 = (s[12] << 12) | (s[13] >>> 20);
        b34 = (s[22] << 10) | (s[23] >>> 22);
        b35 = (s[23] << 10) | (s[22] >>> 22);
        b16 = (s[33] << 13) | (s[32] >>> 19);
        b17 = (s[32] << 13) | (s[33] >>> 19);
        b48 = (s[42] << 2) | (s[43] >>> 30);
        b49 = (s[43] << 2) | (s[42] >>> 30);
        b40 = (s[5] << 30) | (s[4] >>> 2);
        b41 = (s[4] << 30) | (s[5] >>> 2);
        b22 = (s[14] << 6) | (s[15] >>> 26);
        b23 = (s[15] << 6) | (s[14] >>> 26);
        b4 = (s[25] << 11) | (s[24] >>> 21);
        b5 = (s[24] << 11) | (s[25] >>> 21);
        b36 = (s[34] << 15) | (s[35] >>> 17);
        b37 = (s[35] << 15) | (s[34] >>> 17);
        b18 = (s[45] << 29) | (s[44] >>> 3);
        b19 = (s[44] << 29) | (s[45] >>> 3);
        b10 = (s[6] << 28) | (s[7] >>> 4);
        b11 = (s[7] << 28) | (s[6] >>> 4);
        b42 = (s[17] << 23) | (s[16] >>> 9);
        b43 = (s[16] << 23) | (s[17] >>> 9);
        b24 = (s[26] << 25) | (s[27] >>> 7);
        b25 = (s[27] << 25) | (s[26] >>> 7);
        b6 = (s[36] << 21) | (s[37] >>> 11);
        b7 = (s[37] << 21) | (s[36] >>> 11);
        b38 = (s[47] << 24) | (s[46] >>> 8);
        b39 = (s[46] << 24) | (s[47] >>> 8);
        b30 = (s[8] << 27) | (s[9] >>> 5);
        b31 = (s[9] << 27) | (s[8] >>> 5);
        b12 = (s[18] << 20) | (s[19] >>> 12);
        b13 = (s[19] << 20) | (s[18] >>> 12);
        b44 = (s[29] << 7) | (s[28] >>> 25);
        b45 = (s[28] << 7) | (s[29] >>> 25);
        b26 = (s[38] << 8) | (s[39] >>> 24);
        b27 = (s[39] << 8) | (s[38] >>> 24);
        b8 = (s[48] << 14) | (s[49] >>> 18);
        b9 = (s[49] << 14) | (s[48] >>> 18);

        s[0] = b0 ^ (~b2 & b4);
        s[1] = b1 ^ (~b3 & b5);
        s[10] = b10 ^ (~b12 & b14);
        s[11] = b11 ^ (~b13 & b15);
        s[20] = b20 ^ (~b22 & b24);
        s[21] = b21 ^ (~b23 & b25);
        s[30] = b30 ^ (~b32 & b34);
        s[31] = b31 ^ (~b33 & b35);
        s[40] = b40 ^ (~b42 & b44);
        s[41] = b41 ^ (~b43 & b45);
        s[2] = b2 ^ (~b4 & b6);
        s[3] = b3 ^ (~b5 & b7);
        s[12] = b12 ^ (~b14 & b16);
        s[13] = b13 ^ (~b15 & b17);
        s[22] = b22 ^ (~b24 & b26);
        s[23] = b23 ^ (~b25 & b27);
        s[32] = b32 ^ (~b34 & b36);
        s[33] = b33 ^ (~b35 & b37);
        s[42] = b42 ^ (~b44 & b46);
        s[43] = b43 ^ (~b45 & b47);
        s[4] = b4 ^ (~b6 & b8);
        s[5] = b5 ^ (~b7 & b9);
        s[14] = b14 ^ (~b16 & b18);
        s[15] = b15 ^ (~b17 & b19);
        s[24] = b24 ^ (~b26 & b28);
        s[25] = b25 ^ (~b27 & b29);
        s[34] = b34 ^ (~b36 & b38);
        s[35] = b35 ^ (~b37 & b39);
        s[44] = b44 ^ (~b46 & b48);
        s[45] = b45 ^ (~b47 & b49);
        s[6] = b6 ^ (~b8 & b0);
        s[7] = b7 ^ (~b9 & b1);
        s[16] = b16 ^ (~b18 & b10);
        s[17] = b17 ^ (~b19 & b11);
        s[26] = b26 ^ (~b28 & b20);
        s[27] = b27 ^ (~b29 & b21);
        s[36] = b36 ^ (~b38 & b30);
        s[37] = b37 ^ (~b39 & b31);
        s[46] = b46 ^ (~b48 & b40);
        s[47] = b47 ^ (~b49 & b41);
        s[8] = b8 ^ (~b0 & b2);
        s[9] = b9 ^ (~b1 & b3);
        s[18] = b18 ^ (~b10 & b12);
        s[19] = b19 ^ (~b11 & b13);
        s[28] = b28 ^ (~b20 & b22);
        s[29] = b29 ^ (~b21 & b23);
        s[38] = b38 ^ (~b30 & b32);
        s[39] = b39 ^ (~b31 & b33);
        s[48] = b48 ^ (~b40 & b42);
        s[49] = b49 ^ (~b41 & b43);

        s[0] ^= RC[n];
        s[1] ^= RC[n + 1];
    }
};






var GlobalCryptID=0;
var DeltaTimeCryptID=new Date(2018,1,1)-0;
function Encrypt(Arr,Arr2,ArrSecret)
{
    const StartLen=9;
    var arrRnd=Buffer.alloc(StartLen);
    GlobalCryptID++;
    arrRnd.writeUInt32LE(GlobalCryptID,1,4);
    var Time=Math.floor(((new Date)-DeltaTimeCryptID)/1000);
    arrRnd.writeUInt32LE(Time,5,4);

    //var arrRnd=crypto.randomBytes(StartLen);
    Arr2[0]=Arr[0];
    for(var i=1;i<StartLen;i++)
        Arr2[i]=arrRnd[i];

    var SecretBuf=Buffer.concat([Arr2.slice(0,StartLen), ArrSecret]);
    DoSecret(Arr,Arr2,SecretBuf,9);
}

function Decrypt(Arr,Arr2,ArrSecret)
{
    const StartLen=9;
    var SecretBuf=Buffer.concat([Arr.slice(0,StartLen), ArrSecret]);
    DoSecret(Arr,Arr2,SecretBuf,StartLen);
}


function DoSecret(Arr,Arr2,SecretBuf,StartLen)
{
    var CryptID=SecretBuf.readUInt32LE(1,4);
    var Pos=StartLen;
    while(Pos<Arr.length)
    {
        var CurBuf=shaarr(SecretBuf);

        for(var i=0; i<32 && Pos<Arr.length; i++,Pos++)
        {
            Arr2[Pos]=Arr[Pos]^CurBuf[i];
        }

        CryptID++;
        SecretBuf.writeUInt32LE(CryptID,5,4);
    }
}


function TestEncryptDecrypt()
{
    var ArrSecret=Buffer.from([1,1,1,1,1,1]);
    var Arr=GetArrFromStr("  Secret message",64);
    var Arr2=Buffer.from(new Uint8Array(Arr.length));
    var Arr3=Buffer.from(new Uint8Array(Arr.length));

    console.log("Message:");
    console.log(Arr);
    console.log("-------------------");
    Encrypt(Arr,Arr2,ArrSecret);
    //console.log(Arr);
    console.log("Encrypt:");
    console.log(Arr2);

    console.log("-------------------");
    Decrypt(Arr2,Arr3,ArrSecret);
    //console.log(Arr);
    console.log("Decrypt:");
    console.log(Utf8ArrayToStr(Arr3.slice(9)));
}
//TestEncryptDecrypt();


function toUTF8Array(str)
{
    var utf8 = [];
    for (var i=0; str && i < str.length; i++)
    {
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
        if(out.charCodeAt(i)===0)
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

//////////////////////////////////////
function CreateHashBody(body,Num,Nonce)
{
    body.writeUIntLE(Num,body.length-12,6);
    body.writeUIntLE(Nonce,body.length-6,6);
    return shaarr(body);
}



function CreateHashBodyPOWInnerMinPower(arr,BlockNum,MinPow)
{
    var nonce=0;
    while(1)
    {
        var arrhash=CreateHashBody(arr,BlockNum,nonce);
        var power=GetPowPower(arrhash);
        if(power>=MinPow)
        {
            return nonce;
        }
        nonce++;
    }
}

global.CreateHashBody=CreateHashBody;
global.CreateHashBodyPOWInnerMinPower=CreateHashBodyPOWInnerMinPower;

//////////////////////////////////////


global.CalcHashFromArray=CalcHashFromArray;
global.CalcMerklFromArray=CalcMerklFromArray;
global.IsZeroArr=IsZeroArr;
global.shaarr2=shaarr2;
global.arr2=arr2;
global.GetHashWithNonce=GetHashWithNonce;
global.GetPowPower=GetPowPower;
global.GetArrFromValue=GetArrFromValue;
global.GetPowValue=GetPowValue;
global.Mesh=Mesh;


global.Encrypt=Encrypt;
global.Decrypt=Decrypt;
global.toUTF8Array=toUTF8Array;
global.Utf8ArrayToStr=Utf8ArrayToStr;
global.GetArrFromStr=GetArrFromStr;


global.DEVELOP_PUB_KEY=Buffer.from(GetArrFromHex("022e80aa78bc07c72781fac12488096f0bfa7b4f48fbab0f2a92e208d1ee3654df"));
global.ARR_PUB_KEY=
        [
            "027ae0dce92d8be1f893525b226695ddf0fe6ad756349a76777ff51f3b59067d70",
            "02769165a6f9950d023a415ee668b80bb96b5c9ae2035d97bdfb44f356175a44ff",
            "021566c6feb5495594fc4bbea27795e1db5a663b3fe81ea9846268d5c394e24c23",
            "0215accbc993e67216c9b7f3912b29b91671864e861e61ab73589913c946839efa",
            "0270e0c5acb8eefe7faddac45503da4885e02fb554975d12907f6c33ac6c6bdba5",
            "0202f2aad628f46d433faf70ba6bf12ab9ed96a46923b592a72508dc43af36cb80",
            "0254f373fc44ac4a3e80ec8cb8cc3693a856caa82e0493067bdead78ce8ec354b8",
            "027617f9511b0b0cdbda8f3e17907732731296321846f3fd6fd19460f7227d9482",
        ];

if(LOCAL_RUN)
{
    var KeyPair=GetKeyPairTest("DEVELOPER");
    global.DEVELOP_PUB_KEY=KeyPair.PubKeyArr;
    ToLog("DEVELOP_KEY: "+KeyPair.getPrivateKey('hex'))

    for(var i=0;i<100;i++)
        global.ARR_PUB_KEY[i]=GetHexFromArr(global.DEVELOP_PUB_KEY);

}
