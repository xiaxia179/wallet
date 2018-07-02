"use strict";
/**
 *  Copyright: Yuriy Ivanov, 2017,2018 e-mail: progr76@gmail.com
**/

var fs = require("fs");


module.exports = class CCode extends require("./base")
{
    constructor(SetKeyPair,RunIP,RunPort,UseRNDHeader,bVirtual)
    {
        super(SetKeyPair,RunIP,RunPort,UseRNDHeader,bVirtual)



        if(!global.ADDRLIST_MODE && !this.VirtualMode)
        {
            setInterval(this.CheckLoadCodeTime.bind(this),10*1000);
        }



        CheckCreateDir(GetDataPath("Update"));
        //CheckCreateDir(GetDataPath("Code"));
    }
    CheckLoadCodeTime()
    {
        if(CODE_VERSION.StartLoadNode && CODE_VERSION.StartLoadVersionNum)
        {
            var Delta=new Date()-CODE_VERSION.StartLoadVersionNumTime;
            if(Delta>20*1000)
            {
                ToError("Cannot load code version:"+CODE_VERSION.StartLoadVersionNum+" from node: "+CODE_VERSION.StartLoadNode.ip+":"+CODE_VERSION.StartLoadNode.port)
                this.ClearLoadCode();
            }
        }
    }
    ClearLoadCode()
    {
        CODE_VERSION.StartLoad=undefined;
        CODE_VERSION.StartLoadVersionNum=0;
        CODE_VERSION.StartLoadVersionNumTime=0;
    }

    StartLoadCode(Node,CodeVersion)
    {
        CODE_VERSION.StartLoad=CodeVersion;
        CODE_VERSION.StartLoadNode=Node;
        CODE_VERSION.StartLoadVersionNum=VersionNum;
        CODE_VERSION.StartLoadVersionNumTime=new Date();

        var VersionNum=CodeVersion.VersionNum;
        var fname=GetDataPath("Update/wallet-"+VersionNum+".zip");
        if(fs.existsSync(fname))
        {
            this.UseCode();
            return;
        }


        var Context={"VersionNum":VersionNum};
        this.SendF(Node,
            {
                "Method":"GETCODE",
                "Context":Context,
                "Data":VersionNum
            }
        );
    }

    static GETCODE_F()
    {
        return "uint";
    }

    GETCODE(Info)
    {
        //отправка файла из спец. каталога
        var VersionNum=this.DataFromF(Info);
        var fname=GetDataPath("Update/wallet-"+VersionNum+".zip");
        if(fs.existsSync(fname))
        {
            var data = fs.readFileSync(fname);
            this.Send(Info.Node,
                {
                    "Method":"RETCODE",
                    "Context":Info.Context,
                    "Data":data
                },BUF_TYPE
            );
        }
    }

    RETCODE(Info)
    {
        var VersionNum=Info.Context.VersionNum;
        if(!VersionNum)
            return;

        //получение файла обновления

        //положить в спец. каталог
        var fname=GetDataPath("Update/wallet-"+VersionNum+".zip");
        if(!fs.existsSync(fname))
        {
            //проверка хеша
            var Hash=shaarr(Info.Data);
            if(CompareArr(Hash,CODE_VERSION.StartLoad.Hash)===0)
            {
                var file_handle=fs.openSync(fname, "w");
                fs.writeSync(file_handle, Info.Data,0,Info.Data.length);
                fs.closeSync(file_handle);

                this.UseCode(global.USE_AUTO_UPDATE);


            }
            else
            {
                ToError("Error check hash of version code :"+CODE_VERSION.StartLoadVersionNum+" from node: "+Info.Node.ip+":"+Info.Node.port)
                this.ClearLoadCode();
                this.AddCheckErrCount(Info.Node,1,"Error check hash of version code");
            }
        }

        //распаковать
        //установить флаг перезапуска приложения
    }

    UseCode(bRestart)
    {
        if(bRestart)
        {
            UpdateCodeFiles();
        }



        if(!CODE_VERSION.StartLoad)
            return;

        CODE_VERSION.VersionNum=CODE_VERSION.StartLoad.VersionNum;
        CODE_VERSION.Hash=CODE_VERSION.StartLoad.Hash;
        CODE_VERSION.Sign=CODE_VERSION.StartLoad.Sign;

        this.ClearLoadCode();
    }

    SetNewCodeVersion(VersionNum,PrivateKey)
    {

        var fname=GetDataPath("ToUpdate/wallet.zip");
        if(fs.existsSync(fname))
        {
            var fname2=GetDataPath("Update/wallet-"+VersionNum+".zip");
            if(fs.existsSync(fname2))
            {
                return "File was exist: "+fname2;
            }

            var data = fs.readFileSync(fname);
            var Hash=shaarr(data);


            var file_handle=fs.openSync(fname2, "w");
            fs.writeSync(file_handle, data,0,data.length);
            fs.closeSync(file_handle);

            var SignArr=arr2(Hash,GetArrFromValue(VersionNum));
            var Sign = secp256k1.sign(shabuf(SignArr), PrivateKey).signature;
            global.CODE_VERSION={VersionNum:VersionNum,Hash:Hash,Sign:Sign};


            //ToLog("SetNewCodeVersion="+VersionNum);
            return "OK Set new code version="+VersionNum;
        }
        else
        {
            return "File not exist: "+fname;
        }
    }
}


function UpdateCodeFiles()
{
    if(global.NWMODE)
    {
        process.send({cmd:"update",message:{NUM_CODE_COPY:global.NUM_CODE_COPY, DATA_PATH:DATA_PATH, CODE_PATH:global.CODE_PATH}});
    }
    else
    {
        const updater=require("./updater.js");
        var Num=updater.UpdateCodeFiles(global.NUM_CODE_COPY+1);
        if(Num)
        {
            global.NUM_CODE_COPY=Num;
            SAVE_CONST(true);
        }
    }

    RestartNode();
}


global.RestartNode=function()
{
    global.NeedRestart=1;

    // var it=SERVER.ActualNodes.iterator(), Node;
    // while((Node = it.next()) !== null)
    // {
    //     if(Node.Socket)
    //         CloseSocket(Node.Socket,"Restart");
    // }
    // SERVER.StopNode();

    ToLog("***************************************** RESTART!!!");

    if(global.nw)
    {
        //window only
        var StrRun='"'+process.argv[0]+'" .';
        SaveToFile("run-next.bat",StrRun);


        const child_process = require('child_process');
        child_process.exec("run-next.bat");
    }
    else
    {
        //Must loop start from cmd-file
    }

    process.exit();
}

