const fs = require('node:fs');
const crypto = require('node:crypto');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(root,process.argv[2]||'data/processed/blue-archive/manifest.json'),'utf8'));
const token = crypto.randomBytes(32).toString('hex');
const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
fs.writeFileSync(path.join(root,'.env.upload'),`IMPORT_UPLOAD_TOKEN=${token}\n`);
const files = manifest.manifest.flatMap(entry=>entry.variants.map(variant=>({
  local: variant.path, remote:variant.path.replace('data/processed/',''),
  sha256:crypto.createHash('sha256').update(fs.readFileSync(path.join(root,variant.path))).digest('hex')
})));
fs.writeFileSync(path.join(root,'data/reports/upload-plan.json'),JSON.stringify(files));
const allow = Object.fromEntries(files.map(file=>[file.remote,file.sha256]));
const expiry = Date.now()+2*60*60*1000;
const code = `const expected = ${JSON.stringify(tokenHash)};
const expires = ${expiry};
const allowed: Record<string,string> = ${JSON.stringify(allow)};
const hash = async (bytes: BufferSource) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(b=>b.toString(16).padStart(2,'0')).join('');
Deno.serve(async req => {
 if(req.method!=='POST'||Date.now()>expires) return new Response('Closed',{status:403});
 const proof = req.headers.get('x-import-token') || '';
 if(await hash(new TextEncoder().encode(proof))!==expected) return new Response('Denied',{status:403});
 const name = new URL(req.url).searchParams.get('path') || '';
 if(!Object.hasOwn(allowed,name)) return new Response('Unknown object',{status:403});
 const bytes = await req.arrayBuffer();
 if(bytes.byteLength>2097152 || await hash(bytes)!==allowed[name]) return new Response('Checksum mismatch',{status:400});
 const key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
 if(!key) return new Response('Storage configuration missing',{status:500});
 const response=await fetch(Deno.env.get('SUPABASE_URL')+'/storage/v1/object/content/'+name,{method:'POST',headers:{Authorization:'Bearer '+key,apikey:key,'Content-Type':'image/webp','x-upsert':'true','cache-control':'max-age=300'},body:bytes});
 if(!response.ok) return new Response('Storage upload failed',{status:502});
 return Response.json({ok:true,path:name});
});`;
fs.writeFileSync(path.join(root,'data/reports/upload-function.ts'),code);
console.log(`Prepared ${files.length} checksum-bound uploads. Capability expires in two hours.`);
