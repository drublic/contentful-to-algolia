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
          let data = entries.items.map(this._getLocalizedEntries.bind(this));
          data = flatten(data);

          fulfill(data);
        })
        .catch(reject);
    });
  }

  _getLocalizedEntries (entry) {
    let localizedEntries = [];
    entry = this._cleanEntry(entry);

    if (!this.locales) {
      return this._mergeFields(entry, entry.fields);
    }

    // Generate entries for all locales
    this.locales.forEach((locale) => {
      let newEntry = entry;
      let fields = newEntry.fields;

      fields = this._getFieldsForLocale(fields, locale);
      fields = this._getFields(fields, locale);

      newEntry = this._mergeFields(newEntry, fields);
      delete newEntry.fields;

      localizedEntries.push(newEntry);
    });

    return localizedEntries;
  }

  /**
   * Clean a provided entry of its metadata
   * @param  {Object}  entry Entry to be cleaned
   * @param  {Boolean} full  Should all meta data be removed
   * @return {Object}        Cleaned entry
   */
  _cleanEntry (entry, full = false) {
    let newEntry = {};

    if (entry.sys) {
      if (full) {
        delete entry.sys;
      } else {
        delete entry.sys.space;
        delete entry.sys.contentType;
        delete entry.sys.type;
        delete entry.sys.revision;

        newEntry = entry.sys;
      }
    }

    newEntry.fields = entry.fields;

    return newEntry;
  }

  /**
   * Merge two fieldsets
   * @param  {Object} entry  Fieldset one
   * @param  {Object} fields Fieldset two
   * @return {Obejct}        New fieldsets
   */
  _mergeFields (entry = {}, fields = {}) {
    entry = merge(entry, fields);
    delete entry.fields;

    return entry;
  }

  /**
   * Get complete field entries with siblings
   * @param  {Object} fields All fields
   * @param  {String} key    Name of a field that should be found
   * @param  {Array}  locale Locales to search for
   * @return {Object}        Converted object
   */
  _getFieldEntry (fields, key, locale) {
    if (!fields[key]) {
      return fields;
    }

    if (fields[key].constructor === Array) {
      fields[key] = fields[key].map((entry) => {
        if (!(entry instanceof Object)) {
          return entry;
        }

        entry = this._cleanEntry(entry, true);
        entry = this._mergeFields(entry, entry.fields);
        entry = this._getFields(entry, locale);
        entry = this._getFieldsForLocale(entry, locale);

        return entry;
      });
    }

    return fields;
  }

  /**
   * Iterate through all fields of an entry
   * @param  {Object} fields All fields of a given entry
   * @param  {Array}  locale Locales to search for
   * @return {Object}        New entry
   */
  _getFields (fields, locale) {
    for (var key in fields) {
      if (fields.hasOwnProperty(key)) {
        fields = this._getFieldEntry(fields, key, locale);
      }
    }

    return fields;
  }

  /**
   * Get all fields for a configured locale
   * @param  {Object}  fields   All fields in all availabe languages
   * @param  {Array}   locale   Locale configuration
   * @return {Object}           Localized fieldset
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
   * @param  {Mixed}        field  Field to find content in
   * @param  {Array|String} locale Locales to check
   * @return {Mixed}               Localized field
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
