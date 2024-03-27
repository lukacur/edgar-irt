export type FactoryDelegate = (...ctorArgs: any[]) => object;

export interface GenericFactory {
    create(...ctorArgs: any[]): object;
}
