


global.NWMODE=1;

require("./library");
require("./crypto-library");



var PROCESS=process;
if(process.send && !global.DEBUGPROCESS)
{
    global.ToLog=function (Str)
    {
        process.send({cmd:"log",message:Str});
    }

    process.send({cmd:"online",message:"OK"});

}
else
{
    PROCESS=global.DEBUGPROCESS;
}

var LastAlive=new Date()-0;
var idInterval=undefined;
var Block={};

PROCESS.on('message', (msg) =>
{
    //ToLog("CHILD GET: "+JSON.stringify(msg))
    LastAlive=(new Date())-0;

    if(msg.cmd==="SetBlock")
    {
        var StartNonce=10000000*(1+msg.Num);
        if(Block.LastNonce)
        {
            process.send({cmd:"HASHRATE",CountNonce:Block.LastNonce-StartNonce, Hash:Block.Hash});
        }
        Block=msg;
        Block.Time=(new Date())-0;
        Block.LastNonce=StartNonce;

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
    if(msg.cmd==="Alive")
    {
    }
    else
    if(msg.cmd==="Exit")
    {
        PROCESS.exit(0);
    }
});


function CalcPOWHash()
{
    var Delta=(new Date())-LastAlive;
    if(Math.abs(Delta)>600*1000)
    {
        PROCESS.exit(0);
        return;
    }

    if(!Block.SeqHash)
        return;

    if(new Date()-Block.Time>Block.Period)
    {
        clearInterval(idInterval);
        idInterval=undefined;
        return;
    }


    var AddrArr=GetArrFromValue(Block.Account);
    var Ret=CreateAddrPOW(Block.SeqHash,AddrArr,Block.Hash,Block.LastNonce, Block.RunCount);
    Block.LastNonce=Ret.LastNonce;


    if(Ret.bFind)
    {
        Block.Hash=Ret.MaxHash;
        //ToLog(""+Block.Num+". FIND MAX CALC: LastNonce="+Block.LastNonce+" Block.Hash="+Block.Hash)

        process.send({cmd:"POW",SeqHash:Block.SeqHash,Hash:Block.Hash,AddrArr:AddrArr,Num:Block.Num});
    }

}
//setInterval(function () {},1000);

