#pragma once
#include "overlay.h"
#include "pipe_client.h"

namespace UI {
    void draw(const OverlayState& state, char* chatBuf, int chatBufSize, PipeClient& pipe);
}
