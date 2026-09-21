import {createServerClient} from '@supabase/ssr';
import {NextResponse,type NextRequest} from 'next/server';
export async function proxy(request:NextRequest) {
  let response=NextResponse.next({request});
  const db=createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,{
    cookies:{getAll:()=>request.cookies.getAll(),setAll:(values,headers)=>{
      values.forEach(({name,value})=>request.cookies.set(name,value));
      response=NextResponse.next({request});
      values.forEach(({name,value,options})=>response.cookies.set(name,value,options));
      Object.entries(headers).forEach(([name,value])=>response.headers.set(name,value));
    }}
  });
  if(request.cookies.getAll().some(c=>c.name.startsWith('sb-'))) await db.auth.getUser();
  // Session-bearing responses must never be shared by browsers or a CDN.
  if(request.cookies.getAll().some(c=>c.name.startsWith('sb-')) ||
    /^\/(auth(?:\/|$)|login(?:\/|$)|admin(?:\/|$)|api\/admin(?:\/|$))/.test(request.nextUrl.pathname)) {
    response.headers.set('Cache-Control','private, no-store');
    response.headers.set('Pragma','no-cache');
    response.headers.set('Expires','0');
  }
  if(request.nextUrl.pathname.startsWith('/auth/')) response.headers.set('Referrer-Policy','no-referrer');
  return response;
}
export const config={matcher:['/((?!_next/static|_next/image|favicon.ico|icon.svg|media).*)']};
