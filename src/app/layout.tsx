import type {Metadata} from 'next';
import {Header} from '@/components/header';
import './globals.css';
export const metadata:Metadata={title:{default:'섭차피디아 · 좋아하는 이야기를 더 깊게',template:'%s · 섭차피디아'},description:'게임 속 이야기와 그 안의 캐릭터를 만나고, 나만의 감상을 기록하세요.'};
export const dynamic='force-dynamic';
export default function Layout({children}:{children:React.ReactNode}){
 return <html lang="ko"><body><a href="#main" className="skip-link">본문으로 건너뛰기</a><Header/><main id="main">{children}</main><footer><div className="footer-inner"><strong>섭차피디아</strong><span>좋아하는 이야기를, 더 깊게.</span><span className="footer-note">게임 이미지와 콘텐츠의 권리는 각 권리자에게 있습니다.</span></div></footer></body></html>;
}
