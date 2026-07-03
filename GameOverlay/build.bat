@echo off
setlocal

:: Run from this script's own directory so relative paths (build-x64, vendor\)
:: resolve correctly no matter where the script is invoked from.
cd /d "%~dp0"

:: ?? Locate CMake ?????????????????????????????????????????????????????
:: First try PATH, then fall back to where VS bundles it.
where cmake >nul 2>&1
if %errorlevel% == 0 (
    set CMAKE=cmake
    goto :cmake_found
)

for %%P in (
    "%~dp0tools\cmake\bin\cmake.exe"
    "C:\Program Files\Microsoft Visual Studio\2022\Community\Common7\IDE\CommonExtensions\Microsoft\CMake\CMake\bin\cmake.exe"
    "C:\Program Files\Microsoft Visual Studio\2022\Professional\Common7\IDE\CommonExtensions\Microsoft\CMake\CMake\bin\cmake.exe"
    "C:\Program Files\Microsoft Visual Studio\2022\Enterprise\Common7\IDE\CommonExtensions\Microsoft\CMake\CMake\bin\cmake.exe"
    "C:\Program Files (x86)\Microsoft Visual Studio\2019\Community\Common7\IDE\CommonExtensions\Microsoft\CMake\CMake\bin\cmake.exe"
    "C:\Program Files (x86)\Microsoft Visual Studio\2019\Professional\Common7\IDE\CommonExtensions\Microsoft\CMake\CMake\bin\cmake.exe"
    "C:\Program Files\CMake\bin\cmake.exe"
) do (
    if exist %%P (
        set CMAKE=%%~P
        goto :cmake_found
    )
)

echo ERROR: CMake not found.
echo Install CMake from https://cmake.org/download/ and add it to PATH,
echo or run this script from a Visual Studio Developer Command Prompt.
exit /b 1

:cmake_found
echo [cmake] %CMAKE%

:: ?? Submodule ?????????????????????????????????????????????????????????
echo [1/3] Initializing git submodule (ingame_overlay)...
git submodule update --init --recursive third_party/ingame_overlay
if errorlevel 1 ( echo ERROR: submodule init failed & exit /b 1 )

:: ?? Configure + Build x64 ?????????????????????????????????????????????
:: NOTE: keep error text free of parentheses ? unescaped ( ) inside an
:: `if errorlevel 1 ( ... )` block breaks cmd.exe parsing.
echo [2/5] Configuring CMake x64...
"%CMAKE%" -B build-x64 -G "Visual Studio 17 2022" -A x64 -DGN_ARCH_SUBDIR=x64
if errorlevel 1 ( echo ERROR: cmake configure x64 failed & exit /b 1 )

echo [3/5] Building Release x64...
"%CMAKE%" --build build-x64 --config Release -- /m:1 /p:CL_MPCount=1 /nr:false
if errorlevel 1 ( echo ERROR: build x64 failed & exit /b 1 )

:: ?? Configure + Build x86 [32-bit, for older LAN games] ???????????????
echo [4/5] Configuring CMake x86...
"%CMAKE%" -B build-x86 -G "Visual Studio 17 2022" -A Win32 -DGN_ARCH_SUBDIR=x86
if errorlevel 1 ( echo ERROR: cmake configure x86 failed & exit /b 1 )

echo [5/5] Building Release x86...
"%CMAKE%" --build build-x86 --config Release -- /m:1 /p:CL_MPCount=1 /nr:false
if errorlevel 1 ( echo ERROR: build x86 failed & exit /b 1 )

echo.
echo Done. vendor\overlay\x64\version.dll and vendor\overlay\x86\version.dll are ready.
