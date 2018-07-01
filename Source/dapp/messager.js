"use strict";
/*
 * IRIVER project
 * Copyright: Yuriy Ivanov, 2017-2018, e-mail: progr76@gmail.com
*/

require('../core/crypto-library');

const OPEN_TYPE_TRANSACTION=11;
const MESSAGE_TYPE_TRANSACTION=12;


const MAX_MSG_SIZE=1024;
var TempArrayTr=new Uint8Array(MAX_MSG_SIZE);
const MESSAGE_START=9;
const MESSAGE_END=MAX_MSG_SIZE-5;

require("./names")

class CApp extends require("./dapp")
{
    constructor()
    {
        super();

        this.Channels={};
        this.NamesMap=NAMES.KeyValueMap;
        global.MESSAGER=this;
    }

    //METHODS
    //METHODS
    //METHODS
    Decrypt(Body)
    {
        for(var key in this.Channels)
        {
            var Node=this.Channels[key];
            Decrypt(Body,TempArrayTr,Node.Secret);

            if(IsZeroArr(TempArrayTr.slice(MESSAGE_END)))
            {
                var Str=Utf8ArrayToStr(TempArrayTr.slice(MESSAGE_START));
                return Str;
            }
        }
        return undefined;
    }

    Encrypt(StrMessage,StrTo)
    {
        var NameArr;
        if(typeof StrTo==="string")
        {
            NameArr=GetArrFromStr(StrTo,32);
        }
        else
        {
            NameArr=Str;
        }


        var arrMessage=GetArrFromStr(StrMessage,MESSAGE_END);
        var ArrayTr=new Uint8Array(MAX_MSG_SIZE);
        ArrayTr[0]=MESSAGE_TYPE_TRANSACTION;
        for(var i=5;i<MAX_MSG_SIZE;i++)
        {
            ArrayTr[i]=arrMessage[i-MESSAGE_START];
        }

        var Body=new Uint8Array(MAX_MSG_SIZE);
        var Node=this.OpenChannel(NameArr)
        Encrypt(ArrayTr,Body,Node.Secret);
        return Body;
    }

    OpenChannel(FromNameArr)
    {
        //open chanel
        var FromArr;
        var StrKeyFrom=GetHexFromAddres(FromNameArr);
        if(this.NamesMap[StrKeyFrom])
        {
            FromArr=this.NamesMap[StrKeyFrom];
        }
        else
        {
            FromArr=FromNameArr;
        }
        var StrKey=GetHexFromAddres(FromArr);
        var Node=this.Channels[StrKey];
        if(!Node)
        {
            Node={addrArr:FromArr};
            CheckContextSecret(this.Server,Node);
            this.Channels[StrKey]=Node;
        }
        return Node;
    }

    //EVENTS
    //EVENTS
    //EVENTS
    OnWriteTransaction(Body,BlockNum,TrNum)
    {
        var Type=Body[0];
        if(Type===OPEN_TYPE_TRANSACTION)
        {
            var ToArr=Body.slice(33);
            if(CompareArr(ToArr,NAMES.CurrentNameArr)===0
            || CompareArr(ToArr,this.Server.addrArr)===0)
            {
                //open channel
                var FromNameArr=Body.slice(1,33);
                this.OpenChannel(FromNameArr);
              }
        }
        else
        if(Type===MESSAGE_TYPE_TRANSACTION)
        {
            //message
            var Str=this.Decrypt(Body);
            if(Str!==undefined)
                ToLog("GET MESSAGE:"+Str);
        }
    }

    OnMessage(Msg)
    {
        //message
        ToLog("GET MESSAGE:"+Msg.body);
        return;

        var Body=Msg.body;
        var Type=Body[0];
        if(Type===MESSAGE_TYPE_TRANSACTION)
        {
            //message
            var Str=this.Decrypt(Body);
            if(Str!==undefined)
            {
                ToLog("GET MESSAGE:"+Str);
            }
        }
    }

}

function TestEncryptDecrypt()
{
    const CMessager=module.exports;

    var Server=
        {
            KeyPair:GetKeyPairTest("Test"),
            DApp:{Names:{KeyValueMap:{}}},
    }
    var Test=new CMessager(Server);


    var KeyPair2=GetKeyPairTest("Test2");
    var StrTest1=GetArrFromStr("Test2",32);
    var StrKey=GetHexFromAddres(StrTest1);
    MESSAGER.NamesMap[StrKey]=KeyPair2.addrArr;

    //var Node=MESSAGER.OpenChannel(StrTest1);
    var Body=MESSAGER.Encrypt("This is a test message!","Test2");
    //console.log(Body);


    //Decrypt

    //Server.KeyPair=KeyPair2;
    var Str2=MESSAGER.Decrypt(Body);
    console.log("Decrypt:");
    console.log(Str2);
}


module.exports = CApp;
var App=new CApp;
DApps["Messager"]=App;
DAppByType[OPEN_TYPE_TRANSACTION]=App;
DAppByType[MESSAGE_TYPE_TRANSACTION]=App;

//TestEncryptDecrypt();
