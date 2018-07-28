//Copyright: Yuriy Ivanov, 2017-2018 e-mail: progr76@gmail.com
global.UPDATE_CODE_VERSION_NUM=144;
global.MIN_CODE_VERSION_NUM=141;


global.CONST_NAME_ARR=["DELTA_CURRENT_TIME","SERVER_PRIVATE_KEY_HEX","NET_WORK_MODE","STAT_MODE",
    "UPDATE_NUM_COMPLETE","HTTP_PORT_NUMBER","HTTP_PORT_PASSWORD","WALLET_NAME","COUNT_VIEW_ROWS","ADDRLIST_MODE",
    "USE_MINING","POW_MAX_PERCENT","USE_LOG_NETWORK","ALL_LOG_TO_CLIENT","LIMIT_SEND_TRAFIC"];

global.DELTA_CURRENT_TIME=0;
global.SERVER_PRIVATE_KEY_HEX=undefined;
global.NET_WORK_MODE=undefined;
global.STAT_MODE=0;
global.UPDATE_NUM_COMPLETE=0;
global.WALLET_NAME="TERA";
global.USE_MINING=0;
global.POW_MAX_PERCENT=50;

global.POWRunCount=5000;
global.POWRunPeriod=2;
global.CheckPointDelta=20;
global.ALL_LOG_TO_CLIENT=1;
global.USE_LOG_NETWORK=0;

global.LIMIT_SEND_TRAFIC=0;
global.COUNT_VIEW_ROWS=20;


require("./startlib.js");



global.MIN_POWER_POW_HANDSHAKE=12;

//настройка сообщений
global.MIN_POWER_POW_MSG=2;
global.MEM_POOL_MSG_COUNT=1000;

//СЕТЬ
//СЕТЬ
//Константы иерархии обмена
global.MAX_LEVEL_SPECIALIZATION=24;//максимальный уровень специализации в битах
global.MIN_CONNECT_CHILD=2;
global.MAX_CONNECT_CHILD=8;

//Сетевое взаимодействие
global.MAX_NODES_RETURN = 160;
global.USE_PACKET_STAT=0
global.USE_CHECK_SEND=0;

//БЛОКИ
global.TR_LEN=100;
global.BLOCK_PROCESSING_LENGTH=8;
global.BLOCK_PROCESSING_LENGTH2=BLOCK_PROCESSING_LENGTH*2;
global.CONSENSUS_PERIOD_TIME=1000;//ms
global.MAX_BLOCK_SIZE=120*1024;


//Настройки транзакций
global.MAX_TRANSACTION_SIZE=65535;
global.MIN_TRANSACTION_SIZE=32;
global.MAX_TRANSACTION_COUNT=2000;
//global.MAX_TRANSACTION_COUNT=Math.floor(MAX_BLOCK_SIZE/MIN_TRANSACTION_SIZE);//1000;

global.AVG_TRANSACTION_COUNT=Math.floor(MAX_TRANSACTION_COUNT/2);
//global.MIN_TRANSACTION_COUNT=global.AVG_TRANSACTION_COUNT*4;

global.MIN_POWER_POW_TR=15;//!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
if(global.MIN_POWER_POW_BL===undefined)
    global.MIN_POWER_POW_BL=5;
global.GENERATE_BLOCK_ACCOUNT=0;
global.TOTAL_TER_MONEY=1e9;

//Настройки DApp.accounts
global.TRANSACTION_PROOF_COUNT=1000*1000;
global.MIN_POWER_POW_ACC_CREATE=16;
global.START_MINING=2*1000*1000;
global.REF_PERIOD_MINING=1*1000*1000;


global.DELTA_BLOCK_ACCOUNT_HASH=1000;//more then COUNT_BLOCKS_FOR_LOAD
global.PERIOD_ACCOUNT_HASH=10;


//Работа с памятью:
global.BLOCK_COUNT_IN_MEMORY=40;
global.HISTORY_BLOCK_COUNT=40;
global.MAX_STAT_PERIOD=1*3600;
global.MAX_SIZE_LOG=200*1024*1024;
//global.INTERVAL_FOR_DUMP_MEM=0;




//БД
global.USE_CHECK_SAVE_DB=0;
global.USE_KEY_DB=0;
global.USE_CHECK_KEY_DB=0;


global.START_NETWORK_DATE=1530446400000;//(new Date(2018, 6, 1, 12, 0, 0, 0))-0;


//константы соединения:
var NETWORK="TERA-R3";//10
var NETWORK2="TERA-R3";//10
global.DEF_MAJOR_VERSION="0001";//4


InitParams();


if(global.LOCAL_RUN)
{
    global.START_MINING=100;
    global.REF_PERIOD_MINING=100;
    global.START_NETWORK_DATE=1532790949621-100*1000//((new Date)-0)-50*1000;
    global.DELTA_BLOCK_ACCOUNT_HASH=16;
    global.TEST_TRANSACTION_GENERATE=0;
    global.MIN_POWER_POW_TR=0;
    global.MIN_POWER_POW_ACC_CREATE=0;

    console.log("TEST RUN - START_NETWORK_DATE: "+START_NETWORK_DATE);
    NETWORK="TEST-R3";
    NETWORK2="TEST-R3";
}



global.GetNetworkName=function()
{
    return NETWORK+"-"+DEF_MAJOR_VERSION;//15
    // var CurDate=new Date();
    // var MustDate=new Date(2018, 6, 12, 12, 0, 0, 0);
    // if(CurDate<MustDate)
    //     return NETWORK+"-"+DEF_MAJOR_VERSION;//15
    // else
    //     return NETWORK2+"-"+DEF_MAJOR_VERSION;//15
}

global.DEF_VERSION=DEF_MAJOR_VERSION+"."+UPDATE_CODE_VERSION_NUM;//9
global.DEF_CLIENT="TERA-CORE";//16

global.FIRST_TIME_BLOCK=START_NETWORK_DATE;
global.START_BLOCK_RUN=0;


if(global.START_IP===undefined)
    global.START_IP = "";
if(global.START_PORT_NUMBER===undefined)
    global.START_PORT_NUMBER = 30000;
// if(global.HTTP_PORT_NUMBER===undefined)
//     global.HTTP_PORT_NUMBER = 80;
if(global.HTTP_PORT_PASSWORD===undefined)
    global.HTTP_PORT_PASSWORD="";


//**********************
//Тестирование и отладка
//**********************




if(global.USE_AUTO_UPDATE===undefined)
    global.USE_AUTO_UPDATE=1;
if(global.USE_PARAM_JS===undefined)
    global.USE_PARAM_JS=1;

if(global.DATA_PATH===undefined)
    global.DATA_PATH="";
if(global.CREATE_ON_START===undefined)
    global.CREATE_ON_START=false;

if(global.LOCAL_RUN===undefined)
    global.LOCAL_RUN=0;
if(global.CODE_PATH===undefined)
    global.CODE_PATH=process.cwd();





//Отладка
if(global.DEBUG_MODE===undefined)
    global.DEBUG_MODE=0;




// LIST_PORT_NUMBER=30006;

//try{require("../../params")}catch(e) {};
//require(GetDataPath("params.js"));

if(typeof window === 'object')
{
    window.RUN_CLIENT=0;
    window.RUN_SERVER=1;
}
global.RUN_CLIENT=0;
global.RUN_SERVER=1;





    //----------------------------------------------------------------------------------------------------------------------
function InitParams()
{
    // if(!global.RUN_NW_SERVER && typeof window === 'object')//client
    //     return;



    //env
    for(var i=1;i<process.argv.length;i++)
    {
        var str=process.argv[i];
        // if(str.substr(0,5)=="port:")
        //     global.START_PORT_NUMBER=parseInt(str.substr(5));
        // else
        if(str.substr(0,9)=="httpport:")
        {
            global.HTTP_PORT_NUMBER=parseInt(str.substr(9));
        }
        else
        if(str.substr(0,5)=="path:")
            global.DATA_PATH=str.substr(5);
        else
        if(str.substr(0,5)=="port:")
            global.START_PORT_NUMBER=parseInt(str.substr(5));
        else
        if(str.substr(0,3)=="ip:")
            global.START_IP=str.substr(3);
        else
        if(str=="childpow")
            global.CHILD_POW=true;
        else
        if(str=="ADDRLIST")
            global.ADDRLIST_MODE=true;
        else
        if(str=="CREATEONSTART")
            global.CREATE_ON_START=true;
        else
        if(str=="LOCALRUN")
            global.LOCAL_RUN=1;
        else
        if(str=="NOLOCALRUN")
            global.LOCAL_RUN=0;
        else
        if(str=="NOAUTOUPDATE")
            global.USE_AUTO_UPDATE=0;
        else
        if(str=="NOPARAMJS")
            global.USE_PARAM_JS=0;


    }
}
///////
