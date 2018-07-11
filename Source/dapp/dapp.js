"use strict";
/*
 * IRIVER project
 * Copyright: Yuriy Ivanov, 2017-2018, e-mail: progr76@gmail.com
*/

const fs = require('fs');

class DApp
{
    constructor()
    {
        this.CurrentBlockNum=0;
    }
    Name()
    {
        return "";
    }


    //METHODS
    //METHODS
    //METHODS
    SendMessage(Body,ToAddr)
    {
        SERVER.SendMessage(Body,ToAddr);
    }
    AddTransaction(Body)
    {
        SERVER.AddTransaction(Body);
    }

    GetScriptTransaction(Body)
    {
        return "";
    }



    //EVENTS
    //EVENTS
    //EVENTS
    OnWriteBlockStart(Block)
    {
    }
    OnWriteBlockFinish(Block)
    {
    }
    OnTruncateBlock(Block)
    {

    }
    OnWriteTransaction(Body,BlockNum,TrNum)
    {

    }
    OnMessage(Msg)
    {

    }

}
module.exports = DApp;



function ReqDir(Path)
{
    if(fs.existsSync(Path))
    {
        var arr=fs.readdirSync(Path)
        for(var i=0;i<arr.length;i++)
        {
            var name=arr[i];
            ToLog("Reg: "+name);
            var name2=Path+"/"+arr[i];
            require(name2);
        }
    };
}

//Init:
global.DApps={};
global.DAppByType={};
//ReqDir("../dapp");

//require("../dapp/account");

