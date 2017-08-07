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
   * @param  {String} type Name of index
   * @return {void}
   */
  syncSingle (type) {
    new Contentful(this.config.contentful, this.config.locales)
      .getEntries(type, this.entryId)
      .then((content) => {
        this.singleCallback(type, content);
      })
      .catch(console.error);
  }

  /**
   * Call this function after content from contentful is clear
   * @param  {String} type    Name of index
   * @param  {Object} content Content object that should be synced
   * @return {void}
   */
  singleCallback (type, content) {
    // Convert to array
    if (content.constructor !== Array) {
      content = [content];
    }

    this.callback && this.callback(content);

    new Algolia(this.config.algolia, this.indexName)
      .indexData(content)
      .then(() => {
        console.log(`Indexed type: ${type}`);
      })
      .catch(console.error);
  }

  /**
   * Sync all configured content types
   * @param  {Array}    type             Contentful content types to sync
   * @param  {String}   indexName        Algolia index
   * @param  {Function} callback         Callback, which is fired when each
   *                                     entry is loaded
   * @param  {String}   entryId          Id of an entry that should be syced
   * @return {void}
   */
  sync (contentTypes, indexName, callback, entryId = false) {

    // Convert to array
    if (contentTypes.constructor !== Array) {
      contentTypes = [contentTypes];
    }

    this.indexName = indexName;
    this.callback = callback;
    this.entryId = entryId;

    contentTypes.forEach((type) => {
      this.syncSingle(type);
    });
  }
}

/**
 * Exports
 * @type {Class}
 */
module.exports = Sync;
