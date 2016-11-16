/**
 * Query the Model that is being acted upon, and set it on the req object.
 */

var Promise = require('bluebird');

module.exports = function ModelPolicy (req, res, next) {

  genModelPromise(req.options.model)
  .then(function(model) {
    if (!model) {
      req.options.unknownModel = true;
    }
    req.options.modelDefinition = sails.models[model.identity];
    req.model = model;

    if (req.options.action === 'populate') {
      sails.log.debug("###############populate starts in ModelPolicy");
      req.options.modelDefinition.findOne(req.param('parentid')).then(function(parentObj) {
        // find permission(s) on the parent model and check if there is any criteria that matches with parentObj
        var options = _.defaults({
          model: req.model,
          user: req.user
        }, req.options);
        sails.log.debug("###options.model: ", options.model);
        sails.log.debug("###options.user: ", options.user);
        PermissionService.findModelPermissions(options).then(function (permissions) {
          sails.log.silly('PermissionPolicy:', permissions.length, 'permissions grant',
              PermissionService.getAction(options), 'on', req.model.name, 'for', req.user.username);
	        sails.log.debug('permissions:', JSON.stringify(permissions));
          if (!permissions || permissions.length === 0) {
            return res.badRequest({
              error: 'Cannot perform action [' + req.options.action + '] on parent object'
            });
          }
          else if (!PermissionService.hasPassingCriteria(parentObj, permissions, req.body)) {
            return res.badRequest({
              error: 'Cannot perform action [' + req.options.action + '] on parent object'
            });
          }
          else {
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
              next();
            });
          }
        });
      });
    }
    else {
      next();
    }
  });
}

var genModelPromise = function(reqModel) {

  var modelCache = sails.hooks['sails-permissions']._modelCache;
  var model = modelCache[reqModel];

  if (_.isObject(model) && !_.isUndefined(model.id)) {
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
