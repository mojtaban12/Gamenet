#pragma once
#include <string>
#include <vector>
#include <mutex>
#include <atomic>
#include <functional>
#include "pipe_client.h"

struct LobbyMember {
    std::string id;
    std::string name;
    std::string ip;
    bool        muted  = false;
    bool        isSelf = false;
};

struct OverlayState {
    std::vector<LobbyMember> members;
    std::vector<std::string> friends;
    std::string selfId;
};

class Overlay {
public:
    static Overlay& get();

    void init();      // called from background thread spawned in DllMain
    void shutdown();  // called from DllMain DLL_PROCESS_DETACH

    // ── Thread-safe state update (called from pipe thread) ────────────
    void setState(const OverlayState& s);

    // ── Visibility request from pipe thread (applied in draw()) ───────
    // 0 = hide, 1 = show, -1 = toggle, INT_MIN = no request
    std::atomic<int> visibilityRequest{ INT_MIN };

    // ── Called from game render thread by ingame_overlay ──────────────
    void draw();

    // ── Outgoing actions back to Electron ─────────────────────────────
    PipeClient pipe;

private:
    Overlay() = default;

    // Dispatches one message received on the pipe thread.
    void handleAction(const PipeAction& action);

    std::mutex    _stateMutex;
    OverlayState  _state;

    bool          _visible  = false;
    void*         _renderer = nullptr;  // InGameOverlay::RendererHook_t* — typed void* to avoid
                                        // including the heavy header in this header
    char          _chatBuf[256]{};
};
