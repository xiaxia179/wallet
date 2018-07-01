
const {ipcRenderer} = require('electron')

function GetDataElectron(Method, ObjPost, Func)
{

    if(Func===undefined)
    {
        //old mode
        Func=ObjPost;
        ObjPost=null;
    }

    var reply;
    try
    {
        //reply = ipcRenderer.send('GetData', {path:Method,obj:ObjPost});
        reply = ipcRenderer.sendSync('GetData', {path:Method,obj:ObjPost});
    }
    catch(e)
    {
        reply=undefined;
    }
    if(Func)
        Func(reply);

}

// ipcRenderer.on('RetGetData', (event, arg) =>
// {
//     const message = `Asynchronous message reply: ${arg}`
//     SetStatus(message);
// });



window.GetData=GetDataElectron;
