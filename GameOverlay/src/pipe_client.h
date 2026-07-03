#pragma once
#define WIN32_LEAN_AND_MEAN
#include <windows.h>
#include <string>
#include <atomic>
#include <mutex>
#include <functional>

// Message received from Electron over the named pipe
struct PipeAction {
    std::string type;     // "state" | "toggle" | "show" | "hide"
    std::string userId;   // used by "mute" actions
    std::string ip;
    std::string message;
    std::string rawJson;  // full original JSON — callers parse nested objects themselves
};

class PipeClient {
public:
    // Called from the pipe thread when Electron sends an action
    using ActionCallback = std::function<void(const PipeAction&)>;

    PipeClient();
    ~PipeClient();

    // Blocking: connect -> read/write loop. Returns when DLL is unloading.
    void run(ActionCallback onAction);

    void stop();

    // Thread-safe: queue a JSON message to send to Electron on next loop tick
    void send(const std::string& json);

private:
    bool connect();
    void disconnect();
    void processLine(const std::string& line, ActionCallback& cb);
    bool flushOutgoing();
    bool readAvailable(std::string& lineBuffer);

    HANDLE      _pipe    = INVALID_HANDLE_VALUE;
    std::atomic<bool> _running{ false };

    std::mutex  _outMutex;
    std::string _outgoing;  // pending JSON + '\n' to send
};
