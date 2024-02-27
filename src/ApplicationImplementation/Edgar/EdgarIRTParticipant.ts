import { AbstractItemParticipant } from "../../ApplicationModel/Participant/AbstractItemParticipant.js";

export class EdgarIRTParticipant extends AbstractItemParticipant {
    public getScore(): number {
        throw new Error("Method not implemented.");
    }
    public identify(): string {
        throw new Error("Method not implemented.");
    }
    public getScorePercentage(): Promise<number> {
        throw new Error("Method not implemented.");
    }
    public clone(newScore: number): Promise<AbstractItemParticipant> {
        throw new Error("Method not implemented.");
    }
}
