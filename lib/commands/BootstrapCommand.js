"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = undefined;

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _FileSystemUtilities = require("../FileSystemUtilities");

var _FileSystemUtilities2 = _interopRequireDefault(_FileSystemUtilities);

var _NpmUtilities = require("../NpmUtilities");

var _NpmUtilities2 = _interopRequireDefault(_NpmUtilities);

var _PackageUtilities = require("../PackageUtilities");

var _PackageUtilities2 = _interopRequireDefault(_PackageUtilities);

var _Command2 = require("../Command");

var _Command3 = _interopRequireDefault(_Command2);

var _semver = require("semver");

var _semver2 = _interopRequireDefault(_semver);

var _async = require("async");

var _async2 = _interopRequireDefault(_async);

var _lodash = require("lodash.find");

var _lodash2 = _interopRequireDefault(_lodash);

var _lodash3 = require("lodash.flatten");

var _lodash4 = _interopRequireDefault(_lodash3);

var _path = require("path");

var _path2 = _interopRequireDefault(_path);

var _glob = require("glob");

var _glob2 = _interopRequireDefault(_glob);

var _fsSymlink = require("fs-symlink");

var _fsSymlink2 = _interopRequireDefault(_fsSymlink);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var BootstrapCommand = function (_Command) {
  _inherits(BootstrapCommand, _Command);

  function BootstrapCommand() {
    _classCallCheck(this, BootstrapCommand);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(BootstrapCommand).apply(this, arguments));
  }

  _createClass(BootstrapCommand, [{
    key: "initialize",
    value: function initialize(callback) {
      // Nothing to do...
      callback(null, true);
    }
  }, {
    key: "execute",
    value: function execute(callback) {
      var _this2 = this;

      this.linkDependencies(function (err) {
        if (err) {
          callback(err);
        } else {
          _this2.logger.success("Successfully bootstrapped " + _this2.packages.length + " packages.");
          callback(null, true);
        }
      });
    }
  }, {
    key: "linkDependencies",
    value: function linkDependencies(callback) {
      var _this3 = this;

      this.progressBar.init(this.packages.length);
      this.logger.info("Linking all dependencies");

      var ignore = this.flags.ignore || this.repository.bootstrapConfig.ignore;

      _async2.default.parallelLimit(_PackageUtilities2.default.filterPackages(this.packages, ignore, true).map(function (pkg) {
        return function (done) {
          _async2.default.series([function (cb) {
            return _FileSystemUtilities2.default.mkdirp(pkg.nodeModulesLocation, cb);
          }, function (cb) {
            return _this3.installExternalPackages(pkg, cb);
          }, function (cb) {
            return _this3.linkDependenciesForPackage(pkg, cb);
          }], function (err) {
            _this3.progressBar.tick(pkg.name);
            done(err);
          });
        };
      }), this.concurrency, function (err) {
        _this3.progressBar.terminate();
        callback(err);
      });
    }
  }, {
    key: "linkDependenciesForPackage",
    value: function linkDependenciesForPackage(pkg, callback) {
      var _this4 = this;

      _async2.default.each(this.packages, function (dependency, done) {
        if (!_this4.hasMatchingDependency(pkg, dependency, true)) return done();

        var linkSrc = dependency.location;
        var linkDest = _path2.default.join(pkg.nodeModulesLocation, dependency.name);

        _this4.createLinkedDependency(linkSrc, linkDest, dependency.name, done);
      }, callback);
    }
  }, {
    key: "createLinkedDependency",
    value: function createLinkedDependency(src, dest, name, callback) {
      var _this5 = this;

      _FileSystemUtilities2.default.rimraf(dest, function (err) {
        if (err) {
          return callback(err);
        }

        _FileSystemUtilities2.default.mkdirp(dest, function (err) {
          if (err) {
            return callback(err);
          }

          _this5.createLinkedDependencyFiles(src, dest, name, callback);
        });
      });
    }
  }, {
    key: "createLinkedDependencyFiles",
    value: function createLinkedDependencyFiles(src, dest, name, callback) {
      var srcPackageJsonLocation = _path2.default.join(src, "package.json");
      var destPackageJsonLocation = _path2.default.join(dest, "package.json");
      var destIndexJsLocation = _path2.default.join(dest, "index.js");
      var pkg = require(srcPackageJsonLocation);
      var prefix = this.repository.linkedFiles.prefix || "";

      var linkFiles = pkg.lerna && pkg.lerna.files || [];
      linkFiles.push(pkg.main);

      var packageJsonFileContents = JSON.stringify({
        name: name,
        version: pkg.version,
        main: pkg.main
      }, null, "  ");

      _async2.default.parallel([function (cb) {
        _async2.default.waterfall([function (cb) {
          return _async2.default.map(linkFiles, function (file, cb) {
            return (0, _glob2.default)(file, { cwd: src }, cb);
          }, cb);
        }, function (files, cb) {
          files = (0, _lodash4.default)(files);

          _async2.default.each(files, function (file, cb) {
            var dir = _path2.default.dirname(_path2.default.join(dest, file));

            _async2.default.series([function (cb) {
              _FileSystemUtilities2.default.mkdirp(dir, cb);
            }, function (cb) {
              if (_path2.default.extname(file) === '.js') {
                var fileContent = prefix + "module.exports = require(" + JSON.stringify(_path2.default.join(src, file)) + ");";
                _FileSystemUtilities2.default.writeFile(_path2.default.join(dest, file), fileContent, cb);
              } else {
                (0, _fsSymlink2.default)(_path2.default.join(src, file), _path2.default.join(dest, file)).then(function () {
                  return cb();
                }).catch(function (err) {
                  if (err.code === 'EEXIST') {
                    cb();
                  } else {
                    cb(err);
                  }
                });
              }
            }], cb);
          }, cb);
        }], cb);
      }, function (cb) {
        _FileSystemUtilities2.default.writeFile(destPackageJsonLocation, packageJsonFileContents, cb);
      }], callback);
    }
  }, {
    key: "installExternalPackages",
    value: function installExternalPackages(pkg, callback) {
      var _this6 = this;

      var allDependencies = pkg.allDependencies;

      var externalPackages = Object.keys(allDependencies).filter(function (dependency) {
        var match = (0, _lodash2.default)(_this6.packages, function (pkg) {
          return pkg.name === dependency;
        });

        return !(match && _this6.hasMatchingDependency(pkg, match));
      }).filter(function (dependency) {
        return !_this6.hasDependencyInstalled(pkg, dependency);
      }).map(function (dependency) {
        return dependency + "@" + allDependencies[dependency];
      });

      if (externalPackages.length) {
        _NpmUtilities2.default.installInDir(pkg.location, externalPackages, callback);
      } else {
        callback();
      }
    }
  }, {
    key: "hasMatchingDependency",
    value: function hasMatchingDependency(pkg, dependency) {
      var showWarning = arguments.length <= 2 || arguments[2] === undefined ? false : arguments[2];

      var expectedVersion = pkg.allDependencies[dependency.name];
      var actualVersion = dependency.version;

      if (!expectedVersion) {
        return false;
      }

      if (this.isCompatableVersion(actualVersion, expectedVersion)) {
        return true;
      }

      if (showWarning) {
        this.logger.warning("Version mismatch inside \"" + pkg.name + "\". " + ("Depends on \"" + dependency.name + "@" + expectedVersion + "\" ") + ("instead of \"" + dependency.name + "@" + actualVersion + "\"."));
      }

      return false;
    }
  }, {
    key: "hasDependencyInstalled",
    value: function hasDependencyInstalled(pkg, dependency) {
      var packageJson = _path2.default.join(pkg.nodeModulesLocation, dependency, "package.json");
      try {
        return this.isCompatableVersion(require(packageJson).version, pkg.allDependencies[dependency]);
      } catch (e) {
        return false;
      }
    }
  }, {
    key: "isCompatableVersion",
    value: function isCompatableVersion(actual, expected) {
      return _semver2.default.satisfies(actual, expected);
    }
  }]);

  return BootstrapCommand;
}(_Command3.default);

exports.default = BootstrapCommand;
module.exports = exports["default"];