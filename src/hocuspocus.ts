import { Hocuspocus } from '@hocuspocus/server'

export function createHocuspocus(): Hocuspocus {
  return new Hocuspocus({
    // Lifecycle hooks — add extensions here (e.g. persistence, auth)
    // See: https://tiptap.dev/hocuspocus/server/hooks

    async onConnect() {
      // Called when a client connects
    },

    async onDisconnect() {
      // Called when a client disconnects
    },
  })
}
