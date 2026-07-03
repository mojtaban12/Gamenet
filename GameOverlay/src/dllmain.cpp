#define WIN32_LEAN_AND_MEAN
#include <windows.h>
#include "overlay.h"
#include "dlog.h"

// Worker that brings up the overlay. Launched from DllMain via Win32
// CreateThread (NOT std::thread): creating a C++ std::thread inside DllMain runs
// while the loader lock is held and can fail to ever start its body. A raw
// CreateThread'd routine reliably runs once DllMain returns and the lock frees.
static DWORD WINAPI OverlayThreadProc(LPVOID) {
    OverlayLog("overlay thread proc entered");
    Overlay::get().init();
    OverlayLog("overlay thread proc exiting");
    return 0;
}

// ── Real version.dll (lazy-loaded from System32) ─────────────────────

static HMODULE GetRealVersion() {
    static HMODULE h = nullptr;
    if (!h)
        h = LoadLibraryExW(L"version.dll", nullptr, LOAD_LIBRARY_SEARCH_SYSTEM32);
    return h;
}

static FARPROC VP(const char* name) {
    HMODULE h = GetRealVersion();
    return h ? GetProcAddress(h, name) : nullptr;
}

// ── Proxy exports ─────────────────────────────────────────────────────
// Each function loads the real function pointer on first call and
// forwards transparently.  extern "C" + .def file ensure no name mangling.

extern "C" BOOL WINAPI GetFileVersionInfoA(LPCSTR a, DWORD b, DWORD c, LPVOID d) {
    static auto fn = (BOOL(WINAPI*)(LPCSTR,DWORD,DWORD,LPVOID))VP("GetFileVersionInfoA");
    return fn ? fn(a,b,c,d) : FALSE;
}
extern "C" BOOL WINAPI GetFileVersionInfoW(LPCWSTR a, DWORD b, DWORD c, LPVOID d) {
    static auto fn = (BOOL(WINAPI*)(LPCWSTR,DWORD,DWORD,LPVOID))VP("GetFileVersionInfoW");
    return fn ? fn(a,b,c,d) : FALSE;
}
extern "C" DWORD WINAPI GetFileVersionInfoSizeA(LPCSTR a, LPDWORD b) {
    static auto fn = (DWORD(WINAPI*)(LPCSTR,LPDWORD))VP("GetFileVersionInfoSizeA");
    return fn ? fn(a,b) : 0;
}
extern "C" DWORD WINAPI GetFileVersionInfoSizeW(LPCWSTR a, LPDWORD b) {
    static auto fn = (DWORD(WINAPI*)(LPCWSTR,LPDWORD))VP("GetFileVersionInfoSizeW");
    return fn ? fn(a,b) : 0;
}
extern "C" BOOL WINAPI GetFileVersionInfoExA(DWORD a, LPCSTR b, DWORD c, DWORD d, LPVOID e) {
    static auto fn = (BOOL(WINAPI*)(DWORD,LPCSTR,DWORD,DWORD,LPVOID))VP("GetFileVersionInfoExA");
    return fn ? fn(a,b,c,d,e) : FALSE;
}
extern "C" BOOL WINAPI GetFileVersionInfoExW(DWORD a, LPCWSTR b, DWORD c, DWORD d, LPVOID e) {
    static auto fn = (BOOL(WINAPI*)(DWORD,LPCWSTR,DWORD,DWORD,LPVOID))VP("GetFileVersionInfoExW");
    return fn ? fn(a,b,c,d,e) : FALSE;
}
extern "C" DWORD WINAPI GetFileVersionInfoSizeExA(DWORD a, LPCSTR b, LPDWORD c) {
    static auto fn = (DWORD(WINAPI*)(DWORD,LPCSTR,LPDWORD))VP("GetFileVersionInfoSizeExA");
    return fn ? fn(a,b,c) : 0;
}
extern "C" DWORD WINAPI GetFileVersionInfoSizeExW(DWORD a, LPCWSTR b, LPDWORD c) {
    static auto fn = (DWORD(WINAPI*)(DWORD,LPCWSTR,LPDWORD))VP("GetFileVersionInfoSizeExW");
    return fn ? fn(a,b,c) : 0;
}
extern "C" DWORD WINAPI VerFindFileA(DWORD a,LPCSTR b,LPCSTR c,LPCSTR d,LPSTR e,PUINT f,LPSTR g,PUINT h_) {
    static auto fn = (DWORD(WINAPI*)(DWORD,LPCSTR,LPCSTR,LPCSTR,LPSTR,PUINT,LPSTR,PUINT))VP("VerFindFileA");
    return fn ? fn(a,b,c,d,e,f,g,h_) : 0;
}
extern "C" DWORD WINAPI VerFindFileW(DWORD a,LPCWSTR b,LPCWSTR c,LPCWSTR d,LPWSTR e,PUINT f,LPWSTR g,PUINT h_) {
    static auto fn = (DWORD(WINAPI*)(DWORD,LPCWSTR,LPCWSTR,LPCWSTR,LPWSTR,PUINT,LPWSTR,PUINT))VP("VerFindFileW");
    return fn ? fn(a,b,c,d,e,f,g,h_) : 0;
}
extern "C" DWORD WINAPI VerInstallFileA(DWORD a,LPCSTR b,LPCSTR c,LPCSTR d,LPCSTR e,LPCSTR f,LPSTR g,PUINT h_) {
    static auto fn = (DWORD(WINAPI*)(DWORD,LPCSTR,LPCSTR,LPCSTR,LPCSTR,LPCSTR,LPSTR,PUINT))VP("VerInstallFileA");
    return fn ? fn(a,b,c,d,e,f,g,h_) : 0;
}
extern "C" DWORD WINAPI VerInstallFileW(DWORD a,LPCWSTR b,LPCWSTR c,LPCWSTR d,LPCWSTR e,LPCWSTR f,LPWSTR g,PUINT h_) {
    static auto fn = (DWORD(WINAPI*)(DWORD,LPCWSTR,LPCWSTR,LPCWSTR,LPCWSTR,LPCWSTR,LPWSTR,PUINT))VP("VerInstallFileW");
    return fn ? fn(a,b,c,d,e,f,g,h_) : 0;
}
extern "C" DWORD WINAPI VerLanguageNameA(DWORD a, LPSTR b, DWORD c) {
    static auto fn = (DWORD(WINAPI*)(DWORD,LPSTR,DWORD))VP("VerLanguageNameA");
    return fn ? fn(a,b,c) : 0;
}
extern "C" DWORD WINAPI VerLanguageNameW(DWORD a, LPWSTR b, DWORD c) {
    static auto fn = (DWORD(WINAPI*)(DWORD,LPWSTR,DWORD))VP("VerLanguageNameW");
    return fn ? fn(a,b,c) : 0;
}
extern "C" BOOL WINAPI VerQueryValueA(LPCVOID a, LPCSTR b, LPVOID* c, PUINT d) {
    static auto fn = (BOOL(WINAPI*)(LPCVOID,LPCSTR,LPVOID*,PUINT))VP("VerQueryValueA");
    return fn ? fn(a,b,c,d) : FALSE;
}
extern "C" BOOL WINAPI VerQueryValueW(LPCVOID a, LPCWSTR b, LPVOID* c, PUINT d) {
    static auto fn = (BOOL(WINAPI*)(LPCVOID,LPCWSTR,LPVOID*,PUINT))VP("VerQueryValueW");
    return fn ? fn(a,b,c,d) : FALSE;
}

// ── DLL Entry ─────────────────────────────────────────────────────────

BOOL WINAPI DllMain(HINSTANCE hInst, DWORD reason, LPVOID) {
    if (reason == DLL_PROCESS_ATTACH) {
        OverlayLog("DllMain DLL_PROCESS_ATTACH (version.dll loaded)");
        DisableThreadLibraryCalls(hInst);
        // Spawn overlay thread; init() starts the pipe client + renderer hook
        HANDLE h = CreateThread(nullptr, 0, OverlayThreadProc, nullptr, 0, nullptr);
        if (h) { OverlayLog("CreateThread ok"); CloseHandle(h); }
        else   { OverlayLog("CreateThread FAILED"); }
    } else if (reason == DLL_PROCESS_DETACH) {
        OverlayLog("DllMain DLL_PROCESS_DETACH (version.dll unloading)");
        Overlay::get().shutdown();
    }
    return TRUE;
}
