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
        obj.id = this.id;
        obj.type = "test_instance_question";
        obj.idQuestion = this.idQuestion;
        obj.idTestInstance = this.idTestInstance;
        obj.idStudent = this.idStudent;
        obj.isCorrect = this.isCorrect;
        obj.isIncorrect = this.isIncorrect;
        obj.isUnanswered = this.isUnanswered;
        obj.isPartial = this.isPartial;
        obj.score = this.score;
        obj.maxScore = this.maxScore;
        obj.scorePercentage = this.scorePercentage;
    }
}
