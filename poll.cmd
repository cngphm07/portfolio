@echo off
for /L %%i in (1,1,5) do (
  timeout /t 120 >NUL 2>&1
  curl -s -o NUL -w "attempt %%i: %%{http_code}\n" --max-time 20 https://oddpig.io.vn/
)
