'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // First, drop existing columns if they exist (for development)
    try {
      await queryInterface.removeColumn('utm_links', 'firstName');
      await queryInterface.removeColumn('utm_links', 'lastName');
      await queryInterface.removeColumn('utm_links', 'email');
    } catch (error) {
      // Columns might not exist, that's okay
      console.log('Old columns may not exist, continuing...');
    }

    // Add new columns
    await queryInterface.addColumn('utm_links', 'code', {
      type: Sequelize.STRING(50),
      allowNull: false,
      unique: true,
      after: 'id'
    });

    await queryInterface.addColumn('utm_links', 'destination_url', {
      type: Sequelize.TEXT,
      allowNull: false,
      after: 'code'
    });

    await queryInterface.addColumn('utm_links', 'utm_source', {
      type: Sequelize.STRING(255),
      allowNull: false,
      after: 'destination_url'
    });

    await queryInterface.addColumn('utm_links', 'utm_medium', {
      type: Sequelize.STRING(255),
      allowNull: false,
      after: 'utm_source'
    });

    await queryInterface.addColumn('utm_links', 'utm_campaign', {
      type: Sequelize.STRING(255),
      allowNull: true,
      after: 'utm_medium'
    });

    await queryInterface.addColumn('utm_links', 'utm_content', {
      type: Sequelize.STRING(255),
      allowNull: true,
      after: 'utm_campaign'
    });

    await queryInterface.addColumn('utm_links', 'is_active', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      after: 'utm_content'
    });

    await queryInterface.addColumn('utm_links', 'created_by', {
      type: Sequelize.STRING(255),
      allowNull: true,
      after: 'is_active'
    });

    // Add index on code
    await queryInterface.addIndex('utm_links', ['code'], {
      unique: true,
      name: 'utm_links_code_unique'
    });
  },

  async down(queryInterface, Sequelize) {
    // Remove indexes
    await queryInterface.removeIndex('utm_links', 'utm_links_code_unique');

    // Remove new columns
    await queryInterface.removeColumn('utm_links', 'created_by');
    await queryInterface.removeColumn('utm_links', 'is_active');
    await queryInterface.removeColumn('utm_links', 'utm_content');
    await queryInterface.removeColumn('utm_links', 'utm_campaign');
    await queryInterface.removeColumn('utm_links', 'utm_medium');
    await queryInterface.removeColumn('utm_links', 'utm_source');
    await queryInterface.removeColumn('utm_links', 'destination_url');
    await queryInterface.removeColumn('utm_links', 'code');

    // Restore old columns
    await queryInterface.addColumn('utm_links', 'firstName', {
      type: Sequelize.STRING,
      allowNull: false
    });

    await queryInterface.addColumn('utm_links', 'lastName', {
      type: Sequelize.STRING,
      allowNull: true
    });

    await queryInterface.addColumn('utm_links', 'email', {
      type: Sequelize.STRING,
      allowNull: true
    });
  }
};
