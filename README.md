# Integration tests #

### Prepare running environment ###

Integration tests require [mocha](http://mochajs.org/) framework.

* Install mocha globally

*$ npm install -g mocha*

* cd to root directory

*$ cd devicehive-tests*

* When running specify tests directory 'integration-tests'

*$ mocha integration-tests*

Another easy way to run tests is to use [WebStorm](https://www.youtube.com/watch?v=4mKiGkokyx8)

### Tests structure, dealing with failures ###

* *describe()* closure defines a group of tests
* *it()* defines a single test