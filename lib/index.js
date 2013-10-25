
var request = require('superagent')

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
}

FFApi.prototype = {
  get: function (resource, options, next) {
    var url = this.settings.get('ffhome') + 'api/' + resource
      , req
    /*
    if (resource === 'person/status' && this.mcache.relations[options.id]) {
      this.mcache.relations[options.id].status = options.status
      // arggg this should be asyncable?
      this.updateStatus(options.status, options.id)
    }
    */
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
        if (next) next(res.body)
      })
  },
  // todo make this asyncable
  updateStatus: function (status, id, next) {
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
    this.mcache.photos = {}
    this.loading = 0
    this.loaded = 0
    this.cache.clear(done)
  },
  cachePhoto: function (id, next) {
    if (this.settings.get('cache') === 'none') return next()
    if (this.mcache.photos[id]) {
      return next(null, this.mcache.photos[id])
    }
    if (this.settings.get('cache') !== 'session') return next()
    var self = this
    this.cache.get('photo.' + id, function (err, data) {
      if (err || !data || data.error) return next(err)
      self.mcache.photos[id] = data
      next(null, data)
    })
  },
  photo: function (id, next) {
    var self = this
    this.loading += 1
    this.cachePhoto(id, function (err, data) {
      if (data) {
        self.loaded += 1
        return next(data, true)
      }
      self.get('person/photo/' + id, null, function (data) {
        self.mcache.relations[id] = data
        self.loaded += 1
        if (self.settings.get('cache') !== 'session') return next(data, false)
        self.cache.set('photo.' + id, data, function (err) {
          next(data, false)
        })
      })
    })
  },
  cacheRelations: function (id, next) {
    if (this.settings.get('cache') === 'none') return next()
    if (this.mcache.relations[id]) {
      return next(null, this.mcache.relations[id])
    }
    if (this.settings.get('cache') !== 'session') return next()
    var self = this
    this.cache.get('rel.' + id, function (err, data) {
      if (err || !data || data.error) return next(err)
      self.mcache.relations[id] = data
      next(null, data)
    })
  },
  relation: function (id, next) {
    var self = this
    this.loading += 1
    this.cacheRelations(id, function (err, data) {
      if (data) {
        self.loaded += 1
        return next(data, true)
      }
      self.get('person/relations/' + id, null, function (data) {
        self.mcache.relations[id] = data
        self.loaded += 1
        if (self.settings.get('cache') !== 'session') return next(data, false)
        self.cache.set('rel.' + id, data, function (err) {
          next(data, false)
        })
      })
    })
  },
  sources: function (id, next) {
    next({count: 0}, true);
  }
}
