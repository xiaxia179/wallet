


global.NWMODE=1;

require("./library");
require("./crypto-library");

global.ToLog=function (Str)
{
    process.send({cmd:"log",message:Str});
}

if(process.send)
{
    process.send({cmd:"online",message:"OK"});
}

var idInterval;
var Block={};

process.on('message', (msg) =>
{
    //ToLog("CHILD GET: "+JSON.stringify(msg))

    if(msg.cmd==="SetBlock")
    {
        var StartNonce=10000000*msg.Num;
        if(Block.LastNonce)
        {
            process.send({cmd:"HASHRATE",CountNonce:Block.LastNonce-StartNonce});
        }
        Block.LastNonce=StartNonce;
        Block.Account=msg.Account;
        Block.SeqHash=msg.SeqHash;
        Block.Hash=msg.Hash;
        Block.Time=msg.Time;
        Block.RunCount=msg.RunCount;
        Block.RunPeriod=msg.RunPeriod;
        Block.Percent=msg.Percent;

        Block.Period=CONSENSUS_PERIOD_TIME*Block.Percent/100;
        if(Block.Period>0 && Block.RunPeriod>0)
        {
            CalcPOWHash();
            if(idInterval!==undefined)
            {
                clearInterval(idInterval);
            }
            idInterval=setInterval(CalcPOWHash, Block.RunPeriod);
        }
    }
    else
    if(msg.cmd==="Exit")
    {
        process.exit(0);
    }
});


function CalcPOWHash()
{
    if(!Block.SeqHash)
        return;
    if(new Date()-Block.Time>Block.Period)
        return;


    var AddrArr=GetArrFromValue(Block.Account);
    var Ret=CreateAddrPOW(Block.SeqHash,AddrArr,Block.Hash,Block.LastNonce, Block.RunCount);
    Block.LastNonce=Ret.LastNonce;


    if(Ret.bFind)
    {
        Block.Hash=Ret.MaxHash;
        //ToLog("FIND MAX CALC: LastNonce="+Block.LastNonce+" Block.Hash="+Block.Hash)

        process.send({cmd:"POW",SeqHash:Block.SeqHash,Hash:Block.Hash,AddrArr:AddrArr});
    }

}
//setInterval(function () {},1000);

