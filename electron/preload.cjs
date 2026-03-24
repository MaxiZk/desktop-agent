const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electron', {
  ipcRenderer: {
    on(channel, func) {
      const validChannels = ['ollama-status', 'shortcut-new-chat', 'shortcut-voice-input'];
      if (validChannels.includes(channel)) {
        // Deliberately strip event as it includes `sender`
        ipcRenderer.on(channel, (event, ...args) => func(...args));
      }
    },
    removeListener(channel, func) {
      const validChannels = ['ollama-status', 'shortcut-new-chat', 'shortcut-voice-input'];
      if (validChannels.includes(channel)) {
        ipcRenderer.removeListener(channel, func);
      }
    },
    invoke(channel, ...args) {
      const validChannels = ['speak', 'speak-stop'];
      if (validChannels.includes(channel)) {
        return ipcRenderer.invoke(channel, ...args);
      }
      return Promise.reject(new Error(`Invalid channel: ${channel}`));
    },
  },
});
