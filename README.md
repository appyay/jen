# Jen

> Jen is a lightweight Javascript library for rapid development of static websites. It was built with a focus on ease of use for developers and working seamlessly with headless APIs and static website hosting.

## How does it work?
Jen leverages Mozilla's rich and powerful [Nunjucks](https://mozilla.github.io/nunjucks/) templating language together with Gulp tasks to manage project template files and generate an optimised public directory. Data for the application is retrieved from a JSON data file in the project, making it especially suitable for building API driven websites. The data file can be populated on-demand during development or on-build for in-production static websites.

Aside from Nunjucks and Gulp, Jen is completely unopinionated about what technologies are used, putting the control in the hands of the developer.

A starter project for Jen is available here: [Jen Starter](https://github.com/appyay/jen-starter). The build process for this project includes:
* Sass preprocessing
* Nunjucks/HTML for templating
* CSS concatenation and minification
* Javascript concatenation and uglification
* Multi-browser live browser reload
* Master-detail pattern
* A modular, reusable design


## Installation
Install the dependencies:
````
npm install
````

## Project setup
Jen will be available as an NMP package soon, but in the meantime you can put the jen project in the root of your project and access it through your project's gulpfile:

First, create a gulpfile.js in the root of your project and include the following:

### Require the dependencies:
````
const gulp = require('gulp');
require('jen')(gulp, {
  dataUrl: process.env.DATA_URL
});
````
If there is a DATA_URL specified, Jen will use it to retrieve data.

### Development Gulp task:
````
gulp.task(
  'default',
  gulp.series('jen:dev') //include other gulp tasks as you wish
);
````

### Build Gulp task:
````
gulp.task('build', gulp.series('jen:build'));
````

### Project structure
Jen assumes the following project structure:
````
|--src // required
    |--data // required, but folder and contents will be auto-generated if you supply a dataUrl
        |--db.json // required
    |--templates //required
        |--pages //required
            |--home //required. This is the homepage folder. Other pages can be added in the same manner
                |--index.html //required
|--gulpfile.js // required
````

### Load the data
Data can be loaded in three ways:
1. Manually add a JSON data file to the data folder.
2. Load remote data by running ````gulp jen:load --dataUrl 'http://example.com/api/whatever'````
3. Load remote data and build the project by running ````gulp jen:build````

## Running for development
````
gulp jen:dev
````

## Detail pages
If your website requires use of the master-detail pattern (i.e. a list page and a detail page), you can achieve this by putting a "detail" folder inside your page folder. For example:
````
...
        |--pages
        ...
            |--blog // page folder
                |--detail
                    |--index.html // this is your detail page
                |--index.html //this is your list page
...
````
So, if a blog entry has an ID of "abc123", the detail page would be accessible at:
````
/blogs/abc123
````
## TODOs
* Improve modularity of build