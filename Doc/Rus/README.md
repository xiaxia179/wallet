# TERA Smart money


Внимание: Вам нужно иметь статический IP-адрес и открытый порт 30000 (его можно поменять).


Бинарный файл (win64): https://github.com/terafoundation/wallet/blob/master/Run/Win64/Tera-setup.exe
* Это неполноценный инсталлятор, а SFX rar-file который содержит исходные коды (папка Source) + приложение node-webkit
* При установке программы выберите Папку, иначе программа будет установлена в текущую директорию.
* Если вы уже имеете установленную программу, то при ручном апдейте (запуске файла updater.exe) укажите ту же самую папку. Обновление:
 https://github.com/terafoundation/wallet/blob/master/Run/Win64/Tera-updater.exe



## Ручной способ установки (для win и других платформ)
* Загрузите Nodejs (рекомендуется версия v8.11):  https://nodejs.org/en
* Загрузите папку Source
* Перейдите в папку Source и запустите команду: npm install
* Запустите команду: node run-node.js
* Откройте брайзер и введите адрес: 127.0.0.1


Замечания:
* Когда нода автоматически обновляется из сети, то она перезапускается. Для версии c Nodejs (см. ручной способ установки) выполняется простое завершение процесса, т.к. ожидается что программа запущена через внешнюю оболочку поддерживающую постоянную работу: для win - это батник в цикле запускающий программу - см. run-node.bat, для Linux демон, например pm2
* В версии с Nodejs при старте для http используется порт 80, его можно поменять в закладке CONFIG в интерфейсе кошелька (нажмите кнопку HTTP ACESS), вместе с ним можно установить пароль на доступ к интерфейсу. Рекомендуется это делать если вы используете терминальный Линукс с публичным адресом.




## Установка на Linux 

Просто введите подряд в ssh-терминал команды указанные ниже (в зависимости от версии дистрибутива)

### Дистрибутив CentOS 7:

sudo yum install -y git

curl --silent --location https://rpm.nodesource.com/setup_8.x | sudo bash -

sudo yum  install -y nodejs

sudo npm install pm2 -g

sudo git clone https://github.com/terafoundation/wallet.git

cd wallet/Source

sudo npm install

sudo pm2 start run-node.js

#### open ports (all):

systemctl stop firewalld 

systemctl disable firewalld



### Дистрибутив UBUNTU 18.4:

sudo apt-get install -y git

sudo apt-get install -y nodejs

sudo apt-get install -y npm

sudo npm install pm2 -g

sudo git clone https://github.com/terafoundation/wallet.git

cd wallet/Source

sudo npm install

sudo pm2 start run-node.js

#### open ports:

sudo ufw allow 30000/tcp

sudo ufw allow 80/tcp


### Updates

cd wallet

sudo git reset --hard 

sudo git pull 



## Спецификация
* Название: TERA
* Консенсус: PoW
* Алгоритм:  sha3 + meshhash (антиасик перемешивание)
* Максимальная эмиссия: 1 млрд (TER)
* Награда за блок: 1-20 монет, зависит от мощности сети (одна миллиардная часть от остатка нераспределенной суммы монет и умноженная на сотую часть квадрата логарифма мощности сети)
* Премайн: 5%
* Комиссия от майнинга: 1% (в фонд разработки)
* Время генерации блока: 1 секунда
* Время подтверждения блока: 8 секунд
* Размер блока: 120 Кбайт
* Скорость: от 1000 транзакций в секунду
* Комиссия в транзакциях: бесплатно
* Криптография: sha3, secp256k1
* Защита от ДДОС: PoW (расчет хеша)
* Платформа: Node.JS




## Ссылки:
* Btt: https://bitcointalk.org/index.php?topic=4573801.0
* Twitter: https://twitter.com/terafoundation
* Telegram: https://t.me/Terafoundation
* Discord: https://discord.gg/CvwrbeG


