library(jsonlite)
library(purrr)

fun_calculateTestBasedQuestionStats <- function(param_course) {
  var_testFrames <- param_course$tests
  var_testBasedCalculationDfList <- list()
  
  testFrame <- var_testFrames[[1]]
  
  var_tfTis <- testFrame$testInstances
  var_nesto <- aggregate(
    studentScore ~ idTest,
    var_tfTis[[1]],
    sum
  )[[2]]
  
  var_courseByTestStatistics <- by(
    testFrame,
    seq_len(nrow(testFrame)),
    function(testRow) {
      var_testInstances <- testRow$testInstances[[1]]
      
      var_sumOfTestInstanceScores <- aggregate(
        studentScore ~ idTest,
        var_testInstances,
        sum
      )[[2]]
      
      var_tiqs <- var_testInstances$testInstanceQuestions
      var_tiqsUnioned <- var_tiqs[[1]]
      
      for (i in 2:length(var_tiqs)) {
        var_tiqsUnioned <- rbind(var_tiqsUnioned, var_tiqs[[i]])
      }
      
      var_stats <- aggregate(
        score ~ idQuestion,
        var_tiqsUnioned,
        function(x) c(
          mean(x),
          sd(x),
          length(x),
          median(x),
          sum(x),
          sum(x) / var_sumOfTestInstanceScores
        )
      )
      
      var_stats <- setNames(
        do.call(
          data.frame,
          var_stats
        ),
        c(
          "idQuestion",
          "mean",
          "stdDev",
          "count",
          "median",
          "sum",
          "partOfTotalSum"
        )
      )
      
      return(list(idTest = testRow$id, testData = var_stats))
    }
  )
  
  var_testBasedCalculationDfList <- append(
    var_testBasedCalculationDfList,
    list(var_courseByTestStatistics)
  )
  
  return(var_testBasedCalculationDfList)
}

var_fileConnIn <- file("test_serialization.json", open = "r")
var_dataIn <- fromJSON(readLines(var_fileConnIn, encoding = "utf-8"))

var_computedData <- fun_calculateTestBasedQuestionStats(var_dataIn)

var_foo <- "bar"
