import { transportFunctionType } from "../index";
type SentryTransportOptions = {
    SENTRY: {
        captureException: (msg: string | typeof Error) => void;
        addBreadcrumb: (msg: string | {
            message: string;
        }) => void;
    };
    errorLevels?: string | Array<string>;
};
declare const sentryTransport: transportFunctionType<SentryTransportOptions>;
export { sentryTransport };
