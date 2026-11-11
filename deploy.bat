@echo off
setlocal enabledelayedexpansion
title Nara Store - Auto Deploy ke STB

:: Pindah ke folder root project
cd /d "%~dp0"

:check_ip
if exist .stb_ip (
    set /p STB_IP=<.stb_ip
    set STB_IP=!STB_IP: =!
)

if "%STB_IP%"=="" (
    cls
    echo ===================================================
    echo       SETUP ALAMAT IP STB NARA STORE
    echo ===================================================
    echo.
    set /p STB_IP="Masukkan IP STB kamu (contoh: 192.168.1.100): "
    echo !STB_IP! > .stb_ip
    echo [OK] IP STB berhasil disimpan ke .stb_ip
    timeout /t 2 >nul
)

:menu
cls
echo ===================================================
echo     🚀 NARA STORE - ONE-CLICK DEPLOY KE STB
echo ===================================================
echo Target STB: root@%STB_IP%
echo Direktori : ~/projects/nara-appsV2
echo ===================================================
echo.
echo [1] Deploy FRONTEND Saja  (Build Vite + Upload + Auto-Extract)
echo [2] Deploy BACKEND Saja   (Build TSC + Upload + Auto-Restart PM2)
echo [3] Deploy SEMUANYA       (Frontend + Backend)
echo [4] Ubah Alamat IP STB
echo [5] Keluar
echo.
set /p PILIHAN="Pilih menu [1-5]: "

if "%PILIHAN%"=="1" goto deploy_frontend
if "%PILIHAN%"=="2" goto deploy_backend
if "%PILIHAN%"=="3" goto deploy_all
if "%PILIHAN%"=="4" goto change_ip
if "%PILIHAN%"=="5" goto end
goto menu

:deploy_frontend
cls
echo ===================================================
echo [1/3] 🔨 Memulai Build Frontend (Vite)...
echo ===================================================
call npm.cmd run --prefix frontend build
if %errorlevel% neq 0 (
    echo.
    echo ❌ Gagal build frontend! Periksa error di atas.
    pause
    goto menu
)

echo.
echo ===================================================
echo [2/3] 📦 Membungkus paket frontend...
echo ===================================================
tar.exe -czf frontend.tar.gz -C frontend\dist .

echo.
echo ===================================================
echo [3/3] 🚀 Mengirim & Menerapkan di STB...
echo ===================================================
scp.exe frontend.tar.gz root@%STB_IP%:~/projects/nara-appsV2/
if %errorlevel% neq 0 (
    echo ❌ Gagal mengirim file ke STB via SCP!
    pause
    goto menu
)

ssh.exe root@%STB_IP% "tar -xzf /root/projects/nara-appsV2/frontend.tar.gz -C /var/www/nara-store/ && rm -f /root/projects/nara-appsV2/frontend.tar.gz"
del frontend.tar.gz >nul 2>&1

echo.
echo ===================================================
echo ✅ FRONTEND BERHASIL DI-DEPLOY KE STB!
echo ===================================================
echo Silakan refresh browser (CTRL + F5).
echo.
pause
goto menu

:deploy_backend
cls
echo ===================================================
echo [1/3] 🔨 Memulai Build Backend (TypeScript)...
echo ===================================================
call npm.cmd run --prefix backend build
if %errorlevel% neq 0 (
    echo.
    echo ❌ Gagal build backend! Periksa error di atas.
    pause
    goto menu
)

echo.
echo ===================================================
echo [2/3] 📦 Membungkus paket backend...
echo ===================================================
tar.exe -czf backend.tar.gz -C backend\dist .

echo.
echo ===================================================
echo [3/3] 🚀 Mengirim & Restart PM2 di STB...
echo ===================================================
scp.exe backend.tar.gz root@%STB_IP%:~/projects/nara-appsV2/
if %errorlevel% neq 0 (
    echo ❌ Gagal mengirim file ke STB via SCP!
    pause
    goto menu
)

ssh.exe root@%STB_IP% "cd /root/projects/nara-appsV2/backend && tar -xzf /root/projects/nara-appsV2/backend.tar.gz -C dist/ && rm -f /root/projects/nara-appsV2/backend.tar.gz && pm2 restart nara-backend"
del backend.tar.gz >nul 2>&1

echo.
echo ===================================================
echo ✅ BACKEND BERHASIL DI-DEPLOY & DI-RESTART DI STB!
echo ===================================================
echo.
pause
goto menu

:deploy_all
cls
echo ===================================================
echo [1/4] 🔨 Memulai Build Frontend & Backend...
echo ===================================================
call npm.cmd run --prefix frontend build
if %errorlevel% neq 0 (
    echo ❌ Gagal build frontend!
    pause
    goto menu
)

call npm.cmd run --prefix backend build
if %errorlevel% neq 0 (
    echo ❌ Gagal build backend!
    pause
    goto menu
)

echo.
echo ===================================================
echo [2/4] 📦 Membungkus paket...
echo ===================================================
tar.exe -czf frontend.tar.gz -C frontend\dist .
tar.exe -czf backend.tar.gz -C backend\dist .

echo.
echo ===================================================
echo [3/4] 🚀 Mengirim file ke STB...
echo ===================================================
scp.exe frontend.tar.gz backend.tar.gz root@%STB_IP%:~/projects/nara-appsV2/
if %errorlevel% neq 0 (
    echo ❌ Gagal mengirim file ke STB!
    pause
    goto menu
)

echo.
echo ===================================================
echo [4/4] 🔄 Mengekstrak & Restart PM2 di STB...
echo ===================================================
ssh.exe root@%STB_IP% "tar -xzf /root/projects/nara-appsV2/frontend.tar.gz -C /var/www/nara-store/ && cd /root/projects/nara-appsV2/backend && tar -xzf /root/projects/nara-appsV2/backend.tar.gz -C dist/ && rm -f /root/projects/nara-appsV2/*.tar.gz && pm2 restart nara-backend"
del frontend.tar.gz backend.tar.gz >nul 2>&1

echo.
echo ===================================================
echo 🎉 SELURUH APLIKASI BERHASIL DI-DEPLOY KE STB!
echo ===================================================
echo.
pause
goto menu

:change_ip
cls
echo ===================================================
echo              GANTI ALAMAT IP STB
echo ===================================================
echo IP saat ini: %STB_IP%
echo.
set /p NEW_IP="Masukkan IP STB yang baru: "
if not "%NEW_IP%"=="" (
    set STB_IP=%NEW_IP%
    echo !STB_IP! > .stb_ip
    echo [OK] IP STB berhasil diubah ke: !STB_IP!
)
timeout /t 2 >nul
goto menu

:end
exit /b 0

