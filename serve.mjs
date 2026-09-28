// Entry point for `npm start` (Railway): serve the built site on $PORT.
import { fileURLToPath } from "node:url";
import { createSiteServer } from "./server.mjs";

const port = Number(process.env.PORT ?? 3000);
const root = fileURLToPath(new URL("./dist", import.meta.url));
createSiteServer(root).listen(port, () => console.log(`Royal Hair serving dist/ on port ${port}`));
