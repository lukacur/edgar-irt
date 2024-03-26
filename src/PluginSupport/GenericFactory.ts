export type FactoryDelegate = (...ctorArgs: any[]) => object;

export abstract class GenericFactory {
    public abstract create(...ctorArgs: any[]): object;
}
