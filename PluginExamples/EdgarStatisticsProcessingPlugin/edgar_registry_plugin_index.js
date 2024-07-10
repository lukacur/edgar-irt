import edgarStatProcDE from './EdgarStatProcDataExtractor.js';

import checkIfCalcNeededJS from './CheckIfCalculationNeededStep.js';
import irtCalcJS from './EdgarIRTCalculationStep.js';
import edgarJudge0StatProcJS from './EdgarJudge0StatProcJobStep.js';
import edgarQuestionClassificationJS from './EdgarQuestionClassificationStep.js';

import edgarStatProcJW from './EdgarStatProcWorker.js';

import edgarStatProcWRP from './EdgarStatProcWorkResultPersistor.js';

import edgarStatProcJRP from './EdgarStatisticsProcessingJobRequestParser.js';

export default [
    edgarStatProcDE,
    checkIfCalcNeededJS,
    irtCalcJS,
    edgarJudge0StatProcJS,
    edgarQuestionClassificationJS,
    edgarStatProcJW,
    edgarStatProcWRP,
    edgarStatProcJRP,
];
