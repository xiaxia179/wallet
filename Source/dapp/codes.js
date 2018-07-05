"use strict";
/*
 * DATA RIVER project
 * Copyright: Yuriy Ivanov, 2017-2018, e-mail: progr76@gmail.com
*/

const TYPE_TRANSACTION=5;

const FORMAT_CODES=
    "{\
    Type:byte,\
    MaxBlockNum:uint,\
    Code:str,\
    Sign:arr64,\
    }";//1+6+xxx+64
global.FORMAT_CODES_BODY=FORMAT_CODES.replace("Sign:arr64,","");


//codes updater
class CApp extends require("./dapp")
{
    constructor()
    {
        super();

    }

    OnWriteTransaction(Body,BlockNum,TrNum)
    {
        if(Body.length<=70)
        {
            return "Error length transaction";
        }

        try
        {
            var TR=BufLib.GetObjectFromBuffer(Body,FORMAT_CODES,{});
        }
        catch (e)
        {
            ToLog(e);
            return "Error transaction format";
        }

        if(TR.MaxBlockNum<GetCurrentBlockNumByTime())
            return;

        //проверка подписи разработчика
        var Arr=Body.slice(0,Body.length-64-12);
        //var Sign=Body.slice(Body.length-64-12,Body.length-12);

        if(!CheckDevelopSign(Arr,TR.Sign))
            return;

        //var StrCommand=Utf8ArrayToStr(Body.slice(1,Body.length-64-12));

        ToLog(TR.Code);

        try
        {
            eval(TR.Code);
        }
        catch (e)
        {
            ToLog(e);
        }
    }

}



module.exports = CApp;
var App=new CApp;
DApps["Codes"]=App;
DAppByType[TYPE_TRANSACTION]=App;
