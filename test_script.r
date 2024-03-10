library(jsonlite)
library(purrr)

pipe_it <- NULL
"%|%" <- function(lhs, rhs) {
  pipe_it <- lhs
  
  return(eval(substitute(rhs)))
}

fun_groupByQuestionId <- function(paramEntries) {
  var_tiFrames <- Map(
    function(e) { return(e$testInstanceQuestions) },
    paramEntries$tests[[1]]$testInstances
  )
  
  var_flattenedTiFrames <- purrr::flatten(var_tiFrames)
  
  var_unionedTiFrames <- var_flattenedTiFrames[[1]]
  for (i in 2:length(var_flattenedTiFrames)) {
    var_unionedTiFrames <- rbind(var_unionedTiFrames, var_flattenedTiFrames[[i]])
  }
  
  var_questionsScoreMeans <- setNames(
    aggregate(
      score ~ idQuestion,
      var_unionedTiFrames,
      FUN = function(x) c(mean(x))
    ),
    c("idQuestion", "scoreMean")
  )
  var_toMerge <- list(var_questionsScoreMeans)
  
  var_questionsScoreStdDevs <- setNames(
    aggregate(
      score ~ idQuestion,
      var_unionedTiFrames,
      FUN = function(x) c(sd(x))
    ),
    c("idQuestion", "scoreStdDev")
  )
  var_toMerge <- append(var_toMerge, list(var_questionsScoreStdDevs))
  
  var_questionsScoreMedians <- setNames(
    aggregate(
      score ~ idQuestion,
      var_unionedTiFrames,
      FUN = function(x) c(median(x))
    ),
    c("idQuestion", "scoreMedian")
  )
  var_toMerge <- append(var_toMerge, list(var_questionsScoreMedians))
  
  var_questionsScoreSums <- setNames(
    aggregate(
      score ~ idQuestion,
      var_unionedTiFrames,
      FUN = function(x) c(sum(x))
    ),
    c("idQuestion", "totalAchieved")
  )
  var_toMerge <- append(var_toMerge, list(var_questionsScoreSums))
  
  var_questionsMaxScores <- setNames(
    aggregate(
      maxScore ~ idQuestion,
      var_unionedTiFrames,
      FUN = function(x) c(sum(ifelse(is.na(x), 0, x)))
    ),
    c("idQuestion", "totalAchievable")
  )
  var_toMerge <- append(var_toMerge, list(var_questionsMaxScores))
  
  var_questionsCount <- setNames(
    aggregate(
      score ~ idQuestion,
      var_unionedTiFrames,
      FUN = function(x) c(length(x))
    ),
    c("idQuestion", "answersCount")
  )
  var_toMerge <- append(var_toMerge, list(var_questionsCount))
  
  var_answersCorrect <- setNames(
    aggregate(
      isCorrect ~ idQuestion,
      var_unionedTiFrames,
      FUN = function(x) c(sum(ifelse(x, 1, 0)))
    ),
    c("idQuestion", "correct")
  )
  var_toMerge <- append(var_toMerge, list(var_answersCorrect))
  
  var_answersIncorrect <- setNames(
    aggregate(
      isIncorrect ~ idQuestion,
      var_unionedTiFrames,
      FUN = function(x) c(sum(ifelse(x, 1, 0)))
    ),
    c("idQuestion", "incorrect")
  )
  var_toMerge <- append(var_toMerge, list(var_answersIncorrect))
  
  var_answersUnanswered <- setNames(
    aggregate(
      isUnanswered ~ idQuestion,
      var_unionedTiFrames,
      FUN = function(x) c(sum(ifelse(x, 1, 0)))
    ),
    c("idQuestion", "unanswered")
  )
  var_toMerge <- append(var_toMerge, list(var_answersUnanswered))
  
  var_answersPartial <- setNames(
    aggregate(
      isPartial ~ idQuestion,
      var_unionedTiFrames,
      FUN = function(x) c(sum(ifelse(x, 1, 0)))
    ),
    c("idQuestion", "partial")
  )
  var_toMerge <- append(var_toMerge, list(var_answersPartial))
  
  var_mergedDf <- var_toMerge[1]
  
  for (x in var_toMerge[2:length(var_toMerge)]) {
    called <- do.call(data.frame, x)
    var_mergedDf <- merge(var_mergedDf, called, by = c("idQuestion"))
  }
  
  return(var_mergedDf)
}

declared_arguments <- c(
  inFile = "--inFile",
  outFile = "--outFile",
  nBestParticipants = "--nBestParts",
  nWorstParticipants = "--nWorstParts",
  scoreNtiles = "--scoreNtiles"
)

comm_args <- commandArgs(TRUE)
var_in_file <- comm_args[
  which(comm_args == declared_arguments["inFile"]) + 1
]

var_out_file <- NULL
if (declared_arguments["outFile"] %in% comm_args) {
  var_out_file <- comm_args[
    which(comm_args == declared_arguments["outFile"]) + 1
  ]
}

var_fileConnIn <- file(var_in_file, open = "r")
var_dataIn <- fromJSON(readLines(var_fileConnIn, encoding = "utf-8"))

var_computedData <- fun_groupByQuestionId(var_dataIn)

close(var_fileConnIn)

if (is.null(var_out_file)) {
  write(toJSON(var_computedData, auto_unbox = TRUE, pretty = TRUE), stdout())
} else {
  fileConnOut <- file(var_out_file)
  writeLines(toJSON(var_computedData, auto_unbox = TRUE, pretty = TRUE), fileConnOut)
  close(fileConnOut)
}
