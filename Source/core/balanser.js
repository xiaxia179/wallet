const RBTree = require('bintrees').RBTree;


var glNumWork=0;

module.exports = class CConnect extends require("./transfer-msg")
{
    constructor(SetKeyPair,RunIP,RunPort,UseRNDHeader,bVirtual)
    {
        super(SetKeyPair,RunIP,RunPort,UseRNDHeader,bVirtual)


        function CompareNodePrioritet(a,b)
        {
            if(a.Hot!==b.Hot)
                return b.Hot-a.Hot;
            if(a.BlockProcessCount!==b.BlockProcessCount)
                return b.BlockProcessCount-a.BlockProcessCount;
            if(a.LastTime!==b.LastTime)
                return b.LastTime-a.LastTime;

            if(a.POW!==b.POW)
                return b.POW-a.POW;

            return a.Num-b.Num;

        }
        //queues
        this.ListToConnect=new RBTree(CompareNodePrioritet);
    }

    AddToConnect(Node)
    {
        if(Node.Hot===undefined)
            throw "Node.Hot===undefined";
        if(Node.BlockProcessCount===undefined)
            throw "Node.BlockProcessCount===undefined";
        if(Node.LastTime===undefined)
            throw "Node.LastTime===undefined";
        if(Node.POW===undefined)
            throw "Node.POW===undefined";
        glNumWork++;
        this.ListToConnect.insert(
                                {
                                    Hot:Node.Hot,
                                    BlockProcessCount:Node.BlockProcessCount,
                                    LastTime:Node.LastTime,
                                    POW:Node.POW,
                                    Num:glNumWork,
                                });
    }

}

