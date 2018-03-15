/**
 * Configuration and indexing functions of Algolia API
 */
const algoliasearch = require('algoliasearch');
const crypto = require('crypto');
const _ = require('lodash');

/**
 * Algolia Class
 */
class Algolia {

  /**
   * Constructor
   * @param  {Object} config Configuration
   * @param  {String} index  Name of index
   * @return {void}
   */
  constructor (config, index) {
    let indexName = (config.indexPrefix || '') + index;

    this.client = algoliasearch(config.applicationId, config.apiKey);
    this.index = this.client.initIndex(indexName);
    this.cachedResults = null;
    this.indexName = indexName;
  }

  /**
   * Index any data for a specific type. Update and create.
   * @param  {Object}  data        All elements that should be indexed
   * @param  {String}  contentType Current content type that is being indexed
   * @param  {boolean} isSinge     Is it a single entry update, then don't delete stuff
   * @return {Promise}
   */
  indexData (data, contentType, isSingle = false) {
    return this.getElementsPromise(data, contentType)
      .then((entries) => {
        let deletedEntries = entries.deleted;

        if (isSingle) {
          deletedEntries = [];
        }

        return this.indexObjects(entries.created, entries.updated, deletedEntries);
      })
      .catch(console.error);
  }

  /**
   * Get a key for an entry
   * @param  {Object} entry Entry to find key for
   * @return {String}       Key of entry
   */
  getEntryKey (entry) {
    let hash = crypto.createHash('sha256');

    hash.update(entry.id);
    hash.update(entry.locale);

    return hash.digest('hex');
  }

  /**
   * For each element, that should be indexed, we need to know if it exists or not
   * @param  {Object}  element     Element to index
   * @param  {String}  contentType Current content type that is being indexed
   * @return {Promise}             Resolver holds the data of element and if it
   *                               exists or not
   */
  getElementsPromise (data, contentType) {
    let entriesIndex = _.keyBy(data, this.getEntryKey);

    if (!this.cachedResults) {
      let promise = new Promise((resolve, reject) => {
        let browser = this.index.browseAll();
        let results = [];

        browser
          .on('result', (content) => {
            results = _.concat(results, content.hits);
          })
          .on('end', () => {
            resolve(results);
          })
          .on('error', reject);
      });

      this.cachedResults = promise;
    }

    return this.cachedResults.then((hits) => {
      if (contentType) {
        hits = _.filter(hits, {
          contentType
        });
      }

      let results = {
        created: [],
        updated: [],
        deleted: []
      };

      _.each(hits, (hit) => {
        const key = this.getEntryKey(hit);

        if (entriesIndex[key]) {
          if (entriesIndex[key].locale === hit.locale) {
            entriesIndex[key].objectID = hit.objectID;
          }

          const compactEntry = _.omitBy(entriesIndex[key], (prop) => {
            return _.isUndefined(prop);
          });

          if (!_.isEqual(compactEntry, hit)) {
            results.updated.push(entriesIndex[key]);
          }

        } else if (contentType) { // just in case
          results.deleted.push(hit.objectID);
        }
      });

      results.created = _.filter(data, (entry) => !entry.objectID);

      return results;
    });
  }

  /**
   * Index all objects in Algolia by updating and creating them
   * @param  {Array}    newObjects      Objects to create
   * @param  {Array}    existingObjects Objects to update
   * @param  {Function} resolve         Resolve when ready
   * @param  {Function} reject          Reject
   * @return {Promise}
   */
  indexObjects (newObjects, existingObjects, deletedObjects) {
    return Promise.all([
      this.addObjects(newObjects),
      this.updateObjects(existingObjects),
      this.deleteObjects(deletedObjects)
    ]).then((data) => {
      return this.getMergedObjects(data);
    });
  }

  /**
   * Merge two object arrays
   * @param  {Array} data Data that should be merged
   * @return {Array}      Data that is merged
   */
  getMergedObjects (data) {
    let objects = [];

    data.forEach((element) => {
      objects = objects.concat(element.objectIDs);
    });

    return objects;
  }

  /**
   * Get the full index
   * @return {Promise} Resolves with the found elements
   */
  getIndex(isIndexNameLocalized) {
    let query = {
      indexName: this.indexName,
      params: {
        hitsPerPage: 1000,
      }
    };

    if (!isIndexNameLocalized) {
      query.params.restrictSearchableAttributes = ['id', 'locale'];
    }

    return new Promise((resolve, reject) => {
      this.client.search([query], (error, results) => {
        if (error) {
          return reject(error);
        }

        return resolve(results);
      });
    });
  }


  /**
   * Get an object from the index by its id attribute
   * @param  {String}  id     Id of a given object
   * @param  {String}  locale Locale to filter for
   * @return {Promise}        Resolves with the found elements
   */
  getObjectById (id, locale) {
    return new Promise((resolve, reject) => {
      this.index.search({
        query: `${id} ${locale}`,
        restrictSearchableAttributes: ['id', 'locale']
      }, (error, results) => {
        if (error) {
          return reject(error);
        }

        return resolve(results);
      });
    });
  }

  /**
   * Get a objects from the index by its id attribute
   * @param  {Array}   queries    Ids of a given objects
   * @return {Promise}            Resolves with the found elements
   */
  getObjects (queries) {
    queries = queries.map((query) => {
      return {
        indexName: this.indexName,
        query,
        params: {
          restrictSearchableAttributes: ['id', 'locale']
        }
      };
    });

    return new Promise((resolve, reject) => {
      this.client.search(queries, (error, results) => {
        if (error) {
          return reject(error);
        }

        return resolve(results);
      });
    });
  }

  /**
   * Add new objects to the index
   * @param  {Array}   objects Objects to index
   * @return {Promise}         Resolves with indexed objects
   */
  addObjects (objects) {
    if (objects.length === 0) {
      return {
        objectIDs: []
      };
    }

    const promises = objects.map(object => (
      this.index.addObject(object, (error, content) => {
        if (error) {
          return {
            error
          };
        }

        return content;
      })
    ));

    return Promise.all(promises)
      .then((responses) => {
        const errors = responses.filter(response => response && response.error);

        if (errors.length > 0) {
          throw new Error(errors);
        }

        return responses;
      });
  }

  /**
   * Update existing objects in the index
   * @param  {Array}   objects Objects to update
   * @return {Promise}         Resolves with indexed objects
   */
  updateObjects (objects) {
    if (objects.length === 0) {
      return {
        objectIDs: []
      };
    }

    return new Promise((resolve, reject) => {
      this.index.saveObjects(objects, (error, content) => {
        if (error) {
          return reject(error);
        }

        return resolve(content);
      });
    });
  }

  /**
   * Delete existing objects from the index
   * @param  {Array}   objects Objects to update
   * @return {Promise}         Resolves with indexed objects
   */
  deleteObjects (objects) {
    if (objects.length === 0) {
      return {
        objectIDs: []
      };
    }

    return new Promise((resolve, reject) => {
      this.index.deleteObjects(objects, (error, content) => {
        if (error) {
          return reject(error);
        }

        return resolve(content);
      });
    });
  }
}

/**
 * Exports
 * @type {Class}
 */
module.exports = Algolia;
