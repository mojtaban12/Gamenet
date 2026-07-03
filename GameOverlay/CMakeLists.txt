cmake_minimum_required(VERSION 3.20)
project(GameNetOverlay VERSION 1.0.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# Architecture subfolder under vendor/overlay (x86 | x64). Set per-build by
# build.bat so the 32-bit and 64-bit DLLs don't overwrite each other.
set(GN_ARCH_SUBDIR "x64" CACHE STRING "Output subfolder under vendor/overlay")

# ── Dependencies ──────────────────────────────────────────────────────

include(FetchContent)

FetchContent_Declare(nlohmann_json
    GIT_REPOSITORY https://github.com/nlohmann/json.git
    GIT_TAG        v3.11.3
    GIT_SHALLOW    TRUE
)
FetchContent_MakeAvailable(nlohmann_json)

# ingame_overlay must be cloned as a git submodule:
#   git submodule add https://github.com/Nemirtingas/ingame_overlay third_party/ingame_overlay
add_subdirectory(third_party/ingame_overlay EXCLUDE_FROM_ALL)

# ── GameNetOverlay.dll (output name: version.dll) ─────────────────────

add_library(GameNetOverlay SHARED
    src/dllmain.cpp
    src/overlay.cpp
    src/ui.cpp
    src/pipe_client.cpp
    src/version.def
)

set_target_properties(GameNetOverlay PROPERTIES
    OUTPUT_NAME "version"
    PDB_NAME    "gamenet_overlay"
    # Match ingame_overlay's dynamic CRT (/MD) — build.bat only builds Release
    MSVC_RUNTIME_LIBRARY "MultiThreadedDLL"
    # Release build goes straight into vendor/overlay/<arch> so Electron can ship it
    RUNTIME_OUTPUT_DIRECTORY_RELEASE "${CMAKE_CURRENT_SOURCE_DIR}/../vendor/overlay/${GN_ARCH_SUBDIR}"
    RUNTIME_OUTPUT_DIRECTORY_DEBUG   "${CMAKE_BINARY_DIR}/Debug"
)

target_include_directories(GameNetOverlay PRIVATE src)

# Debug logging to %TEMP%\gamenet-overlay.log (see dlog.h). Keep ON while the
# in-game injection is being brought up; flip OFF (or remove) for shipping.
option(GN_OVERLAY_LOG "Enable DLL debug logging" ON)
if(GN_OVERLAY_LOG)
    target_compile_definitions(GameNetOverlay PRIVATE GN_OVERLAY_LOG)
endif()

target_link_libraries(GameNetOverlay PRIVATE
    ingame_overlay          # target name exported by ingame_overlay's CMakeLists
    nlohmann_json::nlohmann_json
    ws2_32
)
