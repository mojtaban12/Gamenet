const { contextBridge, ipcRenderer } = require('electron')

const _appVersion = ipcRenderer.sendSync('app:version-sync')

contextBridge.exposeInMainWorld('electron', {
    appVersion: _appVersion,
    window: {
        minimize:       () => ipcRenderer.send('window:minimize'),
        maximize:       () => ipcRenderer.send('window:maximize'),
        close:          () => ipcRenderer.send('window:close'),
        quit:           () => ipcRenderer.invoke('window:quit'),
        minimizeToTray: () => ipcRenderer.send('window:minimize-tray'),
        onCloseRequest: (cb) => ipcRenderer.on('window:close-request', () => cb()),
        onQuitting:     (cb) => ipcRenderer.on('window:quitting', () => cb()),
        isFocused:      () => ipcRenderer.invoke('window:is-focused'),
    },

    notify: {
        native:    (data) => ipcRenderer.invoke('notify:native', data),
        onClicked: (cb)   => ipcRenderer.on('notif:clicked', () => cb()),
    },

    auth: {
        save:  (data)  => ipcRenderer.invoke('auth:save', data),
        load:  ()      => ipcRenderer.invoke('auth:load'),
        clear: ()      => ipcRenderer.invoke('auth:clear'),
        saveCredentials:  (data) => ipcRenderer.invoke('auth:save-credentials', data),
        loadCredentials:  ()      => ipcRenderer.invoke('auth:load-credentials'),
        clearCredentials: ()    => ipcRenderer.invoke('auth:clear-credentials'),
    },

    netbird: {
        isInstalled:       ()      => ipcRenderer.invoke('netbird:is-installed'),
        install:           ()      => ipcRenderer.invoke('netbird:install'),
        connect:           (opts)  => ipcRenderer.invoke('netbird:connect', opts),
        disconnect:        ()      => ipcRenderer.invoke('netbird:disconnect'),
        reconnect:         ()      => ipcRenderer.invoke('netbird:reconnect'),
        watch:             ()      => ipcRenderer.invoke('netbird:watch'),
        uninstall:         ()      => ipcRenderer.invoke('netbird:uninstall'),
        status:            ()      => ipcRenderer.invoke('netbird:status'),
        onInstallProgress: (cb)    => ipcRenderer.on('netbird:install-progress', (_, d) => cb(d)),
        onInstallRequired: (cb)    => ipcRenderer.on('netbird:install-required', () => cb()),
        onStatus:          (cb)    => ipcRenderer.on('netbird:status', (_, d) => cb(d)),
    },

    settings: {
        get: (key)        => ipcRenderer.invoke('settings:get', key),
        set: (key, value) => ipcRenderer.invoke('settings:set', key, value),
    },

    shortcut: {
        get: (name)              => ipcRenderer.invoke('shortcut:get', name),
        set: (name, accelerator) => ipcRenderer.invoke('shortcut:set', name, accelerator),
        onOverlayToggled: (cb)   => ipcRenderer.on('overlay:toggled', (_, v) => cb(v)),
        closeOverlay:     ()     => ipcRenderer.send('overlay:closed'),
        onGlobalToggleMic: (cb) => {
            const listener = () => cb()
            ipcRenderer.on('voice:global-toggle-mic', listener)
            return () => ipcRenderer.removeListener('voice:global-toggle-mic', listener)
        },
    },

    tinc: {
        isInstalled: ()         => ipcRenderer.invoke('tinc:is-installed'),
        install:     ()         => ipcRenderer.invoke('tinc:install'),
        applyConfig: (zipB64)   => ipcRenderer.invoke('tinc:apply-config', zipB64),
        updateConfig:(zipB64)   => ipcRenderer.invoke('tinc:update-config', zipB64),
        stop:        ()         => ipcRenderer.invoke('tinc:stop'),
        hardReset:   ()         => ipcRenderer.invoke('tinc:hard-reset'),
        status:      ()         => ipcRenderer.invoke('tinc:status'),
        onHardResetDone: (cb) => {
            const listener = (_, result) => cb(result)
            ipcRenderer.on('tinc:hard-reset-done', listener)
            return () => ipcRenderer.removeListener('tinc:hard-reset-done', listener)
        },
    },

    games: {
        isInstalled:     (gameInfo) => ipcRenderer.invoke('games:is-installed', gameInfo),
        isRunning:       (gameInfo) => ipcRenderer.invoke('games:is-running', gameInfo),
        isRunningByName: (exeName)  => ipcRenderer.invoke('games:is-running-by-name', exeName),
        getActive:       ()         => ipcRenderer.invoke('games:get-active'),
        clearActive:     ()         => ipcRenderer.invoke('games:clear-active'),
        getIcon:         (gameInfo) => ipcRenderer.invoke('games:get-icon', gameInfo),
        getMetaBatch:    (gameInfos) => ipcRenderer.invoke('games:get-meta-batch', gameInfos),
        launch:          (gameInfo) => ipcRenderer.invoke('games:launch', gameInfo),
        pickExe:         ()                 => ipcRenderer.invoke('games:pick-exe'),
        setOverride:     (gameId, exePath)  => ipcRenderer.invoke('games:set-override', gameId, exePath),
        addCustom:       (name, exePath)    => ipcRenderer.invoke('games:add-custom', name, exePath),
        getCustom:       ()                 => ipcRenderer.invoke('games:get-custom'),
        removeCustom:    (gameId)           => ipcRenderer.invoke('games:remove-custom', gameId),
        updateCustom:    (gameId, exePath, name) => ipcRenderer.invoke('games:update-custom', gameId, exePath, name),
        // Event-driven exit notification (fires once, right when the OS actually
        // tears down the launched game's process — see games.js/ipc.js).
        onExited:        (cb) => {
            const listener = (_, data) => cb(data)
            ipcRenderer.on('games:exited', listener)
            return () => ipcRenderer.removeListener('games:exited', listener)
        },
    },

    openExternal: (url) => ipcRenderer.invoke('shell:open-external', url),

    overlay: {
        updateState: (state) => ipcRenderer.send('overlay:state-update', state),
        onIncomingMessage: (cb) => {
            const listener = (_, text) => cb(text)
            ipcRenderer.on('overlay:incoming-message', listener)
            return () => ipcRenderer.removeListener('overlay:incoming-message', listener)
        },
        onIncomingVoiceAction: (cb) => {
            const listener = (_, data) => cb(data)
            ipcRenderer.on('overlay:incoming-voice-action', listener)
            return () => ipcRenderer.removeListener('overlay:incoming-voice-action', listener)
        },
        attach: (windowTitle) => ipcRenderer.send('overlay:attach', windowTitle),
        onAction: (cb) => {
            const listener = (_, action) => cb(action)
            ipcRenderer.on('overlay:action', listener)
            return () => ipcRenderer.removeListener('overlay:action', listener)
        },
    },

    update: {
        onAvailable:    (cb) => ipcRenderer.on('update:available',     (_, info) => cb(info)),
        onProgress:     (cb) => ipcRenderer.on('update:progress',      (_, p)    => cb(p)),
        onDownloaded:   (cb) => ipcRenderer.on('update:downloaded',    (_, info) => cb(info)),
        onNotAvailable: (cb) => ipcRenderer.on('update:not-available', ()        => cb()),
        install:  ()  => ipcRenderer.send('update:install'),
        download: ()  => ipcRenderer.send('update:download'),
        serverPush:      (updates) => ipcRenderer.send('update:server-push', updates),
        onError:        (cb)      => ipcRenderer.on('update:error', (_, e) => cb(e)),
    },

    obs: {
        connect:      (opts) => ipcRenderer.invoke('obs:connect', opts),
        disconnect:   ()     => ipcRenderer.invoke('obs:disconnect'),
        status:       ()     => ipcRenderer.invoke('obs:status'),
        setupScene:   (opts) => ipcRenderer.invoke('obs:setup-scene', opts),
        startStream:  (opts) => ipcRenderer.invoke('obs:start-stream', opts),
        stopStream:   ()     => ipcRenderer.invoke('obs:stop-stream'),
    }
})