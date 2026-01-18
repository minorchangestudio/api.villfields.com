'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class utm_tracking extends Model {
    static associate(models) {
      // Define association with utm_links
      utm_tracking.belongsTo(models.utm_links, {
        foreignKey: {
          name: 'utm_link_id',
          allowNull: false
        },
        onDelete:"CASCADE",
        as: 'utmLink'
      });
    }
  }

  utm_tracking.init({
    utm_link_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'utm_links',
        key: 'id'
      }
    },
    code: {
      type: DataTypes.STRING(50),
      allowNull: false
    },
    clicked_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    },
    ip_address: {
      type: DataTypes.STRING(45),
      allowNull: true
    },
    user_agent: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    referer: {
      type: DataTypes.STRING(500),
      allowNull: true
    },
    country: {
      type: DataTypes.STRING(2),
      allowNull: true
    },
    city: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    device_type: {
      type: DataTypes.STRING(50),
      allowNull: true
    },
    browser: {
      type: DataTypes.STRING(100),
      allowNull: true
    },
    os: {
      type: DataTypes.STRING(100),
      allowNull: true
    },
    geodata: {
      type: DataTypes.JSON,
      allowNull: true,
      comment: 'Full geolocation data from IP address'
    }
  }, {
    sequelize,
    modelName: 'utm_tracking',
    tableName: 'utm_tracking',
    timestamps: false,
    underscored: true
  });

  return utm_tracking;
};
