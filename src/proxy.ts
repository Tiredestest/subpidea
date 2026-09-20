import {createServerClient} from '@supabase/ssr';
import {NextResponse,type NextRequest} from 'next/server';
export async function proxy(request:NextRequest) {
  let response=NextResponse.next({request});
  const db=createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,{
    cookies:{getAll:()=>request.cookies.getAll(),setAll:(values)=>{
      values.forEach(({name,value})=>request.cookies.set(name,value));
      response=NextResponse.next({request});
      values.forEach(({name,value,options})=>response.cookies.set(name,value,options));
    }}
  });
  if(request.cookies.getAll().some(c=>c.name.startsWith('sb-'))) await db.auth.getUser();
  return response;
}
export const config={matcher:['/((?!_next/static|_next/image|favicon.ico|icon.svg|media).*)']};
