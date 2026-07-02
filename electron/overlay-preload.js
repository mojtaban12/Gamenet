//overlay-preload.js
const { contextBridge, ipcRenderer } = require('electron')

// This preload identifies the window as the overlay window.
// The React app checks for window.overlayElectron to switch rendering.
contextBridge.exposeInMainWorld('overlayElectron', {
    onState:      (cb) => ipcRenderer.on('overlay:state',      (_, s) => cb(s)),
    onVisibility: (cb) => ipcRenderer.on('overlay:visibility', (_, v) => cb(v)),
    sendMessage:  (text) => ipcRenderer.send('overlay:send-message', text),
    voiceAction:  (action, payload) => ipcRenderer.send('overlay:voice-action', { action, payload }),
    close:        () => ipcRenderer.send('overlay:close'),
})
