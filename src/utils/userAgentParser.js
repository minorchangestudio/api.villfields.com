/**
 * Simple User Agent Parser
 * Extracts device type, browser, and OS from user agent string
 */

/**
 * Parse user agent to extract device type, browser, and OS
 * @param {string} userAgent - User agent string
 * @returns {Object} Parsed information { deviceType, browser, os }
 */
const parseUserAgent = (userAgent) => {
  if (!userAgent) {
    return {
      deviceType: null,
      browser: null,
      os: null
    }
  }

  const ua = userAgent.toLowerCase()

  // Detect device type
  let deviceType = 'desktop'
  if (/mobile|android|iphone|ipod|blackberry|windows phone/.test(ua)) {
    deviceType = 'mobile'
  } else if (/tablet|ipad/.test(ua)) {
    deviceType = 'tablet'
  }

  // Detect browser
  let browser = 'unknown'
  if (ua.includes('chrome') && !ua.includes('edg')) {
    browser = 'Chrome'
  } else if (ua.includes('firefox')) {
    browser = 'Firefox'
  } else if (ua.includes('safari') && !ua.includes('chrome')) {
    browser = 'Safari'
  } else if (ua.includes('edg')) {
    browser = 'Edge'
  } else if (ua.includes('opera') || ua.includes('opr')) {
    browser = 'Opera'
  } else if (ua.includes('msie') || ua.includes('trident')) {
    browser = 'Internet Explorer'
  } else if (ua.includes('brave')) {
    browser = 'Brave'
  }

  // Detect OS
  let os = 'unknown'
  if (ua.includes('windows')) {
    if (ua.includes('windows nt 10')) {
      os = 'Windows 10/11'
    } else if (ua.includes('windows nt 6.3')) {
      os = 'Windows 8.1'
    } else if (ua.includes('windows nt 6.2')) {
      os = 'Windows 8'
    } else if (ua.includes('windows nt 6.1')) {
      os = 'Windows 7'
    } else {
      os = 'Windows'
    }
  } else if (ua.includes('mac os x') || ua.includes('macintosh')) {
    if (ua.includes('iphone') || ua.includes('ipad')) {
      os = 'iOS'
    } else {
      os = 'macOS'
    }
  } else if (ua.includes('android')) {
    os = 'Android'
  } else if (ua.includes('linux')) {
    os = 'Linux'
  } else if (ua.includes('iphone')) {
    os = 'iOS'
  } else if (ua.includes('ipad')) {
    os = 'iOS'
  }

  return {
    deviceType,
    browser,
    os
  }
}

module.exports = {
  parseUserAgent
}
