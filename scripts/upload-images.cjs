const fs = require('node:fs');
const path = require('node:path');
process.loadEnvFile('.env.local');
process.loadEnvFile('.env.upload');
process.loadEnvFile('.env.upload-auth');
const files=JSON.parse(fs.readFileSync('data/reports/upload-plan.json','utf8'));
const result=[];
let index=0;
async function worker() {
 while(index<files.length) {
  const item=files[index++];
  let ok=false;
  for(let attempt=0;attempt<3&&!ok;attempt++) {
   try {
    const res=await fetch(process.env.NEXT_PUBLIC_SUPABASE_URL+'/functions/v1/initial-content-upload?path='+encodeURIComponent(item.remote),{
     method:'POST',headers:{Authorization:'Bearer '+process.env.IMPORT_ANON_JWT,'x-import-token':process.env.IMPORT_UPLOAD_TOKEN,'Content-Type':'image/webp'},
     body:fs.readFileSync(path.resolve(item.local)),signal:AbortSignal.timeout(45000)});
    if(!res.ok) throw new Error('HTTP '+res.status);
    ok=true;
   } catch(error) { if(attempt===2) console.error(item.remote,error.message); }
  }
  result.push({path:item.remote,ok});
  if(result.length%50===0) console.log(result.length+'/'+files.length);
 }
}
Promise.all(Array.from({length:6},worker)).then(()=>{
 fs.writeFileSync('data/reports/upload-result.json',JSON.stringify(result,null,2));
 console.log('Uploaded',result.filter(x=>x.ok).length,'/',files.length);
 if(result.some(x=>!x.ok)) process.exitCode=1;
});
