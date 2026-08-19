@echo off
for /L %%i in (1,1,6) do (
  timeout /t 90 >NUL 2>&1
  node E:\website\portfolio\debug.js 2>&1 | findstr /C:"subject:" >NUL && echo attempt %%i: CERT OK && exit /b 0
  echo attempt %%i: not yet
)
