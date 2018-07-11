//Copyright: Yuriy Ivanov, 2017 e-mail: progr76@gmail.com
//Use:
//usege: require("./merkl");


require("./crypto-library");



function Compare(arr1,arr2)
{
    for(var n=0;n<arr1.length;n++)
    {
        if(arr1[n]!==arr2[n])
            return false;
    }
    return true;
}



module.exports.RecalHashMerklHex=RecalHashMerklHex;
module.exports.RecalHashMerkl=RecalHashMerkl;
module.exports.GetArrayHex=GetArrayHex;

module.exports.AddToMerklHex=AddToMerklHex;
module.exports.AddToMerkl=AddToMerkl;
module.exports.GetArray=GetArray;
//module.exports.AddToMerkl0=AddToMerkl0;

//HEX
function GetMerklAddrValue(Val)
{
    if(Val===undefined)
        return Val;
    if(Val[0]==="+")
        Val=Val.substr(1);
    return Val;
}

function AddToMerklHex (MTree,Hash,Length)
{
    Length = Length || 12;

    let Hash2=AddrTo2(Hash,Length);
    MTree[""]="+";

    for(let i=0;i<Hash2.length;i++)
    {
        let addr=Hash2.substr(0,i+1);

        let ValuePrev=MTree[addr];
        if(ValuePrev===undefined)
        {
            MTree[addr]=Hash;
            break;
        }

        if(ValuePrev[0]!=="+")
        {
            if(ValuePrev===Hash)
                break;

            //shifting the old hash down
            let ValuePrev2=AddrTo2(ValuePrev,i/4+1);
            let addrValue=ValuePrev2.substr(0,i+2);

            MTree[addr]="+";
            MTree[addrValue]=ValuePrev;
        }
        else
        {
            //The hash must be calculated
            MTree[addr]="+";
        }
    }
}

function shatest(str01,str02)
{
    if(str01==="" || str01==="+")
        throw "NO 1";
    if(str02==="" || str02==="+")
        throw "NO 2";

    var str1=GetAddresFromHex(str01);
    var str2=GetAddresFromHex(str02);
    var len=32;
    var ret=Buffer.alloc(len);
    for(var i=0;i<len;i++)
    {
        ret[i]=(str1[i] + str2[i]);//%256;
    }

    return ret.toString('hex');
}

function RecalHashMerklHex(MTree)
{
    var arr=[];
    for(let Addr in MTree)
        arr.push(Addr);

    MTree[""]="+";
    arr.push("");

    arr.sort(function (addr1,addr2)
    {
        return addr2.length-addr1.length;
    });



    for(let i=0;i<arr.length;i++)
    {
        let Addr=arr[i];

        if(MTree[Addr][0]==="+")
        {
            var Orig0=MTree[Addr+"0"];
            var Orig1=MTree[Addr+"1"];
            let Val0=GetMerklAddrValue(Orig0);
            let Val1=GetMerklAddrValue(Orig1);
            if(Val0===undefined && Val1===undefined)
                continue;
            else
            if(Val0===undefined)
                MTree[Addr]="+"+Val1;
            else
            if(Val1===undefined)
                MTree[Addr]="+"+Val0;
            else
            {
                MTree[Addr]="+"+sha(Val0+Val1);//.toUpperCase();
                //MTree[Addr]="+"+shatest(Val0,Val1);
            }
        }


    }
}


function GetArrayHex(MTree,Max_Count)
{

    var arr=[];
    for(let Addr in MTree)
        arr.push(Addr);
    arr.sort(function (addr1,addr2)
    {
        return addr1.length-addr2.length;
    });


    var CountDop=0;
    var Count=0;
    var prev_length=-1;
    for(var i=0;i<arr.length;i++)
    {
        var cur_addr=arr[i];
        var hash=MTree[cur_addr];

        if(cur_addr.length!==prev_length)
            Count=0;
        prev_length=cur_addr.length;

        if(hash[0]!=="+")
            CountDop++;
        else
            Count++;

        if(Count+CountDop>=Max_Count)
            break;
    }
    var max_length=prev_length;

    var Ret=[];
    var MapAdd={};
    for(var i=0;i<arr.length;i++)
    {
        var cur_addr=arr[i];
        var hash=MTree[cur_addr];

        if(cur_addr.length>max_length)
            break;



        if(hash[0]==="+")
        {
            if(cur_addr.length<max_length)
                continue;
            hash=hash.substr(1);
        }

        if(!MapAdd[hash])
        {
            MapAdd[hash]=1;
            Ret.push(hash);
        }
        else
        {
            //5fb42794401b13374b5e3856f724ff7f0a3d3d3f9220b2e2f9248723e758dfeb
            //58565A978CEBA259D3DAD9C5DDF4AA942A37C9A83476CC83A9047921CFA91104
            //8089a253d283f8a886e1ae2913f826e40ca0575b7f230b1777f91f42351e40a3
        }
    }
    return Ret;
}



//ARR
const rehash=0;


function AddToMerkl (MTree,arr)
{
    if(arr.length!==32)
        return;

    var Hash2=ArrTo2(arr);
    MTree[""]=rehash;

    for(let i=0;i<Hash2.length;i++)
    {
        let addr=Hash2.substr(0,i+1);

        let ValuePrev=MTree[addr];
        if(ValuePrev===undefined)
        {
            MTree[addr]=arr;
            return;
        }

        if(ValuePrev.length===32)
        {
            if(Compare(ValuePrev,arr))
                return;

            //shifting the old hash down
            var ValuePrev2=ArrTo2(ValuePrev,i/8+1);
            let addrValuePrev=ValuePrev2.substr(0,i+2);

            MTree[addr]=rehash;
            MTree[addrValuePrev]=ValuePrev;
        }
        else
        {
            //The hash must be calculated
            MTree[addr]=rehash;
        }
    }

    throw "NO!"
}


function RecalHashMerkl(MTree)
{
    //console.time("sort arr")

    var arr=[];
    MTree[""]=rehash;
    for(let Addr in MTree)
        arr.push(Addr);

    //arr.push("");

    arr.sort(function (addr1,addr2)
    {
        return addr2.length-addr1.length;
    });

    //console.timeEnd("sort arr")


    for(let i=0;i<arr.length;i++)
    {
        let Addr=arr[i];

        var Val=MTree[Addr];
        if(Val===0)
        //if(Val.length!==32)
        {
            let Val0=MTree[Addr+"0"];
            let Val1=MTree[Addr+"1"];
            if(Val0===undefined && Val1===undefined)
                continue;

            var arr_calc;
            if(Val0===undefined)
            {
                arr_calc=Array.from(Val1);
            }
            else
            if(Val1===undefined)
            {
                arr_calc=Array.from(Val0);
            }
            else
            {
                //var h=[0,0,0,0];
                var h=shaarr(Val0.concat(Val1));
                arr_calc=Array.from(h);
            }
            if(arr_calc.length===32)
                arr_calc.push(0);
            MTree[Addr]=arr_calc;
        }


    }
}


function GetArray(MTree,Max_Count)
{

    var arr=[];
    for(let Addr in MTree)
        arr.push(Addr);
    arr.sort(function (addr1,addr2)
    {
        return addr1.length-addr2.length;
    });


    var CountDop=0;
    var Count=0;
    var prev_length=-1;
    for(var i=0;i<arr.length;i++)
    {
        var cur_addr=arr[i];
        var hash=MTree[cur_addr];

        if(cur_addr.length!==prev_length)
            Count=0;
        prev_length=cur_addr.length;

        if(hash.length===32)
            CountDop++;
        else
            Count++;

        if(Count+CountDop>=Max_Count)
            break;
    }
    var max_length=prev_length;

    var Ret=[];
    var MapAdd={};
    for(var i=0;i<arr.length;i++)
    {
        var cur_addr=arr[i];
        var hash=MTree[cur_addr];

        if(cur_addr.length>max_length)
            break;



        if(hash.length!==32)
        {
            if(cur_addr.length<max_length)
                continue;
            hash=hash.slice(0,32);
        }

        if(!MapAdd[hash])
        {
            MapAdd[hash]=1;
            Ret.push(hash);
        }
        else
        {
            //5fb42794401b13374b5e3856f724ff7f0a3d3d3f9220b2e2f9248723e758dfeb
            //58565A978CEBA259D3DAD9C5DDF4AA942A37C9A83476CC83A9047921CFA91104
            //8089a253d283f8a886e1ae2913f826e40ca0575b7f230b1777f91f42351e40a3
        }
    }
    return Ret;
}



