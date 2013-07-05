
// client side api for communicating with a familyfound server

var angular = require('angularjs')
  , request = require('superagent')
  , cookie = require('cookie')
  , settings = require('settings')('ffapi');

settings.config({
  ffhome: {
    value: '/',
    title: 'FamilyFound URL',
    description: 'the FamilyFound URL to use',
    type: 'text'
  },
  cache: {
    value: 'page',
    title: 'Caching policy',
    description: 'How should data be cached?',
    type: 'select',
    options: [['page', 'Page - until refresh'],
              ['session', 'Session - until browser restart'],
              ['none', 'No caching']]
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
    var relation_cache = {};
    var ffapi = function (resource, options, next) {
      if (resource === 'person/status' && relation_cache[options.id]) {
        relation_cache[options.id].status = options.status;
      }
      var url = settings.get('ffhome') + 'api/' + resource
        , req;
      if (options) {
        req = ffauthorize(request.post(url).send(options));
      } else {
        req = ffauthorize(request.get(url));
      }
      req.set('Accept', 'application/json')
        .end(function (err, res) {
          if (err) { return console.error('failed in ff api', url, options, err); }
          next && next(res.body);
        });
    };
    ffapi.relation = function (id, next) {
      if (settings.get('cache') !== 'none') {
        if (!relation_cache[id]) {
          if (settings.get('cache') === 'session' && sessionStorage['rel.' + id]) {
            data = JSON.parse(sessionStorage['rel.' + id]);
            if (!data.error) {
              relation_cache[id] = data;
            }
          }
        }
        if (relation_cache[id]) {
          return next(relation_cache[id], true);
        }
      }
      ffapi('person/relations/' + id, null, function (data) {
        relation_cache[id] = data;
        if (settings.get('cache') === 'session') {
          sessionStorage['rel.' + id] = JSON.stringify(data);
        }
        return next(data, false);
      });
    };
    return ffapi;
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
