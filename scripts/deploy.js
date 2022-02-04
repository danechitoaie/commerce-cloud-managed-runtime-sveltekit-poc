import path from "path";
import fs from "fs-extra";
import task from "tasuku";
import yargs from "yargs";
import fetch from "cross-fetch";
import tar from "tar";
import globby from "globby";
import { createRequire } from "module";

const require = createRequire(import.meta.url);

async function run() {
    await task("Creating [loader.js]...", async () => {
        const file = path.resolve("build", "loader.js");
        await fs.writeFile(file, "/* ¯\\_(ツ)_/¯ */\n");
    });

    await task("Creating [dist/build.tar]...", async () => {
        const pkg = require("../package.json");
        const file = path.resolve("build.tar");
        const prefix = `${pkg.name}/bld`;
        const cwd = path.resolve("build");

        if (fs.existsSync(file)) {
            fs.removeSync(file);
        }

        const fileList = await globby(["**/*"], { cwd, dot: true });
        await tar.create({ file, prefix, cwd }, fileList);
    });

    await task("Deploying build...", async ({ setOutput, setError }) => {
        const file = path.resolve("build.tar");
        if (!fs.existsSync(file)) {
            setError(`${file} does not exist! Please make sure you run "npm run build" first!`);
            return;
        }

        await new Promise((resolve, reject) => {
            yargs(process.argv)
                .usage("Usage: $0 [options]")
                .option("username", { type: "string", description: "Username", demandOption: true })
                .option("apiKey", { type: "string", description: "API Key", demandOption: true })
                .option("message", { type: "string", description: "Message", demandOption: true })
                .help()
                .parse(process.argv, async (yargsErr, argv, output) => {
                    if (yargsErr) {
                        reject(yargsErr);
                        return;
                    }

                    if (output) {
                        reject(output);
                        return;
                    }

                    const pkg = require("../package.json");
                    const url = `https://cloud.mobify.com/api/projects/${encodeURIComponent(pkg.name)}/builds/`;

                    const { username, apiKey } = argv;

                    const data = await fs.promises.readFile(file);
                    const b64Data = data.toString("base64");

                    const cwd = path.resolve("build");
                    const ssrOnlyFileList = await globby(["**/*"], { cwd, dot: true });
                    const ssrSharedFileList = await globby(["client/**/*", "prerendered/**/*", "static/**/*"], { cwd, dot: true });

                    const body = JSON.stringify({
                        message: argv.message,
                        encoding: "base64",
                        data: b64Data,
                        ssr_parameters: { ssrFunctionNodeVersion: pkg.commerceCloudRuntime.ssrFunctionNodeVersion },
                        ssr_only: ssrOnlyFileList,
                        ssr_shared: ssrSharedFileList,
                    });

                    try {
                        const res = await fetch(url, {
                            method: "POST",
                            headers: {
                                authorization: `Basic ${Buffer.from(`${username}:${apiKey}`).toString("base64")}`,
                                "content-type": "application/json",
                                "content-length": body.length.toString(),
                                "user-agent": "progressive-web-sdk#0.3.46",
                            },
                            body,
                        });

                        if (res.status === 401) {
                            const message = await res.text();
                            reject(message);
                            return;
                        }

                        const { message } = await res.json();

                        if (res.ok) {
                            resolve(message);
                        } else {
                            reject(message);
                        }
                    } catch (fetchErr) {
                        reject(fetchErr);
                    }
                });
        })
            .then((output) => {
                setOutput(output);
            })
            .catch((output) => {
                setError(output);
            });
    });
}

run();
