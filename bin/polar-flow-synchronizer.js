#!/usr/bin/env node

var mkdirp = require('mkdirp');
var async = require('async');
var path = require('path');
var program = require('commander');
var touch = require("touch");
var FileCookieStore = require('tough-cookie-filestore');

var PolarApi = require('./../lib/PolarApi');
var PolarSynchronizer = require('./../lib/PolarSynchronizer');
var ProgressBar = require('progress');

var stringValue = function(value) {
	return value;
};

program
	.version('0.0.1')
	.usage('[options] <directory> <username> <password> ')
	.option('-s, --start [date]', 'manually set the start timestamp. Format: DD.MM.YYYY')
	.option('-e, --end [date]', 'manually set the end timestamp. Format: DD.MM.YYYY')
	.parse(process.argv);

if(program.args.length !== 3) {
	program.help();
}

var exportDirectory = program.args[0];
var username = program.args[1];
var password = program.args[2];
var cookieFile = path.join(exportDirectory, username + '-cookie.json');

async.series([
	mkdirp.bind(undefined, exportDirectory, 0770),
	touch.bind(undefined, cookieFile, {}),
	function(cb) {
		var api = new PolarApi(username, new FileCookieStore(cookieFile), function(api, cb) {
			api.authenticate(password, cb);
		});
		var synchronizer = new PolarSynchronizer(exportDirectory, api);
		if(program.start){
			synchronizer.setCustomStartTimeStamp(program.start);
		}
		if (program.end){
			synchronizer.setCustomEndTimeStamp(program.end);
		}
		var bar = null;
		synchronizer.synchronize(cb, function(totalNumberFiles, filesProcessed, filesFailed) {
			if(bar === null) {
				bar = new ProgressBar('  processing ' + totalNumberFiles +  ' Trainings [:bar] :percent :etas', {
					complete: '=',
					incomplete: ' ',
					width: 20,
					total: totalNumberFiles
				});
			}
			//console.log("TOTAL Number Files " + totalNumberFiles + " files Processed: " + filesProcessed + " files Failed: " + filesFailed);
			bar.tick(1);
		});
	}
], function(error, results) {
	var synchronizationResuts = results[2];
	var numberSynchronizedFiles = synchronizationResuts[0];
	var couldNotDownload = synchronizationResuts[1];
	var falseMimeTypes = synchronizationResuts[2];
	if(error) {
		console.log("ERROR: " + (error.message || error));
	} else {
		if (numberSynchronizedFiles === 0) {
			console.log("All your training files are up to date.");
		} else {
			console.log(numberSynchronizedFiles + " files were downloaded.");
		}
		if(couldNotDownload.length > 0) {
			console.log("Could not download " + ouldNotDownload.length + " files:");
			couldNotDownload.forEach(function(failedUrl) {
				console.log(" * " + failedUrl);
			});
			console.log("");
		}
		if(falseMimeTypes.length > 0) {
			console.log("The following training files were in the wrong format:");
			falseMimeTypes.forEach(function(failedUrl) {
				console.log(" * " + failedUrl);
			});
			console.log("");
		}
	}
});