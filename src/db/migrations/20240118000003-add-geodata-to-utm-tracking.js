'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Add geodata column as JSON (works for MySQL 5.7+ and PostgreSQL)
    // For older MySQL versions, it will fall back to TEXT
    await queryInterface.addColumn('utm_tracking', 'geodata', {
      type: Sequelize.JSON,
      allowNull: true,
      comment: 'Full geolocation data from IP address'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('utm_tracking', 'geodata');
  }
};
