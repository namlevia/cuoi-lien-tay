@echo off
chcp 65001 >nul
cd /d "%~dp0"
if not exist node_modules (
  echo Lan dau chay: dang cai thu vien, doi 1-2 phut...
  call npm install
)
echo Dang bat game... Dong cua so nay la tat game.
echo Link cho TikTok LIVE Studio: http://lvh.me:3000/?view=stage  (1080 x 1920)
rem Che do live: trang stage khong tu tai lai khi sua code
set LIVE_MODE=1
start "" cmd /c "timeout /t 8 >nul & start http://localhost:3000"
npm run dev
pause
