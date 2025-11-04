"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.consoleTransport = void 0;
const availableColors = {
    default: null,
    black: 30,
    red: 31,
    green: 32,
    yellow: 33,
    blue: 34,
    magenta: 35,
    cyan: 36,
    white: 37,
    grey: 90,
    redBright: 91,
    greenBright: 92,
    yellowBright: 93,
    blueBright: 94,
    magentaBright: 95,
    cyanBright: 96,
    whiteBright: 97,
};
const resetColors = "\x1b[0m";
const consoleTransport = (props) => {
    var _a, _b, _c;
    if (!props)
        return false;
    let msg = props.msg;
    let color;
    if (((_a = props.options) === null || _a === void 0 ? void 0 : _a.colors) &&
        props.options.colors[props.level.text] &&
        availableColors[props.options.colors[props.level.text]]) {
        color = `\x1b[${availableColors[props.options.colors[props.level.text]]}m`;
        msg = `${color}${msg}${resetColors}`;
    }
    if (props.extension && ((_b = props.options) === null || _b === void 0 ? void 0 : _b.extensionColors)) {
        let extensionColor = "\x1b[7m";
        const extColor = props.options.extensionColors[props.extension];
        if (extColor && availableColors[extColor]) {
            extensionColor = `\x1b[${availableColors[extColor] + 10}m`;
        }
        let extStart = color ? resetColors + extensionColor : extensionColor;
        let extEnd = color ? resetColors + color : resetColors;
        msg = msg.replace(props.extension, `${extStart} ${props.extension} ${extEnd}`);
    }
    if ((_c = props.options) === null || _c === void 0 ? void 0 : _c.consoleFunc) {
        props.options.consoleFunc(msg.trim());
    }
    else {
        console.log(msg.trim());
    }
    return true;
};
exports.consoleTransport = consoleTransport;
