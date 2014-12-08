PolarFlowSynchronizer
=====================

A nodejs based command line tool to synchronize tcx files stored in polar flow to a local directory.

Why?
====

To analyze your trainings it can be useful to have all your training files available as tcx files in a local folder. Although the polar flow webportal provides an interface to download trainings data on a file per files basis, downloading each file separately can be a tedious task.

Solution?
=========

PolarFlowSynchronizer provides you a tool to download all your training files from polar flow to a local directory. Along the way it keeps track of what has been already downloaded and only fetches trainings data newer than the latest trainings file in your local directory.

Installation
============

To globally install PolarFlowSynchronizer 

	$ [sudo] npm install -g polar-flow-synchronizer

Usage
=====

The usage of PolarFlowSynchronizer is straight forward. You only have to provide a target directory, username and password and run the application each time you add new data to polar flow. Keep in mind to document your training online and assigne the correct sports profile before you synchronize your data as already downloaded training data won't be synchronized again.

	$ polar-flow-synchronizer "/my/target/directory" "my.user@domain.com" "mysecretpassword"
