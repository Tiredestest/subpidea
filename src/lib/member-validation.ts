export function nickname(value:unknown){
 if(typeof value!=='string')throw Error('닉네임을 입력해 주세요.');
 const name=value.normalize('NFC').trim();
 if(Array.from(name).length<2||Array.from(name).length>24||/[\p{Cc}\p{Cf}]/u.test(name))throw Error('닉네임은 제어문자 없이 2~24자로 입력해 주세요.');
 return name;
}
