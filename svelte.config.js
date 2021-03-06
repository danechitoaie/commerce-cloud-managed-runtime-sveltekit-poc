import preprocess from "svelte-preprocess";
import adapter from "./adapter/mrt.js";

/** @type {import('@sveltejs/kit').Config} */
const config = {
    // Consult https://github.com/sveltejs/svelte-preprocess
    // for more information about preprocessors
    preprocess: preprocess(),

    kit: {
        adapter: adapter(),

        // Override http methods in the Todo forms
        methodOverride: {
            allowed: ["PATCH", "DELETE"],
        },
    },
};

export default config;
