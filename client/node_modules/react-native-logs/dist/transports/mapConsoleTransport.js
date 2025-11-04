"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mapConsoleTransport = void 0;
const mapConsoleTransport = (props) => {
    var _a;
    if (!props)
        return false;
    let logMethod = "log";
    if (((_a = props.options) === null || _a === void 0 ? void 0 : _a.mapLevels) && props.options.mapLevels[props.level.text]) {
        logMethod = props.options.mapLevels[props.level.text];
    }
    else {
        logMethod = props.level.text;
    }
    if (console[logMethod]) {
        console[logMethod](props.msg);
    }
    else {
        console.log(props.msg);
    }
    return true;
};
exports.mapConsoleTransport = mapConsoleTransport;
