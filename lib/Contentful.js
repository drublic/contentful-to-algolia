/**
 * Contentful configuration and library
 */
const contentful = require('contentful');
const _ = require('lodash');
const merge = _.merge;
const MAX_CONTENTFUL_RESULTS = 1000;

const flatten = (array) => {
  return array.reduce((a, b) => {
    return a.concat(Array.isArray(b) ? flatten(b) : b);
  }, []);
};

class Contentful {

  /**
   * Constructor
   * @param  {Object}   config  Configuration
   * @param  {Array}    locales Locales to check for
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

  getEntriesPaged(query, skip = 0, previous = []) {
    query = Object.assign({}, query, {
      skip,
      limit: MAX_CONTENTFUL_RESULTS
    });

    return this.client
      .getEntries(query)
      .then((result) => {
        const entries = previous.concat(result.items);

        if (result.skip + MAX_CONTENTFUL_RESULTS < result.total) {
          const entriesToRequest = skip + MAX_CONTENTFUL_RESULTS;

          return this.getEntriesPaged(query, entriesToRequest, entries);
        }

        return entries;
      });
  }

  /**
   * Get all entries of a specific type
   * @param  {String}   categoryId       Content type id
   * @param  {String}   entryId          Id of an entry that should be syced
   * @param  {Function} manipulateSingle Manipulate each entry
   * @return {Promise}
   */
  getEntries (categoryId, entryId, manipulateSingle) {
    return new Promise((fulfill, reject) => {
      let query = {
        content_type: categoryId,
        locale: '*',
        include: 2
      };

      if (entryId) {
        query['sys.id'] = entryId;
      }

      this.getEntriesPaged(query)
        .then((entries) => {
          let data = entries.map((entry) => {
            const localizedEntries = this._getLocalizedEntries(entry);
            let localizedManipulatedEntries = localizedEntries;

            if (manipulateSingle) {
              localizedManipulatedEntries = localizedEntries.map((entry) => {
                return manipulateSingle(entry, localizedEntries);
              });
            }

            return localizedManipulatedEntries;
          });

          data = flatten(data);

          fulfill(data);
        })
        .catch(reject);
    });
  }

  _getLocalizedEntries (entry) {
    entry = this._cleanEntry(entry);

    if (!this.locales) {
      return this._mergeFields(entry, entry.fields);
    }

    // Generate entries for all locales
    let localizedEntries = this.locales.map((locale) => {
      let newEntry = Object.assign({}, entry);
      let fields = newEntry.fields;

      fields = this._getFieldsForLocale(fields, locale);
      fields = this._getFields(fields, locale);

      newEntry = this._mergeFields(newEntry, fields);
      delete newEntry.fields;

      newEntry = this._cleanMore(newEntry, locale);
      newEntry = this._cleanLocales(newEntry, locale);
      newEntry = this._getLocalForNestedFields(newEntry, locale);

      return newEntry;
    });

    return localizedEntries;
  }

  _getLocalForNestedFields(entry, locale) {
    Object.keys(entry).forEach((key) => {
      if (entry[key] && entry[key].constructor === Array) {
        entry[key] = entry[key].map((item) => {
          item = this._cleanMore(item, locale);
          item = this._cleanLocales(item, locale);

          if (item.fields) {
            let fields = item.fields;

            fields = this._getFieldsForLocale(fields, locale);
            fields = this._getFields(fields, locale);

            item = this._mergeFields(item, fields);
            delete item.fields;
          }

          item = this._getLocalForNestedFields(item, locale);

          return item;
        });
      }
    });

    return entry;
  }

  /**
   * Clean entries a bit more (to reduce file size)
   * @param  {Object} entry  Entry to clean
   * @param  {Array}  locale Locales
   * @param  {Array}  cleanStack Stack of entries already processed, for cycle detection
   * @return {Object}        Cleaned entry
   */
  _cleanMore (entry, locale, cleanStack = []) {
    let newEntry = {};

    // circular reference detected, do not re-process this entry
    if (_.indexOf(cleanStack, entry)) {
      return entry;
    }

    for (let key in entry) {
      if (typeof entry[key] === 'object') {
        if (entry[key].sys) {
          newEntry[key] = this._cleanEntry(entry[key]);

        } else if (entry[key].elements && entry[key].elements.constructor === Array) {
          newEntry[key] = {};
          newEntry[key].elements = entry[key].elements.map((entry) => {
            entry = this._cleanEntry(entry, true);

            return this._getFieldsForLocale(entry.fields, locale);
          });

          delete entry[key].elements;

          newEntry[key] = merge(entry[key], newEntry[key]);
        } else {
          cleanStack.push(entry);
          newEntry[key] = this._cleanMore(entry[key], locale, cleanStack);
          cleanStack.pop();
        }
      }
    }

    return merge(entry, newEntry);
  }

  /**
   * Clean fields to only transport locale information
   * @param  {Object} entry  Entry to localize
   * @param  {Array}  locale Locales
   * @return {Object}        Localized entry
   */
  _cleanLocales (entry, locale) {
    Object.keys(entry).forEach((key) => {
      if (typeof entry[key] === 'object' && entry[key].fields) {
        entry[key] = this._getFieldsForLocale(entry[key].fields, locale);
      }
    });

    return entry;
  }

  /**
   * Clean a provided entry of its metadata
   * @param  {Object}  entry Entry to be cleaned
   * @param  {Boolean} full  Should all meta data be removed
   * @return {Object}        Cleaned entry
   */
  _cleanEntry (entry, full = false) {
    let newEntry = {};
    let contentType = false;

    newEntry.fields = {};

    if (!entry) {
      return newEntry;
    }

    if (entry.sys) {

      if (entry.sys.contentType) {
        contentType = entry.sys.contentType.sys.id;
      }

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

    if (typeof newEntry.fields === 'object' && !newEntry.fields.contentType) {
      newEntry.fields.contentType = {};
      this.locales.forEach((locale) => {
        locale.forEach((string) => {
          newEntry.fields.contentType[string] = contentType;
        });
      });
    }

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
    Object.keys(fields).forEach((key) => {
      fields = this._getFieldEntry(fields, key, locale);
    });

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

    Object.keys(fields).forEach((key) => {
      entry[key] = this._getLocaleString(fields[key], locale);
    });

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
