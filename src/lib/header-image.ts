import sharp from 'sharp';
export async function prepareHeader(bytes:Buffer){
 if(!bytes.length||bytes.length>3_000_000)throw Error('이미지는 3MB 이하여야 합니다.');
 const options={limitInputPixels:20_000_000,failOn:'error' as const};
 const meta=await sharp(bytes,options).metadata();
 if(!meta.format||!['jpeg','png','webp'].includes(meta.format)||(meta.pages??1)>1)throw Error('정지된 JPEG·PNG·WebP 이미지만 지원합니다.');
 return sharp(bytes,options).rotate().resize({width:1600,height:900,fit:'inside',withoutEnlargement:true}).webp({quality:88}).toBuffer();
}
