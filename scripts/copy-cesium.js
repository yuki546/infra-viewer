// copy-cesium.js
const fs=require('fs');
const path=require('path');
const src=path.join('node_modules','cesium','Build','Cesium');
const dst=path.join('public','cesium');
fs.rmSync(dst,{recursive:true,force:true});
fs.cpSync(src,dst,{recursive:true});
console.log('Copied Cesium assets to public/cesium');
