/**
 * Contentful configuration and library
 */
const contentful = require('contentful');
const merge = require('deepmerge');

class Contentful {

  /**
   * Constructor
   * @param  {Object} config Configuration
   * @return {void}
   */
  constructor (config) {
    const clientConfig = {
      space: config.space,
      accessToken: config.accessToken,
      host: config.host
    };

    /**
     * Create a new client
     */
    this.client = contentful.createClient(clientConfig);
  }

  /**
   * Get all entries of a specific type
   * @param  {String}  categoryId Content type id
   * @return {Promise}
   */
  getEntries (categoryId) {
    return new Promise((fulfill, reject) => {
      this.client
        .getEntries({
          content_type: categoryId,
        })
        .then((entries) => {
          let data = entries.items.map((entry) => {
            delete entry.sys.space;
            delete entry.sys.contentType;

            return merge(entry.sys, entry.fields);
          });

          fulfill(data);
        })
        .catch(reject);
    });
  }
}

/**
 * Exports
 * @type {Class}
 */
module.exports = Contentful;
