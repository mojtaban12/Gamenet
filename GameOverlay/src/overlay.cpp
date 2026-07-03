#include "overlay.h"
#include "ui.h"
#include "dlog.h"
#include <InGameOverlay/RendererDetector.h>
#include <InGameOverlay/RendererHook.h>
#include <nlohmann/json.hpp>
#include <climits>
#include <thread>

Overlay& Overlay::get() {
    static Overlay instance;
    return instance;
}

// ── init ─────────────────────────────────────────────────────────────
// Called from the background thread spawned in DllMain.
// Blocks until the game exits (pipe client loop exits).

void Overlay::init() {
    using namespace InGameOverlay;
    OverlayLog("Overlay::init thread started");

    // The pipe client runs on its OWN thread, independent of renderer
    // detection. This is critical: DetectRenderer().get() below blocks until
    // the game presents its first frame, and returns null for renderers
    // ingame_overlay can't hook. If the pipe were started only after it (the
    // old behaviour), Electron would never see "DLL connected" when detection
    // is slow or fails — and we'd have no signal that the DLL even loaded.
    // Decoupling guarantees pipe comms come up immediately on injection.
    std::thread([this]() {
        OverlayLog("pipe.run loop starting");
        pipe.run([this](const PipeAction& action) { handleAction(action); });
        OverlayLog("pipe.run loop exited");
    }).detach();

    // Renderer detection + hook on this thread (blocks until the first frame).
    OverlayLog("DetectRenderer: waiting for game to present a frame...");
    RendererHook_t* renderer = DetectRenderer().get();
    if (!renderer) {
        OverlayLog("DetectRenderer: FAILED (null) -- overlay can't draw; pipe still active");
        return;
    }
    OverlayLog("DetectRenderer: success -- starting hook");
    _renderer = renderer;

    renderer->OverlayProc = [this]() { draw(); };
    renderer->StartHook(nullptr, nullptr, 0);
    OverlayLog("Renderer hook started -- overlay ready");
}

// ── handleAction ─────────────────────────────────────────────────────
// Runs on the pipe thread for each message Electron sends.

void Overlay::handleAction(const PipeAction& action) {
    if (action.type == "state") {
        try {
            auto j = nlohmann::json::parse(action.rawJson);
            OverlayState s;
            s.selfId = j.value("selfId", "");
            for (auto& m : j.value("members", nlohmann::json::array())) {
                LobbyMember mb;
                mb.id     = m.value("id",     "");
                mb.name   = m.value("name",   "");
                mb.ip     = m.value("ip",     "");
                mb.muted  = m.value("muted",  false);
                mb.isSelf = (mb.id == s.selfId);
                s.members.push_back(std::move(mb));
            }
            for (auto& f : j.value("friends", nlohmann::json::array()))
                s.friends.push_back(f.get<std::string>());
            setState(s);
        } catch (...) {}
    } else if (action.type == "show") {
        visibilityRequest.store(1);
    } else if (action.type == "hide") {
        visibilityRequest.store(0);
    } else if (action.type == "toggle") {
        visibilityRequest.store(-1);
    }
}

// ── setState ─────────────────────────────────────────────────────────

void Overlay::setState(const OverlayState& s) {
    std::lock_guard<std::mutex> lk(_stateMutex);
    _state = s;
}

// ── shutdown ─────────────────────────────────────────────────────────

void Overlay::shutdown() {
    OverlayLog("Overlay::shutdown");
    pipe.stop();
    InGameOverlay::StopRendererDetection();
    InGameOverlay::FreeDetector();
    _renderer = nullptr;
}

// ── draw ─────────────────────────────────────────────────────────────
// Called every frame from the game's render thread by ingame_overlay.

void Overlay::draw() {
    auto* renderer = static_cast<InGameOverlay::RendererHook_t*>(_renderer);
    if (!renderer) return;

    int req = visibilityRequest.exchange(INT_MIN);
    if (req == 1 && !_visible) {
        _visible = true;
        renderer->HideAppInputs(true);
    } else if (req == 0 && _visible) {
        _visible = false;
        renderer->HideAppInputs(false);
    } else if (req == -1) {
        _visible = !_visible;
        renderer->HideAppInputs(_visible);
    }

    if (!_visible) return;

    OverlayState snapshot;
    {
        std::lock_guard<std::mutex> lk(_stateMutex);
        snapshot = _state;
    }

    UI::draw(snapshot, _chatBuf, sizeof(_chatBuf), pipe);
}
