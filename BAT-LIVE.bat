@echo off
chcp 65001 >nul
cd /d "%~dp0"
if not exist node_modules (
  echo Lan dau chay: dang cai thu vien, doi 1-2 phut...
  call npm install
)
echo Dang bat game... Dong cua so nay la tat game.
echo Game dung cong rieng 3005 (cong ban thi tu doi sang 3006, 3007...).
echo Link cho TikTok LIVE Studio se hien ben duoi va tren trang dieu khien.
rem Che do live: trang stage khong tu tai lai khi sua code
set LIVE_MODE=1
rem Server tu mo trang dieu khien dung cong vua chon
set OPEN_BROWSER=1
npm run dev
pause
