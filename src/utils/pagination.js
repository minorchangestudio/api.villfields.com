/**
 * Pagination Utility
 * 
 * Provides reusable pagination functions for Sequelize queries
 * Following best practices for RESTful API pagination
 */

/**
 * Extract pagination parameters from request query
 * @param {Object} query - Request query object
 * @param {Object} options - Configuration options
 * @param {number} options.defaultPage - Default page number (default: 1)
 * @param {number} options.defaultLimit - Default items per page (default: 10)
 * @param {number} options.maxLimit - Maximum items per page (default: 100)
 * @param {number} options.minLimit - Minimum items per page (default: 1)
 * @returns {Object} Pagination parameters { page, limit, offset }
 */
const getPaginationParams = (query, options = {}) => {
  const {
    defaultPage = 1,
    defaultLimit = 10,
    maxLimit = 100,
    minLimit = 1
  } = options;

  // Extract and validate page
  let page = parseInt(query.page, 10);
  if (isNaN(page) || page < 1) {
    page = defaultPage;
  }

  // Extract and validate limit
  let limit = parseInt(query.limit, 10);
  if (isNaN(limit) || limit < minLimit) {
    limit = defaultLimit;
  }
  if (limit > maxLimit) {
    limit = maxLimit;
  }

  // Calculate offset
  const offset = (page - 1) * limit;

  return {
    page,
    limit,
    offset
  };
};

/**
 * Format pagination metadata for response
 * @param {number} count - Total number of records
 * @param {number} page - Current page number
 * @param {number} limit - Items per page
 * @returns {Object} Pagination metadata object
 */
const formatPaginationMeta = (count, page, limit) => {
  const pageCount = Math.ceil(count / limit) || 1;
  const offset = (page - 1) * limit;

  return {
    pagination: {
      count,                    // Total number of records
      page,                     // Current page number
      pageCount,                // Total number of pages
      limit,                    // Items per page
      from: count > 0 ? offset + 1 : 0,  // Starting record number (1-based)
      to: count > 0 ? Math.min(offset + limit, count) : 0  // Ending record number (1-based)
    }
  };
};

/**
 * Format successful paginated response
 * @param {Object} res - Express response object
 * @param {Object} result - Sequelize findAndCountAll result { count, rows }
 * @param {number} page - Current page number
 * @param {number} limit - Items per page
 * @param {Object} options - Additional response options
 * @param {string} options.status - Response status (default: "success")
 * @param {string} options.message - Response message
 * @param {number} options.statusCode - HTTP status code (default: 200)
 * @returns {Object} Express response
 */
const sendPaginatedResponse = (res, result, page, limit, options = {}) => {
  const {
    status = "success",
    message = "Data retrieved successfully",
    statusCode = 200
  } = options;

  const metadata = formatPaginationMeta(result.count, page, limit);

  return res.status(statusCode).json({
    status,
    message,
    data: result.rows,
    metadata
  });
};

/**
 * Helper function to get pagination options for Sequelize findAndCountAll
 * Use this directly in your query options
 * @param {Object} query - Request query object
 * @param {Object} options - Configuration options (same as getPaginationParams)
 * @returns {Object} Sequelize pagination options { limit, offset, pagination }
 */
const getSequelizePagination = (query, options = {}) => {
  const pagination = getPaginationParams(query, options);
  
  return {
    limit: pagination.limit,
    offset: pagination.offset,
    pagination: {
      page: pagination.page,
      limit: pagination.limit
    }
  };
};

module.exports = {
  getPaginationParams,
  formatPaginationMeta,
  sendPaginatedResponse,
  getSequelizePagination
};
