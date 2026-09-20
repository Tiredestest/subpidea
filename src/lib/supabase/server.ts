import 'server-only';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

export function publicDb() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    auth:{persistSession:false,autoRefreshToken:false}, global:{fetch:(url,options)=>fetch(url,{...options,cache:'no-store'})}
  });
}
export async function userDb() {
  const jar=await cookies();
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,{
    cookies:{getAll:()=>jar.getAll(),setAll:(values)=>{try{values.forEach(({name,value,options})=>jar.set(name,value,options));}catch{/* Read-only server render; proxy refreshes cookies. */}}}
  });
}
