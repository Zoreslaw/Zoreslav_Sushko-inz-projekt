import { transportFunctionType } from "../index";
declare const availableColors: {
    readonly default: null;
    readonly black: 30;
    readonly red: 31;
    readonly green: 32;
    readonly yellow: 33;
    readonly blue: 34;
    readonly magenta: 35;
    readonly cyan: 36;
    readonly white: 37;
    readonly grey: 90;
    readonly redBright: 91;
    readonly greenBright: 92;
    readonly yellowBright: 93;
    readonly blueBright: 94;
    readonly magentaBright: 95;
    readonly cyanBright: 96;
    readonly whiteBright: 97;
};
type Color = keyof typeof availableColors;
export type ConsoleTransportOptions = {
    colors?: Record<string, Color>;
    extensionColors?: Record<string, Color>;
    consoleFunc?: (msg: string) => void;
};
declare const consoleTransport: transportFunctionType<ConsoleTransportOptions>;
export { consoleTransport };
