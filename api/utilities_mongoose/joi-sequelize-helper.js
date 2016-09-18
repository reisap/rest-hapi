/**
 * Created by zacharysmith on 11/12/15.
 */
var Joi = require('joi');
var _ = require('lodash');
var assert = require('assert');
var mongoose = require('mongoose');

module.exports = function () {

  return {
    generateJoiReadModel:function(model){
      var readModelBase = {};
      
      var fields = model.schema.paths;

      for(var fieldName in fields){
        var field = fields[fieldName].options;

        if(field.readModel){
          readModelBase[fieldName] = field.readModel;
        }else if(field.allowOnRead !== false && field.exclude !== true){
          var attributeReadModel = this.generateJoiModelFromAttribute(field);

          if(field.requireOnRead === true){
            attributeReadModel = attributeReadModel.required();
          }else{
            attributeReadModel = attributeReadModel.optional();
          }

          readModelBase[fieldName] = attributeReadModel;
        }
      }
      
      var modelMethods = model.schema.methods;
      
      if(modelMethods.routeOptions && modelMethods.routeOptions.associations){
        for(var associationName in modelMethods.routeOptions.associations){
          var association = modelMethods.routeOptions.associations[associationName];

          if(association.type == "MANY"){
            readModelBase[associationName] = Joi.array().items(Joi.object().unknown()).optional();
          }else{
            readModelBase[associationName] = Joi.object().unknown().allow(null).optional();
          }
        }
      }

      if(modelMethods.extraReadModelAttributes){
        _.extend(readModelBase, modelMethods.extraReadModelAttributes);
      }

      var readModel = Joi.object(readModelBase).meta({
        className: model.modelName + "ReadModel"
      });

      return readModel;
    },
    generateJoiUpdateModel:function(model){
      var updateModelBase = {};

      var fields = model.schema.paths;

      for(var fieldName in fields){
        var field = fields[fieldName].options;

        if(field.updateModel){
          updateModelBase[fieldName] = field.updateModel;
        }else if(!field.primaryKey && field.allowOnUpdate !== false){
          var attributeUpdateModel = this.generateJoiModelFromAttribute(field);

          if(field.requireOnUpdate === true){
            attributeUpdateModel = attributeUpdateModel.required();
          }else{
            attributeUpdateModel = attributeUpdateModel.optional();
          }

          updateModelBase[fieldName] = attributeUpdateModel;
        }
      }

      var modelMethods = model.schema.methods;

      if(modelMethods.extraUpdateModelAttributes){
        _.extend(updateModelBase, modelMethods.extraUpdateModelAttributes);
      }

      var updateModel = Joi.object(updateModelBase).meta({
        className: model.modelName + "UpdateModel"
      }).optional();

      return updateModel;
    },
    generateJoiCreateModel:function(model){
      var createModelBase = {};

      var fields = model.schema.paths;

      for(var fieldName in fields){

        var field = fields[fieldName].options;

        if(field.createModel){
          createModelBase[fieldName] = field.createModel;
        }else if(!field.primaryKey && field.allowOnCreate !== false){
          var attributeCreateModel = this.generateJoiModelFromAttribute(field);

          if((field.allowNull === false && !field.defaultValue && !field._autoGenerated) || field.requireOnCreate === true){
            //console.log("required: ", attributeName);

            //console.log(attribute);

            attributeCreateModel = attributeCreateModel.required();
          }else{
            //console.log("optional: ", attributeName);

            attributeCreateModel = attributeCreateModel.optional();
          }

          createModelBase[fieldName] = attributeCreateModel;
        }
      }

      var modelMethods = model.schema.methods;

      if(modelMethods.extraCreateModelAttributes){
        _.extend(createModelBase, modelMethods.extraCreateModelAttributes);
      }

      var createModel = Joi.object(createModelBase).meta({
        className: model.modelName + "CreateModel"
      });

      return createModel;
    },
    generateJoiModelFromAttribute:function(attribute){
      var model;

      switch(attribute.type.schemaName){
        case 'ObjectId':
          model = Joi.string();//TODO: properly validate ObjectIds
          break;
        case 'Boolean':
          model = Joi.bool();
          break;
        case 'Number':
          model = Joi.number();
          break;
        // case Sequelize.INTEGER.key:
        //   model = Joi.number().integer();
        //   break;
        case 'Date':
          model = Joi.date();
          break;
        // case Sequelize.ENUM.key:
        //   model = Joi.string().valid(attribute.values);
        //   break;
        default:
          model = Joi.string();

          if(!attribute.notEmpty){
            model = model.allow('');
          }

          break;
      }

      if(attribute.allowNull){
        model = model.allow(null);
      }

      return model;
    }
  }
};