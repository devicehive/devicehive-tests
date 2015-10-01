# Integration tests #

### Prepare running environment ###

Integration tests require [mocha](http://mochajs.org/) framework.

* Install mocha globally: **$ npm install -g mocha**

* cd to project root directory: **$ cd devicehive-tests**

* Install Node.js references: Linux: **$ sudo npm i**, Windows: **\> npm i**

* When running specify tests directory 'integration-tests': **$ mocha integration-tests**

Another easy way to run tests is to use [WebStorm](https://www.youtube.com/watch?v=4mKiGkokyx8)

### Tests structure ###

* *describe()* closure defines a group of tests
* *it()* defines a single test

![tests_structure.png](https://bitbucket.org/repo/M6o9ee/images/465540167-tests_structure.png)

### Dealing with failures ###

* Use *only()* predecate to run separate test or separate group of tests. This can be helpful to run the failed test only:

![only2.png](https://bitbucket.org/repo/M6o9ee/images/2871072169-only2.png)

Following code will only execute '#Group of Tests' group:

![only1.png](https://bitbucket.org/repo/M6o9ee/images/3914931187-only1.png)

* To ignore test use *skip()* predicate:

![skip.png](https://bitbucket.org/repo/M6o9ee/images/1689287093-skip.png)