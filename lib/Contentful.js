/**
 * Contentful configuration and library
 */
const contentful = require('contentful');
const merge = require('deepmerge');

const flatten = (array) => {
  return array.reduce((a, b) => {
    return a.concat(Array.isArray(b) ? flatten(b) : b);
  }, []);
};

class Contentful {

  /**
   * Constructor
   * @param  {Object} config  Configuration
   * @param  {Array}  locales Locales to check for
   * @return {void}
   */
  constructor (config, locales) {
    const clientConfig = {
      space: config.space,
      accessToken: config.accessToken,
      host: config.host
    };

    /**
     * Create a new client
     */
    this.client = contentful.createClient(clientConfig);

    /**
     * Set the locales
     */
    this.locales = locales;
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
          locale: '*'
        })
        .then((entries) => {
          let data = entries.items.map((entry) => {
            let localizedEntries = [];
            delete entry.sys.space;
            delete entry.sys.contentType;

            if (!this.locales) {
              return merge(entry.sys, entry.fields);
            }

            // Generate entries for all locales
            this.locales.forEach((locale) => {
              let fields = this._getFieldsForLocale(entry.fields, locale);
              localizedEntries.push(merge(entry.sys, fields));
            });

            return localizedEntries;
          });

          data = flatten(data);

          fulfill(data);
        })
        .catch(reject);
    });
  }

  /**
   * Get all fields for a configured locale
   * @param  {Object} fields All fields in all availabe languages
   * @param  {Array}  locale Locale configuration
   * @return {Object}        Localized fieldset
   */
  _getFieldsForLocale (fields, locale) {
    let entry = {};

    for (let key in fields) {
      entry[key] = this._getLocaleString(fields[key], locale);
    }

    entry.locale = locale[0];

    return entry;
  }

  /**
   * Get local string
   * @param  {[type]} field  [description]
   * @param  {[type]} locale [description]
   * @return {[type]}        [description]
   */
  _getLocaleString (field, locale) {
    let localizedField;

    if (locale.constructor !== Array) {
      locale = [locale];
    }

    locale.forEach((currentLocale) => {
      if (field[currentLocale] && !localizedField) {
        localizedField = field[currentLocale];
      }
    });

    return localizedField;
  }
}

/**
 * Exports
 * @type {Class}
 */
module.exports = Contentful;
