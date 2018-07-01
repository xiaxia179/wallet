/**
 * Created by vtools on 21.12.2017.
 */

global.USE_AUTO_UPDATE=0;
global.USE_PARAM_JS=0;

require("./core/constant");
const fs = require('fs');
const child_process = require('child_process');

global.DATA_PATH="D:\\NODE\\NETWORK\\RUN30000";

//CLEAR FILES !!!
//CLEAR FILES !!!
//CLEAR FILES !!!
console.log("=========RUN NETWORK=======");
if(global.START_BLOCK_RUN)
    DelDir("D:\\NODE\\");



var Count;
if(CREATE_NUM_START===0)
{
    global.CREATE_ON_START=true;
}

Count=0;
if(LOCAL_RUN)
    Count=1;

setTimeout(RunNetwork,10);


//require("./server");
require("./run-node.js");


if(global.CHILD_POW)
    return;



// var path="D:\\NODE";
// if(!fs.existsSync(path))
// {
//     console.log("Create: "+path);
//     fs.mkdirSync(path);
// };
// path="D:\\NODE\\NETWORK";
// if(!fs.existsSync(path))
// {
//     console.log("Create: "+path);
//     fs.mkdirSync(path);
// };
// path="D:\\NODE\\NETWORK\\RUN30000";
// if(!fs.existsSync(path))
// {
//     console.log("Create: "+path);
//     fs.mkdirSync(path);
// };
//
//




Number.prototype.toStringZ=function(count)
{
    var strnum=this.toString();
    if(strnum.length>count)
        count=strnum.length;
    else
        strnum="0000000000"+strnum;
    return strnum.substring(strnum.length-count,strnum.length);
};

function RunNetwork()
{

    for(var i=1;i<=Count;i++)
    {
        var num=i;
        var port=START_PORT_NUMBER+num;

        let path="D:\\NODE\\NETWORK\\RUN"+port.toStringZ(3);
        CheckCreateDir(path);

        ToLog("Start process: "+num);
        var StrDop="";
        if(num===CREATE_NUM_START)
            StrDop="CREATEONSTART";


        let child = child_process.spawn("node.exe",
            ["run-node.js","path:"+path,"httpport:"+(8000 + (port%100)),"port:"+port,"ip:"+START_IP,"NOAUTOUPDATE","NOPARAMJS",StrDop],
            {
                env: process.env,
                stdio: 'inherit',
                shell:false
            });

        child.num=num;
        child.on('error', (err) =>
        {
            console.log('Failed to start child process: '+child.num);
        });
    }
}





function Right(Str,count)
{
    if(Str.length>count)
        return Str.substr(Str.length-count,count);
    else
        return Str.substr(0,Str.length);
};
function DelDir(Path)
{
    if(Path.substr(Path.length-1,1)==="\\")
        Path=Path.substr(0,Path.length-1);

    if(fs.existsSync(Path))
    {
        var arr=fs.readdirSync(Path)
        //console.log("arr: "+arr);

        for(var i=0;i<arr.length;i++)
        {
            var name=Path+"\\"+arr[i];
            if (fs.statSync(name).isDirectory())
            {
                DelDir(name);
                //console.log("DELETE "+name);
                //fs.rmdirSync(name);
            }
            else
            {
                if(Right(name,9)=="const.lst")                    continue;
                if(Right(name,7)=="log.log")                    continue;


                //console.log("Delete "+name);
                fs.unlinkSync(name);
            }
        }

    };
}

