$milo = $PSScriptRoot

Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$milo\backend'; ..\venv\Scripts\python.exe -m uvicorn main:app --reload --host 127.0.0.1 --port 8000"

Start-Sleep 2

Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$milo\frontend-new'; npm run dev"

Start-Sleep 4

Start-Process "http://localhost:3000"
