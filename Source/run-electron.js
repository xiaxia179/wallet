


//RUN RUN RUN
require('./core/constant');
global.WORK_MODE=true;
global.ELECTRON=true;
global.START_IP="test.com";
global.START_PORT_NUMBER = 30000;
//global.DATA_PATH=__dirname+"./../DATA";
const os = require('os');
global.DATA_PATH=os.homedir()+"\\TERA";
console.log("DATA DIR: "+global.DATA_PATH);

global.HTTP_PORT_NUMBER=0;
global.CREATE_ON_START=0;
global.CREATE_NUM_START=0;
require('./core/server');



// require('../core/constant');
// global.ELECTRON=true;
// global.START_IP="test.com";
// global.START_PORT_NUMBER = 30010;
// global.DATA_PATH=__dirname+"./../../DATA";
// global.HTTP_PORT_NUMBER=0;
// global.CREATE_ON_START=0;
// global.CREATE_NUM_START=0;
// require('../core/server');
//





// Modules to control application life and create native browser window
const {app, BrowserWindow} = require('electron')

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow
function createWindow ()
{
    // Create the browser window.
    mainWindow = new BrowserWindow(
        {
            width: 820,
            height: 1000,
            webPreferences: {  webSecurity: false  },
        });

    // and load the index.html of the app.
    mainWindow.loadFile('./HTML/wallet.html')
    //mainWindow.loadFile('../HTML/wallet.html')
    //mainWindow.loadFile('../HTML/index.html')
    //mainWindow.loadFile('index.html')

    // Open the DevTools.
    //mainWindow.webContents.openDevTools()

    // Emitted when the window is closed.
    mainWindow.on('closed', function ()
    {
        // Dereference the window object, usually you would store windows
        // in an array if your app supports multi windows, this is the time
        // when you should delete the corresponding element.
        mainWindow = null
    })
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', createWindow)

// Quit when all windows are closed.
app.on('window-all-closed', function ()
{
  // On OS X it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== 'darwin')
  {
    app.quit()
  }
})

app.on('activate', function ()
{
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (mainWindow === null) {
    createWindow()
  }
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.

