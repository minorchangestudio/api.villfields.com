/**
 * Generates a unique alphanumeric code for UTM short links
 * @param {number} length - Length of the code (default: 8)
 * @returns {string} - Generated code
 */
const generateUniqueCode = (length = 8) => {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let code = '';
  
  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * characters.length);
    code += characters[randomIndex];
  }
  
  return code;
};

/**
 * Generates a unique code that doesn't exist in the database
 * @param {Object} model - Sequelize model to check against
 * @param {number} length - Length of the code (default: 8)
 * @param {number} maxRetries - Maximum number of retries (default: 10)
 * @returns {Promise<string>} - Unique code
 */
const generateUniqueCodeWithRetry = async (model, length = 8, maxRetries = 10) => {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const code = generateUniqueCode(length);
    
    const existing = await model.findOne({
      where: { code }
    });
    
    if (!existing) {
      return code;
    }
  }
  
  // If all retries failed, generate a longer code
  return generateUniqueCode(length + 2);
};

module.exports = {
  generateUniqueCode,
  generateUniqueCodeWithRetry
};
