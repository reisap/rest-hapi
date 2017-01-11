var QueryHelper = require('./query-helper');
var Q = require('q');
var errorHelper = require('./error-helper');
var extend = require('util')._extend;
var config = require('../config');

module.exports = {

  /**
   * Finds a list of model documents
   * @param model: A mongoose model.
   * @param query: query parameters to be converted to a mongoose query.
   * @param Log: A logging object.
   * @returns {object} A promise for the resulting model documents.
   */
  list: _list,

  /**
   * Finds a model document
   * @param model: A mongoose model.
   * @param _id: The document id.
   * @param query: query parameters to be converted to a mongoose query.
   * @param Log: A logging object.
   * @returns {object} A promise for the resulting model document.
   */
  find: _find,

  /**
   * Creates a model document
   * @param model: A mongoose model.
   * @param payload: Data used to create the model document.
   * @param Log: A logging object.
   * @returns {object} A promise for the resulting model document.
   */
  create: _create,

  /**
   * Updates a model document
   * @param model: A mongoose model.
   * @param _id: The document id.
   * @param payload: Data used to update the model document.
   * @param Log: A logging object.
   * @returns {object} A promise for the resulting model document.
   */
  update: _update,

  /**
   * Deletes a model document
   * @param model: A mongoose model.
   * @param _id: The document id.
   * @param payload: Data used to determine a soft or hard delete.
   * @param Log: A logging object.
   * @returns {object} A promise returning true if the delete succeeds.
   */
  delete: _delete,

  /**
   * Adds an association to a document
   * @param ownerModel: The model that is being added to.
   * @param ownerId: The id of the owner document.
   * @param childModel: The model that is being added.
   * @param childId: The id of the child document.
   * @param associationName: The name of the association from the ownerModel's perspective.
   * @param payload: Either an id or an object containing an id and extra linking-model fields.
   * @param Log: A logging object
   * @returns {object} A promise returning true if the add succeeds.
   */
  addOne: _addOne,

  /**
   * Adds an association to a document
   * @param ownerModel: The model that is being added to.
   * @param ownerId: The id of the owner document.
   * @param childModel: The model that is being added.
   * @param childId: The id of the child document.
   * @param associationName: The name of the association from the ownerModel's perspective.
   * @param Log: A logging object
   * @returns {object} A promise returning true if the add succeeds.
   */
  removeOne: _removeOne,

  /**
   * Adds multiple associations to a document
   * @param ownerModel: The model that is being added to.
   * @param ownerId: The id of the owner document.
   * @param childModel: The model that is being added.
   * @param associationName: The name of the association from the ownerModel's perspective.
   * @param payload: Either a list of id's or a list of id's along with extra linking-model fields.
   * @param Log: A logging object
   * @returns {object} A promise returning true if the add succeeds.
   */
  addMany: _addMany,

  /**
   * Get all of the associations for a document
   * @param ownerModel: The model that is being added to.
   * @param ownerId: The id of the owner document.
   * @param childModel: The model that is being added.
   * @param associationName: The name of the association from the ownerModel's perspective.
   * @param query: query parameters to be converted to a mongoose query.
   * @param Log: A logging object
   * @returns {object} A promise returning true if the add succeeds.
   */
  getAll: _getAll

};


/**
 * Finds a list of model documents
 * @param model: A mongoose model.
 * @param query: query parameters to be converted to a mongoose query.
 * @param Log: A logging object.
 * @returns {object} A promise for the resulting model documents.
 */
function _list(model, query, Log) {
  try {
    var mongooseQuery = model.find();
    mongooseQuery = QueryHelper.createMongooseQuery(model, query, mongooseQuery, Log);
    return mongooseQuery.exec()
        .then(function (result) {

          var promise = {};
          if (model.routeOptions && model.routeOptions.list && model.routeOptions.list.post) {
            promise = model.routeOptions.list.post(query, result, Log);
          }
          else {
            promise = Q.when(result);
          }

          return promise
              .then(function (result) {
                result = result.map(function (data) {
                  var result = data.toJSON();
                  if (model.routeOptions) {
                    var associations = model.routeOptions.associations;
                    for (var associationKey in associations) {
                      var association = associations[associationKey];
                      if (association.type === "ONE_MANY" && data[associationKey]) {//EXPL: we have to manually populate the return value for virtual (e.g. ONE_MANY) associations
                        if (data[associationKey].toJSON) {//TODO: look into .toJSON and see why it appears sometimes and not other times
                          result[associationKey] = data[associationKey].toJSON();
                        }
                        else {
                          result[associationKey] = data[associationKey];
                        }
                      }
                    }
                  }

                  if (result._id) {
                    result._id = result._id.toString();//EXPL: _id must be a string to pass validation
                  }

                  Log.log("Result: %s", JSON.stringify(result));
                  return result;
                });

                return result;
              })
              .catch(function (error) {
                const message = "There was a postprocessing error.";
                errorHelper.handleError(error, message, errorHelper.types.BAD_REQUEST, Log);
              })
        })
        .catch(function (error) {
          const message = "There was an error accessing the database.";
          errorHelper.handleError(error, message, errorHelper.types.SERVER_TIMEOUT, Log);
        });
  }
  catch(error) {
    const message = "There was an error processing the request.";
    try {
      errorHelper.handleError(error, message, errorHelper.types.BAD_REQUEST, Log)
    }
    catch(error) {
      return Q.reject(error);
    }
  }
}

/**
 * Finds a model document
 * @param model: A mongoose model.
 * @param _id: The document id.
 * @param query: query parameters to be converted to a mongoose query.
 * @param Log: A logging object.
 * @returns {object} A promise for the resulting model document.
 */
function _find(model, _id, query, Log) {
  try {
    var mongooseQuery = model.findOne({ '_id': _id });
    mongooseQuery = QueryHelper.createMongooseQuery(model, query, mongooseQuery, Log);
    return mongooseQuery.exec()
        .then(function (result) {
          if (result) {
            var promise = {};
            if (model.routeOptions && model.routeOptions.find && model.routeOptions.find.post) {
              promise = model.routeOptions.find.post(query, result, Log);
            } else {
              promise = Q.when(result);
            }

            return promise
                .then(function(data) {
                  var result = data.toJSON();
                  if (model.routeOptions) {
                    var associations = model.routeOptions.associations;
                    for (var associationKey in associations) {
                      var association = associations[associationKey];
                      if (association.type === "ONE_MANY" && data[associationKey]) {//EXPL: we have to manually populate the return value for virtual (e.g. ONE_MANY) associations
                        result[associationKey] = data[associationKey];
                      }
                    }
                  }

                  if (result._id) {//TODO: handle this with mongoose/global preware
                    result._id = result._id.toString();//EXPL: _id must be a string to pass validation
                  }

                  Log.log("Result: %s", JSON.stringify(result));

                  return result;
                })
                .catch(function (error) {
                  const message = "There was a postprocessing error.";
                  errorHelper.handleError(error, message, errorHelper.types.BAD_REQUEST, Log);
                });
          }
          else {
            const message = "No resource was found with that id.";
            errorHelper.handleError(message, message, errorHelper.types.NOT_FOUND, Log);
          }
        })
        .catch(function (error) {
          const message = "There was an error accessing the database.";
          errorHelper.handleError(error, message, errorHelper.types.SERVER_TIMEOUT, Log);
        });
  }
  catch(error) {
    const message = "There was an error processing the request.";
    try {
      errorHelper.handleError(error, message, errorHelper.types.BAD_REQUEST, Log)
    }
    catch(error) {
      return Q.reject(error);
    }
  }

}

/**
 * Creates a model document
 * @param model: A mongoose model.
 * @param payload: Data used to create the model document.
 * @param Log: A logging object.
 * @returns {object} A promise for the resulting model document.
 */
function _create(model, payload, Log) {
  try {
    var promise =  {};
    if (model.routeOptions && model.routeOptions.create && model.routeOptions.create.pre){
      promise = model.routeOptions.create.pre(payload, Log);
    }
    else {
      promise = Q.when(payload);
    }

    return promise
        .then(function (payload) {

          if (config.enableCreatedAt) {
            payload.createdAt = new Date();
            payload.updatedAt = new Date();
          }

          return model.create(payload)
              .then(function (data) {

                //EXPL: rather than returning the raw "create" data, we filter the data through a separate query
                var attributes = QueryHelper.createAttributesFilter({}, model, Log);

                return model.findOne({ '_id': data._id }, attributes)
                    .then(function(result) {
                      result = result.toJSON();

                      //TODO: include eventLogs

                      if (model.routeOptions && model.routeOptions.create && model.routeOptions.create.post) {
                        promise = model.routeOptions.create.post(payload, result, Log);
                      }
                      else {
                        promise = Q.when(result);
                      }

                      return promise
                          .then(function (result) {
                            result._id = result._id.toString();//TODO: handle this with preware
                            return result;
                          })
                          .catch(function (error) {
                            const message = "There was a postprocessing error creating the resource.";
                            errorHelper.handleError(error, message, errorHelper.types.BAD_REQUEST, Log);
                          });
                    })
              })
              .catch(function (error) {
                const message = "There was an error creating the resource.";
                errorHelper.handleError(error, message, errorHelper.types.SERVER_TIMEOUT, Log);
              });
        })
        .catch(function (error) {
          const message = "There was a preprocessing error creating the resource.";
          errorHelper.handleError(error, message, errorHelper.types.BAD_REQUEST, Log);
        });
  }
  catch(error) {
    const message = "There was an error processing the request.";
    try {
      errorHelper.handleError(error, message, errorHelper.types.BAD_REQUEST, Log)
    }
    catch(error) {
      return Q.reject(error);
    }
  }
}

/**
 * Updates a model document
 * @param model: A mongoose model.
 * @param _id: The document id.
 * @param payload: Data used to update the model document.
 * @param Log: A logging object.
 * @returns {object} A promise for the resulting model document.
 */
function _update(model, _id, payload, Log) {
  try {
    var promise =  {};
    if (model.routeOptions && model.routeOptions.update && model.routeOptions.update.pre){
      promise = model.routeOptions.update.pre(_id, payload, Log);
    }
    else {
      promise = Q.when(payload);
    }

    return promise
        .then(function (payload) {

          if (config.enableUpdatedAt) {
            payload.updatedAt = new Date();
          }

          //TODO: support eventLogs and log all property updates in one document rather than one document per property update
          return model.findByIdAndUpdate(_id, payload)
              .then(function (result) {
                if (result) {
                  //TODO: log all updated/added associations
                  var attributes = QueryHelper.createAttributesFilter({}, model, Log);

                  return model.findOne({'_id': result._id}, attributes)
                      .then(function (result) {
                        result = result.toJSON();

                        if (model.routeOptions && model.routeOptions.update && model.routeOptions.update.post) {
                          promise = model.routeOptions.update.post(payload, result, Log);
                        }
                        else {
                          promise = Q.when(result);
                        }

                        return promise
                            .then(function (result) {
                              result._id = result._id.toString();//TODO: handle this with preware
                              return result;
                            })
                            .catch(function (error) {
                              const message = "There was a postprocessing error updating the resource.";
                              errorHelper.handleError(error, message, errorHelper.types.BAD_REQUEST, Log);
                            });
                      })
                }
                else {
                  const message = "No resource was found with that id.";
                  errorHelper.handleError(message, message, errorHelper.types.NOT_FOUND, Log);
                }
              })
              .catch(function (error) {
                const message = "There was an error updating the resource.";
                errorHelper.handleError(error, message, errorHelper.types.SERVER_TIMEOUT, Log);
              });
        })
        .catch(function (error) {
          const message = "There was a preprocessing error updating the resource.";
          errorHelper.handleError(error, message, errorHelper.types.BAD_REQUEST, Log);
        });
  }
  catch(error) {
    const message = "There was an error processing the request.";
    try {
      errorHelper.handleError(error, message, errorHelper.types.BAD_REQUEST, Log)
    }
    catch(error) {
      return Q.reject(error);
    }
  }
}

/**
 * Deletes a model document
 * @param model: A mongoose model.
 * @param _id: The document id.
 * @param payload: Data used to determine a soft or hard delete.
 * @param Log: A logging object.
 * @returns {object} A promise returning true if the delete succeeds.
 */
function _delete(model, _id, payload, Log) {
  try {
    var promise = {};
    if (model.routeOptions && model.routeOptions.delete && model.routeOptions.delete.pre) {
      promise = model.routeOptions.delete.pre(payload, Log);
    }
    else {
      promise = Q.when();
    }

    return promise
        .then(function () {

          if (config.enableSoftDelete && !(payload && payload.hardDelete)) {
            promise = model.findByIdAndUpdate(_id, { isDeleted: true, deletedAt: new Date() });
          }
          else {
            promise = model.findByIdAndRemove(_id);
          }
          return promise
              .then(function (deleted) {//TODO: clean up associations/set rules for ON DELETE CASCADE/etc.
                if (deleted) {
                  //TODO: add eventLogs

                  var promise = {};
                  if (model.routeOptions && model.routeOptions.delete && model.routeOptions.delete.post) {
                    promise = model.routeOptions.delete.post(payload, deleted, Log);
                  }
                  else {
                    promise = Q.when();
                  }

                  return promise
                      .then(function () {
                        return true;
                      })
                      .catch(function (error) {
                        const message = "There was a postprocessing error creating the resource.";
                        errorHelper.handleError(error, message, errorHelper.types.BAD_REQUEST, Log);
                      });
                }
                else {
                  const message = "No resource was found with that id.";
                  errorHelper.handleError(message, message, errorHelper.types.NOT_FOUND, Log);
                }
              })
              .catch(function (error) {
                const message = "There was an error deleting the resource.";
                errorHelper.handleError(error, message, errorHelper.types.SERVER_TIMEOUT, Log);
              });
        })
        .catch(function (error) {
          const message = "There was a preprocessing error deleting the resource.";
          errorHelper.handleError(error, message, errorHelper.types.BAD_REQUEST, Log);
        });
  }
  catch(error) {
    const message = "There was an error processing the request.";
    try {
      errorHelper.handleError(error, message, errorHelper.types.BAD_REQUEST, Log)
    }
    catch(error) {
      return Q.reject(error);
    }
  }
}

/**
 * Adds an association to a document
 * @param ownerModel: The model that is being added to.
 * @param ownerId: The id of the owner document.
 * @param childModel: The model that is being added.
 * @param childId: The id of the child document.
 * @param associationName: The name of the association from the ownerModel's perspective.
 * @param payload: Either an id or an object containing an id and extra linking-model fields.
 * @param Log: A logging object
 * @returns {object} A promise returning true if the add succeeds.
 */
function _addOne(ownerModel, ownerId, childModel, childId, associationName, payload, Log) {
  try {
    return ownerModel.findOne({ '_id': ownerId })
        .then(function (ownerObject) {
          if (ownerObject) {
            if (!payload) {
              payload = {};
            }
            payload.childId = childId;
            payload = [payload];
            return _setAssociation(ownerModel, ownerObject, childModel, childId, associationName, payload, Log)
                .then(function() {
                  return true;
                })
                .catch(function (error) {
                  const message = "There was a database error while setting the association.";
                  errorHelper.handleError(error, message, errorHelper.types.GATEWAY_TIMEOUT, Log);
                });
          }
          else {
            const message = "No owner resource was found with that id.";
            errorHelper.handleError(message, message, errorHelper.types.NOT_FOUND, Log);
          }
        })
  }
  catch(error) {
    const message = "There was an error processing the request.";
    try {
      errorHelper.handleError(error, message, errorHelper.types.BAD_REQUEST, Log)
    }
    catch(error) {
      return Q.reject(error);
    }
  }
}

/**
 * Adds an association to a document
 * @param ownerModel: The model that is being added to.
 * @param ownerId: The id of the owner document.
 * @param childModel: The model that is being added.
 * @param childId: The id of the child document.
 * @param associationName: The name of the association from the ownerModel's perspective.
 * @param Log: A logging object
 * @returns {object} A promise returning true if the add succeeds.
 */
function _removeOne(ownerModel, ownerId, childModel, childId, associationName, Log) {
  try {
    return ownerModel.findOne({ '_id': ownerId })
        .then(function (ownerObject) {
          if (ownerObject) {
            _removeAssociation(ownerModel, ownerObject, childModel, childId, associationName, Log)
                .then(function() {
                  return true;
                })
                .catch(function (error) {
                  const message = "There was a database error while removing the association.";
                  errorHelper.handleError(error, message, errorHelper.types.GATEWAY_TIMEOUT, Log);
                });
          }
          else {
            const message = "No owner resource was found with that id.";
            errorHelper.handleError(message, message, errorHelper.types.NOT_FOUND, Log);
          }
        })
  }
  catch(error) {
    const message = "There was an error processing the request.";
    try {
      errorHelper.handleError(error, message, errorHelper.types.BAD_REQUEST, Log)
    }
    catch(error) {
      return Q.reject(error);
    }
  }
}

/**
 * Adds multiple associations to a document
 * @param ownerModel: The model that is being added to.
 * @param ownerId: The id of the owner document.
 * @param childModel: The model that is being added.
 * @param associationName: The name of the association from the ownerModel's perspective.
 * @param payload: Either a list of id's or a list of id's along with extra linking-model fields.
 * @param Log: A logging object
 * @returns {object} A promise returning true if the add succeeds.
 */
function _addMany(ownerModel, ownerId, childModel, associationName, payload, Log) {
  try {
    return ownerModel.findOne({ '_id': ownerId })
        .then(function (ownerObject) {
          if (ownerObject) {
            var childIds = [];
            if (typeof payload[0] === 'string' || payload[0] instanceof String) {//EXPL: the payload is an array of Ids
              childIds = payload;
            }
            else {//EXPL: the payload contains extra fields
              childIds = payload.map(function(object) {
                return object.childId;
              });
            }

            var promise_chain = Q.when();

            childIds.forEach(function(childId) {
              var promise_link = function() {
                var deferred = Q.defer();
                _setAssociation(ownerModel, ownerObject, childModel, childId, associationName, payload, Log)
                    .then(function(result) {
                      deferred.resolve(result);
                    })
                    .catch(function (error) {
                      const message = "There was a database error while setting the associations.";
                      errorHelper.handleError(error, message, errorHelper.types.GATEWAY_TIMEOUT, Log);
                    });
                return deferred.promise;
              };

              promise_chain = promise_chain.then(promise_link);
            });

            return promise_chain
                .then(function() {
                  return true;
                })
                .catch(function (error) {
                  const message = "There was a database error while setting the associations.";
                  errorHelper.handleError(error, message, errorHelper.types.GATEWAY_TIMEOUT, Log);
                });
          }
          else {
            const message = "No owner resource was found with that id.";
            errorHelper.handleError(message, message, errorHelper.types.NOT_FOUND, Log);
          }
        })
  }
  catch(error) {
    const message = "There was an error processing the request.";
    try {
      errorHelper.handleError(error, message, errorHelper.types.BAD_REQUEST, Log)
    }
    catch(error) {
      return Q.reject(error);
    }
  }
}

/**
 * Get all of the associations for a document
 * @param ownerModel: The model that is being added to.
 * @param ownerId: The id of the owner document.
 * @param childModel: The model that is being added.
 * @param associationName: The name of the association from the ownerModel's perspective.
 * @param query: query parameters to be converted to a mongoose query.
 * @param Log: A logging object
 * @returns {object} A promise returning true if the add succeeds.
 */
function _getAll(ownerModel, ownerId, childModel, associationName, query, Log) {
  try {

    var association = ownerModel.routeOptions.associations[associationName];
    var foreignField = association.foreignField;

    var ownerRequest = { query: {} };
    ownerRequest.query.$embed = associationName;
    ownerRequest.query.populateSelect = "_id";
    if (foreignField) {
      ownerRequest.query.populateSelect = ownerRequest.query.populateSelect + "," + foreignField;
    }

    //EXPL: In order to allow for fully querying against the association data, we first embed the
    //associations to get a list of _ids and extra fields. We then leverage _list
    //to perform the full query.  Finally the extra fields (if they exist) are added to the final result
    var mongooseQuery = ownerModel.findOne({ '_id': ownerId });
    mongooseQuery = QueryHelper.createMongooseQuery(ownerModel, ownerRequest.query, mongooseQuery, Log);
    return mongooseQuery.exec()
        .then(function (result) {
          result = result[associationName];
          var childIds = [];
          var many_many = false;
          if (association.type === "MANY_MANY") {
            childIds = result.map(function(object) {
              return object[association.model]._id;
            });
            many_many = true;
          }
          else {
            childIds = result.map(function(object) {
              return object._id;
            });
          }

          query.$where = extend({'_id': { $in: childIds }}, query.$where);

          // var promise = generateListHandler(childModel, options, Log)(request, reply);
          var promise = _list(childModel, query, Log);

          if (many_many && association.linkingModel) {//EXPL: we have to manually insert the extra fields into the result
            var extraFieldData = result;
            return promise
                .then(function(result) {
                  result.forEach(function(object) {
                    var data = extraFieldData.find(function(data) {
                      return data[association.model]._id.toString() === object._id
                    });
                    var fields = data.toJSON();
                    delete fields._id;
                    delete fields[association.model];
                    object[association.linkingModel] = fields;
                  });

                  return result;
                })
                .catch(function (error) {
                  const message = "There was an error processing the request.";
                  errorHelper.handleError(error, message, errorHelper.types.BAD_REQUEST, Log);
                });
          }
          else {
            return promise
                .then(function(result) {
                  return result;
                })
                .catch(function (error) {
                  const message = "There was an error processing the request.";
                  errorHelper.handleError(error, message, errorHelper.types.BAD_REQUEST, Log);
                });
          }
        });
  }
  catch(error) {
    const message = "There was an error processing the request.";
    try {
      errorHelper.handleError(error, message, errorHelper.types.BAD_REQUEST, Log)
    }
    catch(error) {
      return Q.reject(error);
    }
  }
}

/**
 * Create an association instance between two resources
 * @param ownerModel
 * @param ownerObject
 * @param childModel
 * @param childId
 * @param associationName
 * @param payload
 * @param Log
 * @returns {*|promise}
 * @private
 */
function _setAssociation(ownerModel, ownerObject, childModel, childId, associationName, payload, Log) {
  var deferred = Q.defer();

  childModel.findOne({ '_id': childId })
      .then(function (childObject) {
        if (childObject) {
          var promise = {};
          var association = ownerModel.routeOptions.associations[associationName];
          var extraFields = false;
          if (association.type === "ONE_MANY") {//EXPL: one-many associations are virtual, so only update the child reference
            childObject[association.foreignField] = ownerObject._id;
            promise = childObject.save();
          }
          else if (association.type === "MANY_MANY") {
            if (typeof payload[0] === 'string' || payload[0] instanceof String) {//EXPL: the payload is an array of Ids. No extra fields
              payload = {};

              extraFields = false;
            }
            else {
              payload = payload.filter(function(object) {//EXPL: the payload contains extra fields
                return object.childId === childObject._id.toString();
              });

              payload = payload[0];
              delete payload.childId;

              extraFields = true;
            }
            payload[childModel.modelName] = childObject._id;

            var duplicate = ownerObject[associationName].filter(function (associationObject) {
              return associationObject[childModel.modelName].toString() === childId;
            });
            duplicate = duplicate[0];

            var duplicateIndex = ownerObject[associationName].indexOf(duplicate);

            if (duplicateIndex < 0) {//EXPL: if the association doesn't already exist, create it, otherwise update the extra fields
              ownerObject[associationName].push(payload);
            }
            else if (extraFields) {//EXPL: only update if there are extra fields TODO: reference MANY_MANY bug where updating association that's just an id (i.e. no extra fields) causes an error and reference this as the fix
              payload._id = ownerObject[associationName][duplicateIndex]._id;//EXPL: retain the association instance id for consistency
              ownerObject[associationName][duplicateIndex] = payload;
            }

            payload = extend({}, payload);//EXPL: break the reference to the original payload
            delete payload._id;

            delete payload[childModel.modelName];
            payload[ownerModel.modelName] = ownerObject._id;
            var childAssociation = {};
            var childAssociations = childModel.routeOptions.associations;
            for (var childAssociationKey in childAssociations) {
              var association = childAssociations[childAssociationKey];
              if (association.model === ownerModel.modelName && association.type === "MANY_MANY") {//TODO: Add issue referencing a conflict when a model has two associations of the same model and one is a MANY_MANY, and reference this change as the fix
                childAssociation = association;
              }
            }
            var childAssociationName = childAssociation.include.as;

            if (!childObject[childAssociationName]) {
              throw childAssociationName + " association does not exist.";
            }

            duplicate = childObject[childAssociationName].filter(function (associationObject) {
              return associationObject[ownerModel.modelName].toString() === ownerObject._id.toString();
            });
            duplicate = duplicate[0];

            duplicateIndex = childObject[childAssociationName].indexOf(duplicate);

            if (duplicateIndex < 0) {//EXPL: if the association doesn't already exist, create it, otherwise update the extra fields
              childObject[childAssociationName].push(payload);
            }
            else {
              payload._id = childObject[childAssociationName][duplicateIndex]._id;//EXPL: retain the association instance id for consistency
              childObject[childAssociationName][duplicateIndex] = payload;
            }

            promise = Q.all(ownerObject.save(), childObject.save());
          }
          else {
            deferred.reject("Association type incorrectly defined.");
            return deferred.promise;
          }

          promise
              .then(function() {
                //TODO: add eventLogs
                //TODO: allow eventLogs to log/support association extra fields
                deferred.resolve();
              })
              .catch(function (error) {
                Log.error(error);
                deferred.reject(error);
              });
        }
        else {
          deferred.reject("Child object not found.");
        }
      })
      .catch(function (error) {
        Log.error("error: ", error);
        deferred.reject(error);
      });

  return deferred.promise;
}

/**
 * Remove an association instance between two resources
 * @param request
 * @param server
 * @param ownerModel
 * @param ownerObject
 * @param childModel
 * @param childId
 * @param associationName
 * @param options
 * @param Log
 * @returns {*|promise}
 */
function _removeAssociation(ownerModel, ownerObject, childModel, childId, associationName, Log) {
  var deferred = Q.defer();

  childModel.findOne({ '_id': childId })
      .then(function (childObject) {
        if (childObject) {
          var promise = {};
          var association = ownerModel.routeOptions.associations[associationName];
          var associationType = association.type;
          if (associationType === "ONE_MANY") {//EXPL: one-many associations are virtual, so only update the child reference
            // childObject[association.foreignField] = null; //TODO: set reference to null instead of deleting it?
            childObject[association.foreignField] = undefined;
            promise = childObject.save()
          }
          else if (associationType === "MANY_MANY") {//EXPL: remove references from both models

            //EXPL: remove the associated child from the owner
            var deleteChild = ownerObject[associationName].filter(function(child) {
              return child[childModel.modelName].toString() === childObject._id.toString();
            });
            deleteChild = deleteChild[0];

            var index = ownerObject[associationName].indexOf(deleteChild);
            if (index > -1) {
              ownerObject[associationName].splice(index, 1);
            }

            //EXPL: get the child association name
            var childAssociation = {};
            var childAssociations = childModel.routeOptions.associations;
            for (var childAssociationKey in childAssociations) {
              var association = childAssociations[childAssociationKey];
              if (association.model === ownerModel.modelName) {
                childAssociation = association;
              }
            }
            var childAssociationName = childAssociation.include.as;

            //EXPL: remove the associated owner from the child
            var deleteOwner = childObject[childAssociationName].filter(function(owner) {
              return owner[ownerModel.modelName].toString() === ownerObject._id.toString();
            });
            deleteOwner = deleteOwner[0];

            index = childObject[childAssociationName].indexOf(deleteOwner);
            if (index > -1) {
              childObject[childAssociationName].splice(index, 1);
            }

            promise = Q.all(ownerObject.save(), childObject.save());
          }
          else {
            deferred.reject("Association type incorrectly defined.");
            return deferred.promise;
          }

          promise
              .then(function() {
                //TODO: add eventLogs
                deferred.resolve();
              })
              .catch(function (error) {
                Log.error(error);
                deferred.reject(error);
              });
        }
        else {
          deferred.reject("Child object not found.");
        }
      })
      .catch(function (error) {
        Log.error(error);
        deferred.reject(error);
      });

  return deferred.promise;
}
