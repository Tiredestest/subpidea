# 데이터 준비 도구 실행

Python은 openpyxl 및 Pillow가 필요하다. 이미지 변환은 Node.js와 sharp가 필요하다. 현재 작업은 Codex 제공 런타임으로 실행했다.

```text
python scripts/analyze-source.py
python scripts/prepare-data.py --config config/import/blue-archive.json --as-of 2026-09-20
node scripts/optimize-images.cjs config/import/blue-archive.json
python -m unittest discover -s tests -v
```

실제 재실행 시 --as-of는 새 기준일로 바꾸거나 생략해 실행일을 사용한다. 이 기준은 최초 공개 대상 계산용이며 운영 DB의 공개 설정을 자동 갱신하는 배치가 아니다.

- data/raw: 사용자 원본. 변경하지 않음.
- data/reports/source-audit.json: 실제 시트/수식/캐시/이미지 정보 및 원본 해시.
- data/reports/blue-archive/validation.json: 오류, 경고, 정규화 내역, 격리 행.
- data/reports/blue-archive/staging.json: 검증 완료된 입력 준비 데이터. valid=false이면 data=null이며 DB 입력 금지.
- data/processed/blue-archive/manifest.json: 이미지 파생본 명세와 원본 해시.

모든 생성 데이터와 원본은 .gitignore 대상이다. GitHub에는 스크립트·설정·테스트·문서만 포함한다. 이 로컬 경로 자체는 백업되지 않으므로 실제 콘텐츠는 후속 단계에서 Supabase에 저장한다.

폴더가 추가되거나 이름이 바뀌면 config/import/blue-archive.json에서 경로와 매핑을 수정한다. 이름이 없는 BA_C_187 행을 채우면 기존 격리 설정이 낡았다는 오류를 내므로 설정을 검토하고 격리 목록에서 제거한다. 새로운 불완전 행은 자동 제외하지 않고 실패 처리한다.

실제 DB import는 이 준비 단계 다음에 연결해야 한다. 트랜잭션 적용, 변경 미리보기, 기존 운영값과 충돌 검사, Storage 업로드 재시도는 아직 구현 전이다.
