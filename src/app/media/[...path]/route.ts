import {publicDb} from '@/lib/supabase/server';
export async function GET(_request:Request,{params}:{params:Promise<{path:string[]}>}) {
 const {path}=await params;
 const key=path.join('/');
 if(!/^[a-z0-9-]+\/(stories|characters)\/[A-Za-z0-9_-]+\.webp$/.test(key))return new Response(null,{status:404});
 const {data,error}=await publicDb().storage.from('content').download(key);
 if(error||!data)return new Response(null,{status:404});
 return new Response(data,{headers:{'Content-Type':'image/webp','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
}
