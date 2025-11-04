import { transportFunctionType } from "../index";
type ConsoleMethod = "log" | "warn" | "error" | "info" | (string & {});
type LogLevel = string;
export type MapConsoleTransportOptions = {
    mapLevels?: Record<LogLevel, ConsoleMethod>;
};
declare const mapConsoleTransport: transportFunctionType<MapConsoleTransportOptions>;
export { mapConsoleTransport };
