import Link from 'next/link';
export default function NotFound(){return <div className="page-shell empty-state"><h1>아직 공개되지 않았거나 없는 이야기예요</h1><p>공개된 게임 목록에서 다른 이야기를 찾아보세요.</p><Link href="/games" className="button">게임 둘러보기</Link></div>;}
