import { StudentParticipant } from "../Participants/StudentParticipant.js";
import { EdgarItem } from "./EdgarItem.js";

export class QuestionItem extends EdgarItem {
    // questionId
    // score
    // maxScore
    // scorePerc
    // solvedByStudent || testInstanceRef

    constructor(
        id: number,

        private readonly idQuestion: number,

        private readonly idStudent: number,

        private readonly idTestInstance: number,

        private readonly isCorrect: boolean,
        private readonly isIncorrect: boolean,
        private readonly isUnanswered: boolean,
        private readonly isPartial: boolean,

        private readonly score: number,
        maxScore: number,
        private readonly scorePercentage: number,
    ) {
        super(id, maxScore);

        this.participants.push(
            new StudentParticipant(this, this.idStudent, this.score, this.scorePercentage)
        );
    }

    getId(): number {
        return this.id;
    }

    async serializeInto(obj: any): Promise<void> {
        const questionInfo = {
            id: this.id,

            idQuestion: this.idQuestion,

            idTestInstance: this.idTestInstance,
            idStudent: this.idStudent,

            isCorrect: this.isCorrect,
            isIncorrect: this.isIncorrect,
            isUnanswered: this.isUnanswered,
            isPartial: this.isPartial,

            score: this.score,
            maxScore: this.maxScore,
            scorePercentage: this.scorePercentage,
        };

        obj.question = questionInfo;
    }
}
