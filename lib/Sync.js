/**
 * Synchronize data for any given content type from Contentful and bring it to
 * an Algolia Index.
 */
const Algolia = require('./Algolia');
const Contentful = require('./Contentful');

class Sync {

  /**
   * Constructor for Sync class
   * @param  {Object} config Configuration
   * @return {void}
   */
  constructor (config) {
    this.config = config;
  }

  /**
   * Sync any given Contentful content type to a specific index
   * @param  {String}   type      Contentful content type
   * @param  {String}   indexName Algolia index
   * @param  {Object}   content   Content object that should be synced
   * @param  {Function} callback  Callback, which is fired when entries are loaded
   * @param  {String}   entryId   Id of an entry that should be syced
   * @return {void}
   */
  syncSingle (type, indexName, callback, entryId) {
    new Contentful(this.config.contentful, this.config.locales)
      .getEntries(type, entryId)
      .then((content) => {
        this.singleCallback(type, indexName, content, callback);
      })
      .catch(console.error);
  }

  /**
   * Call this function after content from contentful is clear
   * @param  {String}   type      Contentful content type
   * @param  {String}   indexName Algolia index
   * @param  {Object}   content   Content object that should be synced
   * @param  {Function} callback  Callback, which is fired when entries are loaded
   * @return {void}
   */
  singleCallback (type, indexName, content, callback) {
    // Convert to array
    if (content.constructor !== Array) {
      content = [content];
    }

    callback && callback(content);

    new Algolia(this.config.algolia, indexName)
      .indexData(content)
      .then(() => {
        console.log(`Indexed type: ${type}`);
      })
      .catch(console.error);
  }

  /**
   * Sync all configured content types
   * @param  {Array}    type      Contentful content types to sync
   * @param  {String}   indexName Algolia index
   * @param  {Function} callback  Callback, which is fired when each entry is
   *                              loaded
   * @param  {String}   entryId   Id of an entry that should be syced
   * @return {void}
   */
  sync (contentTypes, indexName, callback, entryId = false) {

    // Convert to array
    if (contentTypes.constructor !== Array) {
      contentTypes = [contentTypes];
    }

    contentTypes.forEach((type) => {
      this.syncSingle(type, indexName, callback, entryId);
    });
  }
}

/**
 * Exports
 * @type {Class}
 */
module.exports = Sync;
