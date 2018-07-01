"use strict";
/*
 * IRIVER project
 * Copyright: Yuriy Ivanov, 2017-2018, e-mail: progr76@gmail.com
*/

const NAMES_TYPE_TRANSACTION=10;

//names on key-value db
class CApp extends require("./dapp")
{
    constructor()
    {
        super();

        this.KeyValueMap={};
        this.CurrentNameArr="";

        global.NAMES=this;
    }

    OnWriteTransaction(Body,BlockNum,TrNum)
    {
        return;

        if(Body[0]===NAMES_TYPE_TRANSACTION)
        {
            var StrKey=GetHexFromAddres(Body.slice(1,33));
            if(!this.KeyValueMap[StrKey])
            {
                //ToLog("Write key:"+StrKey)
                this.KeyValueMap[StrKey]=Body.slice(33);

                if(CompareArr(Body.slice(33),this.Server.addrArr)===0)
                    this.CurrentNameArr=Body.slice(1,33);
            }
        }
    }
}

module.exports = CApp;
var App=new CApp;
DApps["Names"]=App;
DAppByType[NAMES_TYPE_TRANSACTION]=App;
