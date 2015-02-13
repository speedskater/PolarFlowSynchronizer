var request = require('request');
var fs = require('fs');
var moment = require('moment');
var path = require('path');
var util = require('util');
var contentDisposition = require('content-disposition');

var POLAR_FLOW_BASE_URI =  'https://flow.polar.com/';

function PolarApi(username, cookieStore, notAuthenticatedCallback) {
	this.username = username;
	this.cookieJar = request.jar(cookieStore);
	this.notAuthenticatedCallback = notAuthenticatedCallback || function(api, cb) {
		cb(new Error("not authenticated"));
	};
	if (typeof opts !== "object") {
		return;
	}
	Object.keys(opts).forEach(function (key) {
		if (Cookie.prototype.hasOwnProperty(key)) {
			this[key] = opts[key] || Cookie.prototype[key];
		}
	}.bind(this));
}

PolarApi.prototype.getSessionCookie = function() {
	var cookies = this.cookieJar.getCookies(POLAR_FLOW_BASE_URI);
	return cookies.some(function(cookie) {
		return cookie.key === 'PLAY_SESSION';
	});
}

PolarApi.prototype.isAuthenticated = function() {
	return this.getSessionCookie();
}

PolarApi.prototype.authenticate = function(password, cb) {
	request.post({
			url: POLAR_FLOW_BASE_URI + 'login',
			jar: this.cookieJar,
			gzip: true,
			form: {
				email: this.username,
				password: password
			}}, function(error, response, body) {
				if(!error && response.statusCode >= 400) {
					error = new Error("Authentication failed. Please Check username and password");
				}
				cb(error, response, body);
			}
	);
};

PolarApi.prototype.execute = function(relativeURI, parameters, cb) {
	var me = this;
	me.doAuthenticatedOperation(function(cb) {
		me.doAuthenticatedCall(relativeURI, parameters, cb)
	}, cb);
};

PolarApi.prototype.doAuthenticatedOperation = function(operation, cb) {
	if(!this.isAuthenticated()) {
		this.notAuthenticatedCallback(this, function(error) {
			if(error) {
				cb(error);
			} else {
				operation(cb);
			}
		});
	} else {
		operation(cb);
	}
}

PolarApi.prototype.doAuthenticatedCall = function(relativeURI, parameters, cb) {
	request(
		{
			headers: {
				'User-Agent': 'Mozilla'
			},
			method: 'GET',
			jar: this.cookieJar,
			url: POLAR_FLOW_BASE_URI + relativeURI,
			gzip: true,
			qs: parameters
		},
		function(error, response, body) {
			if(!error && response.statusCode !== 200) {
				error = new Error("Request for URL: " + (POLAR_FLOW_BASE_URI + relativeURI ) + " could not be fulfilled. Status Code is: " + response.statusCode);
			}
			cb(error, response, body);
		}
	);
};

/**
 *
 * @param {Object} parameters
 * @param {Date/String/Moment} parameters.start either a date or a string in format YYYY.MM.DD representing the start of the range to retrieve calendar events for
 * @param {Date/String/Moment} parameters.end  either a date or a string in format YYYY.MM.DD representing the end of the range to retrieve calendar events for
 * @param {Function} cb the callback after the calendar events have been retrieved
 */
PolarApi.prototype.getCalendarEvents = function(parameters, cb) {
	if(!(parameters.start instanceof String)) {
		parameters.start = moment(parameters.start).format('DD.MM.YYYY');
	}
	if(!(parameters.end instanceof String)) {
		parameters.end = moment(parameters.end).format('DD.MM.YYYY');
	}

	this.execute('training/getCalendarEvents', parameters, cb);
}

PolarApi.prototype.download = function(relativeURI, parameters, targetFile, cb) {
	var me = this;
	var me = this;
	me.doAuthenticatedOperation(function(cb) {
		me.doAuthenticatedDownload(relativeURI, parameters, targetFile, cb);
	}, cb);
};

PolarApi.prototype.doAuthenticatedDownload = function(relativeURI, parameters, targetFile, cb) {
	if(relativeURI.indexOf('/') === 0) {
		relativeURI = relativeURI.substring(1);
	}
	var copyRequest = request(
		{
			headers: {
				'User-Agent': 'Mozilla'
			},
			method: 'GET',
			jar: this.cookieJar,
			url: POLAR_FLOW_BASE_URI + relativeURI,
			gzip: true/*,
			qs: parameters*/
		}
	).on('error', function(err) {
			cb(err);
	}).pipe(fs.createWriteStream(targetFile));
	copyRequest.on('finish', function() {
		cb(null);
	});
};

module.exports = PolarApi;
