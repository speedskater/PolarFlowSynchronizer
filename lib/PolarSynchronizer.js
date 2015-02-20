var fs = require('fs');
var path = require('path');
var mkdirp = require('mkdirp');
var moment = require('moment');
var async = require('async');
var unzip = require('unzip');
var fileType = require('file-type');
var readChunk = require('read-chunk');
var touch = require('touch');

function PolarSynchronizer(directory, api) {
	this.directory = directory;
	this.api = api;
}

PolarSynchronizer.prototype.synchronize = function(cb, progressCb) {
	var me = this;
	var previousLastTimeStamp = null;
	var nrFilesDownloaded = 0;
	var falseMimeTypes = [];
	var exsitingsFiles = [];
	var successfullDownloads = [];
	var couldNotDownload = [];
	var processedFiles = 0;
	var failedFiles = 0;
	var flowBaseUrl = "https://flow.polar.com";

	async.waterfall([
		me.getLastTimeStamp.bind(me),
		function(lastTimeStamp, cb) {
			previousLastTimeStamp = lastTimeStamp;
			me.api.getCalendarEvents({
				start: moment(lastTimeStamp).subtract(1, 'days'),
				end: moment().add(1, 'days')
			}, cb);
		},
		function(response, body, cb) {
			var trainings = JSON.parse(body);
			trainings = trainings.filter(function(training) {
				return training.url.toLowerCase().indexOf("test") == -1
			});
			async.mapLimit(trainings, 6, function(training, cb) {
				this.processTraining(training, function(error, result) {
					var trainingUrl = flowBaseUrl + training.url.toLowerCase();
					var successful = false;
					if(!error) {
						++processedFiles;
						if(!result.correctMimeType) {
							falseMimeTypes.push(trainingUrl);
						} else {
							if(!result.downloaded) {
								exsitingsFiles.push(trainingUrl);
							} else {
								successfullDownloads.push(trainingUrl);
							}
							successful = true;
						}
					} else {
						++failedFiles;
						couldNotDownload.push(trainingUrl);
					}
					if(!!progressCb) {
						progressCb(trainings.length, processedFiles, failedFiles, trainingUrl, successful);
					}
					cb(null, result);
				});
			}.bind(me), function(error, results) {
				cb(error, results);
			});
		},
		function(results, cb) {
			if(couldNotDownload.length == 0) {
				var latestTimestamp = results.reduce(function (latestTimestamp, currentTrainingResult) {
					nrFilesDownloaded += (currentTrainingResult.downloaded ? 1 : 0);
					return moment.max(latestTimestamp, currentTrainingResult.timestamp);
				}, previousLastTimeStamp);
				me.setLastTimeStamp(latestTimestamp, cb);
			} else {
				cb(null);
			}
		}
	], function(error) {
		cb(error, nrFilesDownloaded, couldNotDownload, falseMimeTypes, successfullDownloads, existingsFiles);
	});
};

PolarSynchronizer.prototype.processTraining = function(training, cb) {
	var me = this;
	var exportUrl = training.url + "/export/tcx"
	var subDirectory = path.dirname(training.url);
	var targetDirectory = path.join(this.directory, training.url);
	var targetZipFile = path.join(targetDirectory, "export.zip");
	var correctMimeType = false;
	var synchedFile = path.join(targetDirectory,"synched.txt");

	fs.exists(synchedFile, function (exists) {
		if (exists) {
			cb(null, {
				downloaded: false,
				correctMimeType: true,
				timestamp: moment(training.datetime)
			}); //do not overwrite
		} else {
			async.series([function (cb) {
				mkdirp(targetDirectory, 0770, cb);
			}, function (cb) {
				me.api.download(exportUrl, {}, targetZipFile, cb);
			}, function (cb) {
				async.waterfall([
					function(cb) {
						readChunk(targetZipFile, 0, 262, cb);
					},
					function(buffer, cb) {
						var mimeType = fileType(buffer);
						if(!mimeType || mimeType.ext !== 'zip') {
							fs.createReadStream(targetZipFile).pipe(fs.createWriteStream(path.join(targetDirectory, "export.txt")));
							cb(null);
						} else {
							correctMimeType = true;
							fs.createReadStream(targetZipFile).pipe(unzip.Extract({ path: targetDirectory })).on('finish', function(error) {
								if(!error) {
									touch(synchedFile, {}, cb);
								} else {
									cb(error);
								}
							});
						}
					}
				], cb);
			}, function(cb) {
				fs.unlink(targetZipFile, cb);
			}], function (error, results) {
				cb(error, {
					correctMimeType: correctMimeType,
					downloaded: !error,
					timestamp: moment(training.datetime)
				});
			});
		}
	});
};

PolarSynchronizer.prototype.ensureDirectory = function(cb) {
	mkdirp(this.directory, 0770, cb);
}

PolarSynchronizer.prototype.getLastTimeStamp = function(cb) {
	var me = this;
	var timeStampFilename = path.join(this.directory, "last-timestamp.txt");
	var initialDate = moment(0);

	async.series([
		me.ensureDirectory.bind(me),
		function(cb) {
			fs.readFile(timeStampFilename, { encoding: 'utf8' }, function (err, lastTimeISOString) {
				var lastTime = moment(lastTimeISOString);
				cb(null, err ? initialDate : lastTime);
			});
		}
	], function(err, results) {
		cb(err, results[1]);
	});
}

PolarSynchronizer.prototype.setLastTimeStamp = function(lastTimestamp, cb) {
	fs.writeFile(this.getLastTimeStampFile(), moment(lastTimestamp).toISOString(), { encoding: 'utf8' }, cb);
}

PolarSynchronizer.prototype.getLastTimeStampFile = function() {
	return path.join(this.directory, "last-timestamp.txt");
}

module.exports = PolarSynchronizer;
