import { createApp } from "./app.js";
import { config } from "./config.js";

const app = createApp();
app.listen(config.port, () => {
  console.log(`FinTrack Pro API → http://localhost:${config.port}`);
});
