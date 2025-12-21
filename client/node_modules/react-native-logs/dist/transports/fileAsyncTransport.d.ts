import { transportFunctionType } from "../index";
export interface FileAsyncTransportOptions {
    fileNameDateType?: "eu" | "us" | "iso";
    FS: any;
    fileName?: string;
    filePath?: string;
}
declare const fileAsyncTransport: transportFunctionType<FileAsyncTransportOptions>;
export { fileAsyncTransport };
