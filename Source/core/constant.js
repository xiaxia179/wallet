//Copyright: Yuriy Ivanov, 2017-2018 e-mail: progr76@gmail.com
global.UPDATE_CODE_VERSION_NUM=19;
"update 19";

require("./startlib.js");



global.MIN_POWER_POW_HANDSHAKE=12;

//настройка сообщений
global.MIN_POWER_POW_MSG=2;
global.MEM_POOL_MSG_COUNT=1000;

//СЕТЬ
//СЕТЬ
//Константы иерархия
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
global.TEST_TRANSACTION_GENERATE=0;
global.MAX_TRANSACTION_SIZE=65535;
global.MIN_TRANSACTION_SIZE=32;
global.MAX_TRANSACTION_COUNT=2000;
//global.MAX_TRANSACTION_COUNT=Math.floor(MAX_BLOCK_SIZE/MIN_TRANSACTION_SIZE);//1000;

global.AVG_TRANSACTION_COUNT=Math.floor(MAX_TRANSACTION_COUNT/2);
//global.MIN_TRANSACTION_COUNT=global.AVG_TRANSACTION_COUNT*4;

global.MIN_POWER_POW_TR=13;//!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
if(global.MIN_POWER_POW_BL===undefined)
    global.MIN_POWER_POW_BL=6;
global.GENERATE_BLOCK_ACCOUNT=0;
global.TOTAL_TER_MONEY=1e9;

//Настройки DApp.accounts
global.TRANSACTION_PROOF_COUNT=1000*1000;
global.MIN_POWER_POW_ACC_CREATE=16;



//Работа с памятью:
global.BLOCK_COUNT_IN_MEMORY=240;
global.HISTORY_BLOCK_COUNT=240;
global.MAX_STAT_PERIOD=3*3600;
global.MAX_SIZE_LOG=200*1024*1024;
//global.INTERVAL_FOR_DUMP_MEM=0;




//БД
global.USE_CHECK_SAVE_DB=0;
global.USE_KEY_DB=0;
global.USE_CHECK_KEY_DB=0;


global.START_NETWORK_DATE=1530446400000;//(new Date(2018, 6, 1, 12, 0, 0, 0))-0;


//константы соединения:
var NETWORK="TERA-R3";//10
global.DEF_MAJOR_VERSION="0001";//4


InitParams();

if(global.LOCAL_RUN)
{
    global.START_NETWORK_DATE=1530783132785;//(new Date)-0;//1530781502576+(1)*1000;//
    NETWORK="TEST-R3";
}



global.DEF_NETWORK=NETWORK+"-"+DEF_MAJOR_VERSION;//15
global.DEF_VERSION=DEF_MAJOR_VERSION+".0001";//9
global.DEF_CLIENT="TERA-CORE";//16
global.START_IP="";

global.FIRST_TIME_BLOCK=START_NETWORK_DATE;
global.START_BLOCK_RUN=0;


if(global.HTTP_PORT_NUMBER===undefined)
    global.HTTP_PORT_NUMBER = 80;
if(global.START_PORT_NUMBER ===undefined)
    global.START_PORT_NUMBER = 30000;



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
