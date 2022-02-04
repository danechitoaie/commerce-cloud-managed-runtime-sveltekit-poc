import "./shims.js";
import fs from "fs";
import path from "path";
import sirv from "sirv";
import { getRequest, setResponse } from "@sveltejs/kit/node";
import { App } from "APP";
import { manifest } from "MANIFEST";
import awsServerlessExpress from "aws-serverless-express";
import express from "express";
// import compression from "compression";

/* global ORIGIN, PROTOCOL_HEADER, HOST_HEADER */

const app = new App(manifest);
const origin = ORIGIN;
const protocol_header = PROTOCOL_HEADER && process.env[PROTOCOL_HEADER];
const host_header = (HOST_HEADER && process.env[HOST_HEADER]) || "host";

/**
 * @param {string} path
 * @param {number} max_age
 * @param {boolean} immutable
 */
function serve(path, max_age, immutable = false) {
    return (
        fs.existsSync(path) &&
        sirv(path, {
            etag: true,
            maxAge: max_age,
            immutable,
            gzip: true,
            brotli: true,
        })
    );
}

/** @type {import('polka').Middleware} */
const ssr = async (req, res) => {
    let request;

    try {
        request = await getRequest(origin || get_origin(req.headers), req);
    } catch (err) {
        res.statusCode = err.status || 400;
        return res.end(err.reason || "Invalid request body");
    }

    setResponse(res, await app.render(request));
};

/** @param {import('polka').Middleware[]} handlers */
function sequence(handlers) {
    /** @type {import('polka').Middleware} */
    return (req, res, next) => {
        /** @param {number} i */
        function handle(i) {
            handlers[i](req, res, () => {
                if (i < handlers.length) handle(i + 1);
                else next();
            });
        }

        handle(0);
    };
}

/**
 * @param {import('http').IncomingHttpHeaders} headers
 * @returns
 */
function get_origin(headers) {
    const protocol = (protocol_header && headers[protocol_header]) || "https";
    const host = headers[host_header];
    return `${protocol}://${host}`;
}

const handler = sequence(
    [
        serve(path.join(__dirname, "/client"), 31536000, true),
        serve(path.join(__dirname, "/static"), 0),
        serve(path.join(__dirname, "/prerendered"), 0),
        ssr,
    ].filter(Boolean)
);

const expressApp = express();
// expressApp.use(compression());
expressApp.use(handler);

const server = awsServerlessExpress.createServer(expressApp);
export function get(event, context) {
    awsServerlessExpress.proxy(server, event, context);
}
