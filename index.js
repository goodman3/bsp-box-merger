let fs =require('fs');
let path =require('path');
let math3d =require('math3d');
let inputName = 'desc.map';
let map = fs.readFileSync(path.join(__dirname,'desc.map')).toString('utf8');
Array.prototype.distinct = function (){
    var arr = this,
        i,
        obj = {},
        result = [],
        len = arr.length;
    for(i = 0; i< arr.length; i++){
        if(!obj[arr[i]]){ //如果能查找到，证明数组元素重复了
            obj[arr[i]] = 1;
            result.push(arr[i]);
        }
    }
    return result;
};
let Vector3 = math3d.Vector3;
class boxMerger{
    constructor(UTF8map){
        this.mapFile = UTF8map;
        this.jsonMap = [];
        this.lastBlockId = 0;
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
                    item = item.replace('\n','');
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
                    block.id=this.lastBlockId;
                    this.lastBlockId++;
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
            let info = {
                vectors:[],
            };
            if(a.length !== 4) throw Error('length not correct');
            for(let i=0;i<3;i++){
                let d=a[i];
                d = d.replace('(',"").trim().split(' ');
                let v1 = new Vector3(parseInt(d[0]), parseInt(d[1]), parseInt(d[2]));
                info.vectors.push(v1);
            }
            let v1 = info.vectors[1].sub(info.vectors[0]);
            let v2 = info.vectors[2].sub(info.vectors[1]);
            // console.log(`v1 :`,v1);
            info.cross = v2.cross(v1).normalize();
            return info;
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
                    let k = block.validFaceInfo.vectors;
                    let allowed = [k[0].x,k[0].y,k[0].z];
                    allowed = allowed.concat([k[1].x,k[1].y,k[1].z]);
                    allowed = allowed.concat([k[2].x,k[2].y,k[2].z]);
                    allowed =  allowed.distinct();
                    let existed = [`${k[0].x},${k[0].y},${k[0].z}`];
                    existed.push(`${k[1].x},${k[1].y},${k[1].z}`);
                    existed.push(`${k[2].x},${k[2].y},${k[2].z}`);
                    for(let o=0;o<block.originalBlockArray.length;o++){
                        let l=block.originalBlockArray[o];
                        let info = getFaceInfo(l);
                        for(let v=0;v<info.vectors.length;v++){
                            let vv=info.vectors[v];
                            if(allowed.indexOf(vv.x) === -1) continue;
                            if(allowed.indexOf(vv.y) === -1) continue;
                            if(allowed.indexOf(vv.z) === -1) continue;
                            if(existed.indexOf(`${vv.x},${vv.y},${vv.z}`) >=0) continue;
                            block.validFaceInfo.extraVector = vv;
                        }

                    }
                }
            }
        }
    }
    /*
        block {
        id:int,
        validFace:''
        originalBlockArray:[]
        mergeAble: t/f,
        validFaceInfo:{
            vectors:[v1,v2,v3],
            cross:normalized,
            extraVector:v4,
            lines:[l1,l2,l3,l4] "[p1,p2]"
            }
        },
        nearFaces: [ 6, 7, 8 ] block's id
     */

    tryMergeBox(block){

    }

    findNearFaces(){
        for(let i=0;i<this.jsonMap.length;i++){
            let item=this.jsonMap[i];
            let blocks = item.blocks;
            if(blocks){
                for(let b=0;b<blocks.length;b++){
                    let block=blocks[b];
                    if(block.mergeAble){
                        block.nearFaces = boxMerger.getNearFacesByLine(blocks,block.validFaceInfo.lines,block.id);
                    }
                }
            }
        }
    }

    static getNearFacesByLine(blocks,lines,selfId){
        let nearFacesId= [];
        for(let b=0;b<blocks.length;b++){
            let block=blocks[b];
            if(block.id === selfId){
                continue;
            }
            if(block.mergeAble){
                for(let i=0;i<block.validFaceInfo.lines.length;i++){
                    let item=block.validFaceInfo.lines[i];
                    for(let l=0;l<lines.length;l++){
                        let line=lines[l];
                        if(item[0] === line[0] && item[1] === line[1]){
                            nearFacesId.push(block.id);
                        }else if(item[1] === line[0] && item[0] === line[1]){
                            nearFacesId.push(block.id);
                        }

                    }
                }
            }
        }
        return nearFacesId;
    }
    buildLines(){
        for(let i=0;i<this.jsonMap.length;i++){
            let item=this.jsonMap[i];
            let blocks = item.blocks;
            if(blocks){
                for(let b=0;b<blocks.length;b++){
                    let block=blocks[b];
                    if(block.mergeAble){
                        let validFaceInfo = block.validFaceInfo;
                        if(!validFaceInfo.status || validFaceInfo.status ==='none'){
                            let lines = [validFaceInfo.vectors[0].toString(),validFaceInfo.vectors[1].toString()];
                            let lines1 = [validFaceInfo.vectors[1].toString(),validFaceInfo.vectors[2].toString()];
                            let lines2 = [validFaceInfo.vectors[2].toString(),validFaceInfo.extraVector.toString()];
                            let lines3 = [validFaceInfo.extraVector.toString(),validFaceInfo.vectors[0].toString()];
                            validFaceInfo.lines=[lines,lines1,lines2,lines3];
                            // let nearFaces = [];
                            // nearFaces.push(this.findFacesByLine(lines));
                        }
                    }
                }
            }
        }
    }
    parseMap(){
        let firstMap = {};
        this.jsonMap.push(firstMap);
        this._readBlock(firstMap,this.mapFile.indexOf(`{`)+1);
        this.markBlocks();
        this.extractBlockValidFace();
        this.buildLines();
        this.findNearFaces();
        this.kill();
        console.log(`this.jsonMap :`,this.jsonMap[2].blocks[0]);
        fs.writeFileSync(path.join(__dirname,`out_${inputName}`),JSON.stringify(this.jsonMap));
    };
}
let merger = new boxMerger(map);
merger.parseMap();