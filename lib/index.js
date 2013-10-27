
var request = require('superagent')
  , Emitter = require('emitter')
  , extend = require('extend')
  , each = require('async-each')

module.exports = FFApi

function FFApi(settings, cache, ffauthorize) {
  this.settings = settings
  this.auth = ffauthorize
  this.loading = 0
  this.loaded = 0
  this.cache = cache
  this.mcache = {
    relations: {},
    photos: {}
  }
  this._errorh = []
}

Emitter(FFApi.prototype)

extend(FFApi.prototype, {
  get: function (resource, options, next) {
    var url = this.settings.get('ffhome') + 'api/' + resource
      , self = this
      , req
    if (resource === 'person/status' && this.mcache.relations[options.id]) {
      this.mcache.relations[options.id].status = options.status
      // arggg this should be asyncable?
      this.updateStatus(options.status, options.id)
    }
    if (options) {
      req = this.auth(request.post(url).send(options))
    } else {
      req = this.auth(request.get(url))
    }
    req.set('Accept', 'application/json')
      .end(function (err, res) {
        if (err) {
          return console.error('failed in ff api', url, options, err)
        }
        if (res.status >= 400) {
          return self.error(res)
        }
        if (next) next(res.body)
      })
  },
  error: function (res) {
    var msgs = {
      401: 'Not logged in',
      500: 'Server Error'
    }
      , msg = msgs[res.status] || 'Unknown Error'
    this._errorh.forEach(function (h) {
      h(msg, res.status, res)
    })
  },
  onerror: function (handler) {
    this._errorh.push(handler)
  },
  updateStatus: function (status, id, next) {
    this.emit('status:changed', id, status)
    if (this.settings.get('cache') !== 'session') return next()
    var cache = this.cache
    cache.get('rel.' + id, function (err, data) {
      if (err || !data || data.error) return next()
      data.status = status
      cache.set('rel.' + id, data, next)
    })
  },
  resetCounter: function () {
    this.loading = 0;
    this.loaded = 0;
  },
  clear: function (done) {
    this.mcache.relations = {}
    this.mcache.photo = {}
    this.loading = 0
    this.loaded = 0
    this.cache.clear(done)
  },
  clearFrom: function (person, done) {
    if (!person) return done && done()
    var self = this
    this.fromCache('relations', 'person/relations/' + person, function (err, data) {
      if (err) return done && done(err)
      if (!data) return done && done()
      each([data.motherId, data.fatherId], self.clearFrom.bind(self), function (err) {
        self.clearAt(person)
        if (done) done(err)
      })
    })
  },
  clearAt: function (pid) {
    var urls = ['photo', 'relations', 'sources']
      , self = this
    urls.forEach(function (url) {
      var key = 'person/' + url + '/' + pid
      if (!self.mcache[url]) return
      ;delete self.mcache[url][key]
      self.cache.unset(url + '.' + key)
    })
  },
  // next(err, data)
  fromCache: function (type, id, next) {
    if (this.settings.get('cache') === 'none') return next()
    if (!this.mcache[type]) this.mcache[type] = {}
    if (this.mcache[type][id]) {
      return next(null, this.mcache[type][id])
    }
    if (this.settings.get('cache') !== 'session') return next()
    var self = this
    this.cache.get(type + '.' + id, function (err, data) {
      if (err || 'undefined' === typeof data || (data && data.error)) return next(err)
      self.mcache[type][id] = data
      next(null, data)
    })
  },
  toCache: function (type, id, data, next) {
    if (this.settings.get('cache') === 'none') return next()
    this.mcache[type][id] = data
    if (this.settings.get('cache') !== 'session') return next()
    this.cache.set(type + '.' + id, data, function (err) {
      next()
    })
  },
  getcached: function (key, url, data, done) {
    var self = this
    this.loading += 1
    this.fromCache(key, url, function (err, data) {
      if (data) {
        self.loaded += 1
        return done(data, true)
      }
      self.get(url, null, function (data) {
        self.loaded += 1
        self.toCache(key, url, data, function () {
          done(data, false)
        })
      })
    })
  },
  photo: function (id, next) {
    this.getcached('photo', 'person/photo/' + id, null, next)
  },
  relation: function (id, line, next) {
    if (arguments.length === 2) {
      next = line
      line = null
    }
    this.getcached('relations', 'person/relations/' + id, line ? {line: line} : null, next)
  },
  sources: function (id, next) {
    this.getcached('sources', 'person/sources/' + id, null, next)
  }
})
