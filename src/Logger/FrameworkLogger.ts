import { CtorType, IFrameworkLogger } from "./IFrameworkLogger.js";

class ConsoleFrameworkLogger implements IFrameworkLogger {
    public debug(ctor: CtorType, message: string, ...optionalData: any[]): void {
        console.debug(`[DEBUG] ${ctor.name}: ${message}`, ...optionalData);
    }

    public info(ctor: CtorType, message: string, ...optionalData: any[]): void {
        console.info(`[INFO] ${ctor.name}: ${message}`, ...optionalData);
    }
    
    public warn(ctor: CtorType, message: string, ...optionalData: any[]): void {
        console.warn(`[WARN] ${ctor.name}: ${message}`, ...optionalData);
    }
    
    public error(ctor: CtorType, message: string, ...optionalData: any[]): void {
        console.error(`[ERROR] ${ctor.name}: ${message}`, ...optionalData);
    }
    
}

export abstract class FrameworkLogger {
    private static instance: IFrameworkLogger = new ConsoleFrameworkLogger();

    private constructor() {}

    public static useLogger(logger: IFrameworkLogger): void {
        FrameworkLogger.instance = logger;
    }

    public static debug(ctor: CtorType, message: string, ...optionalData: any[]): void {
        FrameworkLogger.instance.debug(ctor, message, ...optionalData);
    }

    public static info(ctor: CtorType, message: string, ...optionalData: any[]): void {
        FrameworkLogger.instance.info(ctor, message, ...optionalData);
    }

    public static warn(ctor: CtorType, message: string, ...optionalData: any[]): void {
        FrameworkLogger.instance.warn(ctor, message, ...optionalData);
    }

    public static error(ctor: CtorType, message: string, ...optionalData: any[]): void {
        FrameworkLogger.instance.error(ctor, message, ...optionalData);
    }
}
