## TERA Smart money


WARNING: To connect to the network and start sync, you must have a static IP address and an open port


Binary file (win64): https://github.com/terafoundation/wallet/blob/master/Run/Win64/Tera-setup.exe
* This  assembly file is an SFX rar-file that contains the source code + node-webkit
* Select the FOLDER where you want to install the program (by default, the program is installed to the CURRENT folder).
* If you have already installed the assembly data, you can download only the updates and install them in the same directory:
 https://github.com/terafoundation/wallet/blob/master/Run/Win64/Tera-updater.exe

## Custom run whith Sorce code (win and other)
* Download nodejs (recommended ver v8.11.1):  https://nodejs.org/en
* Download Source dir
* Goto dir Source and run command: npm install
* Run command: node run-node.js
* Start the browser with the address: 127.0.0.1


Notes: 
* When the purse receives updates to the new version of the code from the network, the code is rewritten and the purse is output. For correct operation it is necessary to loop start the command: node run-node.js
* Nodejs uses the default http port for node 80, but you can change it when you start with the command: node run-node.js "httpport: 81"



## Installation on Linux 

### CentOS 7:

sudo yum install -y git

curl --silent --location https://rpm.nodesource.com/setup_8.x | sudo bash -

sudo yum  install -y nodejs

sudo npm install pm2 -g

sudo git clone https://github.com/terafoundation/wallet.git

cd wallet/Source

sudo npm install

sudo pm2 start run-node.js

* open ports (all)
systemctl stop firewalld 

systemctl disable firewalld



### UBUNTU 18.4:

sudo apt-get install -y git

sudo apt-get install -y nodejs

sudo apt-get install -y npm

sudo npm install pm2 -g

sudo git clone https://github.com/terafoundation/wallet.git

cd wallet/Source

sudo npm install

sudo pm2 start run-node.js

* open ports
sudo ufw allow 30000/tcp

sudo ufw allow 80/tcp


### Updates

cd wallet

sudo git reset --hard 

sudo git pull 



## Specification

* Name: TERA
* Consensus: PoW
* Algorithm:  sha3 + meshhash (ASIC resistent hashing)
* Max emission: 1 bln (TER)
* Reward for block: 1-20 coins, depends on network power (one billionth of the remainder of undistributed amount of coins and multiplied by the hundredth part of the square of the logarithm of the network power)
* Block size 120 KB
* Premine: 5%
* Development fund: 1% of the mining amount
* Block generation time: 1 second
* Block confirmation time: 8 seconds
* Speed: from 1000 transactions per second
* Commission: free of charge 
* Cryptography: sha3, secp256k1
* Protection against DDoS: PoW (hash calculation)
* Platform: Node.JS




## Refs:
* Btt: https://bitcointalk.org/index.php?topic=4573801.0
* Twitter: https://twitter.com/terafoundation
* Telegram: @Terafoundation
* Discord: https://discord.gg/CvwrbeG


## Tests
- 1
- 2
* 11
* 22
** 111
** 222
