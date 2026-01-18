'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class utm_links extends Model {
    static associate(models) {


      // Define association with utm_tracking
      utm_links.hasMany(models.utm_tracking, {
        foreignKey: {
          name: 'utm_link_id',
          allowNull: false
        },
        onDelete:"CASCADE",
        as: 'tracking'
      });


    }
  }

  utm_links.init({
    code: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true,
      validate: {
        notEmpty: true
      }
    },
    destination_url: {
      type: DataTypes.TEXT,
      allowNull: false,
      validate: {
        notEmpty: true,
        isUrl: true
      }
    },
    utm_source: {
      type: DataTypes.STRING(255),
      allowNull: false,
      validate: {
        notEmpty: true
      }
    },
    utm_medium: {
      type: DataTypes.STRING(255),
      allowNull: false,
      validate: {
        notEmpty: true
      }
    },
    utm_campaign: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    utm_content: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true
    },
    created_by: {
      type: DataTypes.STRING(255),
      allowNull: true
    }
  }, {
    sequelize,
    modelName: 'utm_links',
    tableName: 'utm_links',
    timestamps: true,
    underscored: true,
    indexes: [
      {
        unique: true,
        fields: ['code']
      }
    ]
  });

  return utm_links;
};