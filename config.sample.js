/**
 * Example configuration that can be passed into `Sync.sync(Object <config>);`.
 * Uses environment variables
 * @type {Object}
 */
module.exports = {
  algolia: {
    applicationId: process.env.ALGOLIA_APPID,
    apiKey: process.env.ALGOLIA_APIKEY,
    indexPrefix: 'dev_'  // for Development mode
  },

  contentful: {
    accessToken: process.env.CONTENTFUL_ACCESSTOKEN,
    space: process.env.CONTENTFUL_SPACE,
    host: 'preview.contentful.com' // for Drafts
  },

  locales: [
    [
      'en-US',
      'en'
    ], [
      'de-DE',
      'de'
    ]
  ]
};
