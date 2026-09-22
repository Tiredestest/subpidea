import sharp from 'sharp';
import type {Variant} from './bulk-images.ts';
const sizes:Record<Variant,[number,number]>={card:[640,450],detail:[1280,900],avatar:[128,128],portrait:[512,512]};
export async function prepareContentImage(bytes:Buffer,variants:Variant[]){
 if(!bytes.length||bytes.length>3_000_000)throw Error('파일 하나당 3MB 이하의 이미지를 선택해 주세요.');
 const options={limitInputPixels:20_000_000,failOn:'error' as const};
 const metadata=await sharp(bytes,options).metadata();
 if(!metadata.format||!['png','jpeg','webp'].includes(metadata.format)||(metadata.pages??1)>1)throw Error('정지된 PNG·JPEG·WebP 이미지만 지원합니다.');
 const outputs=[];
 for(const variant of variants){
  const [width,height]=sizes[variant];
  const inner=await sharp(bytes,options).rotate().resize({width,height,fit:'inside',withoutEnlargement:true}).toBuffer();
  const data=await sharp({create:{width,height,channels:4,background:'#f3f5f9'}}).composite([{input:inner,gravity:'centre'}]).webp({quality:82,effort:5}).toBuffer();
  outputs.push({variant,width,height,data});
 }
 return outputs;
}
