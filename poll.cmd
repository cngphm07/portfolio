@echo off
setlocal enabledelayedexpansion
for /f "tokens=1" %%r in ('""C:\Program Files\GitHub CLI\gh.exe" run list --workflow=deploy.yml --limit 1 --json databaseId -q .[0].databaseId"') do set RID=%%r
echo watching run !RID!
"C:\Program Files\GitHub CLI\gh.exe" run watch !RID! --exit-status >NUL 2>&1
if %errorlevel%==0 (echo deploy OK) else (echo deploy FAILED)
curl -4 -s -o NUL -w "site: %{http_code}\n" --max-time 30 https://oddpig.io.vn/
