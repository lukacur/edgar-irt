library(jsonlite)

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

var_out_file <- NULL;
if (declared_arguments["outFile"] %in% comm_args) {
  var_out_file <- comm_args[
    which(comm_args == declared_arguments["outFile"]) + 1
  ]
}

var_data = list()
var_data$success <- TRUE

var_data_json = toJSON(var_data, auto_unbox = TRUE)

if (is.null(var_out_file)) {
  write(var_data_json, stdout())
} else {
  fileConn <- file(var_out_file)
  writeLines(var_data_json, fileConn)
  close(fileConn)
}

fileConnIn <- file(var_in_file, open = "r")
fileConn <- file("B:/testna/r/given_json_in.json")
writeLines(toJSON(fromJSON(readLines(fileConnIn, encoding = "utf-8")), auto_unbox = TRUE, pretty = TRUE), fileConn)
close(fileConn)
