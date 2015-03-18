# Integration tests #

### Prepare running environment ###

Integration tests require [mocha](http://mochajs.org/) framework.

* Install mocha globally: *$ npm install -g mocha*

* cd to root directory: *$ cd devicehive-tests*

* When running specify tests directory 'integration-tests': *$ mocha integration-tests*

Another easy way to run tests is to use [WebStorm](https://www.youtube.com/watch?v=4mKiGkokyx8)

### Tests structure, dealing with failures ###

* *describe()* closure defines a group of tests
* *it()* defines a single test

Use *only()* predecate to run separate test or group of tests. This can be helpful to run the failed test:

![only2.png](https://bitbucket.org/repo/M6o9ee/images/2871072169-only2.png)

Following code separates a group of tests:

![only1.png](https://bitbucket.org/repo/M6o9ee/images/3914931187-only1.png)

To ignore test use *skip()* predicate:

![skip.png](https://bitbucket.org/repo/M6o9ee/images/1689287093-skip.png)