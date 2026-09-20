import {NextResponse} from 'next/server';
import {userDb} from '@/lib/supabase/server';
export async function POST(request:Request){const url=new URL(request.url);if(request.headers.get('origin')!==url.origin)return new Response(null,{status:403});const db=await userDb();await db.auth.signOut();return NextResponse.redirect(new URL('/',url.origin),303);}
