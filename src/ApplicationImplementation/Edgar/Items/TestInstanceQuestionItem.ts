import { StudentParticipant } from "../Participants/StudentParticipant.js";
import { EdgarItem } from "./EdgarItem.js";

export class TestInstanceQuestionItem extends EdgarItem {
    // questionId
    // score
    // maxScore
    // scorePerc
    // solvedByStudent || testInstanceRef

    constructor(
        id: number,

        public readonly idQuestion: number,

        private readonly idStudent: number,

        private readonly idTestInstance: number,

        private readonly isCorrect: boolean,
        private readonly isIncorrect: boolean,
        private readonly isUnanswered: boolean,
        private readonly isPartial: boolean,

        public readonly score: number,
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
        obj.isCorrect = this.isCorrect ?? false;
        obj.isIncorrect = this.isIncorrect ?? false;
        obj.isUnanswered = this.isUnanswered ?? false;
        obj.isPartial = this.isPartial ?? false;
        obj.score = this.score ?? 0;
        obj.maxScore = this.maxScore ?? 0;
        obj.scorePercentage = this.scorePercentage ?? 0;
    }
}
