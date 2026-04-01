import { Logger } from "@hocuspocus/extension-logger";
import { Hocuspocus } from "@hocuspocus/server";

export function createHocuspocus(): Hocuspocus {
  return new Hocuspocus({
    extensions: [new Logger()],
  });
}
