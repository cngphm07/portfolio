@echo off
"C:\Program Files\GitHub CLI\gh.exe" run watch %1 --exit-status >NUL 2>&1
curl -s -o NUL -w "site: %%{http_code}\n" --max-time 30 http://oddpig.io.vn/
