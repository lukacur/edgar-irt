export class QueueClosedException extends Error {
    constructor(msg?: string) {
        super(msg);
    }
}
