const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),shared=path.join(root,'shared'),manifest=path.join(shared,'source-hashes.json');
let hashes={};try{hashes=JSON.parse(fs.readFileSync(manifest,'utf8'));}catch{}
for(const name of ['pphand.js','replay-link.js']){
 const canonical=path.join(root,'..','src',name),out=path.join(shared,name);
 if(fs.existsSync(canonical)){fs.copyFileSync(canonical,out);hashes[name]=crypto.createHash('sha256').update(fs.readFileSync(canonical)).digest('hex');}
 else if(!fs.existsSync(out)||crypto.createHash('sha256').update(fs.readFileSync(out)).digest('hex')!==hashes[name])throw new Error('Arquivo compartilhado divergente: '+name+'. Gere novamente a partir de src/.');
}
fs.writeFileSync(manifest,JSON.stringify(hashes,null,2)+'\n');
fs.copyFileSync(path.join(shared,'view.js'),path.join(root,'public/replay/view.js'));
for(const file of ['public/replay/replay.js','public/replay/replay.css','shared/view.js','api/replay.js','api/pphand.js'])if(!fs.existsSync(path.join(root,file)))throw new Error('Arquivo ausente: '+file);
console.log('Web replay pronto; PPHand e validação idênticos aos arquivos canônicos de src/.');

// Integração ao site estático EXISTENTE: publica os arquivos atuais, nunca cópias
// antigas distribuídas no pacote. Não altera a origem nem sobrescreve /replay.
const reserved=new Set(['api','lib','shared','scripts','tests','node_modules','public','replay']);
const staticExt=/\.(?:html|css|js|png|jpe?g|webp|svg|ico|mp4|webm|pdf|woff2?|ttf)$/i;
function stage(source,target){
 const stat=fs.lstatSync(source);if(stat.isSymbolicLink())return;
 if(stat.isDirectory()){for(const item of fs.readdirSync(source)){if(!item.startsWith('.')&&!reserved.has(item))stage(path.join(source,item),path.join(target,item));}}
 else if(staticExt.test(source)){fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(source,target);}
}
for(const item of fs.readdirSync(root)){if(!item.startsWith('.')&&!reserved.has(item))stage(path.join(root,item),path.join(root,'public',item));}
