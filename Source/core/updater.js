const ZIP = require("zip");
var fs = require("fs");
require("./startlib.js");


module.exports = {UpdateCodeFiles:UpdateCodeFiles};

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
        var Path=fname+"\\"+Name;

        ToLog("Check file:"+Name);

        if(fs.existsSync(Path))
        {
            if(Num<StartNum)
            {
                if(i<arr2.length-1)
                {
                    ToLog("Delete old file update:"+Name);
                    fs.unlinkSync(Path);
                }
                continue;
            }

            ToLog("UnpackCodeFile:"+Name);
            UnpackCodeFile(Path);
            return Num;
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
        //var Path=GetDataPath("Code\\"+Name);
        var Path=global.CODE_PATH+"\\"+Name;

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


