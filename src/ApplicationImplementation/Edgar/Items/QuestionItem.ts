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

        private readonly idStudent: number,

        private readonly idTestInstance: number,

        private readonly is_correct: boolean,
        private readonly is_incorrect: boolean,
        private readonly is_unanswered: boolean,
        private readonly is_partial: boolean,

        private readonly score: number,
        maxScore: number,
        private readonly score_perc: number,
    ) {
        super(id, maxScore);

        this.participants.push(
            new StudentParticipant(this, idStudent, score, score_perc)
        );
    }
}
