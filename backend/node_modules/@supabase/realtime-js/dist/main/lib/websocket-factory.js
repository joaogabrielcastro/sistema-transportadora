"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebSocketFactory = void 0;
class WebSocketFactory {
    /**
     * Dynamic require that works in both CJS and ESM environments
     * Bulletproof against strict ESM environments where require might not be in scope
     * @private
     */
    static dynamicRequire(moduleId) {
        try {
            // Check if we're in a Node.js environment first
            if (typeof process !== 'undefined' &&
                process.versions &&
                process.versions.node) {
                // In Node.js, both CJS and ESM support require for dynamic imports
                // Wrap in try/catch to handle strict ESM environments
                if (typeof require !== 'undefined') {
                    return require(moduleId);
                }
            }
            return null;
        }
        catch (_a) {
            // Catches any error from typeof require OR require() call in strict ESM
            return null;
        }
    }
    static detectEnvironment() {
        var _a, _b;
        if (typeof WebSocket !== 'undefined') {
            return { type: 'native', constructor: WebSocket };
        }
        if (typeof globalThis !== 'undefined' &&
            typeof globalThis.WebSocket !== 'undefined') {
            return { type: 'native', constructor: globalThis.WebSocket };
        }
        if (typeof global !== 'undefined' &&
            typeof global.WebSocket !== 'undefined') {
            return { type: 'native', constructor: global.WebSocket };
        }
        if (typeof globalThis !== 'undefined' &&
            typeof globalThis.WebSocketPair !== 'undefined' &&
            typeof globalThis.WebSocket === 'undefined') {
            return {
                type: 'cloudflare',
                error: 'Cloudflare Workers detected. WebSocket clients are not supported in Cloudflare Workers.',
                workaround: 'Use Cloudflare Workers WebSocket API for server-side WebSocket handling, or deploy to a different runtime.',
            };
        }
        if ((typeof globalThis !== 'undefined' && globalThis.EdgeRuntime) ||
            (typeof navigator !== 'undefined' &&
                ((_a = navigator.userAgent) === null || _a === void 0 ? void 0 : _a.includes('Vercel-Edge')))) {
            return {
                type: 'unsupported',
                error: 'Edge runtime detected (Vercel Edge/Netlify Edge). WebSockets are not supported in edge functions.',
                workaround: 'Use serverless functions or a different deployment target for WebSocket functionality.',
            };
        }
        if (typeof process !== 'undefined' &&
            process.versions &&
            process.versions.node) {
            const nodeVersion = parseInt(process.versions.node.split('.')[0]);
            if (nodeVersion >= 22) {
                try {
                    if (typeof globalThis.WebSocket !== 'undefined') {
                        return { type: 'native', constructor: globalThis.WebSocket };
                    }
                    const undici = this.dynamicRequire('undici');
                    if (undici && undici.WebSocket) {
                        return { type: 'native', constructor: undici.WebSocket };
                    }
                    throw new Error('undici not available');
                }
                catch (err) {
                    return {
                        type: 'unsupported',
                        error: `Node.js ${nodeVersion} detected but native WebSocket not found.`,
                        workaround: 'Install the "ws" package or check your Node.js installation.',
                    };
                }
            }
            try {
                // Use dynamic require to work in both CJS and ESM environments
                const ws = this.dynamicRequire('ws');
                if (ws) {
                    return { type: 'ws', constructor: (_b = ws.WebSocket) !== null && _b !== void 0 ? _b : ws };
                }
                throw new Error('ws package not available');
            }
            catch (err) {
                return {
                    type: 'unsupported',
                    error: `Node.js ${nodeVersion} detected without WebSocket support.`,
                    workaround: 'Install the "ws" package: npm install ws',
                };
            }
        }
        return {
            type: 'unsupported',
            error: 'Unknown JavaScript runtime without WebSocket support.',
            workaround: "Ensure you're running in a supported environment (browser, Node.js, Deno) or provide a custom WebSocket implementation.",
        };
    }
    static getWebSocketConstructor() {
        const env = this.detectEnvironment();
        if (env.constructor) {
            return env.constructor;
        }
        let errorMessage = env.error || 'WebSocket not supported in this environment.';
        if (env.workaround) {
            errorMessage += `\n\nSuggested solution: ${env.workaround}`;
        }
        throw new Error(errorMessage);
    }
    static createWebSocket(url, protocols) {
        const WS = this.getWebSocketConstructor();
        return new WS(url, protocols);
    }
    static isWebSocketSupported() {
        try {
            const env = this.detectEnvironment();
            return env.type === 'native' || env.type === 'ws';
        }
        catch (_a) {
            return false;
        }
    }
}
exports.WebSocketFactory = WebSocketFactory;
exports.default = WebSocketFactory;
//# sourceMappingURL=websocket-factory.js.map