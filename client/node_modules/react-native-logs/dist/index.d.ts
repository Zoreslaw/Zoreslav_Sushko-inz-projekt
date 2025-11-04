/**
 * REACT-NATIVE-LOGS
 * Alessandro Bottamedi - a.bottamedi@me.com
 *
 * Performance-aware simple logger for React-Native with custom levels and transports (colored console, file writing, etc.)
 *
 * MIT license
 *
 * Copyright (c) 2021 Alessandro Bottamedi.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */
/** Import preset transports */
import { consoleTransport } from "./transports/consoleTransport";
import { mapConsoleTransport } from "./transports/mapConsoleTransport";
import { fileAsyncTransport } from "./transports/fileAsyncTransport";
import { sentryTransport } from "./transports/sentryTransport";
import { crashlyticsTransport } from "./transports/crashlyticsTransport";
/** Types Declaration */
type transportFunctionType<T extends object> = (props: {
    msg: string;
    rawMsg: unknown;
    level: {
        severity: number;
        text: string;
    };
    extension?: string | null;
    options?: T;
}) => void;
type levelLogMethodType = (...msgs: any[]) => boolean;
type extendedLogType = {
    [key: string]: levelLogMethodType | any;
};
type ExtractOptions<T> = T extends transportFunctionType<infer U> ? U : never;
type MergeTransportOptions<T> = T extends (infer U)[] ? ExtractOptions<U> : ExtractOptions<T>;
type UnionToIntersection<U> = (U extends any ? (k: U) => void : never) extends (k: infer I extends U) => void ? I : never;
type configLoggerType<T extends transportFunctionType<object> | transportFunctionType<object>[], Level extends string> = {
    severity?: string;
    transport?: T;
    transportOptions?: UnionToIntersection<MergeTransportOptions<T>>;
    levels?: Record<Level, number>;
    async?: boolean;
    asyncFunc?: Function;
    stringifyFunc?: (msg: any) => string;
    formatFunc?: null | ((level: string, extension: string | null, msgs: any) => string);
    dateFormat?: string | ((date: Date) => string);
    printLevel?: boolean;
    printDate?: boolean;
    fixedExtLvlLength?: boolean;
    enabled?: boolean;
    enabledExtensions?: string[] | string | null;
};
type OptionsWithConsoleFunc = {
    consoleFunc?: (msg: string) => void;
};
/** Logger Main Class */
declare class logs<T extends transportFunctionType<OptionsWithConsoleFunc> | transportFunctionType<OptionsWithConsoleFunc>[], K extends string> {
    private _levels;
    private _level;
    private _transport;
    private _transportOptions;
    private _async;
    private _asyncFunc;
    private _stringifyFunc;
    private _formatFunc?;
    private _dateFormat;
    private _printLevel;
    private _printDate;
    private _fixedExtLvlLength;
    private _enabled;
    private _enabledExtensions;
    private _disabledExtensions;
    private _extensions;
    private _extendedLogs;
    private _originalConsole?;
    private _maxLevelsChars;
    private _maxExtensionsChars;
    constructor(config: Required<configLoggerType<T, K>>);
    /** Log messages methods and level filter */
    private _log;
    private _sendToTransport;
    private _stringifyMsg;
    private _formatMsg;
    /** Return true if level is enabled */
    private _isLevelEnabled;
    /** Return true if extension is enabled */
    private _isExtensionEnabled;
    /** Extend logger with a new extension */
    extend: (extension: string) => extendedLogType;
    /** Enable logger or extension */
    enable: (extension?: string) => boolean;
    /** Disable logger or extension */
    disable: (extension?: string) => boolean;
    /** Return all created extensions */
    getExtensions: () => string[];
    /** Set log severity API */
    setSeverity: (level: string) => string;
    /** Get current log severity API */
    getSeverity: () => string;
    /** Monkey Patch global console.log */
    patchConsole: () => void;
}
type defLvlType = "debug" | "info" | "warn" | "error";
declare const logger: {
    createLogger: <K extends transportFunctionType<any> | transportFunctionType<any>[] = transportFunctionType<{
        _def: string;
    }>, Y extends string = "error" | "warn" | "info" | "debug">(config?: configLoggerType<K, Y>) => Omit<logs<K, Y>, "extend"> & { [key in Y]: (...args: unknown[]) => void; } & {
        extend: (extension: string) => { [key in Y]: (...args: unknown[]) => void; };
    };
};
export { logger, consoleTransport, mapConsoleTransport, fileAsyncTransport, sentryTransport, crashlyticsTransport, };
export type { transportFunctionType, configLoggerType, defLvlType };
