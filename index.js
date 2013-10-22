
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
    options: [['Page - until refresh', 'page'],
              ['Session - until browser restart', 'session'],
              ['No caching', 'none']]
  }
});

function updateStatus(status, id) {
  if (settings.get('cache') === 'session' && sessionStorage['rel.' + id]) {
    data = JSON.parse(sessionStorage['rel.' + id]);
    if (data && !data.error) {
      data.status = status;
      sessionStorage['rel.' + id] = JSON.stringify(data);
    }
  }
}  

angular.module('ffapi', [])
  .factory('ffauthorize', function () {
    return function (req) {
      var sid = cookie('fssessionid');
      if (sid) req.set('Authorization', 'Bearer ' + sid);
      return req;
    };
  })
  .factory('ffapi', function (ffauthorize) {
    var relation_cache = {}
      , photo_cache = {};
    var ffapi = function (resource, options, next) {
      if (resource === 'person/status' && relation_cache[options.id]) {
        relation_cache[options.id].status = options.status;
        updateStatus(options.status, options.id);
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
    ffapi.loading = 0;
    ffapi.loaded = 0;
    ffapi.clear = function () {
      sessionStorage.clear();
      photo_cache = {}
      relation_cache = {}
      ffapi.loading = 0;
      ffapi.loaded = 0;
    };
    ffapi.photo = function (id, next) {
      ffapi.loading += 1;
      if (settings.get('cache') !== 'none') {
        if (!photo_cache[id]) {
          if (settings.get('cache') === 'session' && sessionStorage['photo.' + id]) {
            data = JSON.parse(sessionStorage['photo.' + id]);
            if (data && !data.error) {
              photo_cache[id] = data;
            }
          }
        }
        if (photo_cache[id]) {
          ffapi.loaded += 1;
          return next(photo_cache[id], true);
        }
      }
      ffapi('person/photo/' + id, null, function (data) {
        relation_cache[id] = data;
        if (settings.get('cache') === 'session') {
          sessionStorage['photo.' + id] = JSON.stringify(data);
        }
        ffapi.loaded += 1;
        return next(data, false);
      });
    };
    ffapi.relation = function (id, next) {
      ffapi.loading += 1;
      if (settings.get('cache') !== 'none') {
        if (!relation_cache[id]) {
          if (settings.get('cache') === 'session' && sessionStorage['rel.' + id]) {
            data = JSON.parse(sessionStorage['rel.' + id]);
            if (data && !data.error) {
              relation_cache[id] = data;
            }
          }
        }
        if (relation_cache[id]) {
          ffapi.loaded += 1;
          return next(relation_cache[id], true);
        }
      }
      ffapi('person/relations/' + id, null, function (data) {
        relation_cache[id] = data;
        if (settings.get('cache') === 'session') {
          sessionStorage['rel.' + id] = JSON.stringify(data);
        }
        ffapi.loaded += 1;
        return next(data, false);
      });
    };
    return ffapi;
  })
  .factory('ffperson', function (ffapi) {
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
