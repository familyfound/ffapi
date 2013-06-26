
// client side api for communicating with a familyfound server

var angular = require('angularjs')
  , request = require('superagent')
  , cookie = require('cookie')
  , settings = require('settings').sub('ffapi');

settings.add({
  name: 'main',
  settings: {
    ffhome: 'http://familyfound.local:3000/',
    type: 'text'
  }
});

angular.module('ffapi', [])
  .factory('ffauthorize', function () {
    return function (req) {
      var sid = cookie('fssessionid');
      if (sid) req.set('Authorization', 'Bearer ' + sid);
      return req;
    };
  })
  .factory('ffapi', function (ffauthorize) {
    return function (resource, options, next) {
      var url = settings.get('ffhome') + 'api/' + name
        , req;
      if (options) {
        req = authorize(request.post(url).send(options));
      } else {
        req = authorize(request.get(url));
      }
      req.set('Accept', 'application/json')
        .end(function (err, res) {
          if (err) { return console.error('failed in ff api', url, options, err); }
          next && next(res.body);
        });
    };
  })
  .factory('ffperson', function (ffapi) {
    // TODO: use localStorage? no. Refresh should give them new data.
    var cache = {};
    return function (personId, nocache, next) {
      if (!next && typeof (nocache) == 'function') {
        next = nocache; nocache = false;
      }
      if (!nocache && cache[personId]) {
        return next(cache[personId])
      }
      ffapi('person/' + personId, null, function (data) {
        cache[personId] = data;
        return next(data);
      });
    };
  });
