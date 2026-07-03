#include "ui.h"
#include <imgui.h>
#include <nlohmann/json.hpp>

// ── Helpers ───────────────────────────────────────────────────────────

static void SendAction(PipeClient& pipe, const nlohmann::json& j) {
    pipe.send(j.dump());
}

static void StylePush() {
    ImGui::PushStyleColor(ImGuiCol_WindowBg,     ImVec4(0.08f, 0.08f, 0.10f, 0.92f));
    ImGui::PushStyleColor(ImGuiCol_TitleBgActive, ImVec4(0.15f, 0.15f, 0.18f, 1.00f));
    ImGui::PushStyleColor(ImGuiCol_Button,        ImVec4(0.20f, 0.20f, 0.25f, 1.00f));
    ImGui::PushStyleColor(ImGuiCol_ButtonHovered, ImVec4(0.30f, 0.30f, 0.38f, 1.00f));
    ImGui::PushStyleColor(ImGuiCol_FrameBg,       ImVec4(0.14f, 0.14f, 0.18f, 1.00f));
    ImGui::PushStyleVar(ImGuiStyleVar_WindowRounding, 8.0f);
    ImGui::PushStyleVar(ImGuiStyleVar_FrameRounding,  4.0f);
    ImGui::PushStyleVar(ImGuiStyleVar_ItemSpacing,    ImVec2(8, 6));
}

static void StylePop() {
    ImGui::PopStyleVar(3);
    ImGui::PopStyleColor(5);
}

// ── draw ─────────────────────────────────────────────────────────────

void UI::draw(const OverlayState& state, char* chatBuf, int chatBufSize, PipeClient& pipe) {
    StylePush();

    ImGui::SetNextWindowSize(ImVec2(320, 0), ImGuiCond_FirstUseEver);
    ImGui::SetNextWindowPos(ImVec2(20, 20), ImGuiCond_FirstUseEver);

    bool open = true;
    if (!ImGui::Begin("GameNet##overlay", &open,
            ImGuiWindowFlags_NoCollapse | ImGuiWindowFlags_AlwaysAutoResize))
    {
        ImGui::End();
        StylePop();
        return;
    }

    if (!open) {
        // User pressed the [×] — tell Electron to hide
        SendAction(pipe, { {"type", "hide"} });
        ImGui::End();
        StylePop();
        return;
    }

    // ── Lobby ──────────────────────────────────────────────────────────
    ImGui::TextColored(ImVec4(0.6f, 0.8f, 1.0f, 1.0f),
        "Lobby (%zu players)", state.members.size());
    ImGui::Separator();

    for (const auto& m : state.members) {
        // Mute button / indicator
        bool muted = m.muted;
        if (m.isSelf) {
            // Self row — no mute toggle, just label
            ImGui::TextColored(ImVec4(0.4f, 1.0f, 0.4f, 1.0f), "[you]");
        } else {
            const char* muteLabel = muted ? "[M]##m" : "[ ]##m";
            ImGui::PushID(m.id.c_str());
            if (ImGui::Button(muteLabel)) {
                SendAction(pipe, {
                    {"type",   "mute"},
                    {"userId", m.id}
                });
            }
            if (ImGui::IsItemHovered())
                ImGui::SetTooltip(muted ? "Unmute" : "Mute");
            ImGui::PopID();
        }

        // Name
        ImGui::SameLine();
        if (muted)
            ImGui::TextDisabled("%s", m.name.c_str());
        else
            ImGui::Text("%s", m.name.c_str());

        // IP + copy button
        ImGui::SameLine();
        ImGui::TextColored(ImVec4(0.5f, 0.6f, 0.7f, 1.0f), "%s", m.ip.c_str());

        if (!m.ip.empty()) {
            ImGui::SameLine();
            ImGui::PushID((m.id + "_copy").c_str());
            if (ImGui::SmallButton("Copy")) {
                ImGui::SetClipboardText(m.ip.c_str());
                SendAction(pipe, {
                    {"type",   "copyIp"},
                    {"userId", m.id},
                    {"ip",     m.ip}
                });
            }
            ImGui::PopID();
        }
    }

    // ── Friends Online ──────────────────────────────────────────────────
    if (!state.friends.empty()) {
        ImGui::Spacing();
        ImGui::TextColored(ImVec4(0.6f, 0.8f, 1.0f, 1.0f),
            "Friends Online (%zu)", state.friends.size());
        ImGui::Separator();
        for (size_t i = 0; i < state.friends.size(); ++i) {
            if (i > 0) ImGui::SameLine();
            ImGui::Text("%s", state.friends[i].c_str());
        }
    }

    // ── Chat ───────────────────────────────────────────────────────────
    ImGui::Spacing();
    ImGui::TextColored(ImVec4(0.6f, 0.8f, 1.0f, 1.0f), "Chat");
    ImGui::Separator();

    ImGui::SetNextItemWidth(-1);
    bool submitted = ImGui::InputText(
        "##chat", chatBuf, chatBufSize,
        ImGuiInputTextFlags_EnterReturnsTrue
    );
    if (submitted && chatBuf[0] != '\0') {
        SendAction(pipe, {
            {"type",    "chat"},
            {"message", std::string(chatBuf)}
        });
        chatBuf[0] = '\0';
        ImGui::SetKeyboardFocusHere(-1);
    }

    ImGui::End();
    StylePop();
}
