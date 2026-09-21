import {adminSnapshot} from '@/lib/admin/server';
import {AppearanceManager} from '@/components/admin/appearance-manager';
export default async function Page(){return <AppearanceManager data={await adminSnapshot()}/>;}
