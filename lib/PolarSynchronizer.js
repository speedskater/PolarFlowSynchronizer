var fs = require('fs');
var path = require('path');
var mkdirp = require('mkdirp');
var moment = require('moment');
var async = require('async');
var unzip = require('unzip');

function PolarSynchronizer(directory, api) {
	this.directory = directory;
	this.api = api;
}

PolarSynchronizer.prototype.synchronize = function(cb, progressCb) {
	var me = this;
	var previousLastTimeStamp = null;
	var nrFilesDownloaded = 0;
	var processedFiles = 0;
	var failedFiles = 0;

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
					if(!error) {
						++processedFiles;
					} else {
						++failedFiles;
					}
					if(!!progressCb) {
						progressCb(trainings.length, processedFiles, failedFiles);
					}
					cb(error, result);
				});
			}.bind(me), function(error, results) {
				cb(error, results);
			});
		},
		function(results, cb) {
			var latestTimestamp = results.reduce(function(latestTimestamp, currentTrainingResult) {
				nrFilesDownloaded += (currentTrainingResult.downloaded ? 1 : 0);
				return moment.max(latestTimestamp, currentTrainingResult.timestamp);
			}, previousLastTimeStamp);
			me.setLastTimeStamp(latestTimestamp, cb);
		}
	], function(error) {
		cb(error, nrFilesDownloaded);
	});
};

PolarSynchronizer.prototype.processTraining = function(training, cb) {
	var me = this;
	var exportUrl = training.url + "/export/tcx"
	var subDirectory = path.dirname(training.url);
	var targetDirectory = path.join(this.directory, training.url);
	var targetZipFile = path.join(targetDirectory, "export.zip");

	fs.exists(targetDirectory, function (exists) {
		if (exists) {
			cb(null, {
				downloaded: false,
				timestamp: moment(training.datetime)
			}); //do not overwrite
		} else {
			async.series([function (cb) {
				mkdirp(targetDirectory, 0770, cb);
			}, function (cb) {
				me.api.download(exportUrl, {}, targetZipFile, cb);
			}, function (cb) {
				fs.createReadStream(targetZipFile).pipe(unzip.Extract({ path: targetDirectory })).on('finish', cb);
			}, function(cb) {
				fs.unlink(targetZipFile, cb);
			}], function (error, results) {
				cb(error, {
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
