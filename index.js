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
  const projectRoot = path.join(__dirname, '../../../')
  const templatesPath = `${projectRoot}src/templates/pages`
  const dataPath = `${projectRoot}src/data`
  const info = chalk.keyword('lightblue')
  const success = chalk.keyword('lightgreen')

  let globalData = {};
  let hasData;
  const DEFAULT_ITEMS_PER_PAGE = 50;
  
  /**
   * Jen class.
   * @param gulp Project Gulp object
   * @param options Configuration object
   */
  var Jen = function (gulp, options = {}) {
    if (!options.itemsPerPage) {
      options.itemsPerPage = DEFAULT_ITEMS_PER_PAGE;
    }

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
    let pageType = 'master'

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
        // globalData.jen = dataArray.reduce(function (result, current) {
        //   return Object.assign(result, current)
        // }, {})
        let pageData = {
          page: {},
          item: {},
          pagination: {} 
        }
        let projectData =  dataArray.reduce(function (result, current) {
          return Object.assign(result, current)
        }, {});
         globalData.jen = {...pageData, ...projectData};
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
        let path = ''
        if (pageType === 'detail') {
          path = '../'
        }
        return name === 'home' ? '' : (path += '../')
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
     * Generate a page.
     * A page is a folder with an index file within the public folder.
     * @param {String} folder 
     * @param {String} format 
     * @param {String} folderPath 
     * @param {Boolean} hasScripts 
     */
    async function generatePage (folder, format, folderPath, hasScripts) {
        gulp
          .src([path.join(folderPath, format)])
          .pipe(
            data(function () {
              //set page config
              globalData.jen.page.name = folder;
              globalData.jen.page.hasScripts = hasScripts;
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

    /**
     * Generate the detail pages.
     * @param {String} folder 
     * @param {String} subfolder 
     * @param {String} format 
     */
    async function generateDetailPages (folder, subfolder, format) {
      pageType = 'detail';
      const folderPath = path.join(templatesPath, folder, 'detail')
      let hasScripts = await checkHasScripts(folderPath)
      let items = globalData.jen.db[folder].items;
      let currentPage = 1;
      for (let j = 0; j < items.length; j++) {
        let item = items[j]
        gulp
          .src(path.join(templatesPath, folder, subfolder, format))
          .pipe(concat('index.html'))
          .pipe(
            data(function () {
              //set page config
              globalData.jen.item = item;
              globalData.jen.page.name = `${folder}-detail`;
              globalData.jen.page.hasScripts = hasScripts;
              return globalData
            }).on('error', gutil.log)
          )
          .pipe(nunjucksRender(nunjucksOptions).on('error', gutil.log))
          .pipe(inlinesource())
          .pipe(gulp.dest(`${projectRoot}/public/${folder}/${item.id}`))
          currentPage = Math.ceil((j + 1)/options.itemsPerPage);
          let paginationOptions = {
            folder: folder,
            templatesPath: templatesPath,
            noOfItems: items.length,
            currentPage: currentPage,
            index: j
          };
          await generatePaginationPage(paginationOptions)
          
          
          
      } 
    }

    /**
     * Generate a pagination page.
     * @param {Object} paginationOptions 
     */
    function generatePaginationPage(paginationOptions){
      
      return new Promise(async function(resolve, reject){
        let folderPath = paginationOptions.templatesPath + '/' + paginationOptions.folder;
        let [hasScripts, hasPartial] = await Promise.all([
          checkHasScripts(folderPath),
          checkHasPartial(folderPath)
        ])
        let format = hasPartial === true ? '/**/_*.html' : '/*.html';
        let i = paginationOptions.index;
        if(i === 0 || i === (paginationOptions.currentPage - 1) * options.itemsPerPage){
          let offset = i === 0 ? 0 : (paginationOptions.currentPage - 1) * options.itemsPerPage;
        gulp
          .src([path.join(folderPath, format)])
          .pipe(
            data(function () {
              //set page config          
              globalData.jen.page.name = paginationOptions.folder;
              globalData.jen.page.hasScripts = hasScripts;
              globalData.jen.pagination.currentPage = paginationOptions.currentPage
              globalData.jen.pagination.total = paginationOptions.noOfItems
              globalData.jen.pagination.itemsPerPage = options.itemsPerPage
              globalData.jen.pagination.offset = offset
              return globalData
            }).on('error', gutil.log)
          )
          .pipe(concat('index.html'))
          .pipe(nunjucksRender(nunjucksOptions).on('error', gutil.log))
          .pipe(inlinesource())
          .pipe(gulp.dest(`${projectRoot}/public/${paginationOptions.folder}/page-${paginationOptions.currentPage}`))
          .on('end', resolve)
        } else {
          resolve();
        }
      })
    }

    /**
     * Process the templates to generate pages.
     */
    async function processTemplates(){
      for (let i = 0; i < folders.length; i++) {
        const folder = folders[i]
        let subfolders = getPages(templatesPath + '/' + folder)
        let isMasterDetail = false;
        // find a subfolder with the name "detail"
        for (let i = 0; i < subfolders.length; i++) {
          let subfolder = subfolders[i]
          if (subfolder === 'detail') {
            let detailPath = path.join(templatesPath, folder, subfolder)
            let hasPartial = await checkHasPartial(detailPath)
            let format = hasPartial === true ? '/_*.html' : '/*.html'
            if (globalData.jen.db[folder].items) {
              await generateDetailPages(folder, subfolder, format)
              isMasterDetail = true;
              break;
            } 
          } 
        }
        if(!isMasterDetail) {
          let folderPath = templatesPath + '/' + folder
        let [hasScripts, hasPartial] = await Promise.all([
          checkHasScripts(folderPath),
          checkHasPartial(folderPath)
        ])
        let format = hasPartial === true ? '/**/_*.html' : '/*.html'
          generatePage(folder, format, folderPath, hasScripts);
        }
      }
    }
    
    /**************
    JEN GULP TASKS
    ***************/

   gulp.task('jen:init', function (done) {
    init().then(function () {
      done()
    })
  })

  gulp.task('jen:templates', function (done) {
    processTemplates().then(function () {
      done()
    })
  })

    gulp.task('jen:build-remote', done =>
      gulp.series('jen:load', 'jen:init', 'jen:templates')(done)
    )
    gulp.task('jen:build', done =>
      gulp.series('jen:init', 'jen:templates')(done)
    )
    gulp.task('jen:dev', done =>
      gulp.series('jen:dev-setup', 'jen:build')(done)
    )
  }
  module.exports = Jen
})()