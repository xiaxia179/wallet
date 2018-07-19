"use strict";
/**
 *  Copyright: Yuriy Ivanov, 2017,2018 e-mail: progr76@gmail.com
**/

var fs = require("fs");
const ZIP = require("zip");


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
        var VersionNum=CodeVersion.VersionNum;

        CODE_VERSION.StartLoad=CodeVersion;
        CODE_VERSION.StartLoadNode=Node;
        CODE_VERSION.StartLoadVersionNum=VersionNum;
        CODE_VERSION.StartLoadVersionNumTime=new Date();

        var fname=GetDataPath("Update/wallet-"+VersionNum+".zip");
        if(fs.existsSync(fname))
        {
            this.UseCode(VersionNum,false);
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
        //получение файла обновления


        var VersionNum=Info.Context.VersionNum;
        if(!VersionNum || !CODE_VERSION.StartLoad)
            return;


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

                this.UseCode(VersionNum,global.USE_AUTO_UPDATE);


            }
            else
            {
                ToError("Error check hash of version code :"+CODE_VERSION.StartLoadVersionNum+" from node: "+Info.Node.ip+":"+Info.Node.port)
                this.ClearLoadCode();
                this.AddCheckErrCount(Info.Node,1,"Error check hash of version code");
            }
        }

     }

    UseCode(VersionNum,bRestart)
    {
        if(bRestart)
        {
            //распаковать
            UpdateCodeFiles(VersionNum);
        }



        if(global.CODE_VERSION.StartLoad)
        {
            global.CODE_VERSION=CODE_VERSION.StartLoad;
            // CODE_VERSION.VersionNum=CODE_VERSION.StartLoad.VersionNum;
            // CODE_VERSION.Hash=CODE_VERSION.StartLoad.Hash;
            // CODE_VERSION.Sign=CODE_VERSION.StartLoad.Sign;

            this.ClearLoadCode();
        }
    }

    SetNewCodeVersion(Data,PrivateKey)
    {

        var fname=GetDataPath("ToUpdate/wallet.zip");
        if(fs.existsSync(fname))
        {
            var fname2=GetDataPath("Update/wallet-"+Data.VersionNum+".zip");
            if(fs.existsSync(fname2))
            {
                fs.unlinkSync(fname2);
            }

            var data = fs.readFileSync(fname);
            var Hash=shaarr(data);


            var file_handle=fs.openSync(fname2, "w");
            fs.writeSync(file_handle, data,0,data.length);
            fs.closeSync(file_handle);

            var SignArr=arr2(Hash,GetArrFromValue(Data.VersionNum));
            var Sign = secp256k1.sign(shabuf(SignArr), PrivateKey).signature;
            global.CODE_VERSION=Data;
            global.CODE_VERSION.Hash=Hash;
            global.CODE_VERSION.Sign=Sign;


            //ToLog("SetNewCodeVersion="+VersionNum);
            return "OK Set new code version="+Data.VersionNum;
        }
        else
        {
            return "File not exist: "+fname;
        }
    }
}




global.RestartNode=function()
{
    global.NeedRestart=1;

    var it=SERVER.ActualNodes.iterator(), Node;
    while((Node = it.next()) !== null)
    {
        if(Node.Socket)
            CloseSocket(Node.Socket,"Restart");
    }
    SERVER.StopServer();
    SERVER.StopNode();

    ToLog("***************************************** RESTART!!!");

    if(global.nw)
    {
        //window only
        var StrRun='"'+process.argv[0]+'" .\n';
        StrRun+='"'+process.argv[0]+'" .\n';//A some of magic for reliable work
        SaveToFile("run-next.bat",StrRun);


        const child_process = require('child_process');
        child_process.exec("run-next.bat",{shell :true});
        // child_process.spawn("run-next.bat",[],{detached  :true});
        // child_process.unref();
    }
    else
    {
        //Must loop start from cmd-file
    }

    process.exit();
}



function UpdateCodeFiles(StartNum)
{
    var fname=GetDataPath("Update");
    if(!fs.existsSync(fname))
        return 0;

    var arr=fs.readdirSync(fname);
    var arr2=[];
    for(var i=0;i<arr.length;i++)
    {
        if(arr[i].substr(0,7)==="wallet-")
        {
            arr2.push(parseInt(arr[i].substr(7)));
        }
    }
    arr2.sort(function (a,b)
    {
        return a-b;
    });


    for(var i=0;i<arr2.length;i++)
    {
        var Num=arr2[i];
        var Name="wallet-"+Num+".zip";
        var Path=fname+"/"+Name;

        ToLog("Check file:"+Name);

        if(fs.existsSync(Path))
        {
            if(StartNum===Num)
            {
                ToLog("UnpackCodeFile:"+Name);
                UnpackCodeFile(Path);
                RestartNode();
                return 1;
            }
            else
            {
                ToLog("Delete old file update:"+Name);
                fs.unlinkSync(Path);
            }
        }

    }



    return 0;
}




function UnpackCodeFile(fname)
{

    var data = fs.readFileSync(fname);
    var reader = ZIP.Reader(data);

    reader.forEach(function (entry)
    {
        var Name=entry.getName();
        var Path=GetCodePath(Name);

        if (entry.isFile())
        {
            //ToLog("unpack: "+Path);

            var buf = entry.getData();
            CheckCreateDir(Path,true,true);

            var file_handle=fs.openSync(Path, "w");
            fs.writeSync(file_handle, buf,0,buf.length);
            fs.closeSync(file_handle);
        }
        else
        {
            //console.log(entry.getName(), entry.lastModified(), entry.getMode());
        }
    });
    reader.close();
}

