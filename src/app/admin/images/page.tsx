import {requireAdmin} from '@/lib/admin/server';
import {HeaderUpload} from '@/components/admin/header-upload';
export default async function Page(){const {db}=await requireAdmin();const {data,error}=await db.from('games').select('id,title').order('title');if(error)throw Error('게임을 불러오지 못했습니다.');return <HeaderUpload games={data}/>;}
