"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.crashlyticsTransport = void 0;
const crashlyticsTransport = (props) => {
    var _a, _b;
    if (!props)
        return false;
    if (!((_a = props === null || props === void 0 ? void 0 : props.options) === null || _a === void 0 ? void 0 : _a.CRASHLYTICS)) {
        throw new Error(`react-native-logs: crashlyticsTransport - No crashlytics instance provided`);
    }
    let isError = false;
    if ((_b = props === null || props === void 0 ? void 0 : props.options) === null || _b === void 0 ? void 0 : _b.errorLevels) {
        isError = false;
        const level = props.level.text;
        const errorLevels = props.options.errorLevels;
        const levelsToCheck = Array.isArray(errorLevels)
            ? errorLevels
            : [errorLevels];
        if (levelsToCheck.includes(level)) {
            isError = true;
        }
    }
    try {
        let msgToRecord = props.msg;
        if (isError) {
            const errorToRecord = msgToRecord instanceof Error
                ? msgToRecord
                : new Error(String(msgToRecord));
            props.options.CRASHLYTICS.recordError(errorToRecord, props.extension || undefined);
        }
        else {
            props.options.CRASHLYTICS.log(String(msgToRecord));
        }
        return true;
    }
    catch (error) {
        throw new Error(`react-native-logs: crashlyticsTransport - Error on send msg to crashlytics: ${error}`);
    }
};
exports.crashlyticsTransport = crashlyticsTransport;
