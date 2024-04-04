export class ArraysUtil {
    private constructor() {}

    public static populateArray<TMember>(
        base?: TMember[],
        populateWithIfEmpty?: TMember[],
        append?: TMember[],
    ): TMember[] {
        const arr = base ?? [];
        if (arr.length === 0) {
            arr.push(...(populateWithIfEmpty ?? []));
        }

        arr.push(...(append ?? []));

        return arr;
    }
}
