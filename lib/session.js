
module.exports = SessionCache

function SessionCache(store) {
  this.store = store
}

SessionCache.prototype = {
  get: function (key, next) {
    var data
    try {
      data = JSON.parse(this.store[key] || 'null')
    } catch (e) {
      return next(e)
    }
    next(null, data)
  },
  set: function (key, value, next) {
    this.store[key] = JSON.stringify(value)
    next()
  },
  clear: function (next) {
    this.store.clear()
    next()
  }
}

