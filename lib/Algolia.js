/**
 * Configuration and indexing functions of Algolia API
 */
const algoliasearch = require('algoliasearch');

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
  }

  /**
   * Index any data for a specific type. Update and create.
   * @param  {Object}  data All elements that should be indexed
   * @return {Promise}
   */
  indexData (data) {
    return new Promise((resolve, reject) => {
      let promises = [];
      let newObjects = [];
      let existingObjects = [];

      data.forEach((element) => {
        promises.push(this.getElementPromise(element));
      });

      Promise.all(promises)
        .then((results) => {
          results.forEach((result) => {
            if (result.exists) {
              existingObjects.push(result.element);
            } else {
              newObjects.push(result.element);
            }
          });
        })
        .then(() => {
          this.indexObjects(newObjects, existingObjects, resolve, reject);
        })
        .catch(console.error);
    });
  }

  /**
   * For each element, that should be indexed, we need to know if it exists or not
   * @param  {Object}  element Element to index
   * @return {Promise}         Resolver holds the data of element and if it exists
   *                           or not
   */
  getElementPromise (element) {
    return new Promise((resolve, reject) => {
      this.getObjectById(element.id, element.locale)
        .then(results => {
          if (results && results.hits && results.hits.length > 0) {
            element.objectID = results.hits[0].objectID;
            return resolve({
              exists: true,
              element
            });
          } else {
            return resolve({
              exists: false,
              element
            });
          }
        })
        .catch(console.error);
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
  indexObjects (newObjects, existingObjects, resolve, reject) {
    return Promise.all([
      this.addObjects(newObjects),
      this.updateObjects(existingObjects)
    ]).then((data) => {
      let objects = this.getMergedObjects(data);

      resolve(objects);
    })
    .catch(reject);
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
   * Add new objects to the index
   * @param  {Array}   objects Objects to index
   * @return {Promise}         Resolves with indexed objects
   */
  addObjects (objects) {
    return new Promise((resolve, reject) => {
      this.index.addObjects(objects, (error, content) => {
        if (error) {
          return reject(error);
        }

        return resolve(content);
      });
    });
  }

  /**
   * Update existing objects in the index
   * @param  {Array}   objects Objects to update
   * @return {Promise}         Resolves with indexed objects
   */
  updateObjects (objects) {
    return new Promise((resolve, reject) => {
      this.index.saveObjects(objects, (error, content) => {
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
