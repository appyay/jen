/** !
 * @fileOverview A Javascript library for easily creating static websites. Jen uses Gulp tasks to
 * manage project template files and generation of an optimised public directory. Apart from the
 * use of Nunjucks, Jen is unopinionated, leaving felxibility for the developer to specify Gulp
 * dependencies and tasks in the main project Gulp file instead.
 * @version 0.1.0
 * @license
 * Copyright (c) 2019 Richard Lovell
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the 'Software'), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */
;(function () {
  'use strict'

  const gutil = require('gulp-util')

  const chalk = require('chalk')

  const argv = require('yargs').argv

  const path = require('path')

  const fs = require('fs')

  const fsPath = require('fs-path')

  const axios = require('axios')

  const gulpif = require('gulp-if')

  const concat = require('gulp-concat')

  const nunjucksRender = require('gulp-nunjucks-render')

  var inlinesource = require('gulp-inline-source')

  const data = require('gulp-data')

  const projectRoot = path.join(__dirname, '../')
  const templatesPath = `${projectRoot}/src/templates/pages`

  const dataPath = `${projectRoot}src/data`

  const info = chalk.keyword('lightblue')
  const success = chalk.keyword('lightgreen')

  // set in jen:templates and then used again in jen:details
  let globalData, hasData

  /**
   * Jen class.
   * @param gulp Project Gulp object
   * @param options Configuration object
   */
  var Jen = function (gulp, options = {}) {
    /*****************
     DATA
     *****************/
    gulp.task('jen:dev-setup', function (done) {
      if (!hasData) {
        return new Promise(function (resolve, reject) {
          fs.readdir(dataPath, function (err, files) {
            if (err) {
              // No public folder, carry on
              resolve()
            } else {
              if (!files.length) {
                // No files in public folder, carry on
              } else {
                for (let i = 0; i < files.length; i++) {
                  const file = files[i]
                  if (file === 'db.json') {
                    hasData = true
                    break
                  }
                }
                resolve()
              }
            }
          })
        }).then(function () {
          done()
        })
      }
    })

    gulp.task('jen:load', function (done) {
      if (!hasData) {
        if (!options.dataUrl && !argv.dataUrl) {
          throw new Error('Jen: No data URL provided')
        }
        console.log(info('Jen: fetching remote data from ' + options.dataUrl))
        return new Promise(function (resolve, reject) {
          let dataUrl =
            options.dataUrl !== undefined ? options.dataUrl : argv.dataUrl
          axios
            .get(dataUrl)
            .then(function (response) {
              fsPath.writeFile(
                `${projectRoot}/src/data/db.json`,
                JSON.stringify(response.data, null, 4),
                function (err) {
                  if (err) {
                    throw err
                  } else {
                    console.log(
                      success('Jen: Remote data successfully written to file.')
                    )
                    resolve()
                  }
                }
              )
            })
            .catch(function (error) {
              reject(error)
            })
        }).then(function () {
          done()
        })
      } else {
        console.log(info('Jen: In dev mode - using local data'))
        done()
      }
    })

    /*****************
     TEMPLATING
     *****************/

    const nunjucksOptions = {
      path: [`${projectRoot}/src/templates`, 'build/css/'],
      manageEnv: addPathFilter
    }
    const folders = getPages(templatesPath)
    let pageType = 'master';

    /**
     * Get the data ready for templating.
     * Data is retrieved from all files kept in the data directory.
     */
    async function init () {
      const dir = `${projectRoot}src/data/`
      return new Promise((resolve, reject) => {
        fs.readdir(dir, (err, files) => {
          if (err) reject(err)
          let dataArray = []
          files.forEach(file => {
            let content = require(`${dir}${file}`)
            if (file === 'db.json') {
              content = { db: content }
            }
            dataArray.push(content)
          })
          resolve(dataArray)
        })
      }).then(dataArray => {
        globalData = dataArray.reduce(function (result, current) {
          return Object.assign(result, current)
        }, {})
      })
    }

    /**
     * Get pages.
     * Pages are folders within the templates directory.
     * @param {String} dir
     */
    function getPages (dir) {
      return fs.readdirSync(dir).filter(function (file) {
        return fs.statSync(path.join(dir, file)).isDirectory()
      })
    }

    /**
     * Add a path filter.
     * Used because the home page will be compiled to to root of the public
     * folder, whereas the other pages will sit one level deeper.
     * @param {NunjucksEnvironment} environment
     */
    function addPathFilter (environment) {
      environment.addFilter('path', function (name) {
        let path = '';
        if(pageType === 'detail'){
          path = '../';
        }
        return name === 'home' ? '' : path += '../'
      })
    }

    /**
     * Check if a folder contains partial files.
     * Used because a partial file will be the starting point for Nunjucks
     * if one exists.
     * Partials are HTML files that begin with an underscore and/or files
     * within a "components" directory.
     * @param {String} path
     */
    async function checkHasPartial (path) {
      return new Promise(function (resolve, reject) {
        fs.readdir(path, (err, files) => {
          if (err) reject(err)
          for (let k = 0; k < files.length; k++) {
            if (
              files[k] === 'components' ||
              (files[k].startsWith('_') && files[k].endsWith('.html'))
            ) {
              resolve(true)
            }
          }
          resolve(false)
        })
      }).then(function (hasPartial) {
        return hasPartial
      })
    }

    /**
     * Check if a folder contains script files.
     * Used to set up the inlining of page-scoped scripts.
     * @param {String} path
     */
    async function checkHasScripts (path) {
      return new Promise(function (resolve, reject) {
        fs.readdir(path, (err, files) => {
          if (err) reject(err)
          for (let k = 0; k < files.length; k++) {
            if (files[k].startsWith('_') && files[k].endsWith('.js')) {
              resolve(true)
            }
          }
          resolve(false)
        })
      }).then(function (hasScripts) {
        return hasScripts
      })
    }

    /**
     * Render the page templates.
     */
    async function renderPageTemplates () {
      
      for (let i = 0; i < folders.length; i++) {
        const folder = folders[i]
        let folderPath = templatesPath + '/' + folder
        let [hasScripts, hasPartial] = await Promise.all([
          checkHasScripts(folderPath),
          checkHasPartial(folderPath)
        ])
        let format = hasPartial === true ? '/**/_*.html' : '/*.html'
        gulp
          .src([path.join(folderPath, format)])
          .pipe(
            data(function () {
              globalData.jen = { page: {} }
              globalData.jen.page.name = folder
              globalData.jen.page.hasScripts = hasScripts
              return globalData
            }).on('error', gutil.log)
          )
          .pipe(concat('index.html'))
          .pipe(nunjucksRender(nunjucksOptions).on('error', gutil.log))
          .pipe(inlinesource())
          .pipe(gulpif(folder === 'home', gulp.dest(`${projectRoot}/public`)))
          .pipe(
            gulpif(
              folder !== 'home',
              gulp.dest(`${projectRoot}/public/${folder}`)
            )
          )
      }
  
    }

    /**
     * Setup and render page templates.
     */
    async function processPageTemplates () {
      await Promise.all([init(), renderPageTemplates()])
    }

    /**
     * Render the detail templates.
     */
    async function renderDetailTemplates (folder, subfolder, format) {
      
      const folderPath = path.join(templatesPath, folder, 'detail');
      let hasScripts = await checkHasScripts(folderPath);
      for (let j = 0; j < globalData.db[folder].items.length; j++) {
        let item = globalData.db[folder].items[j]
        gulp
          .src(path.join(templatesPath, folder, subfolder, format))
          .pipe(concat('index.html'))
          .pipe(
            data(function () {
              globalData.item = item
              globalData.jen = { page: {} }
              globalData.jen.page.name = `${folder}-detail`;
              globalData.jen.page.hasScripts = hasScripts
              return globalData
            }).on('error', gutil.log)
          )
          .pipe(nunjucksRender(nunjucksOptions).on('error', gutil.log))
          .pipe(inlinesource())
          .pipe(gulp.dest(`${projectRoot}/public/${folder}/${item.id}`))
      }
   
    }

    /**
     * Setup and render detail templates.
     */
    async function processDetailTemplates () {
      pageType = 'detail';
      for (let i = 0; i < folders.length; i++) {
        const folder = folders[i]
        let subfolders = getPages(templatesPath + '/' + folder)
        // find a subfolder with the name "detail"
        for (let i = 0; i < subfolders.length; i++) {
          let subfolder = subfolders[i]
          if (subfolder === 'detail') {
            let detailPath = path.join(templatesPath, folder, subfolder)
            let hasPartial = await checkHasPartial(detailPath)

            let format = hasPartial === true ? '/_*.html' : '/*.html'
            if (globalData.db[folder].items) {
              await renderDetailTemplates(folder, subfolder, format)
            }
          }
        }
      }
    }

    gulp.task('jen:templates', function (done) {
      processPageTemplates().then(function () {
        done()
      })
    })

    gulp.task('jen:details', function (done) {
      processDetailTemplates().then(function () {
        done()
      })
    })

    /**************
    JEN
    ***************/

    gulp.task('jen:build', (done) => (
      gulp.series('jen:load', 'jen:templates', 'jen:details')(done)
    ))

    gulp.task('jen:dev', (done) => (
      gulp.series('jen:dev-setup', 'jen:build')(done)
    ))
  }

  module.exports = Jen
})()
