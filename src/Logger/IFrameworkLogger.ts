export type CtorType = abstract new(...args: any[]) => any;

export interface IFrameworkLogger {
    debug(ctor: CtorType, message: string, ...optionalData: any[]): void;
    info(ctor: CtorType, message: string, ...optionalData: any[]): void;
    warn(ctor: CtorType, message: string, ...optionalData: any[]): void;
    error(ctor: CtorType, message: string, ...optionalData: any[]): void;
}
