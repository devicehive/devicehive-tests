# Integration tests #

### Prepare running environment ###

Integration tests require [mocha](http://mochajs.org/) framework.

* Install mocha globally: **$ sudo npm install -g mocha**, Windows: **\> npm install -g mocha**

* cd to project root directory: **$ cd devicehive-tests**

* Install Node.js references: Linux: **$ sudo npm i**, Windows: **\> npm i**

* When running specify tests directory 'integration-tests': **$ mocha integration-tests**

* More advanced example of running tests with JSON reporter: **$ mocha -R json integration-tests/rest-access-key.js > result.json**

You can pick any of [alternative reporters](http://mochajs.org/#reporters) available in Mocha framework or third-party reporter, like [mochawesome](https://github.com/adamgruber/mochawesome).

* Install mochawesome globally: **$ sudo npm install -g mochawesome**, Windows: **$ npm install -g mochawesome**

* Run tests: **$ mocha -R mochawesome integration-tests**.
 In order to set ip and port use: **$ mocha -R mochawesome integration-tests --ip=${ip} --port=${port}**. Default values:  ${ip} = 127.0.0.1 ${port} = 8080** 

Another easy way to run tests is to use [WebStorm](https://www.youtube.com/watch?v=4mKiGkokyx8)

When running tests in WebStorm you can export test results to .html file:

![export_tests.png](https://bitbucket.org/repo/M6o9ee/images/3334473711-export_tests.png)

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