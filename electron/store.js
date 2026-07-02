const path = require('path')
const fs = require('fs')
const os = require('os')

class Store {
    constructor() {
        const { app } = require('electron')
        const userDataPath = app.isPackaged
            ? app.getPath('userData')
            : path.join(os.homedir(), '.targame-dev')

        if (!fs.existsSync(userDataPath)) fs.mkdirSync(userDataPath, { recursive: true })

        this.filePath = path.join(userDataPath, 'config.json')
        this._data = this._load()
    }

    _load() {
        try {
            if (fs.existsSync(this.filePath)) {
                return JSON.parse(fs.readFileSync(this.filePath, 'utf8'))
            }
        } catch { }
        return {}
    }

    _save() {
        fs.writeFileSync(this.filePath, JSON.stringify(this._data, null, 2), 'utf8')
    }

    get(key) {
        return key.split('.').reduce((obj, k) => obj?.[k], this._data)
    }

    set(key, value) {
        const keys = key.split('.')
        let obj = this._data
        for (let i = 0; i < keys.length - 1; i++) {
            if (!obj[keys[i]]) obj[keys[i]] = {}
            obj = obj[keys[i]]
        }
        obj[keys[keys.length - 1]] = value
        this._save()
    }

    delete(key) {
        const keys = key.split('.')
        let obj = this._data
        for (let i = 0; i < keys.length - 1; i++) {
            obj = obj?.[keys[i]]
        }
        if (obj) delete obj[keys[keys.length - 1]]
        this._save()
    }
}

module.exports = Store