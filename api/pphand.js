'use strict';
module.exports=(_req,res)=>{res.setHeader('Content-Type','text/javascript; charset=utf-8');res.setHeader('Cache-Control','public,max-age=0,must-revalidate');res.setHeader('X-Content-Type-Options','nosniff');res.end(require('node:fs').readFileSync(require('node:path').join(__dirname,'../shared/pphand.js')));};
