# MailioEvaporate

**A Complete File Upload API for AWS S3**

Work in progress: ![75%](https://progress-bar.dev/75)

Mailio Evaporate is a JS library for uploading files from a browser to AWS S3, using parallel S3's multipart uploads with MD5 checksum support and control over pausing / resuming the upload.

The implementation was insipired by a great [EvaporateJS](https://github.com/TTLabs/EvaporateJS) library. 

***Issues of EvaporateJS addressed by Mailio-Evaporate***

- Mailio-Evaporate mainly addresses the issue of maintenance [EvaporateJS issue 450](https://github.com/TTLabs/EvaporateJS/issues/450) for the purposes of [mail.io](https://mail.io) project. 

- The code structure of Typescript seemed too complicated for mail.io project purposes where we need to "inject" End-To-End encrpytion to it. 

- A lot of functonality that EvaporateJS previously implemented can now, after AWS release AWS SDK v3, easily be addressed by using AWS S3 packages. That greatly reduces the amount of code to maintain. 

**Table of Contents**

- [Help us test our v3!](#help-us-test-our-v3)
- [Features](#features)
  - [Configurable](#configurable)
  - [Resilient](#resilient)
  - [Performant](#performant)
  - [Monitorable](#monitorable)
  - [Cross Platform](#cross-platform)
- [Installation](#installation)
- [API & Usage](#api--usage)
- [Authors](#authors)
- [Maintainers](#maintainers)
- [Contributing](#contributing)
- [License](#license)

## Features

### Configurable

- Configurable number of parallel uploads for each part (`maxConcurrentParts`)

- Custom part transformation (e.g. End-to-End encryption) (`transformPart`)

### Resilient

- S3 Transfer Acceleration (`s3Acceleration`)

- Robust recovery when uploading huge files. 

- Ability to pause and resume downloads at will

- AWS Signature Version 4

### Performant

- Reduced memory footprint when calculating MD5 digests.

- Parallel file uploads while respecting `maxConcurrentParts`.

### Monitorable

- The `progress()` and `complete()` callbacks provide upload stats like transfer rate and time remaining.

- Pause, Resume, Cancel can act on all in-progress file uploads

### Cross Browser support

As the library can be used with Node.js it's primary goal is to be used withing a browser.

## Installation (TBD)

```bash
$ npm install mailio-evaporate
```

## API & Usage (TBD)

The documentation for the usage of the whole API is [available here](https://github.com/igorrendulic/mailio-evaporate-angular/wiki/API).

This is a simple example of how you can configure it:

... TBD

## Authors

- Igor Rendulic - [@igorrendulic](http://github.com/igorrendulic)

## Maintainers

- Igor Rendulic - [@igorrendulic](http://github.com/igorrendulic)

## Contributing

Pull requests are welcome. For major changes, please open an issue first to discuss what you would like to change.

Please make sure to update tests as appropriate.

## License

This package is licensed under the [BSD 3-Clause](http://opensource.org/licenses/BSD-3-Clause) license


# For Developers
This project was generated with [Angular CLI](https://github.com/angular/angular-cli) version 12.2.12.

## Development server

Run `ng serve` for a dev server. Navigate to `http://localhost:4200/`. The app will automatically reload if you change any of the source files.

## Code scaffolding

Run `ng generate component component-name` to generate a new component. You can also use `ng generate directive|pipe|service|class|guard|interface|enum|module`.

## Build

Run `ng build` to build the project. The build artifacts will be stored in the `dist/` directory.

## Running unit tests

Run `ng test` to execute the unit tests via [Karma](https://karma-runner.github.io).

## Running end-to-end tests

Run `ng e2e` to execute the end-to-end tests via a platform of your choice. To use this command, you need to first add a package that implements end-to-end testing capabilities.

## Further help

To get more help on the Angular CLI use `ng help` or go check out the [Angular CLI Overview and Command Reference](https://angular.io/cli) page.
