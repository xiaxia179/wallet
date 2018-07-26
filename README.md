# TERA Smart money

[<Документация на русском>](https://github.com/terafoundation/wallet/tree/master/Doc/Rus)

Attention:
* After the installation shown below, enter the address in the browser: 127.0.0.1
* To connect to the network and start sync, you must have a static (public) IP address and an open port.
* Do not forget to set a password to restrict access to http (click the HTTP ACCESS button on your wallet). We also recommend changing port 80 to another and not storing private keys on remote servers.
* We recommend putting an additional password on the private key ("Set password" button) - in this case the private key will be stored in file in encrypted form.



## Installing on Windows by steps:

1. Download and install Nodejs https://nodejs.org (v8.11 is recommended)
2. Download and install git https://desktop.github.com/
3. Then run the commands (to do this, run the program cmd or PowerShell):

```
cd ..\..\..\
git clone https://github.com/terafoundation/wallet.git
cd wallet/Source
npm install
run-node.bat

```
If you want to run the wallet as a background process, then instead of the last command (run-node.bat), do the following:
```
npm install pm2 -g
pm2 start run-node.js
```

### Opening ports:
```
netsh advfirewall firewall add rule name="Open 30000 port" protocol=TCP localport=30000 action=allow dir=IN
```



## Installation on Linux 

### CentOS 7:


```
sudo yum install -y git
curl --silent --location https://rpm.nodesource.com/setup_8.x | sudo bash -
sudo yum  install -y nodejs
sudo npm install pm2 -g
sudo git clone https://github.com/terafoundation/wallet.git
cd wallet/Source
sudo npm install
sudo pm2 start run-node.js
```

### open ports (all):
```
systemctl stop firewalld 
systemctl disable firewalld
```

### Updates

```
cd wallet
git reset --hard 
git pull 
```



### UBUNTU 18.4:

```
sudo apt-get install -y git
sudo apt-get install -y nodejs
sudo apt-get install -y npm
sudo npm install pm2 -g
sudo git clone https://github.com/terafoundation/wallet.git
cd wallet/Source
sudo npm install
sudo pm2 start run-node.js
```

### open ports:

```
sudo ufw allow 30000/tcp
sudo ufw allow 80/tcp
```




### Updates

```
cd wallet
sudo git reset --hard 
sudo git pull 
```



## Specification

* Name: TERA
* Consensus: PoW
* Algorithm:  sha3 + meshhash (ASIC resistent hashing)
* Max emission: 1 Bln
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


# FAQs

## Solving connection problems (when no start sync)
* Check the presence of a direct ip-address (order from the provider)
* Check if the port is routed from the router to your computer
* Check the firewall (port must open on the computer)



## Refs:
* Btt: https://bitcointalk.org/index.php?topic=4573801.0
* Twitter: https://twitter.com/terafoundation
* Telegram: https://t.me/Terafoundation
* Discord: https://discord.gg/CvwrbeG
* [Документация на русском](https://github.com/terafoundation/wallet/tree/master/Doc/Rus)

