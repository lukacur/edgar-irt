export class RegistryDefaultConstants {
    public static readonly DEFAULT_DATABASE_CONNECTION_KEY = "DEFAULT_CONNECTION";

    public static readonly jobSteps = {
        URL_INPUT_FETCH: "URLInputFetch",
        INSERT_OBJECT: "InsertObject",
    } as const;
}
