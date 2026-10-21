import type { D1Migration } from "cloudflare:test";
import type { Env as EnvWorker } from "../src/env";

declare global {
  namespace Cloudflare {
    interface Env extends EnvWorker {
      TEST_MIGRATIONS: D1Migration[];
    }
  }
}
