var actionUtil = require('sails/lib/hooks/blueprints/actionUtil');
var Promise = require('bluebird');

/**
 * Query the Model that is being acted upon, and set it on the req object.
 */
module.exports = function ModelPolicy (req, res, next) {

  var promiseAry = [];
  req.options.modelIdentity = actionUtil.parseModel(req).identity;

  var modelPromise = genModelPromise(req.options.modelIdentity)
  .then(function(model) {
    if (!model) {
      req.options.unknownModel = true;
    }
    req.options.modelDefinition = sails.models[model.identity];
    req.model = model;
  });
  promiseAry.push(modelPromise);

  if (req.options.action === 'populate') {
    var assoc = _.find(req.options.associations,{alias: req.options.alias})
    var modelName = assoc[assoc.type];
    var model = sails.models[assoc[assoc.type]];

    var populateModelPromise = genModelPromise(modelName)
    .then(function(model) {
      if (!model) {
        req.options.unknownPopulateModel = true;
      }
      req.options.populateModelDefinition = sails.models[model.identity];
      req.populateModel = model;
    });
    promiseAry.push(populateModelPromise);

  }

  Promise.all(promiseAry)
  .nodeify(next);

};


var genModelPromise = function(reqModel) {

  var modelCache = sails.hooks['sails-permissions']._modelCache;
  var model = modelCache[reqModel];

  if (_.isObject(model) && !_.isNull(model.id)) {
    return Promise.resolve(model);
  }

  sails.log.warn('Model [', model, '] not found in model cache');

  // if the model is not found in the cache for some reason, get it from the database
  return Model.findOne({ identity: reqModel})
    .then(function (model) {
      if (!_.isObject(model)) {

        if (!sails.config.permissions.allowUnknownModelDefinition) {
          throw new Error('Model definition not found: '+ reqModel);
        }
        else {
          model = sails.models[reqModel];
        }
      }
      return model;
    })
};
