#!/usr/bin/env node

var mkdirp = require('mkdirp');
var async = require('async');
var path = require('path');
var program = require('commander');
var touch = require("touch");
var FileCookieStore = require('tough-cookie-filestore');

var PolarApi = require('./../lib/PolarApi');
var PolarSynchronizer = require('./../lib/PolarSynchronizer');

var stringValue = function(value) {
	return value;
};

program
	.version('0.0.1')
	.usage('[options] <directory> <username> <password> ')
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
		synchronizer.synchronize(cb);
	}
], function(error, results) {
	var numberSynchronizedFiles = results[2];
	if(error) {
		console.log(error.message || error);
	} else {
		if (numberSynchronizedFiles === 0) {
			console.log("All your training files are up to date.");
		} else {
			console.log(numberSynchronizedFiles + " files were downloaded.");
		}
	}
});