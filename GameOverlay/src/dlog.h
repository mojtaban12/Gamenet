#pragma once
// Lightweight debug logger for the injected DLL.
// We have no console inside the game process, so lifecycle events are written
// to %TEMP%\gamenet-overlay.log. Multiple processes (launcher + game) may load
// the DLL and append concurrently — each line is small and prefixed with PID,
// so interleaving is acceptable for diagnostics.
//
// Enabled whenever GN_OVERLAY_LOG is defined (build.bat defines it). Compiles
// to nothing otherwise, so shipping builds carry no logging overhead.

#define WIN32_LEAN_AND_MEAN
#include <windows.h>
#include <cstdio>

#ifdef GN_OVERLAY_LOG
inline void OverlayLog(const char* msg) {
    char dir[MAX_PATH];
    DWORD n = GetTempPathA(MAX_PATH, dir);
    if (n == 0 || n > MAX_PATH) return;

    char path[MAX_PATH * 2];
    _snprintf_s(path, sizeof(path), _TRUNCATE, "%s%s", dir, "gamenet-overlay.log");

    // Open shared-append so concurrent processes don't lock each other out.
    HANDLE h = CreateFileA(path, FILE_APPEND_DATA,
                           FILE_SHARE_READ | FILE_SHARE_WRITE, nullptr,
                           OPEN_ALWAYS, FILE_ATTRIBUTE_NORMAL, nullptr);
    if (h == INVALID_HANDLE_VALUE) return;

    SYSTEMTIME st;
    GetLocalTime(&st);
    char exe[MAX_PATH];
    GetModuleFileNameA(nullptr, exe, MAX_PATH);
    const char* base = strrchr(exe, '\\');
    base = base ? base + 1 : exe;

    char line[MAX_PATH * 3];
    int len = _snprintf_s(line, sizeof(line), _TRUNCATE,
                          "[%02d:%02d:%02d.%03d] pid=%lu %-16s | %s\r\n",
                          st.wHour, st.wMinute, st.wSecond, st.wMilliseconds,
                          GetCurrentProcessId(), base, msg);
    if (len > 0) {
        SetFilePointer(h, 0, nullptr, FILE_END);
        DWORD written = 0;
        WriteFile(h, line, (DWORD)len, &written, nullptr);
    }
    CloseHandle(h);
}
#else
inline void OverlayLog(const char*) {}
#endif
