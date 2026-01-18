'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('utm_tracking', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      utm_link_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'utm_links',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      code: {
        type: Sequelize.STRING(50),
        allowNull: false
      },
      clicked_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      ip_address: {
        type: Sequelize.STRING(45),
        allowNull: true
      },
      user_agent: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      referer: {
        type: Sequelize.STRING(500),
        allowNull: true
      },
      country: {
        type: Sequelize.STRING(2),
        allowNull: true
      },
      city: {
        type: Sequelize.STRING(255),
        allowNull: true
      },
      device_type: {
        type: Sequelize.STRING(50),
        allowNull: true
      },
      browser: {
        type: Sequelize.STRING(100),
        allowNull: true
      },
      os: {
        type: Sequelize.STRING(100),
        allowNull: true
      }
    });

    // Add indexes
    await queryInterface.addIndex('utm_tracking', ['utm_link_id'], {
      name: 'utm_tracking_utm_link_id_idx'
    });

    await queryInterface.addIndex('utm_tracking', ['code'], {
      name: 'utm_tracking_code_idx'
    });

    await queryInterface.addIndex('utm_tracking', ['clicked_at'], {
      name: 'utm_tracking_clicked_at_idx'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('utm_tracking');
  }
};
