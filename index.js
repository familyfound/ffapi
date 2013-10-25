
// client side api for communicating with a familyfound server

var angular = require('angularjs')
  , request = require('superagent')
  , cookie = require('cookie')
  , settings = require('settings')('ffapi')

  , SessionCache = require('./lib/session')
  , FFApi = require('./lib')

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
})

angular.module('ffapi', [])
  .factory('ffauthorize', function () {
    return function (req) {
      var sid = cookie('fssessionid')
      if (sid) req.set('Authorization', 'Bearer ' + sid)
      return req
    }
  })
  .factory('ffapi', function (ffauthorize) {
    return new FFApi(settings, new SessionCache(sessionStorage), ffauthorize)
  })
  .factory('ffperson', function (ffapi) {
    var cache = {}
    return function (personId, nocache, next) {
      if (!next && typeof (nocache) == 'function') {
        next = nocache
        nocache = false
      }
      if (!nocache && cache[personId]) {
        return next(cache[personId])
      }
      ffapi.get('person/' + personId, null, function (data) {
        cache[personId] = data
        return next(data)
      })
    }
  })
