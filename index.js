let fs =require('fs');
let path =require('path');
let map = fs.readFileSync(path.join(__dirname,'desc.map')).toString('utf8');

class boxMerger{
    parseMapBlock(){

    }
    constructor(UTF8map){
        this.mapFile = UTF8map;
        this.jsonMap = [];
    }
    _readBlock(parent,position){
        if(position>= this.mapFile.length){
            return;
        }
        let c= this.mapFile[position];
        if(c===`"`){
            //parse one line
            let lineEnd = this.mapFile.indexOf(`\r`,position);
            let str = this.mapFile.substring(position,lineEnd);
            let middle = str.indexOf("\" ");
            let middle2 = str.indexOf(" \"");
            let name = str.substring(1,middle);
            let value = str.substring(middle2+2,str.lastIndexOf("\""));
            parent[name] = value;
            return this._readBlock(parent,lineEnd);
        } else if(c===`{`){
            if(!parent.blocks){
                parent.blocks = [];
            }
            //push brush
            //find }
            let blockP = this.mapFile.indexOf(`}`,position);
            let block = this.mapFile.substring(position+1,blockP).split('\r');
            let validFace=null;
            let originalBlockArray=[];
            for(let i=0;i<block.length;i++){
                let item=block[i];
                if(item.length>10){
                    originalBlockArray.push(item);
                    if(!(item.indexOf('NULL')>=0 || item.indexOf('null')>=0)){
                        validFace = item;
                    }
                }
            }
            parent.blocks.push({
                validFace:validFace,
                originalBlockArray:originalBlockArray
            });
            return this._readBlock(parent,blockP+1);
        }else if(c===`}`){
            let firstMap = {};
            this.jsonMap.push(firstMap);
            let next = this.mapFile.indexOf(`{`,position);
            return this._readBlock(firstMap,next > 0 ? next +1 : position+1);
            //exit Block level
        } else {
            //continue
            return this._readBlock(parent,position+1);
        }
    }

    /**
     * mark blocks that we can merge
     */
    markBlocks(){
        for(let i=0;i<this.jsonMap.length;i++){
            let item=this.jsonMap[i];
            let blocks = item.blocks;
            if(blocks){
                for(let b=0;b<blocks.length;b++){
                    let block=blocks[b];
                    block.mergeAble = block.originalBlockArray.length === 6;
                    if(!block.validFace){
                        block.mergeAble = false;
                    }
                }
            }
        }
    }
    /**
     * get valid Face
     */
    extractBlockValidFace(){
        function getFaceInfo(validFace){
            let a = validFace.split(')');
            console.log(a);
            if(a.length !== 4) throw Error('length not correct');
            for(let i=0;i<3;i++){
                let item=a[i];
                item = item.replace('(',"").trim().split(' ');
                for(let b=0;b<item.length;b++){
                    let item=item[b];

                }
            }

        }
        for(let i=0;i<this.jsonMap.length;i++){
            let item=this.jsonMap[i];
            let blocks = item.blocks;
            if(blocks){
                for(let b=0;b<blocks.length;b++){
                    let block=blocks[b];
                    if(block.mergeAble){
                        block.validFaceInfo = getFaceInfo(block.validFace);
                    }
                }
            }
        }
    }
    /*
        blocks {
        validFace:''
        originalBlockArray:[]
        mergeAble: t/f
        }
     */
    parseMap(){
        let firstMap = {};
        this.jsonMap.push(firstMap);
        this._readBlock(firstMap,this.mapFile.indexOf(`{`)+1);
        this.markBlocks();
        this.extractBlockValidFace();

    };
}
let merger = new boxMerger(map);
merger.parseMap();