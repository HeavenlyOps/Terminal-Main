@echo off
setlocal
cd /d "%~dp0"
title Nusantara - Terminal Saham
echo.
echo Menyiapkan terminal saham lokal...
echo.
if exist ".venv\Scripts\python.exe" goto dependencies
python --version >nul 2>&1
if errorlevel 1 goto python_missing
python -m venv .venv
if errorlevel 1 goto failed

:dependencies
".venv\Scripts\python.exe" -c "import flask, yfinance, curl_cffi" >nul 2>&1
if not errorlevel 1 goto start
".venv\Scripts\python.exe" -m pip install -r requirements.txt
if errorlevel 1 goto failed

:start
echo Browser akan terbuka di http://127.0.0.1:5000
echo Biarkan jendela ini terbuka selama terminal digunakan.
echo Tekan Ctrl+C untuk berhenti.
echo.
".venv\Scripts\python.exe" app.py
if errorlevel 1 goto failed
exit /b 0

:python_missing
echo Python belum ditemukan. Pastikan Python sudah dipasang dan ada di PATH.
pause
exit /b 1

:failed
echo.
echo Terminal belum dapat dijalankan. Kirim pesan error di atas untuk diperiksa.
pause
exit /b 1
