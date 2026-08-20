/* dendry
 * http://github.com/idmillington/dendry
 *
 * MIT License
 */
/*jshint indent:2 */
(function() {
  'use strict';

  var path = require('path');
  var fs = require('fs');
  var async = require('async');
  var utils = require('../utils');
  var cmdCompile = require('./compile').cmd;

  var loadGameAndSource = function(data, callback) {
    utils.loadCompiledGame(data.compiledPath, function(err, game, json) {
      if (err) {
        return callback(err);
      }
      data.gameFile = json;
      data.game = game;
      callback(null, data);
    });
  };

  var bundleUIWithBun = function(data, callback) {
    var gameFile = data.gameFile.toString();
    var wrappedGameFile = JSON.stringify({compiled:gameFile});
    if (typeof Bun === 'undefined' || typeof Bun.build !== 'function') {
      return callback(new Error('make-html Bun bundling requires the Bun runtime.'));
    }

    Bun.build({
      entrypoints: [path.resolve(__dirname, '../../ui/browser.js')],
      target: 'browser',
      format: 'iife',
      minify: !data.pretty,
      write: false
    }).then(function(result) {
      if (!result.success) {
        var errorMessage = result.logs.map(function(log) {
          return log.message || String(log);
        }).join('\n');
        return callback(new Error(errorMessage || 'Bun build failed.'));
      }
      if (!result.outputs || result.outputs.length === 0) {
        return callback(new Error('Bun build produced no browser output.'));
      }
      return result.outputs[0].text().then(function(bundleText) {
        data.code = 'window.game=' + wrappedGameFile + ';' + bundleText;
        return callback(null, data);
      }, function(err) {
        return callback(err);
      });
    }, function(err) {
      return callback(err);
    });
  };

  var getTemplateDir = function(data, callback) {
    utils.getTemplatePath(
      data.template, 'html',
      function(err, templateDir, name) {
        if (err) {
          return callback(err);
        }
        data.templateDir = templateDir;
        data.template = name;
        return callback(null, data);
      });
  };

  var getDestDir = function(data, callback) {
    data.destDir = path.join(data.projectDir, 'out', 'html');
    callback(null, data);
  };

  var notifyUser = function(data, callback) {
    console.log(('Creating HTML build in: ' + data.destDir).grey);
    console.log(('Using template: ' + data.template).grey);
    callback(null, data);
  };

  var createHTML = function(data, callback) {
    fs.exists(data.destDir, function(exists) {
      if (exists) {
        if (data.overwrite) {
          console.log(
            'Warning: Overwriting existing HTML and custom content.'.red
          );
        } else {
          console.log(
            'Warning: Overwriting existing HTML content.'.red
          );
        }
      }
      utils.copyTemplate(
        data.templateDir, data.destDir, data,
        function(err) {
          if (err) {
            return callback(err);
          } else {
            return callback(null, data);
          }
        });
    });
  };

  // ----------------------------------------------------------------------
  // Make-HTML: Creates a playable HTML version of the game.
  // ----------------------------------------------------------------------

  var cmdMakeHTML = new utils.Command('make-html');
  cmdMakeHTML.createArgumentParser = function(subparsers) {
    var parser = subparsers.addParser(this.name, {
      help: 'Make a project into a playable HTML page.',
      description: 'Builds a HTML version of a game, compiling it first ' +
        'if it is out of date. The compilation uses a template which ' +
        'can be a predefined template, or the path to a directory. ' +
        'Templates use the handlebars templating system. The default ' +
        'HTML template (called "default") compresses the browser interface ' +
        'and your game content and embeds it in a single HTML file, for the ' +
        'most portable game possible.'
    });
    parser.addArgument(['project'], {
      nargs: '?',
      help: 'The project to compile (default: the current directory).'
    });
    parser.addArgument(['-t', '--template'], {
      help: 'A theme template to use (default: the "default" theme). ' +
        'Can be the name of a built-in theme, or the path to a theme.'
    });
    parser.addArgument(['--pretty'], {
      action: 'storeTrue',
      defaultValue: false,
      help: 'Doesn\'t minify the output bundle.'
    });
    parser.addArgument(['--overwrite'], {
      action: 'storeTrue',
      defaultValue: false,
      help: 'Overwrites all files, including those designed for customization.'
    });
    parser.addArgument(['-f', '--force'], {
      action: 'storeTrue',
      defaultValue: false,
      help: 'Always recompiles, even if the compiled game is up to date.'
    });
  };
  cmdMakeHTML.run = function(args, callback) {
    var getData = function(callback) {
      cmdCompile.run(args, callback);
    };

     async.waterfall([getData, loadGameAndSource,
                     bundleUIWithBun,
                     getTemplateDir, getDestDir,
                     notifyUser, createHTML], callback);
  };

  module.exports = {
    cmd: cmdMakeHTML
  };
}());
