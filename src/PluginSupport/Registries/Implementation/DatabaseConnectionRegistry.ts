import { DatabaseConnection } from "../../../ApplicationModel/Database/DatabaseConnection.js";
import { GenericRegistry } from "../GenericRegistry.js";

export class DatabaseConnectionRegistry extends GenericRegistry {
    //#region SingletonHandling
    public static readonly instance = new DatabaseConnectionRegistry();
    //#endregion

    private constructor() { super(); }

    public override getItem<TReturnObject extends object = DatabaseConnection>(
        ieType: string,
        ...args: any[]
    ): TReturnObject | null {
        return <TReturnObject>super.getItem(ieType, ...args);
    }
}
