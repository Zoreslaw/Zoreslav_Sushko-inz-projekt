import { transportFunctionType } from "../index";
export type CrashlyticsTransportOption = {
    CRASHLYTICS: {
        recordError: (error: Error | string, name?: string) => void;
        log: (msg: string) => void;
    };
    errorLevels?: string | Array<string>;
};
declare const crashlyticsTransport: transportFunctionType<CrashlyticsTransportOption>;
export { crashlyticsTransport };
