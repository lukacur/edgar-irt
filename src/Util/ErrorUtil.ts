export class ErrorUtil {
    private constructor() {}

    public static getErrorDetailedInfo(error: any, tabSize?: number): string {
        const msg: string =
        (error instanceof Error) ?
            `Error: ${error.name}
Message: ${error.message}
Trace: ${error.stack ?? "-"}` :
        (
            ("toString" in error) ?
                error.toString() :
                "Unparsable unknown error"
        );

        if (tabSize) {
            return " ".repeat(tabSize) + msg.split("\n").join("\n" + " ".repeat(tabSize));
        }

        return msg;
    }
}
