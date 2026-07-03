#include "pipe_client.h"
#include <nlohmann/json.hpp>

static constexpr wchar_t PIPE_NAME[] = L"\\\\.\\pipe\\gamenet-overlay";
static constexpr DWORD   CONNECT_RETRY_MS = 2000;
static constexpr DWORD   LOOP_SLEEP_MS    = 10;

PipeClient::PipeClient() = default;

PipeClient::~PipeClient() {
    stop();
}

void PipeClient::run(ActionCallback onAction) {
    _running = true;
    std::string lineBuffer;

    while (_running) {
        // ── Connect ─────────────────────────────────────────────────
        if (_pipe == INVALID_HANDLE_VALUE) {
            if (!connect()) {
                Sleep(CONNECT_RETRY_MS);
                continue;
            }
            lineBuffer.clear();
        }

        // ── Flush outgoing ──────────────────────────────────────────
        if (!flushOutgoing()) {
            disconnect();
            continue;
        }

        // ── Read incoming (non-blocking via PeekNamedPipe) ──────────
        if (!readAvailable(lineBuffer)) {
            disconnect();
            continue;
        }

        // ── Process complete lines ──────────────────────────────────
        size_t pos;
        while ((pos = lineBuffer.find('\n')) != std::string::npos) {
            std::string line = lineBuffer.substr(0, pos);
            lineBuffer = lineBuffer.substr(pos + 1);
            if (!line.empty())
                processLine(line, onAction);
        }

        Sleep(LOOP_SLEEP_MS);
    }

    disconnect();
}

void PipeClient::stop() {
    _running = false;
}

void PipeClient::send(const std::string& json) {
    std::lock_guard<std::mutex> lk(_outMutex);
    _outgoing = json + "\n";
}

bool PipeClient::connect() {
    // Wait for the server (Electron) to be ready
    if (!WaitNamedPipeW(PIPE_NAME, CONNECT_RETRY_MS))
        return false;

    _pipe = CreateFileW(
        PIPE_NAME,
        GENERIC_READ | GENERIC_WRITE,
        0, nullptr,
        OPEN_EXISTING,
        0, nullptr
    );
    if (_pipe == INVALID_HANDLE_VALUE)
        return false;

    // Switch to byte-stream mode
    DWORD mode = PIPE_READMODE_BYTE;
    if (!SetNamedPipeHandleState(_pipe, &mode, nullptr, nullptr)) {
        disconnect();
        return false;
    }
    return true;
}

void PipeClient::disconnect() {
    if (_pipe != INVALID_HANDLE_VALUE) {
        CloseHandle(_pipe);
        _pipe = INVALID_HANDLE_VALUE;
    }
}

bool PipeClient::flushOutgoing() {
    std::string msg;
    {
        std::lock_guard<std::mutex> lk(_outMutex);
        if (_outgoing.empty()) return true;
        msg = std::move(_outgoing);
        _outgoing.clear();
    }
    DWORD written = 0;
    return WriteFile(_pipe, msg.c_str(), static_cast<DWORD>(msg.size()), &written, nullptr) != 0;
}

bool PipeClient::readAvailable(std::string& lineBuffer) {
    DWORD available = 0;
    if (!PeekNamedPipe(_pipe, nullptr, 0, nullptr, &available, nullptr)) {
        DWORD err = GetLastError();
        // Broken pipe is normal when game exits
        return err == ERROR_NO_DATA;
    }
    if (available == 0) return true; // nothing to read yet

    char buf[4096];
    DWORD read = 0;
    DWORD toRead = min(available, static_cast<DWORD>(sizeof(buf) - 1));
    if (!ReadFile(_pipe, buf, toRead, &read, nullptr)) return false;
    buf[read] = '\0';
    lineBuffer.append(buf, read);
    return true;
}

void PipeClient::processLine(const std::string& line, ActionCallback& cb) {
    try {
        auto j = nlohmann::json::parse(line);
        PipeAction a;
        a.rawJson = line;
        a.type    = j.value("type", "");
        if (j.contains("userId"))  a.userId  = j["userId"].get<std::string>();
        if (j.contains("ip"))      a.ip      = j["ip"].get<std::string>();
        if (j.contains("message")) a.message = j["message"].get<std::string>();
        cb(a);
    } catch (...) {
        // malformed JSON — ignore
    }
}
