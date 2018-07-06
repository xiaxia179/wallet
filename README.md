## TERA Smart money



Binary file (win64): https://github.com/terafoundation/wallet/blob/master/Run/Win64/Tera-setup.exe
* This  assembly file is an SFX rar-file that contains the source code + node-webkit
* If you have already installed the assembly data, you can download only the updates and install them in the same directory:
 https://github.com/terafoundation/wallet/blob/master/Run/Win64/Tera-updater.exe

## Custon run whith Sorce code
* Download nodejs (recommended ver v8.11.1):  https://nodejs.org/en
* Download Source dir
* Goto dir Source and run command: npm install
* Run: node run-node.js
* Start the browser with the address: 127.0.0.1/wallet


Notes: 
* When the purse receives updates to the new version of the code from the network, the code is rewritten and the purse is output. For correct operation it is necessary to loop start the command: node run-node.js
* nodejs uses the default http port for node 80, but you can change it when you start with the command: node run-node.js "httpport: 81"







## Specification

* Name: TERA
* Consensus: PoW
* Algorithm:  sha3 + meshhash (Asic resistent hashing)
* Max emission: 1 bln (TER)
* Reward for block: 1-20 coins, depends on network power (one billionth of the remainder of undistributed amount of coins and multiplied by the hundredth part of the square of the logarithm of the network power)
* Block size 120 KB
* Premine: 5%
* Commission from the mining: 1% (to the development)
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
