export interface WebSocketLike {
    readonly CONNECTING: number;
    readonly OPEN: number;
    readonly CLOSING: number;
    readonly CLOSED: number;
    readonly readyState: number;
    readonly url: string;
    readonly protocol: string;
    close(code?: number, reason?: string): void;
    send(data: string | ArrayBufferLike | Blob | ArrayBufferView): void;
    onopen: ((this: any, ev: Event) => any) | null;
    onmessage: ((this: any, ev: MessageEvent) => any) | null;
    onclose: ((this: any, ev: CloseEvent) => any) | null;
    onerror: ((this: any, ev: Event) => any) | null;
    addEventListener(type: string, listener: EventListener): void;
    removeEventListener(type: string, listener: EventListener): void;
    binaryType?: string;
    bufferedAmount?: number;
    extensions?: string;
    dispatchEvent?: (event: Event) => boolean;
}
export interface WebSocketEnvironment {
    type: 'native' | 'ws' | 'cloudflare' | 'unsupported';
    constructor?: any;
    error?: string;
    workaround?: string;
}
export declare class WebSocketFactory {
    /**
     * Dynamic require that works in both CJS and ESM environments
     * Bulletproof against strict ESM environments where require might not be in scope
     * @private
     */
    private static dynamicRequire;
    private static detectEnvironment;
    static getWebSocketConstructor(): typeof WebSocket;
    static createWebSocket(url: string | URL, protocols?: string | string[]): WebSocketLike;
    static isWebSocketSupported(): boolean;
}
export default WebSocketFactory;
//# sourceMappingURL=websocket-factory.d.ts.map