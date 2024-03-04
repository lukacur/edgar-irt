import { QuestionType } from "./QuestionType.model.js";

export class Question {
    public id: number = null!;
    public question_text: string = null!;

    public id_question_type: number | null = null;
    public question_type_navigation: QuestionType | null = null;
}
