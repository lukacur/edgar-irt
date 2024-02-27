import { AbstractItemParticipant } from "../../../ApplicationModel/Participant/AbstractItemParticipant.js";
import { EdgarItemParticipant } from "./EdgarItemParticipant.js";

export class StudentParticipant extends EdgarItemParticipant<number> {
    public identify(): string {
        throw new Error("Method not implemented.");
    }

    public clone(newScore: number): Promise<AbstractItemParticipant> {
        throw new Error("Method not implemented.");
    }
}
