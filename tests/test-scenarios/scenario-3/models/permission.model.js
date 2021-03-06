'use strict';

module.exports = function (mongoose) {
  var modelName = "permission";
  var Types = mongoose.Schema.Types;
  var Schema = new mongoose.Schema({
    name: {
      type: Types.String,
      required: true
    },
    description: {
      type: Types.String
    }
  }, { collection: modelName });
  Schema.statics = {
    collectionName:modelName,
    routeOptions: {
      associations: {
        users: {
          type: "MANY_MANY",
          alias: "user",
          model: "user",
          linkingModel: "user_permission"
        },
        roles: {
          type: "MANY_MANY",
          alias: "role",
          model: "role"
        }
      }
    }
  };

  return Schema;
};